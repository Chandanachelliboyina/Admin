from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fetch MongoDB settings from .env, falling back to local defaults if missing
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "bmm_admin_db")

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    """Establish connection to MongoDB."""
    print(f"Connecting to MongoDB at {MONGODB_URL}...")
    try:
        db_instance.client = AsyncIOMotorClient(MONGODB_URL)
        db_instance.db = db_instance.client[DATABASE_NAME]
        print("Successfully connected to MongoDB!")
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")

async def close_mongo_connection():
    """Close the MongoDB connection."""
    if db_instance.client:
        print("Closing MongoDB connection...")
        db_instance.client.close()
        print("MongoDB connection closed.")

def get_db():
    """Helper to fetch the database instance."""
    return db_instance.db
