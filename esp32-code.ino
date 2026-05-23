#include <Wire.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <Adafruit_BMP085.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_APDS9960.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const int I2C_SDA_PIN = 21;
const int I2C_SCL_PIN = 22;
const int APDS_INT_PIN = 26;
const int BUZZER_PIN = 5;
const bool BUZZER_ACTIVE_LOW = true;

const int OLED_WIDTH = 128;
const int OLED_HEIGHT = 64;
const int OLED_RESET_PIN = -1;
const int OLED_I2C_ADDRESS = 0x3C;

const uint16_t DEFAULT_LIGHT_LUX = 120;

Adafruit_BMP085 bmp;
Adafruit_MPU6050 mpu;
Adafruit_APDS9960 apds;
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, OLED_RESET_PIN);
WebSocketsServer webSocket = WebSocketsServer(81);

bool bmpReady = false;
bool mpuReady = false;
bool apdsReady = false;
bool oledReady = false;

unsigned long lastPacketMs = 0;
const unsigned long PACKET_INTERVAL_MS = 1000;

float pressureBaselineHpa = 0.0;
float pressureBaselineTotal = 0.0;
int pressureBaselineSamples = 0;
const int PRESSURE_BASELINE_SAMPLE_COUNT = 12;

unsigned long lastBuzzerToggleMs = 0;
bool buzzerState = false;

void setBuzzer(bool on) {
  if (BUZZER_ACTIVE_LOW) {
    digitalWrite(BUZZER_PIN, on ? LOW : HIGH);
  } else {
    digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
  }
}

float clampValue(float value, float minValue, float maxValue) {
  if (value < minValue) return minValue;
  if (value > maxValue) return maxValue;
  return value;
}

int calculateSafetyScore(float pressureHpa, float vibrationG, uint16_t lightLux) {
  float pressureDelta = abs(pressureHpa - pressureBaselineHpa);
  float pressureScore = clampValue(100.0 - pressureDelta * 10.0, 0.0, 100.0);
  float vibrationScore = clampValue(100.0 - vibrationG * 90.0, 0.0, 100.0);
  float lightScore = clampValue(100.0 - lightLux / 7.0, 0.0, 100.0);

  return round(vibrationScore * 0.50 + pressureScore * 0.30 + lightScore * 0.20);
}

String getStatus(float pressureHpa, float vibrationG, uint16_t lightLux, int safetyScore) {
  float pressureDrop = pressureBaselineHpa - pressureHpa;

  if (vibrationG > 1.35 || pressureDrop > 8.0 || lightLux > 560 || safetyScore < 58) {
    return "Critical";
  }

  if (vibrationG > 0.90 || pressureDrop > 4.0 || lightLux > 390 || safetyScore < 76) {
    return "Watch";
  }

  return "Stable";
}

String getAlert(float pressureHpa, float vibrationG, uint16_t lightLux, int safetyScore) {
  float pressureDrop = pressureBaselineHpa - pressureHpa;

  if (vibrationG > 1.35) return "High vibration trauma detected";
  if (pressureDrop > 8.0) return "Pressure drop warning";
  if (lightLux > 560) return "Excessive light exposure";
  if (safetyScore < 58) return "Emergency transport instability";
  if (vibrationG > 0.90) return "Vibration warning";
  if (pressureDrop > 4.0) return "Pressure change warning";
  if (lightLux > 390) return "Light exposure warning";
  if (safetyScore < 76) return "Transport stability warning";

  return "None";
}

void scanI2CBus() {
  Serial.println("Scanning I2C bus...");

  byte devicesFound = 0;

  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();

    if (error == 0) {
      Serial.print("I2C device found at 0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      devicesFound++;
    }
  }

  if (devicesFound == 0) {
    Serial.println("No I2C devices found.");
  }
}

