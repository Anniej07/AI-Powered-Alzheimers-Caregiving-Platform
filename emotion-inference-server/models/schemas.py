"""
Shared Pydantic schemas for request/response validation.
The EmotionResult schema matches exactly what the Node.js backend
expects at POST /api/emotions.
"""

from typing import Optional, Dict, List
from pydantic import BaseModel, Field


# ── Canonical emotion labels (matches backend Emotion model) ──
EMOTION_LABELS = [
    "happy", "sad", "angry", "fearful", "disgusted",
    "surprised", "neutral", "anxious", "confused", "stressed", "calm",
]

# ── DeepFace → canonical mapping ─────────────────────────────
DEEPFACE_MAP = {
    "happy":     "happy",
    "sad":       "sad",
    "angry":     "angry",
    "fear":      "fearful",
    "disgust":   "disgusted",
    "surprise":  "surprised",
    "neutral":   "neutral",
}

# ── Wav2Vec2 label → canonical mapping ───────────────────────
WAV2VEC_MAP = {
    # ehcalabres/wav2vec2-lg-xlsr model labels:
    "angry":    "angry",
    "calm":     "calm",
    "disgust":  "disgusted",
    "fearful":  "fearful",
    "happy":    "happy",
    "neutral":  "neutral",
    "sad":      "sad",
    "surprised":"surprised",
    # superb/wav2vec2-base-superb-er labels:
    "ang":      "angry",
    "hap":      "happy",
    "neu":      "neutral",
    "sad":      "sad",
    # Additional mappings for stress/anxiety inference
    "anxiety":  "anxious",
    "stress":   "stressed",
}


# ─────────────────────────────────────────────────────────────
# Request schemas
# ─────────────────────────────────────────────────────────────

class FaceAnalysisRequest(BaseModel):
    """Base64-encoded image (JPEG / PNG)."""
    image_base64: str = Field(..., description="Base64-encoded image data (with or without data URI prefix)")
    patient_id:   Optional[str] = None
    session_id:   Optional[str] = None


class VoiceAnalysisRequest(BaseModel):
    """Optional metadata accompanying an audio file upload."""
    patient_id:  Optional[str] = None
    session_id:  Optional[str] = None


# ─────────────────────────────────────────────────────────────
# Response schemas
# ─────────────────────────────────────────────────────────────

class EmotionScores(BaseModel):
    happy:     float = 0.0
    sad:       float = 0.0
    angry:     float = 0.0
    fearful:   float = 0.0
    disgusted: float = 0.0
    surprised: float = 0.0
    neutral:   float = 0.0
    anxious:   float = 0.0
    confused:  float = 0.0
    stressed:  float = 0.0
    calm:      float = 0.0


class EmotionResult(BaseModel):
    """
    Canonical result — mirrors the Node.js POST /api/emotions body.
    The frontend can pass this directly to the backend.
    """
    detectionType:  str            # "face" | "voice"
    emotion:        str            # dominant canonical emotion
    confidence:     float          # 0–100
    sentiment:      str            # "positive" | "negative" | "neutral"
    emotionScores:  EmotionScores
    sessionId:      Optional[str]  = None
    # Face-specific
    facialActionUnits: Optional[Dict] = None
    # Voice-specific
    audioFeatures:  Optional[Dict] = None
    speechText:     Optional[str]  = None
    # Meta
    modelBackend:   Optional[str]  = None
    processingMs:   Optional[int]  = None
    warning:        Optional[str]  = None


class HealthResponse(BaseModel):
    status:  str
    message: str
