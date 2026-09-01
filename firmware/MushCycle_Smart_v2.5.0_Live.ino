// ============================================================
// MushCycle Smart Controller
// Version: 2.5.0
//
// Hardware:
// - ESP32
// - DHT22
// - MQ-2
// - MQ-9
// - OLED SH1107 128x128 I2C
// - Relay Module 5V 4 Channel
//
// Relay Mapping:
// CH1 = UNUSED
// CH2 = UNUSED
// CH3 = PUMP
// CH4 = RESERVED
//
// Changes in v2.5.0:
// - HTTPS telemetry to MushCycle Dashboard API
// - Remote control polling with revision protection
// - Device-key authentication
//
// Retained from v2.4.0:
// - Removed FAN 1 / FAN 2 completely
// - AUTO mode controls PUMP from humidity only
// - Manual PUMP / Relay 4 control
// - Relay Self-Test tests CH3 / CH4 only
// - Fail-safe: active relays OFF on boot
// - Non-blocking Wi-Fi reconnect retained
//
// Serial Commands @ 115200 baud:
// A = AUTO mode
// M = MANUAL mode
// 3 or P = Toggle PUMP
// 4 = Toggle Relay 4
// 0 = ALL RELAYS OFF
// T = Relay Self-Test
// S = Show status
// H = Show help
// ============================================================

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>
#include <time.h>
#include "secrets.h"

#define APP_NAME    "MushCycle Smart"
#define APP_VERSION "2.5.0"

const char* SERVER_BASE_URL = "https://smzlporzdrhrlhwxopph.supabase.co/functions/v1/mushcycle-api";

// GTS Root R1. Source: https://pki.goog/repo/certs/gtsr1.pem
static const char GTS_ROOT_R1[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQsw
CQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEU
MBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAw
MDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZp
Y2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUA
A4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo
27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7w
Cl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjw
TcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0Pfybl
qAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaH
szVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8
Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmk
MiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92
wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70p
aDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrN
VjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQID
AQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4E
FgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibb
C5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEe
QkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuy
h6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM4
7HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8J
ZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6Ef
MgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/
Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT
6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ
0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm
2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bb
bP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c
-----END CERTIFICATE-----
)EOF";

#define SCREEN_WIDTH  128
#define SCREEN_HEIGHT 128
#define OLED_SDA      21
#define OLED_SCL      22
#define OLED_ADDRESS  0x3C

Adafruit_SH1107 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire);

#define DHT_PIN  4
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

#define MQ2_PIN 34
#define MQ9_PIN 35

#define PUMP_RELAY_PIN 27
#define RELAY4_PIN     33

#define RELAY_ON  LOW
#define RELAY_OFF HIGH

bool pumpState   = false;
bool relay4State = false;

enum ControlMode { MODE_AUTO, MODE_MANUAL };
ControlMode controlMode = MODE_AUTO;

float HUM_LOW  = 60.0;
float HUM_HIGH = 75.0;

const unsigned long SENSOR_INTERVAL     = 2000;
const unsigned long CLOUD_INTERVAL      = 10000;
const unsigned long CONTROL_INTERVAL    = 2000;
const unsigned long WIFI_CHECK_INTERVAL = 10000;

unsigned long previousSensorMillis = 0;
unsigned long previousCloudMillis  = 0;
unsigned long previousControlMillis = 0;
unsigned long previousWiFiMillis   = 0;
unsigned long lastControlRevision  = 0;

bool previousWiFiConnected = false;
bool timeSyncStarted = false;

float temperature = NAN;
float humidity    = NAN;
int mq2Value = 0;
int mq9Value = 0;

void readSensors();
void autoControl();
void updateOLED();
void printSerial();
void showHelp();

void setRelay(int pin, bool state) {
  digitalWrite(pin, state ? RELAY_ON : RELAY_OFF);
}

void applyRelayStates() {
  setRelay(PUMP_RELAY_PIN, pumpState);
  setRelay(RELAY4_PIN, relay4State);
}

void allRelaysOff() {
  pumpState = false;
  relay4State = false;
  applyRelayStates();
}

void showRelayTestOLED(const char* channel, const char* status) {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(12, 15);
  display.println("RELAY SELF TEST");
  display.drawLine(5, 30, 122, 30, SH110X_WHITE);
  display.setTextSize(2);
  display.setCursor(10, 48);
  display.println(channel);
  display.setCursor(30, 80);
  display.println(status);
  display.display();
}

