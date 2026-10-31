/*
  XIAO ESP32-S3 cloud LED client

  LED wiring:
    D10 -> resistor -> LED anode
    GND -> LED cathode

  D10 is GPIO9 on the XIAO ESP32-S3.
  The ESP32 polls the Vercel API, so it does not need a public IP address.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ------------------------- required configuration ----------------------
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace with your deployed Vercel project URL.
const char* BACKEND_LED_URL =
    "https://your-project.vercel.app/api/led";

// Set false if your LED or relay is active-low.
const bool LED_ACTIVE_HIGH = true;

// ------------------------- device configuration ------------------------
const uint8_t LED_PIN = D10;
const unsigned long POLL_INTERVAL_MS = 1000;
const unsigned long WIFI_RETRY_INTERVAL_MS = 10000;

bool ledIsOn = false;
unsigned long lastPoll = 0;
unsigned long lastWiFiRetry = 0;

void setLed(bool on) {
  ledIsOn = on;
  const bool outputLevel = LED_ACTIVE_HIGH ? on : !on;
  digitalWrite(LED_PIN, outputLevel ? HIGH : LOW);
}

bool parseLedState(const String& response, bool& state) {
  const int onKey = response.indexOf("\"on\"");
  if (onKey < 0) return false;

  const int colon = response.indexOf(':', onKey + 4);
  if (colon < 0) return false;

  String value = response.substring(colon + 1);
  value.trim();

  if (value.startsWith("true")) {
    state = true;
    return true;
  }

  if (value.startsWith("false")) {
    state = false;
    return true;
  }

  return false;
}

void applyBackendResponse(const String& response) {
  bool requestedState = false;
  if (!parseLedState(response, requestedState)) {
    Serial.println("Invalid LED response from Vercel");
    return;
  }

  if (requestedState != ledIsOn) {
    setLed(requestedState);
    Serial.printf("LED %s\n", ledIsOn ? "ON" : "OFF");
  }
}

void pollBackend() {
  if (WiFi.status() != WL_CONNECTED) return;

  int statusCode = -1;
  String response;
  const String url = BACKEND_LED_URL;

  if (url.startsWith("https://")) {
    WiFiClientSecure client;
    client.setInsecure();

    HTTPClient http;
    if (!http.begin(client, url)) return;
    statusCode = http.GET();
    if (statusCode == HTTP_CODE_OK) response = http.getString();
    http.end();
  } else {
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, url)) return;
    statusCode = http.GET();
    if (statusCode == HTTP_CODE_OK) response = http.getString();
    http.end();
  }

  if (statusCode == HTTP_CODE_OK) {
    applyBackendResponse(response);
  } else {
    Serial.printf("Vercel request failed: %d\n", statusCode);
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");
  const unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(250);
    Serial.print('.');
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection timed out");
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN, OUTPUT);
  setLed(false);
  connectWiFi();

  Serial.println("Vercel LED client ready");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED &&
      millis() - lastWiFiRetry >= WIFI_RETRY_INTERVAL_MS) {
    lastWiFiRetry = millis();
    Serial.println("Reconnecting Wi-Fi...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  if (millis() - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = millis();
    pollBackend();
  }
}
