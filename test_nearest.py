import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import math

def _haversine(lat1, lon1, lat2, lon2):
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin(math.radians(lat2-lat1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(lon2-lon1)/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["pollumap_v3"]
    
    city = "Chennai"
    location = "Saidapet"
    
    # 1. get target coords
    target = await db.city_areas.find_one({"city": city, "name": location})
    lat1, lon1 = target["lat"], target["lon"]
    
    # 2. find a recent snapshot
    recent = await db.aqi_snapshots.find({"city": city}).sort("timestamp", -1).limit(50).to_list(50)
    
    # gather unique stations
    stations = {}
    for s in recent:
        if s["location"] not in stations:
            stations[s["location"]] = s
            
    # find closest
    closest = min(stations.values(), key=lambda s: _haversine(lat1, lon1, s.get("lat", 0), s.get("lon", 0)))
    print(f"Nearest to {location} is {closest['location']}")

asyncio.run(main())
