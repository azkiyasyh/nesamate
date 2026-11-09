from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.routes.chat import router as chat_router
from backend.app.routes.challenge import router as challenge_router
from backend.app.routes.data import router as data_router

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR.parent / "frontend"

app = FastAPI(
    title="NesaMate API",
    description="Backend API untuk Nesa AI Virtual Tour Guide Hutan UNESA",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan Router API
app.include_router(chat_router)
app.include_router(challenge_router)
app.include_router(data_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "NesaMate", "version": "2.0.0"}


# Mount frontend statis (setelah API router)
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
