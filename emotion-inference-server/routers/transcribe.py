"""
Transcription router
POST /analyze/transcribe  — transcribe audio to text with Whisper
POST /analyze/voice-full  — emotion + transcription in one call
"""

import logging
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from typing import Optional
from pydantic import BaseModel

from models.schemas import EmotionResult, EmotionScores

log    = logging.getLogger("router.transcribe")
router = APIRouter()


class TranscriptResult(BaseModel):
    text:             Optional[str]
    language:         Optional[str]
    segments:         list
    duration_seconds: Optional[float]
    processing_ms:    Optional[int]
    warning:          Optional[str]


class VoiceFullResult(BaseModel):
    """Combined emotion + transcription result."""
    emotion:     EmotionResult
    transcript:  TranscriptResult


# ── Transcription only ────────────────────────────────────────

@router.post("/transcribe", response_model=TranscriptResult,
             summary="Transcribe audio to text (Whisper)")
async def transcribe_audio(
    request:    Request,
    file:       UploadFile = File(..., description="Audio file: webm, wav, mp3, ogg, m4a"),
    language:   Optional[str] = Form(None, description="ISO 639-1 language code (auto-detect if omitted)"),
    session_id: Optional[str] = Form(None),
):
    """
    Transcribe speech to text using OpenAI Whisper (runs locally, no API key).

    Supports: webm, wav, mp3, ogg, m4a.
    Language auto-detected if not specified.
    """
    svc = getattr(request.app.state, "transcription_service", None)
    if svc is None:
        raise HTTPException(503, "Transcription service not initialised")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file")

    result = svc.transcribe(audio_bytes, original_filename=file.filename or "audio.webm", language=language)
    return TranscriptResult(**result)


# ── Combined: emotion + transcription ────────────────────────

@router.post("/voice-full", response_model=VoiceFullResult,
             summary="Emotion detection + transcription in one call")
async def analyze_voice_full(
    request:    Request,
    file:       UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    language:   Optional[str] = Form(None),
):
    """
    Combined endpoint: runs Wav2Vec2 emotion classification AND
    Whisper transcription on the same audio in parallel.
    Returns both results in a single response, saving a round-trip.
    """
    voice_svc  = getattr(request.app.state, "voice_service",        None)
    transc_svc = getattr(request.app.state, "transcription_service", None)

    if not voice_svc or not transc_svc:
        raise HTTPException(503, "Services not initialised")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio file")

    filename = file.filename or "audio.webm"

    # Run both analyses (they operate on the same bytes independently)
    import asyncio
    import concurrent.futures

    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as pool:
        emotion_future = loop.run_in_executor(pool, voice_svc.analyze, audio_bytes, session_id, filename)
        transc_future  = loop.run_in_executor(pool, transc_svc.transcribe, audio_bytes, filename, language)
        emotion_result, transc_result = await asyncio.gather(emotion_future, transc_future)

    # Attach transcript text to emotion result's speechText field
    if transc_result.get("text"):
        emotion_result["speechText"] = transc_result["text"]

    scores_dict = emotion_result.get("emotionScores", {})
    emotion_resp = EmotionResult(
        detectionType = emotion_result["detectionType"],
        emotion       = emotion_result["emotion"],
        confidence    = emotion_result["confidence"],
        sentiment     = emotion_result["sentiment"],
        emotionScores = EmotionScores(**scores_dict),
        sessionId     = emotion_result.get("sessionId"),
        audioFeatures = emotion_result.get("audioFeatures"),
        speechText    = emotion_result.get("speechText"),
        modelBackend  = emotion_result.get("modelBackend"),
        processingMs  = emotion_result.get("processingMs"),
        warning       = emotion_result.get("warning"),
    )

    return VoiceFullResult(
        emotion    = emotion_resp,
        transcript = TranscriptResult(**transc_result),
    )
