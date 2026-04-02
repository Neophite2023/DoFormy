import http.server
import json
import os
import sqlite3
import ssl
import threading
import time
import webbrowser

PORT = 8000
DB_FILE = "doformy.db"
HOST_NAME = "doma-pc.tail85a624.ts.net"
URL = f"https://{HOST_NAME}:{PORT}/desktop/index.html"

DEFAULT_LEVEL_NAME = "F\u00e1za 1: Z\u00e1klady"
LEGACY_LEVEL_NAME = "F\u00e1za 1: Adapt\u00e1cia"
DEFAULT_START_DATE = "2023-10-27T12:00:00.000Z"


def normalize_sync_meta(record):
    source = record if isinstance(record, dict) else {}
    sync_meta = source.get("sync_meta") or {}
    fallback = int(source.get("last_updated") or 0)

    def sync_time(key):
        value = sync_meta.get(key)
        return fallback if value is None else int(value)

    return {
        "steps": sync_time("steps"),
        "habit": sync_time("habit"),
        "workout": sync_time("workout"),
        "weight": sync_time("weight"),
        "water": sync_time("water"),
    }


def normalize_history_record(record):
    source = record if isinstance(record, dict) else {}
    workout = source.get("workout") if isinstance(source.get("workout"), list) else []
    if not workout:
        workout = []
    weight = source.get("weight")
    return {
        "steps": int(source.get("steps") or 0),
        "habit": bool(source.get("habit")),
        "workout": [
            {"name": item.get("name"), "reps": int(item.get("reps") or 0)}
            for item in workout
            if isinstance(item, dict) and item.get("name")
        ],
        "weight": None if weight in (None, "") else float(weight),
        "water": int(source.get("water") or 0),
        "last_updated": int(source.get("last_updated") or 0),
        "sync_meta": normalize_sync_meta(source),
    }


def history_row_to_record(row):
    if not row:
        return None

    sync_meta_raw = row["sync_meta_json"] if "sync_meta_json" in row.keys() else "{}"
    try:
        sync_meta = json.loads(sync_meta_raw) if sync_meta_raw else {}
    except json.JSONDecodeError:
        sync_meta = {}

    return normalize_history_record(
        {
            "steps": row["steps"],
            "habit": bool(row["habit"]),
            "workout": json.loads(row["workout_json"]) if row["workout_json"] else [],
            "weight": row["weight"],
            "water": row["water"],
            "last_updated": row["last_updated"],
            "sync_meta": sync_meta,
        }
    )


def merge_workout(local_workout, server_workout):
    if not local_workout:
        return server_workout or []
    if not server_workout:
        return local_workout or []

    merged = [dict(item) for item in server_workout]
    for local_exercise in local_workout:
        idx = next((i for i, item in enumerate(merged) if item.get("name") == local_exercise.get("name")), -1)
        if idx >= 0:
            merged[idx]["reps"] = max(int(merged[idx].get("reps") or 0), int(local_exercise.get("reps") or 0))
        else:
            merged.append(dict(local_exercise))
    return merged


def pick_latest_value(local_value, server_value, local_time, server_time):
    local_defined = local_value is not None
    server_defined = server_value is not None

    if not local_defined:
        return server_value
    if not server_defined:
        return local_value
    if local_time > server_time:
        return local_value
    if server_time > local_time:
        return server_value
    return local_value


def merge_day_record(local_record, server_record):
    if not server_record:
        return normalize_history_record(local_record)
    if not local_record:
        return normalize_history_record(server_record)

    local = normalize_history_record(local_record)
    server = normalize_history_record(server_record)
    local_meta = local["sync_meta"]
    server_meta = server["sync_meta"]

    return {
        "steps": max(local["steps"], server["steps"]),
        "habit": local["habit"] or server["habit"],
        "workout": merge_workout(local["workout"], server["workout"]),
        "weight": pick_latest_value(local["weight"], server["weight"], local_meta["weight"], server_meta["weight"]),
        "water": pick_latest_value(local["water"], server["water"], local_meta["water"], server_meta["water"]),
        "last_updated": max(
            local["last_updated"],
            server["last_updated"],
            local_meta["steps"],
            local_meta["habit"],
            local_meta["workout"],
            local_meta["weight"],
            local_meta["water"],
            server_meta["steps"],
            server_meta["habit"],
            server_meta["workout"],
            server_meta["weight"],
            server_meta["water"],
        ),
        "sync_meta": {
            "steps": max(local_meta["steps"], server_meta["steps"]),
            "habit": max(local_meta["habit"], server_meta["habit"]),
            "workout": max(local_meta["workout"], server_meta["workout"]),
            "weight": max(local_meta["weight"], server_meta["weight"]),
            "water": max(local_meta["water"], server_meta["water"]),
        },
    }


