# Pollumap V3 - API Documentation

Welcome to the comprehensive API documentation for the Pollumap V3 backend! 
This backend is built on **FastAPI** (`routes.py`) and serves as the data engine for interacting with MongoDB to fetch, infer, process, and combine air quality snapshots, forecasts, satellite fire data, weather parameters, and generate healthy routing paths.

Below is an extensive guide to the structure, purpose, logic, and interface of all REST API endpoints.

---

## 🏗️ 1. City & Location Metadata

### Get Supported Cities
- **Endpoint:** `GET /cities`
- **Description:** Returns a statically defined list of supported cities within the Pollumap system that have active data pipelines. Currently supported: `"Chennai"` and `"Delhi"`.
- **Response Format:** `Array<string>`
  ```json
  ["Chennai", "Delhi"]
  ```

### Get Sensor Locations
- **Endpoint:** `GET /locations`
- **Description:** Fetches up to 1000 geographical areas/sensor stations within a given city. Under the hood, this queries the `city_areas` collection and attempts to cross-reference and enrich each location with the most recent snapshot from the `aqi_snapshots` collection.
- **Query Parameters:**
  - `city` (string, required): The name of the target city.
- **Logic Details:** It asynchronously queries snapshots for each location, attaching keys like `aqi`, `aqi_category`, and `aqi_color` if current data exists, otherwise returning the bare area object. Both enriched and raw locations are combined and returned.
- **Response Format:** `Array<Object>`

### Search Areas
- **Endpoint:** `GET /areas/search`
- **Description:** Provides autocomplete functionality to search for specific area names from the `city_areas` collection. Used heavily in the frontend's search components.
- **Query Parameters:**
  - `city` (string, required): The name of the city.
  - `q` (string, required): The search query prefix (minimum length: 1).
- **Limit:** Returns up to 10 matching results.
- **Response Format:** `Array<Object>` (List of matching area dictionary objects)

---

## 💨 2. Air Quality Data & Forecasting

### Get Current AQI
- **Endpoint:** `GET /current`
- **Description:** Gets the most recent air quality index snapshot for a specific location.
- **Query Parameters:**
  - `city` (string, required): Name of the city.
  - `location` (string, required): Specific location or area name.
- **Logic Details (Fallback Inference):** If the exact string match for `location` doesn't yield an `aqi_snapshot`, the API automatically looks up the coordinates for the requested string in `city_areas` and calculates the Haversine distance to the 100 most recent active sensor stations. It then assigns the closest station's AQI values to the requested location and flags it with `_is_inferred = True`.
- **Response Format:** Single JSON `Object` representing the latest valid `aqi_snapshot`.

### Get AQI History
- **Endpoint:** `GET /history`
- **Description:** Retrieves an array of chronological, historical AQI snapshots for a specified location up to a given number of hours.
- **Query Parameters:**
  - `city` (string, required)
  - `location` (string, required)
  - `hours` (int, default: 24): The maximum timeframe (in hours) to retrieve.
- **Logic Details:** Like `GET /current`, it employs spatial fallback inference if the direct location doesn't have native history available. Results are returned chronologically reversed (`[::-1]`).
- **Response Format:** `Array<Object>` (History records)

### Get AQI Forecast
- **Endpoint:** `GET /forecast`
- **Description:** Retrieves pre-computed XGBoost machine learning hourly AQI forecasts for a given location, looking forward in time.
- **Query Parameters:**
  - `city` (string, required)
  - `location` (string, required)
  - `hours` (int, default: 24): Hours ahead to return.
- **Logic Details:** Operates with fallback spatial inference mapping exactly like `/history` and `/current`. 
- **Response Format:** `Array<Object>` (Forecast data points sorted by the `forecast_for` timestamp).

### Generate Forecast
- **Endpoint:** `POST /forecast/generate`
- **Description:** A trigger endpoint that forces the generation of an XGBoost-powered 24-hour pollutant and weather forecast for a specific location based on the *latest* available database snapshot.
- **Query Parameters:**
  - `city` (string, required)
  - `location` (string, required)
- **Logic Details:** 
  1. Pulls the latest valid snapshot as the anchor point.
  2. Runs `generate_xgb_forecast` based on synthetic historical patterns & the latest pollutant/meteorological state.
  3. Purges all existing/stale forecasts for this location in the database.
  4. Inserts the new batch of 24 hourly predictions.
