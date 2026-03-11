from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()
mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")

try:
    print(f"Connecting to {mongo_uri}...")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print("Error:", e)
