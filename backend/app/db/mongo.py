import logging
from typing import Optional
from backend.app.config import settings

logger = logging.getLogger("pulsebug.mongo")

_mongo_client = None
_mongo_db = None

async def init_mongo():
    """Initializes MongoDB Atlas connection if MONGODB_URL is provided."""
    global _mongo_client, _mongo_db
    
    if not settings.MONGODB_URL:
        logger.info("[MongoDB Atlas] MONGODB_URL not configured. Running with standard relational SQL store.")
        return None

    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        
        logger.info(f"[MongoDB Atlas] Connecting to MongoDB Atlas cluster...")
        _mongo_client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000
        )
        
        # Ping the server
        await _mongo_client.admin.command("ping")
        _mongo_db = _mongo_client[settings.MONGODB_DB_NAME]
        logger.info(f"[MongoDB Atlas] Successfully connected to database '{settings.MONGODB_DB_NAME}'!")
        return _mongo_db
    except Exception as e:
        logger.warning(f"[MongoDB Atlas] Could not connect to Atlas cluster: {e}. Falling back gracefully.")
        _mongo_client = None
        _mongo_db = None
        return None

def get_mongo_db():
    """Returns the MongoDB database instance if connected."""
    return _mongo_db

async def close_mongo():
    """Closes MongoDB Atlas connection."""
    global _mongo_client
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
