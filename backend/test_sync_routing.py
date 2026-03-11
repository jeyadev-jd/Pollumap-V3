import asyncio
import os
import requests
from dotenv import load_dotenv
from app.db.database import connect_to_mongo, close_mongo_connection, get_database

load_dotenv()

async def test():
    API_KEY = os.getenv("ORS_API_KEY")
    url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': API_KEY
    }
    payload = {
        "coordinates": [[80.2707, 13.0827], [80.2435, 12.9716]],
        "alternative_routes": {
            "share_factor": 0.6,
            "target_count": 3
        }
    }
    print("Testing synchronous request with test_sync_routing.py...")
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        print("Status:", response.status_code)
        if response.status_code == 200:
            data = response.json()
            features = data.get("features", [])
            print(f"Got {len(features)} routes.")
        else:
            print("Response:", response.text)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
