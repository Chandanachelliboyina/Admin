from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fetch MongoDB settings from .env, falling back to local defaults if missing
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "bmm_admin_db")

PREVIOUS_MONGODB_URL = os.getenv("PREVIOUS_MONGODB_URL", "mongodb://localhost:27017")
PREVIOUS_DATABASE_NAME = os.getenv("PREVIOUS_DATABASE_NAME", "bmm_employee_db")

class Database:
    client: AsyncIOMotorClient = None
    db = None
    
    prev_client: AsyncIOMotorClient = None
    prev_db = None

db_instance = Database()

async def connect_to_mongo():
    """Establish connection to MongoDB."""
    print(f"Connecting to Main Admin MongoDB at {MONGODB_URL}...")
    try:
        db_instance.client = AsyncIOMotorClient(MONGODB_URL)
        db_instance.db = db_instance.client[DATABASE_NAME]
        print("Successfully connected to Main Admin MongoDB!")
    except Exception as e:
        print(f"Error connecting to Main Admin MongoDB: {e}")

    print(f"Connecting to Previous Employee MongoDB at {PREVIOUS_MONGODB_URL}...")
    try:
        db_instance.prev_client = AsyncIOMotorClient(PREVIOUS_MONGODB_URL)
        db_instance.prev_db = db_instance.prev_client[PREVIOUS_DATABASE_NAME]
        print("Successfully connected to Previous Employee MongoDB!")
    except Exception as e:
        print(f"Error connecting to Previous Employee MongoDB: {e}")

async def close_mongo_connection():
    """Close the MongoDB connection."""
    if db_instance.client:
        print("Closing Main MongoDB connection...")
        db_instance.client.close()
    if db_instance.prev_client:
        print("Closing Previous MongoDB connection...")
        db_instance.prev_client.close()
    print("All MongoDB connections closed.")

def get_db():
    """Helper to fetch the main database instance."""
    return db_instance.db

def get_previous_db():
    """Helper to fetch the previous employee database instance."""
    return db_instance.prev_db
