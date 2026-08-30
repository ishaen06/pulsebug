import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.db.session import engine, sync_engine, Base, SessionLocal
from backend.app.services.seed_service import seed_database

# Routers
from backend.app.api.auth import router as auth_router
from backend.app.api.projects import router as projects_router
from backend.app.api.bugs import router as bugs_router
from backend.app.api.comments import router as comments_router
from backend.app.api.attachments import router as attachments_router
from backend.app.api.git import router as git_router
from backend.app.api.ai import router as ai_router
from backend.app.api.analytics import router as analytics_router
from backend.app.api.notifications import router as notifications_router
from backend.app.api.audit import router as audit_router
from backend.app.api.websockets import router as ws_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB schema
    Base.metadata.create_all(bind=sync_engine)
    
    # Safe automated schema migration for SQLite
    from sqlalchemy import text
    with sync_engine.connect() as conn:
        columns_to_add = [
            ("is_verified", "BOOLEAN DEFAULT 1"),
            ("verification_code", "VARCHAR(10)"),
            ("verification_code_expires_at", "DATETIME")
        ]
        for col_name, col_type in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
    
    # Run seed script on startup
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
        
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Modern Intelligent Bug Tracking & Developer Collaboration Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Uploads directory
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers under API_V1_STR
api_prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=api_prefix)
app.include_router(projects_router, prefix=api_prefix)
app.include_router(bugs_router, prefix=api_prefix)
app.include_router(comments_router, prefix=api_prefix)
app.include_router(attachments_router, prefix=api_prefix)
app.include_router(git_router, prefix=api_prefix)
app.include_router(ai_router, prefix=api_prefix)
app.include_router(analytics_router, prefix=api_prefix)
app.include_router(notifications_router, prefix=api_prefix)
app.include_router(audit_router, prefix=api_prefix)
app.include_router(ws_router, prefix=api_prefix)
app.include_router(ws_router)

@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "ai_engine": settings.AI_PROVIDER
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected", "ai_service": "ready"}
