# AgroSmart Dashboard

AgroSmart is a React/Vite dashboard with a Flask API and SQLite demo data store.

## Local development

### Backend

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
python backend/app.py
```

The API runs on `http://127.0.0.1:5000`.

### Frontend

Install Node.js 20 or newer, then run:

```powershell
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` if the API uses a non-default URL.

## Render deployment

The root `render.yaml` defines two services:

- `agrosmart-api`: Python web service running Gunicorn and exposing `/health`.
- `agrosmart-dashboard`: static Vite site that uses `VITE_API_BASE_URL` to reach the API.

In Render, create a Blueprint from this repository and review the generated service URLs. If Render assigns different URLs than the defaults in `render.yaml`, update `VITE_API_BASE_URL` on the frontend and `CORS_ORIGINS` on the API to match them.

SQLite storage on Render is ephemeral unless a persistent disk is attached. This is acceptable for the demo; use a managed database for production sensor history.

## ESP32 LED proxy

The dashboard controls an LED connected to XIAO ESP32-S3 pin `D10` through `POST /api/led`. The ESP32 polls `GET /api/led`, so it does not need to be on the same network as Render and the device does not need a public IP. Set the backend URL in `esp32_led_server/esp32_led_server.ino` before uploading. The endpoint returns `{ "on": true|false, "pin": "D10" }`.

For local development, use `http://127.0.0.1:5000` in `.env` and replace it with the actual Render API service URL in the firmware for hosted operation. `.env` is intentionally ignored by Git; use `.env.example` as the template.
