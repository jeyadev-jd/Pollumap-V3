import asyncio
import os
import datetime
from app.db.database import get_database, connect_to_mongo, close_mongo_connection
from app.services.fetchers.waqi import fetch_live_waqi_data, fetch_waqi_station_metadata
from app.services.fetchers.overpass import fetch_city_areas, fetch_osm_sources
from app.services.fetchers.meteo import fetch_meteo_data, fetch_cams_data
from app.services.fetchers.firms import fetch_firms_data
from app.services.core_logic.apportionment import apportion_sources
from app.services.core_logic.forecasting import generate_xgb_forecast, load_history, fetch_meteo_forecast

POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co', 'voc']

# ─── Indian National AQI (CPCB) breakpoints ─────────────────────────────────
# Format: (Cp_low, Cp_high, AQI_low, AQI_high)
_NAQI_BREAKPOINTS = {
    # PM2.5 µg/m³ (24-hr avg)
    'pm25': [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)],
    # PM10 µg/m³ (24-hr avg)
    'pm10': [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)],
    # NO2 µg/m³ (annual avg)
    'no2':  [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,800,401,500)],
    # SO2 µg/m³ (24-hr avg)
    'so2':  [(0,40,0,50),(40,80,51,100),(80,380,101,200),(380,800,201,300),(800,1600,301,400),(1600,2620,401,500)],
    # O3 µg/m³ (8-hr avg)
    'o3':   [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1000,401,500)],
    # CO mg/m³ (8-hr avg) — note: worker stores in µg/m³, convert /1000
    'co':   [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,46,401,500)],
}

_NAQI_CATEGORIES = [
    (50,  'Good',           '#00b050'),
    (100, 'Satisfactory',   '#92d050'),
    (200, 'Moderate',       '#ffff00'),
    (300, 'Poor',           '#ff7e00'),
    (400, 'Very Poor',      '#ff0000'),
    (500, 'Severe',         '#7030a0'),
]

def _sub_index(pollutant: str, concentration: float) -> float:
    """Piecewise linear AQI sub-index per CPCB Indian NAQI standard."""
    if pollutant == 'co':
        concentration = concentration / 1000.0   # µg/m³ → mg/m³
    bps = _NAQI_BREAKPOINTS.get(pollutant)
    if bps is None:
        return 0.0
    for (bl, bh, il, ih) in bps:
        if bl <= concentration <= bh:
            return il + (ih - il) * (concentration - bl) / (bh - bl)
    if concentration > bps[-1][1]:
        return 500.0
    return 0.0

def calculate_aqi(pollutants: dict) -> tuple[int, str, str]:
    """
    Indian NAQI (CPCB): sub-index per pollutant, final = max sub-index.
    Returns (aqi_int, category_str, color_hex).
    """
    sub_indices = {p: _sub_index(p, v) for p, v in pollutants.items() if v is not None and p in _NAQI_BREAKPOINTS}
    if not sub_indices:
        return 50, 'Good', '#00b050'
    aqi = max(sub_indices.values())
    aqi_int = int(round(aqi))
    for threshold, cat, color in _NAQI_CATEGORIES:
        if aqi_int <= threshold:
            return aqi_int, cat, color
    return 500, 'Severe', '#7030a0'

