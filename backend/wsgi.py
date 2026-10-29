
import threading

from app import app, init_database, automatic_sensor_logging

init_database()

logging_thread = threading.Thread(
    target=automatic_sensor_logging,
    daemon=True
)

logging_thread.start()