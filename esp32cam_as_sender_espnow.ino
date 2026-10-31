/*
  ESP32-CAM - ESP-NOW Sender (brownout-safe)
  Board: AI Thinker ESP32-CAM
  Type text in Serial Monitor (115200, Newline) -> shows on OLED of XIAO ESP32S3
*/

#include <WiFi.h>
#include <esp_now.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include "esp_wifi.h"

#define BOARD_ID 1          // <<< change to 2 and 3 for the other boards
#define RED_LED_PIN 33      // red LED on back (active LOW)

// Receiver: XIAO ESP32S3  1C:DB:D4:75:DC:C4
uint8_t receiverMAC[] = {0x1C, 0xDB, 0xD4, 0x75, 0xDC, 0xC4};

typedef struct {
  uint8_t id;
  char msg[64];
} Packet;

Packet p;

void blinkLed() {
  digitalWrite(RED_LED_PIN, LOW);
  delay(60);
  digitalWrite(RED_LED_PIN, HIGH);
}

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 3, 0)
void OnDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
#else
void OnDataSent(const uint8_t *mac, esp_now_send_status_t status) {
#endif
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Delivered" : "Delivery failed");
}

bool sendMessage(const String &text) {
  p.id = BOARD_ID;
  memset(p.msg, 0, sizeof(p.msg));
  text.toCharArray(p.msg, sizeof(p.msg));   // max 63 chars
  return esp_now_send(receiverMAC, (uint8_t *)&p, sizeof(p)) == ESP_OK;
}

void setup() {
  // Disable brownout reset (use together with proper power)
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);

  pinMode(RED_LED_PIN, OUTPUT);
  digitalWrite(RED_LED_PIN, HIGH);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  // Lower TX power to reduce current spikes (still fine for short/medium range)
  WiFi.setTxPower(WIFI_POWER_11dBm);

  Serial.print("This board MAC: ");
  Serial.println(WiFi.macAddress());

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init failed");
    delay(1000);
    ESP.restart();
  }

  esp_now_register_send_cb(OnDataSent);

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, receiverMAC, 6);
  peer.channel = 0;
  peer.encrypt = false;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("Failed to add peer");
    return;
  }

  Serial.printf("CAM%d ready. Type a message and press Enter:\n", BOARD_ID);
  sendMessage("online");
}

void loop() {
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() > 0) {
      if (sendMessage(input)) {
        Serial.println("Sent: " + input);
        blinkLed();
      } else {
        Serial.println("Send error");
      }
    }
  }
}