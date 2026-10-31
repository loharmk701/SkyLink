#include <WiFi.h>
#include <esp_now.h>

#define MAX_JPEG 30000

typedef struct __attribute__((packed)) {
  uint8_t cam;
  uint8_t frame;
  uint16_t idx;
  uint16_t total;
  uint8_t len;
  uint8_t data[240];
} Chunk;

uint8_t *rxBuf[3];       // frame being assembled
uint8_t *outBuf[3];      // completed frame
size_t rxLen[3] = {0};
size_t outLen[3] = {0};
uint8_t curFrame[3] = {255, 255, 255};
uint16_t gotChunks[3] = {0};
volatile bool ready[3] = {false, false, false};
volatile bool sending = false;

#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
void OnRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void OnRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < 8 || len > (int)sizeof(Chunk)) return;
  const Chunk *c = (const Chunk *)data;
  if (c->cam < 1 || c->cam > 3) return;
  int k = c->cam - 1;

  if (c->frame != curFrame[k]) {       // new frame starts
    curFrame[k] = c->frame;
    gotChunks[k] = 0;
    rxLen[k] = 0;
  }
  size_t off = (size_t)c->idx * 240;
  if (off + c->len > MAX_JPEG) return;
  memcpy(rxBuf[k] + off, c->data, c->len);
  gotChunks[k]++;
  if (off + c->len > rxLen[k]) rxLen[k] = off + c->len;

  if (gotChunks[k] == c->total) {      // all chunks received
    if (!sending && !ready[k]) {
      uint8_t *t = outBuf[k]; outBuf[k] = rxBuf[k]; rxBuf[k] = t;
      outLen[k] = rxLen[k];
      ready[k] = true;
    }
    curFrame[k] = 255;
  }
}

void setup() {
  Serial.begin(2000000);               // ignored on USB CDC, runs at full USB speed
  for (int i = 0; i < 3; i++) {
    rxBuf[i] = (uint8_t *)ps_malloc(MAX_JPEG);
    outBuf[i] = (uint8_t *)ps_malloc(MAX_JPEG);
    if (!rxBuf[i]) rxBuf[i] = (uint8_t *)malloc(MAX_JPEG);
    if (!outBuf[i]) outBuf[i] = (uint8_t *)malloc(MAX_JPEG);
  }
  WiFi.mode(WIFI_STA);
  esp_now_init();
  esp_now_register_recv_cb(OnRecv);
}

void loop() {
  for (int k = 0; k < 3; k++) {
    if (ready[k]) {
      sending = true;
      uint32_t n = outLen[k];
      uint8_t hdr[7] = {0xAA, 0x55, (uint8_t)(k + 1),
                        (uint8_t)n, (uint8_t)(n >> 8), (uint8_t)(n >> 16), (uint8_t)(n >> 24)};
      Serial.write(hdr, 7);
      Serial.write(outBuf[k], n);
      ready[k] = false;
      sending = false;
    }
  }
}