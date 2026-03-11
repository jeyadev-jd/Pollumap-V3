import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from app.services.core_logic.routing import evaluate_routes
from app.db.database import connect_to_mongo, close_mongo_connection

async def test():
    await connect_to_mongo()
    res = await evaluate_routes("Chennai", 13.0827, 80.2707, 13.0450, 80.2200)
    print("Fastest route duration:", res.get("fastest", {}).get("duration"), "mins")
    print("Cleanest route duration:", res.get("cleanest", {}).get("duration"), "mins")
    print("Fastest exposure:", res.get("fastest", {}).get("total_exposure"))
    print("Cleanest exposure:", res.get("cleanest", {}).get("total_exposure"))
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test())
