"""
Voice analysis router
Exposes:
  POST /analyze/voice  — multipart audio file upload (webm/wav/mp3/ogg)
"""

import logging
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from typing import Optional

from models.schemas import EmotionResult, EmotionScores

log    = logging.getLogger("router.voice")
router = APIRouter()

ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/wav", "audio/wave", "audio/x-wav",
    "audio/mpeg", "audio/mp3", "audio/ogg", "audio/x-m4a",
    "application/octet-stream",   # some browsers send this for webm blobs
}


@router.post("/voice", response_model=EmotionResult, summary="Analyse emotion from audio recording")
async def analyze_voice(
    request:    Request,
    file:       UploadFile = File(..., description="Audio file: webm, wav, mp3, or ogg"),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
):
    """
    Receive an audio recording from the browser MediaRecorder API and
    return speech emotion scores.

    **Pipeline**
    1. Decode audio bytes → 16 kHz mono waveform (via librosa)
    2. Extract acoustic features (pitch, energy, MFCC, tempo)
    3. Run Wav2Vec2 speech emotion classifier
    4. Apply acoustic heuristics for stressed/anxious detection
    5. Return EmotionResult (ready to POST to /api/emotions)

    **Typical browser recording format**: `audio/webm;codecs=opus`
    """
    svc = getattr(request.app.state, "voice_service", None)
    if svc is None:
        raise HTTPException(503, "Voice service not initialised")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_AUDIO_TYPES and content_type:
        log.warning(f"Unexpected content type: {file.content_type} — proceeding anyway")

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(400, "Uploaded audio file is empty")

    if len(audio_bytes) < 4_000:
        raise HTTPException(400, "Audio too short (< ~0.25 s). Record for at least 2 seconds.")

    try:
        result = svc.analyze(
            audio_bytes,
            session_id=session_id,
            original_filename=file.filename or "audio.webm",
        )
    except Exception as e:
        log.exception("Voice analysis failed")
        raise HTTPException(500, f"Analysis error: {e}")

    scores_dict = result.get("emotionScores", {})
    return EmotionResult(
        detectionType = result["detectionType"],
        emotion       = result["emotion"],
        confidence    = result["confidence"],
        sentiment     = result["sentiment"],
        emotionScores = EmotionScores(**scores_dict),
        sessionId     = result.get("sessionId"),
        audioFeatures = result.get("audioFeatures"),
        speechText    = result.get("speechText"),
        modelBackend  = result.get("modelBackend"),
        processingMs  = result.get("processingMs"),
        warning       = result.get("warning"),
    )
