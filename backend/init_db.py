import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import pymongo

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "pollumap_v3")

async def init_db():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("Creating collections and indexes...")

    # city_areas: Unique index on city, lat, lon
    print(" -> Setting up `city_areas`")
    await db.city_areas.create_index(
        [("city", pymongo.ASCENDING), ("lat", pymongo.ASCENDING), ("lon", pymongo.ASCENDING)],
        unique=True
    )

    # waqi_stations: Unique index on city, station_id
    print(" -> Setting up `waqi_stations`")
    await db.waqi_stations.create_index(
        [("city", pymongo.ASCENDING), ("station_id", pymongo.ASCENDING)],
        unique=True
    )

    # osm_sources: Index on city, type
    print(" -> Setting up `osm_sources`")
    await db.osm_sources.create_index(
        [("city", pymongo.ASCENDING), ("type", pymongo.ASCENDING)]
    )

    # aqi_snapshots: 
    # 1. Query optimization index on city, location, timestamp (descending)
    # 2. TTL Index to auto-expire documents older than 48 hours (172800 seconds)
    print(" -> Setting up `aqi_snapshots`")
    await db.aqi_snapshots.create_index(
        [("city", pymongo.ASCENDING), ("location", pymongo.ASCENDING), ("timestamp", pymongo.DESCENDING)]
    )
    await db.aqi_snapshots.create_index(
        [("timestamp", pymongo.ASCENDING)],
        expireAfterSeconds=172800
    )

    # aqi_forecasts: Similar structure to snapshots
    print(" -> Setting up `aqi_forecasts`")
    await db.aqi_forecasts.create_index(
        [("city", pymongo.ASCENDING), ("location", pymongo.ASCENDING), ("forecast_for", pymongo.DESCENDING)]
    )

    print("\n✅ Database initialization complete!")

if __name__ == "__main__":
    asyncio.run(init_db())
