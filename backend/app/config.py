import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PulseBug - Modern Intelligent Bug Tracking Platform"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-pulsebug-key-for-jwt-tokens-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./pulsebug.db")
    SYNC_DATABASE_URL: str = os.getenv("SYNC_DATABASE_URL", "sqlite:///./pulsebug.db")
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # SLA Config (in hours)
    SLA_HOURS_P1: int = 24       # Critical: 24 hours
    SLA_HOURS_P2: int = 72       # High: 3 days (72 hours)
    SLA_HOURS_P3: int = 168      # Medium: 7 days (168 hours)
    SLA_HOURS_P4: int = 336      # Low: 14 days (336 hours)
    
    # Stale bug threshold (in days)
    STALE_BUG_DAYS: int = 30
    
    # AI Engine Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "hybrid")  # "hybrid", "local", "gemini"
    
    # File upload
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
    MAX_FILE_SIZE_MB: int = 25

    class Config:
        case_sensitive = True
        extra = "allow"

settings = Settings()
