import http.server
import json
import sqlite3
import os
import sys
import webbrowser
import threading
import time

PORT = 8000
DB_FILE = "doformy.db"
URL = f"http://localhost:{PORT}/desktop/index.html"

def open_browser():
    time.sleep(1.2)
    try:
        ff = webbrowser.get('firefox')
        ff.open(URL)
    except:
        webbrowser.open(URL)

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS user (id INTEGER PRIMARY KEY, exp INTEGER, levelName TEXT, stepsGoal INTEGER, startDate TEXT)''')
    cursor.execute('''CREATE TABLE IF NOT EXISTS history (date TEXT PRIMARY KEY, steps INTEGER, habit INTEGER, workout_json TEXT, weight REAL, water INTEGER DEFAULT 0)''')
    cursor.execute("SELECT COUNT(*) FROM user")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO user (exp, levelName, stepsGoal, startDate) VALUES (?, ?, ?, ?)",
                       (0, 'Fáza 1: Adaptácia', 6000, '2023-10-27T12:00:00.000Z'))
    
    # Migrácia - pridať stĺpce ak neexistujú
    try:
        cursor.execute("ALTER TABLE history ADD COLUMN weight REAL")
    except:
        pass
    try:
        cursor.execute("ALTER TABLE history ADD COLUMN water INTEGER DEFAULT 0")
    except:
        pass
    
    conn.commit()
    conn.close()

class DoFormyHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        print(f"GET request: {self.path}", flush=True)
        if self.path == "/api/data":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            conn = sqlite3.connect(DB_FILE)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM user WHERE id = 1")
            user_data = dict(cursor.fetchone())
            cursor.execute("SELECT * FROM history")
            history_data = {row['date']: {
                "steps": row['steps'], 
                "habit": bool(row['habit']), 
                "workout": json.loads(row['workout_json']) if row['workout_json'] else [],
                "weight": row['weight'],
                "water": row['water']
            } for row in cursor.fetchall()}
            conn.close()
            self.wfile.write(json.dumps({"user": user_data, "history": history_data}).encode())
        else:
            # Serve static files
            super().do_GET()

    def do_POST(self):
        print(f"POST request: {self.path}", flush=True)
        if self.path == "/api/quit":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "shutdown"}).encode())
            print("\n!!! DoFormy: Vypínam server a CMD okno !!!", flush=True)
            
            def kill_self():
                time.sleep(0.3)
                os.kill(os.getpid(), 9)
            
            threading.Thread(target=kill_self).start()
            return

        if self.path == "/api/save":
            print(">>> /api/save received!", flush=True)
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            print(f">>> Saving data: exp={data.get('user', {}).get('exp')}, history_keys={len(data.get('history', {}))}", flush=True)
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("UPDATE user SET exp = ?, levelName = ?, stepsGoal = ? WHERE id = 1", (data['user']['exp'], data['user']['levelName'], data['user']['stepsGoal']))
            for date, stats in data['history'].items():
                cursor.execute("INSERT OR REPLACE INTO history (date, steps, habit, workout_json, weight, water) VALUES (?, ?, ?, ?, ?, ?)", 
                    (date, 
                     stats.get('steps', 0), 
                     int(stats.get('habit', False)), 
                     json.dumps(stats.get('workout', [])),
                     stats.get('weight'),
                     stats.get('water', 0)))
            conn.commit()
            conn.close()
            print(">>> Save complete!", flush=True)
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success"}).encode())

def run_server():
    init_db()
    # Zmeníme working directory na projekt
    web_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(web_dir)
    threading.Thread(target=open_browser, daemon=True).start()
    server = http.server.HTTPServer(('', PORT), DoFormyHandler)
    print(f"DoFormy Server beží na porte {PORT}...", flush=True)
    try:
        server.serve_forever()
    except:
        os._exit(0)

if __name__ == "__main__":
    run_server()