- **Response Format:** An operational status object describing how many points were generated and the anchor timestamp used.

---

## 🌍 3. External Data Sources

### Get Active Fires
- **Endpoint:** `GET /fires`
- **Description:** Aggregates and returns live, active satellite fire hotspots sourced from NASA's FIRMS API.
- **Query Parameters:**
  - `city` (string, required): Used to dynamically assign a hardcoded geographic bounding box (e.g. `[79.8, 12.7, 80.4, 13.3]` for Chennai).
- **Response Format:** Direct JSON payload from the NASA FIRMS fetcher.

### Get OSM Sources
- **Endpoint:** `GET /osm-sources`
- **Description:** Retrieves pre-cached OpenStreetMap source entities (such as road graphs, emissions zones, etc.) for up to 5000 records.
- **Query Parameters:**
  - `city` (string, required)
- **Response Format:** `Array<Object>`

---

## 🧠 4. Health Insights & Analytics

### Generate Local AI Insights
- **Endpoint:** `POST /insights/generate`
- **Description:** Synthesizes local health insights, advisory warnings, and descriptive analyses using AI.
- **Query Parameters:**
  - `city` (string, required)
  - `location` (string, required)
- **Logic Details:** Consolidates the latest AQI real-time snapshot (pollutants, weather, and source apportionment) along with the 24-hour predictive forecast arrays. It passes this rich dataset into the `generate_local_ai_insight` core logic module and persists the output into the `health_insights` MongoDB collection.
- **Response Format:** The complete generated insight string document object, including a `timestamp`.

### Get Insights History
- **Endpoint:** `GET /insights/history`
- **Description:** Retrieves past chronological records of AI-generated health insights.
- **Query Parameters:**
  - `city` (string, required)
  - `location` (string, required)
  - `limit` (int, default: 10): Maximum number of historical records to return.
- **Response Format:** `Array<Object>`

### Save Analytics
- **Endpoint:** `POST /analytics/save`
- **Description:** A generic sink for saving client-side multi-pollutant correlations, exploratory insights, or custom analytics telemetry back to the database.
- **Body Payload Requirement:** A JSON dictionary containing whatever analytics data needs to be logged.
- **Logic Details:** Appends a server-side `saved_at` timestamp before insertion into the `health_analytics` collection.
- **Response Format:** JSON object containing `{"status": "success", "id": "<inserted MongoDB ObjectId>"}`

---

## 🚶‍♂️ 5. Healthy Routing API (A* Algorithm)

### Get Optimal Route by Coordinates
- **Endpoint:** `GET /optimal-route`
- **Description:** The core routing endpoint. Given two geographic coordinates and a transport mode, it calculates not just the fastest logical route (like traditional GPS), but also parallel alternatives: the *cleanest route* (least pollution exposure) and the *balanced route* (compromise between time and safety).
- **Query Parameters:**
  - `city` (string, required)
  - `start_lat` (float, required)
  - `start_lon` (float, required)
  - `end_lat` (float, required)
  - `end_lon` (float, required)
  - `mode` (string, default: `"car"`): Supported modes include `car`, `bus`, `walking`, and `cycling`.
- **Response Format:** A complex nested JSON dictionary containing coordinate arrays, estimated duration, distances, path coordinates, and a comparative multi-mode exposure analysis matrix.

### Get Optimal Route by Area
- **Endpoint:** `GET /route-by-area`
- **Description:** A frontend-friendly wrapper around `/optimal-route`. Instead of needing exact lat/long floats, modern clients can just pass area name strings.
- **Query Parameters:**
  - `city` (string, required)
  - `start_area` (string, required): e.g., "T Nagar"
  - `end_area` (string, required): e.g., "Adyar"
  - `mode` (string, default: `"car"`)
- **Logic Details:** Performs an internal lookup of `start_area` and `end_area` against the `city_areas` database to derive exact latitudes and longitudes, then proceeds exactly as `/optimal-route`. Results are enriched by appending the textual area names into the output response payload.

### Clear Route Cache
- **Endpoint:** `DELETE /cache/clear`
- **Description:** Wipes the entire `route_cache` collection in the local MongoDB. Crucial for triggering fresh A* algorithm graph traversal calculations immediately following large-scale new data ingestion or major sensor reading changes.
- **Response Format:** `{"deleted": <number of records wiped>}`