async def hourly_pipeline():
    """Main background worker updating MongoDB collections every hour"""
    print(f"\n[{datetime.datetime.now()}] 🔄 Starting hourly background update...")
    db = get_database()
    cities = ["Chennai", "Delhi"]
    
    for city in cities:
        # Ensure static metadata exists (Overpass regions, OSM sources, WAQI stations)
        await fetch_city_areas(city)
        await fetch_osm_sources(city)
        
        station_count = await db.waqi_stations.count_documents({"city": city})
        if station_count == 0:
            await fetch_waqi_station_metadata(city)
            
        # Get all locations for this city
        locations_cursor = db.city_areas.find({"city": city})
        locations = await locations_cursor.to_list(length=None)
        
        osm_sources_cursor = db.osm_sources.find({"city": city})
        osm_sources = await osm_sources_cursor.to_list(length=None)
        
        # NASA FIRMS data. The key comes from the environment; without it fires are skipped
        # (never hardcode keys in source control).
        firms_key = os.getenv("NASA_FIRMS_API_KEY")
        bounds = [79.8, 12.7, 80.4, 13.3] if city == "Chennai" else [76.8, 28.4, 77.4, 28.9]
        firms_fires = await fetch_firms_data(firms_key, bounds) if firms_key else []
        if not firms_key:
            print("  [FIRMS] NASA_FIRMS_API_KEY not set; fire data skipped.")

        # In a real scenario, we'd batch these up. 
        # For this prototype structure, we process the first 5 locations to avoid rate limits instantly.
        for loc in locations[:5]:
            try:
                # 1. Fetch live Meteo & CAMS
                meteo_res = await fetch_meteo_data([loc['lat']], [loc['lon']])
                cams_res = await fetch_cams_data([loc['lat']], [loc['lon']])
                
                meteo = meteo_res[0].get('current', {}) if meteo_res else {}
                cams = cams_res[0].get('current', {}) if cams_res else {}
                
                # Format CAMS to standard pollutant keys. Missing values are NOT replaced with
                # invented defaults: a location with an incomplete reading is skipped this cycle.
                cams_map = {'pm25': 'pm2_5', 'pm10': 'pm10', 'o3': 'ozone', 'no2': 'nitrogen_dioxide',
                            'so2': 'sulphur_dioxide', 'co': 'carbon_monoxide'}
                base_pollutants = {k: cams.get(v) for k, v in cams_map.items()}
                missing = [k for k, v in base_pollutants.items() if v is None]
                if missing:
                    print(f"  [skip] {loc['name']}: no CAMS value for {missing}")
                    continue
                base_pollutants = {k: float(v) for k, v in base_pollutants.items()}

                # 2. Source Apportionment
                sources = apportion_sources(loc, base_pollutants, osm_sources, meteo, firms_fires)
                
                # 3. AQI Calcs (Indian NAQI)
                aqi_int, aqi_category, aqi_color = calculate_aqi(base_pollutants)
                sub_indices = {p: round(_sub_index(p, v), 1) for p, v in base_pollutants.items() if p in _NAQI_BREAKPOINTS}
                
                # 4. Save Snapshot
                snapshot = {
                    "city": city,
                    "location": loc["name"],
                    "timestamp": datetime.datetime.utcnow(),
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                    "aqi": aqi_int,
                    "aqi_category": aqi_category,
                    "aqi_color": aqi_color,
                    "sub_indices": sub_indices,
                    "pollutants_final": base_pollutants,
                    "pollutants_source": "CAMS via Open-Meteo (model grid, not station measurements)",
                    "sources": sources,
                    "meteo": meteo
                }
                
                await db.aqi_snapshots.insert_one(snapshot)

                # 5. Forecast from real stored history (empty list when history is too short)
                try:
                    history = await load_history(db, city, loc["name"])
                    meteo_fc = fetch_meteo_forecast(loc["lat"], loc["lon"], 24)
                    forecasts = generate_xgb_forecast(loc, history, meteo_fc, hours_ahead=24)
                    if forecasts:
                        await db.aqi_forecasts.delete_many(
                            {"city": city, "location": loc["name"]}
                        )
                        await db.aqi_forecasts.insert_many(forecasts)
                        print(f"  [forecast] Saved {len(forecasts)} points for {loc['name']}")
                except Exception as fe:
                    print(f"  [forecast] Error for {loc['name']}: {fe}")

            except Exception as e:
                print(f"Error processing location {loc['name']}: {e}")
                
    print(f"✅ Hourly update complete.")

async def start_worker():
    await connect_to_mongo()
    while True:
        await hourly_pipeline()
        print("💤 Worker sleeping for 30 minutes...")
        await asyncio.sleep(1800) # Run every 30 mins

if __name__ == "__main__":
    asyncio.run(start_worker())
