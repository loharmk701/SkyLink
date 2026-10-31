# ESP32 LED Control

Minimal Vite + Vercel dashboard for controlling an LED on XIAO ESP32-S3 `D10` / `GPIO9`.

## Deploy to Vercel

Import this GitHub repository into Vercel. Use the default Vite settings:

- Build command: `npm run build`
- Output directory: `dist`
- No environment variables are required.

The dashboard uses the same-origin serverless endpoint:

```text
GET  /api/led
POST /api/led  { "on": true }
```

## ESP32 setup

Open `esp32_led_server/esp32_led_server.ino`, set the Wi-Fi credentials, and replace `BACKEND_LED_URL` with your Vercel project URL:

```cpp
const char* BACKEND_LED_URL =
    "https://your-project.vercel.app/api/led";
```

Upload it to `XIAO ESP32S3`. The firmware polls Vercel over HTTPS, so the ESP32 and browser do not need to share a network.
