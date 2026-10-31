"""
Face analysis router
Exposes two endpoints:
  POST /analyze/face/base64  — JSON body with base64 image
  POST /analyze/face/upload  — multipart file upload
"""

import logging
from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional

from models.schemas import FaceAnalysisRequest, EmotionResult, EmotionScores

log    = logging.getLogger("router.face")
router = APIRouter()


@router.post("/face/base64", response_model=EmotionResult, summary="Analyse face from base64 image")
async def analyze_face_base64(request: Request, body: FaceAnalysisRequest):
    """
    Receive a base64-encoded webcam screenshot and return emotion scores.

    **Request body**
    ```json
    {
      "image_base64": "data:image/jpeg;base64,/9j/4AAQ...",
      "patient_id":   "66abc123...",
      "session_id":   "sess-001"
    }
    ```

    **Response** — EmotionResult schema (ready to POST to /api/emotions)
    """
    svc = getattr(request.app.state, "face_service", None)
    if svc is None:
        raise HTTPException(503, "Face service not initialised")

    if not body.image_base64:
        raise HTTPException(400, "image_base64 is required")

    try:
        result = svc.analyze_base64(body.image_base64, body.session_id)
    except Exception as e:
        log.exception("Face analysis failed")
        raise HTTPException(500, f"Analysis error: {e}")

    return _build_response(result)


@router.post("/face/upload", response_model=EmotionResult, summary="Analyse face from uploaded image file")
async def analyze_face_upload(
    request:    Request,
    file:       UploadFile = File(..., description="JPEG or PNG image"),
    patient_id: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
):
    """
    Receive an image file upload (JPEG / PNG) and return emotion scores.
    Useful when the frontend captures a blob rather than a base64 string.
    """
    svc = getattr(request.app.state, "face_service", None)
    if svc is None:
        raise HTTPException(503, "Face service not initialised")

    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, f"Unsupported image type: {file.content_type}. Use JPEG or PNG.")

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(400, "Uploaded file is empty")

    try:
        result = svc.analyze_bytes(image_bytes, session_id)
    except Exception as e:
        log.exception("Face upload analysis failed")
        raise HTTPException(500, f"Analysis error: {e}")

    return _build_response(result)


# ── Helpers ───────────────────────────────────────────────────

def _build_response(result: dict) -> EmotionResult:
    scores_dict = result.get("emotionScores", {})
    return EmotionResult(
        detectionType     = result["detectionType"],
        emotion           = result["emotion"],
        confidence        = result["confidence"],
        sentiment         = result["sentiment"],
        emotionScores     = EmotionScores(**scores_dict),
        sessionId         = result.get("sessionId"),
        facialActionUnits = result.get("facialActionUnits"),
        modelBackend      = result.get("modelBackend"),
        processingMs      = result.get("processingMs"),
        warning           = result.get("warning"),
    )