void testOneRelay(int pin, const char* serialName, const char* oledName) {
  Serial.print("[TEST] ");
  Serial.print(serialName);
  Serial.println(" -> ON");
  digitalWrite(pin, RELAY_ON);
  showRelayTestOLED(oledName, "ON");
  delay(1500);

  Serial.print("[TEST] ");
  Serial.print(serialName);
  Serial.println(" -> OFF");
  digitalWrite(pin, RELAY_OFF);
  showRelayTestOLED(oledName, "OFF");
  delay(500);
}

void testRelays() {
  Serial.println();
  Serial.println("================================");
  Serial.println("       RELAY SELF TEST");
  Serial.println("================================");

  allRelaysOff();
  delay(1000);

  testOneRelay(PUMP_RELAY_PIN, "CH3 - PUMP", "CH3 PUMP");
  testOneRelay(RELAY4_PIN, "CH4 - RESERVED", "CH4 R4");

  allRelaysOff();

  Serial.println("================================");
  Serial.println("      RELAY TEST COMPLETE");
  Serial.println("================================");

  if (controlMode == MODE_AUTO) {
    readSensors();
    autoControl();
  }

  updateOLED();
}

void togglePump() {
  if (controlMode != MODE_MANUAL) {
    Serial.println("Switch to MANUAL mode first.");
    return;
  }
  pumpState = !pumpState;
  applyRelayStates();
}

void toggleRelay4() {
  if (controlMode != MODE_MANUAL) {
    Serial.println("Switch to MANUAL mode first.");
    return;
  }
  relay4State = !relay4State;
  applyRelayStates();
}

void showHelp() {
  Serial.println();
  Serial.println("================================");
  Serial.println("     MushCycle Serial Commands");
  Serial.println("================================");
  Serial.println("A = AUTO mode");
  Serial.println("M = MANUAL mode");
  Serial.println("3 = Toggle PUMP");
  Serial.println("P = Toggle PUMP");
  Serial.println("4 = Toggle Relay 4");
  Serial.println("0 = ALL RELAYS OFF");
  Serial.println("T = Relay Self-Test");
  Serial.println("S = Show status");
  Serial.println("H = Show help");
  Serial.println("================================");
}

void handleSerialCommands() {
  while (Serial.available() > 0) {
    char command = Serial.read();
    if (command == '\n' || command == '\r') continue;

    switch (command) {
      case 'A':
      case 'a':
        controlMode = MODE_AUTO;
        Serial.println("CONTROL MODE -> AUTO");
        readSensors();
        autoControl();
        updateOLED();
        break;

      case 'M':
      case 'm':
        controlMode = MODE_MANUAL;
        allRelaysOff();
        Serial.println("CONTROL MODE -> MANUAL");
        Serial.println("All relays forced OFF.");
        updateOLED();
        break;

      case '3':
      case 'P':
      case 'p':
        togglePump();
        printSerial();
        updateOLED();
        break;

      case '4':
        toggleRelay4();
        printSerial();
        updateOLED();
        break;

      case '0':
        allRelaysOff();
        Serial.println("ALL RELAYS -> OFF");
        printSerial();
        updateOLED();
        break;

      case 'T':
      case 't':
        testRelays();
        break;

      case 'S':
      case 's':
        printSerial();
        break;

      case 'H':
      case 'h':
        showHelp();
        break;

      default:
        Serial.print("Unknown command: ");
        Serial.println(command);
        Serial.println("Use H for help.");
        break;
    }
  }
}

