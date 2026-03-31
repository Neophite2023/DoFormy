import argparse
import datetime as dt
import os
import shutil
import sqlite3


DEFAULT_LEVEL_NAME = "Fáza 1: Základy"


def iso_tomorrow_utc_midnight():
    # App stores ISO strings with trailing Z; keep it stable regardless of local timezone.
    today = dt.date.today()
    tomorrow = today + dt.timedelta(days=1)
    return f"{tomorrow.isoformat()}T00:00:00.000Z"


def init_db(conn, start_date):
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS user (
            id INTEGER PRIMARY KEY,
            exp INTEGER,
            levelName TEXT,
            stepsGoal INTEGER,
            startDate TEXT
        )
        """
    )
    cur.execute(
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

    cur.execute("SELECT COUNT(*) FROM user WHERE id = 1")
    if int(cur.fetchone()[0] or 0) == 0:
        cur.execute(
            "INSERT INTO user (id, exp, levelName, stepsGoal, startDate) VALUES (1, ?, ?, ?, ?)",
            (0, DEFAULT_LEVEL_NAME, 6000, start_date),
        )
    conn.commit()


def reset_db(db_path, start_date, make_backup):
    if not os.path.exists(db_path):
        raise SystemExit(f"DB file not found: {db_path}")

    if make_backup:
        ts = dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_path = f"{db_path}.backup-{ts}"
        shutil.copy2(db_path, backup_path)
        print(f"Backup created: {backup_path}")

    conn = sqlite3.connect(db_path, timeout=5)
    try:
        init_db(conn, start_date)
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM history")
        before_history = int(cur.fetchone()[0] or 0)

        cur.execute("DELETE FROM history")
        cur.execute(
            "UPDATE user SET exp = ?, levelName = ?, stepsGoal = ?, startDate = ? WHERE id = 1",
            (0, DEFAULT_LEVEL_NAME, 6000, start_date),
        )
        conn.commit()

        # Optional compaction; safe, but can fail if DB is locked elsewhere.
        try:
            cur.execute("VACUUM")
            conn.commit()
        except sqlite3.OperationalError:
            pass

        cur.execute("SELECT COUNT(*) FROM history")
        after_history = int(cur.fetchone()[0] or 0)

        print(f"history rows: {before_history} -> {after_history}")
        print(f"user.startDate set to: {start_date}")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Reset DoFormy SQLite DB (server-side) to a clean state.")
    parser.add_argument("--db", default="doformy.db", help="Path to SQLite DB file (default: doformy.db).")
    parser.add_argument("--start-date", default=iso_tomorrow_utc_midnight(), help="ISO startDate to store in user row.")
    parser.add_argument("--no-backup", action="store_true", help="Do not create a backup copy before resetting.")
    args = parser.parse_args()

    reset_db(args.db, args.start_date, make_backup=not args.no_backup)


if __name__ == "__main__":
    main()

