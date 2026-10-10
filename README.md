# 🌿 Pollumap V3

> **AI-powered air quality monitoring & healthy routing dashboard for Chennai**

Pollumap V3 is a full-stack web application that aggregates real-time air quality data, weather metrics, fire insights, and IoT sensor readings into a unified interactive dashboard. It also provides an intelligent **Healthy Routing** feature that calculates the least-polluted walking/cycling paths through the city.

---

## ✨ Features

- 📊 **Live AQI Dashboard** — Real-time pollutant levels (PM2.5, PM10, O₃, NO₂, SO₂, CO) with animated charts
- 🗺️ **Interactive Map View** — Leaflet-powered map with pollution overlay and sensor locations
- 🌤️ **Weather Integration** — Temperature, humidity, UV index, wind, and rainfall visualizations
- 🔥 **Fire Insights** — FIRMS satellite fire detection data displayed on the dashboard
- 🤖 **ML Forecasting** — XGBoost-powered 24-hour pollutant and weather forecasting
- 🚶 **Healthy Routing** — A* algorithm that computes fastest, cleanest, and balanced routes while minimising pollution exposure
- 🏭 **Source Apportionment** — Pie-chart breakdown of pollution sources (vehicles, industry, dust, etc.)
- 📱 **IoT Dashboard** — Live sensor grid with connectivity indicators
- 🌓 **Dark / Light Mode** — Fully theme-aware UI

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & build tool |
| Recharts | Data visualisation charts |
| React-Leaflet / Leaflet | Interactive map |
| Framer Motion | Animations & transitions |
| Lucide React | Icon library |
| Axios + SWR | Data fetching & caching |

### Backend
| Technology | Purpose |
|---|---|
| Flask 3 | REST API server |
| MongoDB | Time-series data storage |
| XGBoost / scikit-learn | ML forecasting models |
| Open-Meteo API | Weather data |
| WAQI API | Air quality sensor data |
| FIRMS API | Satellite fire data |
| Overpass API | OpenStreetMap road graph |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- MongoDB running locally on port `27017`

### 1. Clone the Repository
```bash
git clone https://github.com/jeyadev-jd/Pollumap-V3.git
cd Pollumap-V3
```

### 2. Backend Setup
```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your API keys
cp .env.example .env
# Edit .env with your WAQI_API_KEY, FIRMS_API_KEY, etc.

# Initialise the database
python init_db.py

# Start the backend server
python -m app.main
```

The backend runs on **http://localhost:5000**

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend runs on **http://localhost:5173**

### 4. Quick Start (Both Together)
```bash
# From the project root
chmod +x run_dashboard.sh
./run_dashboard.sh
```

---

## 📁 Project Structure

```
Pollumap-V3/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py          # All REST API endpoints
│   │   ├── db/
│   │   │   └── database.py        # MongoDB connection & queries
│   │   ├── services/
│   │   │   ├── core_logic/
│   │   │   │   ├── apportionment.py   # Source apportionment logic
│   │   │   │   ├── forecasting.py     # XGBoost ML forecasting
│   │   │   │   └── routing.py         # A* healthy routing engine
│   │   │   ├── fetchers/
│   │   │   │   ├── waqi.py        # WAQI AQI data fetcher
│   │   │   │   ├── meteo.py       # Open-Meteo weather fetcher
│   │   │   │   ├── firms.py       # NASA FIRMS fire data fetcher
│   │   │   │   └── overpass.py    # OSM road graph fetcher
│   │   │   └── worker/
│   │   │       └── main.py        # Background data sync worker
│   │   └── main.py                # Flask app entry point
│   ├── init_db.py                 # Database initialisation script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/            # All React UI components
│   │   │   ├── AQIChart.jsx
│   │   │   ├── ForecastCard.jsx
│   │   │   ├── MapView.jsx
│   │   │   ├── HealthAdvisoryCard.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── TopNav.jsx
│   │   │   └── iot/
│   │   │       └── IoTDashboard.jsx
│   │   ├── hooks/
│   │   │   └── usePollumapAPI.js  # Custom SWR data hooks
│   │   ├── App.jsx                # Root application component
│   │   └── main.jsx               # React entry point
│   ├── index.html
│   └── package.json
├── run_dashboard.sh               # Convenience startup script
└── README.md
```

---

## 🔑 Environment Variables

Create a `backend/.env` file with the following keys:

```env
WAQI_API_KEY=your_waqi_api_key_here
FIRMS_API_KEY=your_firms_api_key_here
MONGO_URI=mongodb://localhost:27017
```

---

## 📸 Screenshots

> Dashboard with real-time AQI, weather, and map view for Chennai.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 👤 Author

**Jeyadev** — [@jeyadev-jd](https://github.com/jeyadev-jd)

---

## Author

**Jeyadev R** · AI/ML Engineer & Full-Stack Developer · Chennai, India

- Portfolio: [jeyadev.dev](https://jeyadev.dev/projects/pollumap-v3)
- GitHub: [@jeyadev-jd](https://github.com/jeyadev-jd)
- LinkedIn: [r-jeyadev](https://www.linkedin.com/in/r-jeyadev)

If this project is useful to you, a ⭐ on the repo helps others find it.
