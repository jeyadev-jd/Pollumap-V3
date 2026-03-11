import httpx
import os
from typing import List, Dict, Any
from app.db.database import get_database

WAQI_API_TOKEN = os.getenv("WAQI_API_TOKEN", "da77cadeed5012f680511ebc6714745443487a0d")
POLLUTANTS = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co', 'voc']

async def fetch_waqi_station_metadata(city: str) -> List[Dict[str, Any]]:
    """Populates waqi_stations collection with static metadata"""
    url = f"https://api.waqi.info/search/?token={WAQI_API_TOKEN}&keyword={city}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10.0)
        
    if response.status_code == 200:
        data = response.json()
        if data.get("status") == "ok":
            db = get_database()
            stations = []
            for s in data["data"]:
                station_doc = {
                    "city": city,
                    "station_id": s["station"]["url"],
                    "name": s["station"]["name"],
                    "lat": s["station"]["geo"][0],
                    "lon": s["station"]["geo"][1]
                }
                
                # Upsert into DB
                await db.waqi_stations.update_one(
                    {"city": city, "station_id": station_doc["station_id"]},
                    {"$set": station_doc},
                    upsert=True
                )
                stations.append(station_doc)
            print(f"✅ Upserted {len(stations)} WAQI stations for {city}")
            return stations
    return []

async def fetch_live_waqi_data(station_ids: List[str]) -> Dict[str, Dict[str, float]]:
    """Fetches real-time IAQI values for a list of station IDs"""
    live_data = {}
    
    async with httpx.AsyncClient() as client:
        for st_id in station_ids:
            url = f"https://api.waqi.info/feed/{st_id}/?token={WAQI_API_TOKEN}"
            try:
                response = await client.get(url, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "ok":
                        iaqi = data["data"].get("iaqi", {})
                        live_data[st_id] = {p: iaqi.get(p, {}).get("v") for p in POLLUTANTS}
            except Exception as e:
                print(f"Error fetching live WAQI data for {st_id}: {e}")
                
    return live_data
