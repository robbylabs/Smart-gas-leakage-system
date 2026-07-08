# Smart Gas Leakage Detection and Alert System

A modern, professional Industrial IoT Dashboard and Gas Leakage Detection simulator. This application leverages a Flask/SQLAlchemy backend, SQLite database logging, and a responsive Bootstrap 5 telemetry dashboard with dynamic Chart.js trends, tabular history filters, pagination, and synthesized Web Audio emergency siren alerts.

---

## 🚀 Key Features

1. **Live Telemetry Dashboard:** Real-time statistics, progress bars, and safety status indicators.
2. **Sensor Simulation Engine:** Generates random gas concentrations (50–500 PPM) every 2 seconds, auto-classifies danger levels, and logs them in SQLite.
3. **Emergency Alert Subsystem:** Triggers flashing warnings, a Bootstrap Toast, a top banner alert, and alternating siren audio alerts using the browser's native **Web Audio API** when gas levels exceed 350 PPM.
4. **History Log Console:** Features paginated data queries (10 records/page), text searching, status/date filtering, sorting filters, action details modals, and row deletion.
5. **Interactive Analytics Page:** Employs Chart.js to render real-time streaming line graphs, status distribution pies, daily averages bars, weekly trends, and alert distribution doughnuts.

---

## 🛠️ Technology Stack

- **Backend:** Flask, SQLAlchemy, SQLite
- **Frontend:** HTML5, CSS3 (variables, Light/Dark themes), Bootstrap 5, JavaScript (ES6), Fetch API
- **Charts:** Chart.js (v4 CDN)
- **Icons:** Font Awesome (v6 CDN)

---

## 📦 Setup & Installation

### 1. Install Dependencies
Make sure you have Python 3 installed. Open a terminal in the root directory and install dependencies:
```bash
pip install -r requirements.txt
```

### 2. Initialize Database and Tables
Initialize the SQLite schema database by starting the application and visiting the database route:
- Visit: `http://localhost:5000/initialize-db`

### 3. Run the Development Server
Launch the Flask web app:
```bash
python app.py
```
Access the application at **[http://localhost:5000/](http://localhost:5000/)**

---

## 🧪 Verification & Testing

- **Seed Data:** Visit `http://localhost:5000/seed-data` to pre-populate database charts with 20 historical records.
- **Polling Indicator:** The footer "Polling" spinner pulses every 2 seconds as the client polls simulated sensor readings.
- **Alert Sound Check:** To test the Web Audio sirens, let the simulator generate a reading above 350 PPM. Ensure your system volume is enabled.
- **Light/Dark Theme:** Click the moon/sun icon in the navbar. Theme states persist across pages via LocalStorage.
