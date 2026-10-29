import csv
import io
import sqlite3

import threading
import time

from pathlib import Path


from flask import Flask, jsonify, Response

from flask_cors import CORS
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "https://agrosmart-dashboard-1.onrender.com"
        ]
    }
})
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


DB_PATH = Path(__file__).resolve().parent / "agrosmart.db"

def init_database():
    with sqlite3.connect(DB_PATH) as conn:
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
    with sqlite3.connect(DB_PATH) as conn:
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
    with sqlite3.connect(DB_PATH) as conn:
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
    with sqlite3.connect(DB_PATH) as conn:
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

    app.run(debug=True, use_reloader=False, port=5000)

