---
publishDate: 2026-05-23

title: LifeLink - The Intelligent Neonatal/Infant Transport Black Box

excerpt: An ESP32-based smart neonatal transport monitoring system that detects vibration trauma, pressure shifts, and environmental risks during infant transport.

image: lifelink-cover.jpg

tags:
  - esp32
  - iot
  - healthcare
  - neonatal
  - embedded
  - sensors
  - react
---

> Smart environmental monitoring system for safer neonatal and infant transport.

---

## Acknowledgements

We sincerely thank IEEE MYOSA 5.0, our faculty mentor Dr. Surbhi Sharma, and Model Institute of Engineering & Technology Jammu for supporting this project.

---

## Overview

LifeLink is an intelligent neonatal and infant transport monitoring system designed to improve safety during critical medical transportation. The system focuses on monitoring Environmental Determinants of Health (EDOH) such as vibration trauma, pressure shifts, and unsafe environmental conditions that may negatively affect newborn infants during transport.

The project uses the ESP32 MYOSA motherboard along with multiple sensors to generate real-time safety analytics and alerts for clinicians and transport staff.

### Key Features

* Real-time vibration and motion monitoring
* Pressure and environmental analysis
* Touchless gesture-based interaction
* OLED safety score display
* Emergency buzzer alert system
* Wireless transport data logging
* Smart safety score algorithm
* Web dashboard monitoring system

---

## Demo / Examples

### Images

![Cover Image](lifelink-cover.jpg)

![Prototype Setup](prototype-setup.jpg)

![Sensor Integration](sensor-setup.jpg)

![OLED Display](oled-display.jpg)

---

### Videos

[▶ Watch Demo Video](https://github.com/harshgujral2006/lifelink-neonatal-blackbox/blob/main/demo.mp4.mp4)

---

## Features (Detailed)

### 1. Vibration Trauma Detection

The MPU6050 accelerometer and gyroscope sensor continuously monitors vibration and road stress during neonatal transport. High G-force vibrations caused by potholes or unstable movement trigger emergency alerts.

### 2. Pressure Monitoring

The BMP180 sensor monitors environmental pressure changes during transport. Rapid pressure drops may affect infant respiratory stability and trigger warning conditions.

### 3. Touchless Sterile Interface

The APDS9960 gesture sensor allows healthcare staff to interact with the system without physical contact, helping maintain sterile medical conditions.

### 4. Real-Time Safety Score

The ESP32 processes sensor data using a weighted sensor fusion algorithm and generates a real-time safety score displayed on the OLED screen.

### 5. Emergency Alert System

When unsafe environmental conditions are detected, the buzzer immediately alerts the medical staff for rapid intervention.

### 6. Wireless Data Handover

The ESP32 transmits transport logs and monitoring data wirelessly for clinical review and hospital handover.

### 7. Web Dashboard

A React + Vite based dashboard displays transport history, vibration analysis, environmental conditions, and safety monitoring data in real time.

---

## Usage Instructions

```plaintext
1. Power ON the ESP32 MYOSA board
2. Connect all sensors properly
3. Upload firmware using Arduino IDE
4. Monitor safety score on OLED display
5. Open dashboard interface
6. Observe alerts during simulated transport conditions
```

---

## Tech Stack

* ESP32 MYOSA Board
* Arduino IDE
* Embedded C/C++
* React.js
* Vite
* HTML/CSS/JavaScript
* IoT Sensors
* OLED Display

---

## Requirements / Installation

```bash
Install ESP32 board libraries in Arduino IDE

Install dashboard dependencies:
npm install

Run dashboard:
npm run dev
```

---

## File Structure

```plaintext
/lifelink-neonatal-blackbox
│
├── lifelink-neonatal-blackbox.md
├── lifelink-cover.jpg
├── prototype-setup.jpg
├── sensor-setup.jpg
├── oled-display.jpg
├── lifelink-demo.mp4
├── esp32-code.ino
│
├── lifelink-dashboard/
│   ├── dist/
│   ├── src/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
```

---

## Contribution Notes

This project was developed as part of the IEEE MYOSA 5.0 innovation event to demonstrate the potential of low-cost embedded healthcare monitoring systems for neonatal transport safety.