void updatePressureBaseline(float pressureHpa) {
  if (pressureHpa <= 0.0 || pressureBaselineSamples >= PRESSURE_BASELINE_SAMPLE_COUNT) {
    return;
  }

  pressureBaselineTotal += pressureHpa;
  pressureBaselineSamples++;
  pressureBaselineHpa = pressureBaselineTotal / pressureBaselineSamples;

  if (pressureBaselineSamples == PRESSURE_BASELINE_SAMPLE_COUNT) {
    Serial.print("Pressure baseline locked at ");
    Serial.print(pressureBaselineHpa, 1);
    Serial.println(" hPa");
  }
}

void updateBuzzer(String status) {
  if (status == "Critical") {
    if (millis() - lastBuzzerToggleMs >= 150) {
      lastBuzzerToggleMs = millis();
      buzzerState = !buzzerState;
      setBuzzer(buzzerState);
    }
    return;
  }

  if (status == "Watch") {
    if (millis() - lastBuzzerToggleMs >= 600) {
      lastBuzzerToggleMs = millis();
      buzzerState = !buzzerState;
      setBuzzer(buzzerState);
    }
    return;
  }

  buzzerState = false;
  setBuzzer(false);
}

void updateOledDisplay(
  float pressureHpa,
  float vibrationG,
  float accelX,
  float accelY,
  float accelZ,
  uint16_t lightLux,
  int safetyScore,
  String status
) {
  if (!oledReady) return;

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);

  display.setCursor(0, 0);
  display.print("LifeLink ");
  display.print(status);

  display.setCursor(0, 10);
  display.print("Score:");
  display.print(safetyScore);
  display.print("% P:");
  display.print(pressureHpa, 0);

  display.setCursor(0, 22);
  display.print("X:");
  display.print(accelX, 2);
  display.print(" Y:");
  display.print(accelY, 2);

  display.setCursor(0, 34);
  display.print("Z:");
  display.print(accelZ, 2);
  display.print(" V:");
  display.print(vibrationG, 2);

  display.setCursor(0, 46);
  display.print("Light:");
  display.print(lightLux);
  display.print(apdsReady ? " lux" : " est");

  display.display();
}

void onWebSocketEvent(uint8_t clientId, WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.print("Dashboard connected: client ");
      Serial.println(clientId);
      break;

    case WStype_DISCONNECTED:
      Serial.print("Dashboard disconnected: client ");
      Serial.println(clientId);
      break;

    case WStype_TEXT:
      Serial.print("Dashboard message: ");
      Serial.println((char*)payload);
      break;

    default:
      break;
  }
}

void connectToWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected. ESP32 IP address: ");
  Serial.println(WiFi.localIP());
  Serial.println("WebSocket endpoint: ws://" + WiFi.localIP().toString() + ":81");
}

void setupSensors() {
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  pinMode(APDS_INT_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  setBuzzer(false);

  scanI2CBus();

  bmpReady = bmp.begin();
  Serial.println(bmpReady ? "BMP180 ready" : "BMP180 not found");

  mpuReady = mpu.begin(0x68);

  if (!mpuReady) {
    mpuReady = mpu.begin(0x69);
  }

  if (mpuReady) {
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.println("MPU6050 ready");
  } else {
    Serial.println("MPU6050 not found");
  }

  apdsReady = apds.begin();

  if (apdsReady) {
    apds.enableColor(true);
    apds.enableProximity(true);
    apds.enableGesture(true);
    Serial.println("APDS9960 ready");
  } else {
    Serial.println("APDS9960 not found. Using estimated light value.");
  }

  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDRESS);

  if (oledReady) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("LifeLink booting");
    display.println("Sensors starting...");
    display.display();
    Serial.println("OLED display ready");
  } else {
    Serial.println("OLED display not found");
  }
}

