import os
import sys

# Ensure root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app.db.session import SessionLocal, sync_engine, Base
from backend.app.services.seed_service import seed_database

if __name__ == "__main__":
    print("[PulseBug] Initializing tables and seeding rich sample dataset...")
    Base.metadata.create_all(bind=sync_engine)
    db = SessionLocal()
    try:
        seed_database(db, force=True)
        print("[PulseBug] Seeding completed successfully!")
    finally:
        db.close()
