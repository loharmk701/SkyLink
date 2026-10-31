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

The dashboard controls the XIAO ESP32-S3 LED on pin `D0` through `POST /api/led`. To connect a hosted API to the device, set the API service environment variable `ESP32_DEVICE_URL` to an HTTPS endpoint reachable by the ESP32 network. The endpoint receives `{ "on": true|false, "pin": "D0" }`. Without this variable, the API runs in local/demo mode.