String buildSensorJson() {
  float pressureHpa = 0.0;
  float vibrationG = 0.0;
  float accelerationMagnitudeG = 0.0;
  float accelX = 0.0;
  float accelY = 0.0;
  float accelZ = 0.0;
  uint16_t lightLux = DEFAULT_LIGHT_LUX;
  String gesture = apdsReady ? "none" : "estimated";

  if (bmpReady) {
    pressureHpa = bmp.readPressure() / 100.0;
    updatePressureBaseline(pressureHpa);
  }

  if (mpuReady) {
    sensors_event_t accel;
    sensors_event_t gyro;
    sensors_event_t temp;

    mpu.getEvent(&accel, &gyro, &temp);

    accelX = accel.acceleration.x / 9.80665;
    accelY = accel.acceleration.y / 9.80665;
    accelZ = accel.acceleration.z / 9.80665;

    accelerationMagnitudeG = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
    vibrationG = abs(accelerationMagnitudeG - 1.0);
  }

  if (apdsReady) {
    uint16_t red;
    uint16_t green;
    uint16_t blue;
    uint16_t clear;

    apds.getColorData(&red, &green, &blue, &clear);
    lightLux = clear;

    uint8_t gestureValue = apds.readGesture();

    if (gestureValue == APDS9960_UP) gesture = "up";
    else if (gestureValue == APDS9960_DOWN) gesture = "down";
    else if (gestureValue == APDS9960_LEFT) gesture = "left";
    else if (gestureValue == APDS9960_RIGHT) gesture = "right";
  }

  int safetyScore = calculateSafetyScore(pressureHpa, vibrationG, lightLux);
  String status = getStatus(pressureHpa, vibrationG, lightLux, safetyScore);
  String alert = getAlert(pressureHpa, vibrationG, lightLux, safetyScore);

  bool apdsInterruptActive = digitalRead(APDS_INT_PIN) == LOW;

  if (!bmpReady || !mpuReady) {
    safetyScore = min(safetyScore, 40);
    status = "Critical";

    if (!bmpReady) {
      alert = "BMP180 offline";
    } else {
      alert = "MPU6050 offline";
    }
  } else if (!apdsReady && alert == "None") {
    alert = "None";
  }

  updateBuzzer(status);
  updateOledDisplay(pressureHpa, vibrationG, accelX, accelY, accelZ, lightLux, safetyScore, status);

  String json = "{";
  json += "\"pressure\":" + String(pressureHpa, 1) + ",";
  json += "\"pressureBaseline\":" + String(pressureBaselineHpa, 1) + ",";
  json += "\"vibration\":" + String(vibrationG, 2) + ",";
  json += "\"accelerationMagnitude\":" + String(accelerationMagnitudeG, 2) + ",";
  json += "\"accelX\":" + String(accelX, 2) + ",";
  json += "\"accelY\":" + String(accelY, 2) + ",";
  json += "\"accelZ\":" + String(accelZ, 2) + ",";
  json += "\"light\":" + String(lightLux) + ",";
  json += "\"safetyScore\":" + String(safetyScore) + ",";
  json += "\"status\":\"" + status + "\",";
  json += "\"alert\":\"" + alert + "\",";
  json += "\"gesture\":\"" + gesture + "\",";
  json += "\"apdsInterrupt\":" + String(apdsInterruptActive ? "true" : "false") + ",";
  json += "\"buzzer\":" + String(status == "Critical" || status == "Watch" ? "true" : "false") + ",";
  json += "\"battery\":87,";
  json += "\"esp32\":\"connected\",";
  json += "\"bmpReady\":" + String(bmpReady ? "true" : "false") + ",";
  json += "\"mpuReady\":" + String(mpuReady ? "true" : "false") + ",";
  json += "\"apdsReady\":" + String(apdsReady ? "true" : "false") + ",";
  json += "\"oledReady\":" + String(oledReady ? "true" : "false");
  json += "}";

  return json;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("LifeLink ESP32 starting...");

  setupSensors();
  connectToWiFi();

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  Serial.println("WebSocket server started on port 81");
}

void loop() {
  webSocket.loop();

  if (millis() - lastPacketMs >= PACKET_INTERVAL_MS) {
    lastPacketMs = millis();

    String packet = buildSensorJson();
    Serial.println(packet);
    webSocket.broadcastTXT(packet);
  }
}
