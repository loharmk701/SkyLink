import csv
import io
import sqlite3

import os
import threading
import time
import json
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

from pathlib import Path


from flask import Flask, jsonify, Response, request

from flask_cors import CORS
app = Flask(__name__)


def _cors_origins():
    configured = os.getenv("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


CORS(app, resources={r"/api/*": {"origins": _cors_origins()}})


DB_PATH = Path(os.getenv("DATABASE_PATH", Path(__file__).resolve().parent / "agrosmart.db"))
ESP32_DEVICE_URL = os.getenv("ESP32_DEVICE_URL", "").strip()
led_state = False


@app.get("/health")
def health():
    return jsonify({"status": "ok", "service": "agrosmart-api"})
@app.route("/")
def home():
    return jsonify({
        "project": "AgroSmart",
        "message": "Backend is working!",
        "status": "success"
    })

@app.route("/api/sensors", methods=["GET"])
def get_sensors():
    return jsonify({
        "soil_moisture": 25,
        "tank_level": 76,
        "pump_status": False,
        "device_connected": False,
        "mode": "demo"
    })


@app.route("/api/led", methods=["GET", "POST"])
def led_control():
    global led_state

    if request.method == "GET":
        return jsonify({"on": led_state, "pin": "D0"})

    payload = request.get_json(silent=True) or {}
    if not isinstance(payload.get("on"), bool):
        return jsonify({"error": "The 'on' value must be boolean."}), 400

    desired_state = payload["on"]
    if ESP32_DEVICE_URL:
        try:
            command = Request(
                ESP32_DEVICE_URL,
                data=json.dumps({"on": desired_state, "pin": "D0"}).encode(),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(command, timeout=5) as response:
                if response.status >= 400:
                    raise RuntimeError("ESP32 rejected the command")
        except (HTTPError, URLError, TimeoutError, RuntimeError) as error:
            return jsonify({"error": f"ESP32 command failed: {error}"}), 502

    led_state = desired_state
    return jsonify({"on": led_state, "pin": "D0"})



def init_database():
    with sqlite3.connect(DB_PATH, timeout=30) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sensor_readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                soil_moisture REAL NOT NULL,
                tank_level REAL NOT NULL,
                pump_status INTEGER NOT NULL,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


def save_sensor_to_database(soil_moisture, tank_level, pump_status):
    with sqlite3.connect(DB_PATH, timeout=30) as conn:
        conn.execute(
            """
            INSERT INTO sensor_readings
            (soil_moisture, tank_level, pump_status)
            VALUES (?, ?, ?)
            """,
            (soil_moisture, tank_level, int(pump_status))
        )
        conn.commit()


@app.route("/api/save-reading", methods=["POST"])
def save_reading():
    soil_moisture = 25
    tank_level = 76
    pump_status = False

    save_sensor_to_database(
        soil_moisture,
        tank_level,
        pump_status
    )

    return jsonify({
        "message": "Sensor reading saved successfully!",
        "status": "success"
    })

@app.route("/api/history", methods=["GET"])
def get_history():
    with sqlite3.connect(DB_PATH, timeout=30) as conn:
        conn.row_factory = sqlite3.Row

        readings = conn.execute("""
            SELECT id, soil_moisture, tank_level,
                   pump_status, recorded_at
            FROM sensor_readings
            ORDER BY id DESC
            LIMIT 20
        """).fetchall()

    
    return jsonify([dict(row) for row in readings])


def automatic_sensor_logging():
    while True:
        try:
            save_sensor_to_database(
                soil_moisture=25,
                tank_level=76,
                pump_status=False
            )
            print("AgroSmart: Demo sensor reading saved")
        except Exception as error:
            print("Auto logging error:", error)

        time.sleep(30)


@app.route("/api/export-csv", methods=["GET"])
def export_csv():
    with sqlite3.connect(DB_PATH, timeout=30) as conn:
        readings = conn.execute("""
            SELECT id, soil_moisture, tank_level,
                   pump_status, recorded_at
            FROM sensor_readings
            ORDER BY id DESC
        """).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "ID",
        "Soil Moisture (%)",
        "Tank Level (%)",
        "Pump Status",
        "Recorded At (UTC)"
    ])

    for reading in readings:
        writer.writerow([
            reading[0],
            reading[1],
            reading[2],
            "ON" if reading[3] else "OFF",
            reading[4]
        ])

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                "attachment; filename=AgroSmart_Report.csv"
        }
    )

if __name__ == "__main__":
    init_database()

    logging_thread = threading.Thread(
        target=automatic_sensor_logging,
        daemon=True
    )
    logging_thread.start()

    app.run(
        debug=False,
        use_reloader=False,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
    )


# Gunicorn imports the application instead of executing this module as a script.
# Initialize the SQLite schema for both local and hosted execution.
init_database()

