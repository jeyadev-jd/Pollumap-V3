from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "pollumap_v3")

class Database:
    client: AsyncIOMotorClient = None

db = Database()

async def connect_to_mongo():
    print(f"Connecting to MongoDB at {MONGO_URI}...")
    db.client = AsyncIOMotorClient(MONGO_URI)
    print("Connected to MongoDB!")

async def close_mongo_connection():
    if db.client:
        print("Closing MongoDB connection...")
        db.client.close()
        print("MongoDB connection closed.")

def get_database():
    return db.client[DB_NAME]
