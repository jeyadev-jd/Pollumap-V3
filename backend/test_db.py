import asyncio
from app.db.database import connect_to_mongo
from app.api.routes import get_locations

async def main():
    await connect_to_mongo()
    try:
        res = await get_locations("Chennai")
        print("Success:", len(res))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