def merge_user(existing_user, incoming_user):
    existing = existing_user or {}
    incoming = incoming_user or {}
    existing_exp = int(existing.get("exp") or 0)
    incoming_exp = int(incoming.get("exp") or 0)
    incoming_level_name = incoming.get("levelName")
    existing_level_name = existing.get("levelName")
    existing_reset = int(existing.get("resetVersion") or 0)
    incoming_reset = int(incoming.get("resetVersion") or 0)

    return {
        "exp": max(existing_exp, incoming_exp),
        "levelName": incoming_level_name if incoming_exp >= existing_exp else existing_level_name or incoming_level_name or DEFAULT_LEVEL_NAME,
        "stepsGoal": int(incoming.get("stepsGoal") or existing.get("stepsGoal") or 6000),
        # startDate is server-controlled once initialized (avoid clients overwriting it during sync)
        "startDate": existing.get("startDate") or incoming.get("startDate") or DEFAULT_START_DATE,
        # resetVersion is monotonic; server uses it to signal clients to drop local test data after a reset.
        "resetVersion": max(existing_reset, incoming_reset),
    }


def save_history_row(cursor, date, record):
    cursor.execute(
        """
        INSERT OR REPLACE INTO history
        (date, steps, habit, workout_json, weight, water, last_updated, sync_meta_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            date,
            record.get("steps", 0),
            int(record.get("habit", False)),
            json.dumps(record.get("workout", []), ensure_ascii=False),
            record.get("weight"),
            record.get("water", 0),
            record.get("last_updated", 0),
            json.dumps(record.get("sync_meta", {}), ensure_ascii=False),
        ),
    )


def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY,
            exp INTEGER,
            levelName TEXT,
            stepsGoal INTEGER,
            startDate TEXT,
            resetVersion INTEGER DEFAULT 0
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS history (
            date TEXT PRIMARY KEY,
            steps INTEGER,
            habit INTEGER,
            workout_json TEXT,
            weight REAL,
            water INTEGER DEFAULT 0,
            last_updated INTEGER DEFAULT 0,
            sync_meta_json TEXT DEFAULT '{}'
        )
        """
    )

    cursor.execute("SELECT COUNT(*) FROM user")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO user (exp, levelName, stepsGoal, startDate, resetVersion) VALUES (?, ?, ?, ?, ?)",
            (0, DEFAULT_LEVEL_NAME, 6000, DEFAULT_START_DATE, 0),
        )

    for statement in [
        "ALTER TABLE user ADD COLUMN resetVersion INTEGER DEFAULT 0",
    ]:
        try:
            cursor.execute(statement)
        except sqlite3.OperationalError:
            pass

    for statement in [
        "ALTER TABLE history ADD COLUMN weight REAL",
        "ALTER TABLE history ADD COLUMN water INTEGER DEFAULT 0",
        "ALTER TABLE history ADD COLUMN last_updated INTEGER DEFAULT 0",
        "ALTER TABLE history ADD COLUMN sync_meta_json TEXT DEFAULT '{}'",
    ]:
        try:
            cursor.execute(statement)
        except sqlite3.OperationalError:
            pass

    cursor.execute(
        "UPDATE user SET levelName = ? WHERE levelName = ?",
        (DEFAULT_LEVEL_NAME, LEGACY_LEVEL_NAME),
    )

    conn.commit()
    conn.close()


