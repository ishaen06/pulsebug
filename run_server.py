import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = "0.0.0.0"
    print(f"[PulseBug] Starting FastAPI server on {host}:{port}...")
    uvicorn.run("backend.app.main:app", host=host, port=port, log_level="info")
