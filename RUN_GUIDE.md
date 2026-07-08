# Zlot Smart Parking System - Setup & Run Guide

This project consists of 4 main components:
1. **Backend Server (`zlot-backend`)** - Node.js & Express API
2. **Admin Web Dashboard (`zlot-admin`)** - React & Vite web application
3. **Mobile App (`zlot-mobile-app`)** - React Native & Expo mobile app
4. **Predictive ML Engine (`zlot-python-ml`)** - Flask & Python Machine Learning model

---

## 🛠️ Prerequisites
Make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- [Git](https://git-scm.com/)
- **Expo Go** app installed on your physical mobile device (from Play Store or App Store)

---

## 🔑 Crucial Security Configuration
Since private credential keys are ignored in Git to prevent security leaks, you must manually add the service keys to the backend.

1. Obtain your **Firebase Service Account JSON** key.
2. Place this file inside the `zlot-backend/` directory and rename it to:
   `serviceAccountKey.json`
3. If using Google Cloud Vision, also place the vision credential file inside `zlot-backend/` and rename it to:
   `visionKey.json`

---

## 🚀 Running the Components Step-by-Step

### 1. Backend Server (`zlot-backend`)
1. Open a terminal and navigate to `zlot-backend`:
   ```bash
   cd zlot-backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node index.js
   ```
   *The server will run on `http://localhost:3000`.*

---

### 2. Admin Web Dashboard (`zlot-admin`)
1. Open a new terminal and navigate to `zlot-admin`:
   ```bash
   cd zlot-admin
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The dashboard will run on `http://localhost:5173` (or the port shown in your terminal).*

---

### 3. Mobile App (`zlot-mobile-app`)
1. Open a new terminal and navigate to `zlot-mobile-app`:
   ```bash
   cd zlot-mobile-app
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Expo server:
   ```bash
   npx expo start
   ```
4. Open the app:
   - **On a physical device:** Scan the QR code shown in the terminal using the **Expo Go** app.
   - **On an emulator:** Press `a` for Android Emulator or `i` for iOS Simulator.

---

### 4. Machine Learning Engine (`zlot-python-ml`)
1. Open a new terminal and navigate to `zlot-python-ml`:
   ```bash
   cd zlot-python-ml
   ```
2. Create a Python Virtual Environment:
   - **Windows:**
     ```bash
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux:**
     ```bash
     python -m venv venv
     source venv/bin/activate
     ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the predictive engine:
   ```bash
   python predictive_model.py
   ```
   *The ML engine will run on `http://localhost:5000`.*
