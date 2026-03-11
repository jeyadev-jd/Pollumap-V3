import asyncio
from app.db.database import connect_to_mongo, close_mongo_connection, get_database

async def test_db():
    print("Testing DB Connection...")
    await connect_to_mongo()
    db = get_database()
    print("Connected.")
    
    city = "Chennai"
    print(f"Fetching locations for {city}...")
    locations = await db.city_areas.find({"city": city}, {"_id": 0}).to_list(100)
    print(f"Found {len(locations)} locations.")
    
    for loc in locations:
        latest = await db.aqi_snapshots.find_one(
            {"city": city, "location": loc["name"]},
            sort=[("timestamp", -1)],
            projection={"_id": 0}
        )
        if latest:
            print(f"Found snapshot for {loc['name']}")
    
    await close_mongo_connection()
    print("Done testing DB.")

if __name__ == "__main__":
    asyncio.run(test_db())
