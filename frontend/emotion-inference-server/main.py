"""
AlzheimerCare — Emotion Inference Server
=========================================
FastAPI service that exposes two endpoints:
  POST /analyze/face   — receives a base64 image or file upload
  POST /analyze/voice  — receives an audio file (wav/mp3/webm)

Both return a standardised EmotionResult payload that the React
frontend posts directly to the Node.js backend /api/emotions route.
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import face, voice, transcribe
from models.schemas import HealthResponse

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("main")

# ── Lifespan: pre-load models on startup ─────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("⏳  Pre-loading emotion models…")
    from services.face_service         import FaceEmotionService
    from services.voice_service        import VoiceEmotionService
    from services.transcription_service import TranscriptionService
    app.state.face_service         = FaceEmotionService()
    app.state.voice_service        = VoiceEmotionService()
    app.state.transcription_service = TranscriptionService()
    log.info("✅  Models ready.")
    yield
    log.info("👋  Shutting down inference server.")

# ── App ───────────────────────────────────────────────────────
app = FastAPI(
    title="AlzheimerCare Emotion Inference API",
    version="1.0.0",
    description="Real-time face and voice emotion detection powered by DeepFace + Wav2Vec2",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(face.router,       prefix="/analyze", tags=["Face Detection"])
app.include_router(voice.router,      prefix="/analyze", tags=["Voice Detection"])
app.include_router(transcribe.router, prefix="/analyze", tags=["Transcription"])

# ── Health ────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", message="Emotion inference server is running")
