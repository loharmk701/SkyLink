/*
  XIAO ESP32-S3 LED Web Controller

  Hardware:
    LED/resistor positive leg -> D10
    LED/resistor negative leg -> GND

  XIAO ESP32-S3 mapping:
    D10 = GPIO9

  HTTP API:
    GET  /health
    GET  /led
    POST /led

  POST body expected by the AgroSmart dashboard:
    {"on":true,"pin":"D10"}
    {"on":false,"pin":"D10"}
*/

#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// --------------------------- Wi-Fi settings ---------------------------
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace this with the actual public Render API service URL.
// Local example: http://192.168.1.100:5000/api/led
const char* BACKEND_LED_URL =
    "https://YOUR-BACKEND-SERVICE.onrender.com/api/led";

// --------------------------- Hardware settings ------------------------
const uint8_t LED_PIN = D10;

// true: LED anode/resistor is connected to D10 and cathode to GND.
// false: use this for an active-low LED or relay module.
const bool LED_ACTIVE_HIGH = true;

// --------------------------- Server settings --------------------------
WebServer server(80);
bool ledIsOn = false;
unsigned long lastWifiAttempt = 0;

const unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
const unsigned long BACKEND_POLL_INTERVAL_MS = 1000;
unsigned long lastBackendPoll = 0;

void setLed(bool on) {
  ledIsOn = on;

  const bool outputLevel = LED_ACTIVE_HIGH ? on : !on;
  digitalWrite(LED_PIN, outputLevel ? HIGH : LOW);
}

String ledResponse() {
  String response = "{\"on\":";
  response += ledIsOn ? "true" : "false";
  response += ",\"pin\":\"D10\"}";
  return response;
}

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Cache-Control", "no-store");
}

void sendJson(int statusCode, const String& body) {
  addCorsHeaders();
  server.send(statusCode, "application/json", body);
}

bool readRequestedLedState(const String& body, bool& requestedState) {
  int onKey = body.indexOf("\"on\"");
  if (onKey < 0) {
    return false;
  }

  int colon = body.indexOf(':', onKey + 4);
  if (colon < 0) {
    return false;
  }

  String value = body.substring(colon + 1);
  value.trim();

  if (value.startsWith("true")) {
    requestedState = true;
    return true;
  }

  if (value.startsWith("false")) {
    requestedState = false;
    return true;
  }

  return false;
}

void syncLedFromBackendResponse(const String& body) {
  bool requestedState = false;
  if (readRequestedLedState(body, requestedState)) {
    setLed(requestedState);
  }
}

void pollBackendLedState() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  const String backendUrl = BACKEND_LED_URL;
  int httpCode = -1;
  String responseBody;

  if (backendUrl.startsWith("https://")) {
    WiFiClientSecure secureClient;
    secureClient.setInsecure();

    HTTPClient http;
    if (!http.begin(secureClient, backendUrl)) {
      return;
    }

    httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      responseBody = http.getString();
    }
    http.end();
  } else {
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, backendUrl)) {
      return;
    }

    httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      responseBody = http.getString();
    }
    http.end();
  }

  if (httpCode == HTTP_CODE_OK) {
    syncLedFromBackendResponse(responseBody);
  } else {
    Serial.printf("Backend LED request failed: %d\n", httpCode);
  }
}

void handleRoot() {
  sendJson(200, "{\"device\":\"XIAO ESP32-S3\",\"service\":\"LED controller\"}");
}

void handleHealth() {
  sendJson(200, "{\"status\":\"ok\",\"device\":\"XIAO ESP32-S3\"}");
}

void handleLedGet() {
  sendJson(200, ledResponse());
}

void handleLedPost() {
  bool requestedState = false;
  const String requestBody = server.arg("plain");

  if (!readRequestedLedState(requestBody, requestedState)) {
    sendJson(400, "{\"error\":\"Expected JSON with boolean on value\"}");
    return;
  }

  setLed(requestedState);
  Serial.printf("LED %s | request: %s\n", ledIsOn ? "ON" : "OFF", requestBody.c_str());
  sendJson(200, ledResponse());
}

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

void handleNotFound() {
  sendJson(404, "{\"error\":\"Route not found\"}");
}

void connectToWiFi() {
  Serial.printf("Connecting to Wi-Fi: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < 20000) {
    delay(250);
    Serial.print('.');
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("Wi-Fi connected");
    Serial.print("ESP32 IP address: http://");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection timed out; retrying in the background");
  }
}

void setupRoutes() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/led", HTTP_GET, handleLedGet);
  server.on("/led", HTTP_POST, handleLedPost);
  server.on("/led", HTTP_OPTIONS, handleOptions);
  server.onNotFound(handleNotFound);
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  setLed(false);

  connectToWiFi();
  setupRoutes();
  server.begin();

  Serial.println("LED HTTP server started on port 80");
  Serial.println("GET  /led  -> LED status");
  Serial.println("POST /led  -> {\"on\":true} or {\"on\":false}");
}

void loop() {
  server.handleClient();

  if (millis() - lastBackendPoll >= BACKEND_POLL_INTERVAL_MS) {
    lastBackendPoll = millis();
    pollBackendLedState();
  }

  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWifiAttempt >= WIFI_RECONNECT_INTERVAL_MS) {
    lastWifiAttempt = millis();
    Serial.println("Wi-Fi disconnected; reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}