void startWiFiConnection() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("Starting WiFi connection...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void handleWiFiReconnect() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long currentMillis = millis();

  if (currentMillis - previousWiFiMillis >= WIFI_CHECK_INTERVAL) {
    previousWiFiMillis = currentMillis;
    Serial.println("WiFi offline -> reconnecting...");
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

void updateWiFiStatus() {
  bool connected = WiFi.status() == WL_CONNECTED;

  if (connected != previousWiFiConnected) {
    previousWiFiConnected = connected;

    if (connected) {
      Serial.println();
      Serial.println("WiFi Connected");
      Serial.print("IP Address : ");
      Serial.println(WiFi.localIP());
      if (!timeSyncStarted) {
        configTime(0, 0, "pool.ntp.org", "time.google.com");
        timeSyncStarted = true;
        Serial.println("NTP time sync started");
      }
    } else {
      Serial.println();
      Serial.println("WiFi Disconnected");
    }

    updateOLED();
  }
}

void readSensors() {
  float newHumidity = dht.readHumidity();
  float newTemperature = dht.readTemperature();

  if (!isnan(newHumidity) && !isnan(newTemperature)) {
    humidity = newHumidity;
    temperature = newTemperature;
  } else {
    Serial.println("DHT22 Read Error");
  }

  mq2Value = analogRead(MQ2_PIN);
  mq9Value = analogRead(MQ9_PIN);
}

void autoControl() {
  if (controlMode != MODE_AUTO) return;
  if (isnan(humidity)) return;

  if (humidity <= HUM_LOW) {
    pumpState = true;
  } else if (humidity >= HUM_HIGH) {
    pumpState = false;
  }

  relay4State = false;
  applyRelayStates();
}

void printSerial() {
  Serial.println();
  Serial.println("================================");
  Serial.print("Version     : ");
  Serial.println(APP_VERSION);
  Serial.print("Mode        : ");
  Serial.println(controlMode == MODE_AUTO ? "AUTO" : "MANUAL");

  Serial.print("Temperature : ");
  if (isnan(temperature)) Serial.println("ERROR");
  else {
    Serial.print(temperature, 1);
    Serial.println(" C");
  }

  Serial.print("Humidity    : ");
  if (isnan(humidity)) Serial.println("ERROR");
  else {
    Serial.print(humidity, 1);
    Serial.println(" %");
  }

  Serial.print("MQ-2 ADC    : ");
  Serial.println(mq2Value);
  Serial.print("MQ-9 ADC    : ");
  Serial.println(mq9Value);

  Serial.println("-------------------------------");
  Serial.print("PUMP   : ");
  Serial.println(pumpState ? "ON" : "OFF");
  Serial.print("RELAY4 : ");
  Serial.println(relay4State ? "ON" : "OFF");
  Serial.print("WiFi   : ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "CONNECTED" : "OFFLINE");
  Serial.println("================================");
}

void updateOLED() {
  display.clearDisplay();
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);

  display.setCursor(3, 3);
  display.print("MushCycle v");
  display.println(APP_VERSION);

  display.setCursor(3, 14);
  display.print("MODE:");
  display.println(controlMode == MODE_AUTO ? "AUTO" : "MANUAL");

  display.drawLine(3, 26, 124, 26, SH110X_WHITE);

  display.setCursor(5, 34);
  display.print("TEMP:");
  if (isnan(temperature)) display.println("ERR");
  else {
    display.print(temperature, 1);
    display.println("C");
  }

  display.setCursor(5, 48);
  display.print("HUM :");
  if (isnan(humidity)) display.println("ERR");
  else {
    display.print(humidity, 1);
    display.println("%");
  }

  display.setCursor(5, 62);
  display.print("MQ2 :");
  display.println(mq2Value);

  display.setCursor(5, 76);
  display.print("MQ9 :");
  display.println(mq9Value);

  display.drawLine(3, 90, 124, 90, SH110X_WHITE);

  display.setCursor(5, 98);
  display.print("PUMP:");
  display.print(pumpState ? "ON " : "OFF ");
  display.print("R4:");
  display.println(relay4State ? "ON" : "OFF");

  display.setCursor(5, 114);
  display.print("WiFi:");
  display.print(WiFi.status() == WL_CONNECTED ? "ON" : "OFF");

  display.display();
}

void sendCloudData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Cloud skipped: WiFi offline");
    return;
  }

  if (String(DEVICE_API_KEY).indexOf("YOUR_DEVICE") >= 0) {
    Serial.println("Cloud skipped: DEVICE_API_KEY not configured");
    return;
  }
  if (time(nullptr) < 1700000000) {
    Serial.println("Cloud skipped: waiting for NTP time");
    return;
  }

  WiFiClientSecure client;
  client.setCACert(GTS_ROOT_R1);
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/v1/readings";
  if (!http.begin(client, url)) {
    Serial.println("Cloud error: HTTPS connection setup failed");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.setTimeout(8000);

  String json = "{";
  json += "\"device\":\"MushCycle-ESP32\",";
  json += "\"version\":\"" + String(APP_VERSION) + "\",";
  json += "\"mode\":\"";
  json += (controlMode == MODE_AUTO ? "AUTO" : "MANUAL");
  json += "\",";

  json += "\"temperature\":";
  json += isnan(temperature) ? "null" : String(temperature, 1);

  json += ",\"humidity\":";
  json += isnan(humidity) ? "null" : String(humidity, 1);

  json += ",\"mq2\":" + String(mq2Value);
  json += ",\"mq9\":" + String(mq9Value);
  json += ",\"pump\":";
  json += pumpState ? "true" : "false";
  json += ",\"relay4\":";
  json += relay4State ? "true" : "false";
  json += "}";

  Serial.println("Sending Cloud Data:");
  Serial.println(json);

  int httpCode = http.POST(json);

  if (httpCode > 0) {
    Serial.print("HTTP Response : ");
    Serial.println(httpCode);
    Serial.println(http.getString());
  } else {
    Serial.print("HTTP Error : ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

void fetchControlCommand() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (String(DEVICE_API_KEY).indexOf("YOUR_DEVICE") >= 0) return;
  if (time(nullptr) < 1700000000) return;

  WiFiClientSecure client;
  client.setCACert(GTS_ROOT_R1);
  HTTPClient http;
  String url = String(SERVER_BASE_URL) + "/api/v1/control?format=csv";
  if (!http.begin(client, url)) {
    Serial.println("Control error: HTTPS connection setup failed");
    return;
  }
  http.addHeader("X-Device-Key", DEVICE_API_KEY);
  http.setTimeout(5000);

  int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    if (httpCode > 0) {
      Serial.print("Control HTTP Response: ");
      Serial.println(httpCode);
    } else {
      Serial.print("Control HTTP Error: ");
      Serial.println(http.errorToString(httpCode));
    }
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  char mode[8] = {0};
  int remotePump = 0;
  int remoteRelay4 = 0;
  unsigned long revision = 0;
  if (sscanf(payload.c_str(), "%7[^,],%d,%d,%lu", mode, &remotePump, &remoteRelay4, &revision) != 4) {
    Serial.println("Control error: invalid response");
    return;
  }
  if (revision <= lastControlRevision) return;

  if (strcmp(mode, "AUTO") == 0) {
    controlMode = MODE_AUTO;
    readSensors();
    autoControl();
  } else if (strcmp(mode, "MANUAL") == 0) {
    controlMode = MODE_MANUAL;
    pumpState = remotePump == 1;
    relay4State = remoteRelay4 == 1;
    applyRelayStates();
  } else {
    Serial.println("Control error: invalid mode");
    return;
  }

  lastControlRevision = revision;
  Serial.print("Remote control applied, revision ");
  Serial.println(lastControlRevision);
  printSerial();
  updateOLED();
}

void setup() {
  Serial.begin(115200);

  // Fail-safe first
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  pinMode(RELAY4_PIN, OUTPUT);
  allRelaysOff();

  delay(300);

  Serial.println();
  Serial.println("================================");
  Serial.println(APP_NAME);
  Serial.print("Version : ");
  Serial.println(APP_VERSION);
  Serial.println("Fans removed");
  Serial.println("Fail-safe: RELAYS OFF");
  Serial.println("================================");

  dht.begin();

  analogReadResolution(12);
  analogSetPinAttenuation(MQ2_PIN, ADC_11db);
  analogSetPinAttenuation(MQ9_PIN, ADC_11db);

  Wire.begin(OLED_SDA, OLED_SCL);
  Wire.setClock(50000);

  Serial.println("Starting SH1107...");

  if (!display.begin(OLED_ADDRESS, true)) {
    Serial.println("OLED INIT FAILED!");
    allRelaysOff();
    while (true) delay(1000);
  }

  Serial.println("OLED INIT OK!");

  display.clearDisplay();
  display.setRotation(0);
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(2);
  display.setCursor(10, 28);
  display.println("MushCycle");

  display.setTextSize(1);
  display.setCursor(30, 58);
  display.print("v");
  display.println(APP_VERSION);

  display.setCursor(15, 78);
  display.println("PUMP SAFE OFF");
  display.display();

  startWiFiConnection();

  readSensors();
  autoControl();
  updateOLED();

  Serial.println("System Ready!");
  showHelp();
}

void loop() {
  unsigned long currentMillis = millis();

  handleSerialCommands();
  updateWiFiStatus();

  if (currentMillis - previousSensorMillis >= SENSOR_INTERVAL) {
    previousSensorMillis = currentMillis;

    readSensors();

    if (controlMode == MODE_AUTO) {
      autoControl();
    }

    printSerial();
    updateOLED();
  }

  if (currentMillis - previousCloudMillis >= CLOUD_INTERVAL) {
    previousCloudMillis = currentMillis;
    sendCloudData();
  }

  if (currentMillis - previousControlMillis >= CONTROL_INTERVAL) {
    previousControlMillis = currentMillis;
    fetchControlCommand();
  }

  handleWiFiReconnect();
}