class DoFormyHandler(http.server.SimpleHTTPRequestHandler):
    is_syncing = False

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split('?')[0].rstrip('/')

        if clean_path == "/api/info":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "name": "DoFormy Server",
                "version": "2.5"
            }, ensure_ascii=False).encode("utf-8"))
            return

        if clean_path == "/api/data":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM user WHERE id = 1")
            user_row = cursor.fetchone()
            user_data = dict(user_row) if user_row else {
                "id": 1,
                "exp": 0,
                "levelName": DEFAULT_LEVEL_NAME,
                "stepsGoal": 6000,
                "startDate": DEFAULT_START_DATE,
                "resetVersion": 0,
            }

            cursor.execute("SELECT * FROM history")
            history_data = {}
            for row in cursor.fetchall():
                history_data[row["date"]] = history_row_to_record(row)

            conn.close()
            self.wfile.write(json.dumps({"user": user_data, "history": history_data}, ensure_ascii=False).encode("utf-8"))
            return

        path = self.path.split('?')[0]
        if path == '/':
            path = '/desktop/index.html'

        file_path = path.lstrip('/')
        if '..' in file_path:
            self.send_response(403)
            self.end_headers()
            return

        full_path = os.path.join(os.getcwd(), file_path)
        if os.path.isfile(full_path):
            import mimetypes

            content_type = mimetypes.guess_type(full_path)[0] or 'application/octet-stream'
            self.send_response(200)
            self.send_header("Content-type", content_type)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with open(full_path, 'rb') as file_handle:
                self.wfile.write(file_handle.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"File not found")

    def do_POST(self):
        if self.path == "/api/quit":
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "shutdown"}).encode("utf-8"))
            print("\nDoFormy: shutting down server", flush=True)

            def kill_self():
                time.sleep(0.3)
                os._exit(0)

            threading.Thread(target=kill_self).start()
            return

        if self.path == "/api/save":
            content_length = int(self.headers['Content-Length'])
            payload = json.loads(self.rfile.read(content_length))
            incoming_user = payload.get("user") or {}
            incoming_history = payload.get("history") or {}

            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            cursor.execute("SELECT * FROM user WHERE id = 1")
            existing_user_row = cursor.fetchone()

            existing_reset = 0
            if existing_user_row and "resetVersion" in existing_user_row.keys():
                try:
                    existing_reset = int(existing_user_row["resetVersion"] or 0)
                except (TypeError, ValueError):
                    existing_reset = 0

            try:
                incoming_reset = int(incoming_user.get("resetVersion") or 0)
            except (TypeError, ValueError):
                incoming_reset = 0

            # If server has been reset and a stale client tries to upload old history, ignore it.
            if incoming_reset < existing_reset:
                incoming_history = {}

            merged_user = merge_user(dict(existing_user_row) if existing_user_row else None, incoming_user)
            cursor.execute(
                "UPDATE user SET exp = ?, levelName = ?, stepsGoal = ?, startDate = ?, resetVersion = ? WHERE id = 1",
                (
                    merged_user["exp"],
                    merged_user["levelName"],
                    merged_user["stepsGoal"],
                    merged_user["startDate"],
                    merged_user["resetVersion"],
                ),
            )

            for date, stats in incoming_history.items():
                cursor.execute("SELECT * FROM history WHERE date = ?", (date,))
                existing_history_row = cursor.fetchone()
                existing_record = history_row_to_record(existing_history_row) if existing_history_row else None
                merged_record = merge_day_record(normalize_history_record(stats), existing_record)
                save_history_row(cursor, date, merged_record)

            conn.commit()
            conn.close()

            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode("utf-8"))

        if self.path == "/api/sync":
            if DoFormyHandler.is_syncing:
                self.send_response(409)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "conflict", "message": "Sync in progress"}).encode("utf-8"))
                return

            DoFormyHandler.is_syncing = True

            try:
                content_length = int(self.headers['Content-Length'])
                payload = json.loads(self.rfile.read(content_length))
                local_user = payload.get("user") or {}
                local_history = payload.get("history") or {}

                conn = sqlite3.connect(DB_FILE)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                cursor.execute("SELECT * FROM user WHERE id = 1")
                existing_user_row = cursor.fetchone()
                existing_user = dict(existing_user_row) if existing_user_row else None

                cursor.execute("SELECT * FROM history")
                server_history = {}
                for row in cursor.fetchall():
                    server_history[row["date"]] = history_row_to_record(row)

                conn.close()

                merged_user = merge_user(existing_user, local_user)
                merged_history = {}

                all_dates = set(local_history.keys()) | set(server_history.keys())
                for date in all_dates:
                    merged_history[date] = merge_day_record(
                        normalize_history_record(local_history.get(date, {})),
                        server_history.get(date)
                    )

                local_reset = int(local_user.get("resetVersion") or 0)
                existing_reset = int(existing_user.get("resetVersion") or 0) if existing_user else 0
                if existing_reset > local_reset:
                    local_history = {}

                self.send_response(200)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "status": "success",
                    "user": merged_user,
                    "history": merged_history
                }, ensure_ascii=False).encode("utf-8"))
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode("utf-8"))
            finally:
                DoFormyHandler.is_syncing = False
                return


def run_server():
    init_db()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    threading.Thread(target=lambda: (time.sleep(1.5), webbrowser.open(URL)), daemon=True).start()

    try:
        server = http.server.HTTPServer(('0.0.0.0', PORT), DoFormyHandler)
        cert_path = "certs/cert.crt"
        key_path = "certs/cert.key"

        if os.path.exists(cert_path) and os.path.exists(key_path):
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(certfile=cert_path, keyfile=key_path)
            server.socket = context.wrap_socket(server.socket, server_side=True)
            print(f"DoFormy Server running on HTTPS (https://{HOST_NAME}:{PORT})", flush=True)
        else:
            print(f"Warning: certificates not found in {cert_path}. Running on HTTP.", flush=True)

        server.serve_forever()
    except Exception as exc:
        print(f"Server error: {exc}", flush=True)
        os._exit(0)


if __name__ == "__main__":
    run_server()
