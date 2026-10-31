
import threading

from app import app, init_database, automatic_sensor_logging

init_database()

# The Render service is configured with one worker, so this demo logger has a
# single owner and does not duplicate readings across multiple processes.
logging_thread = threading.Thread(
    target=automatic_sensor_logging,
    daemon=True,
)
logging_thread.start()
