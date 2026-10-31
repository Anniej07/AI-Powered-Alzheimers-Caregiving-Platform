import os
import io
import base64
import logging
import time
from typing import Dict, Optional

import cv2
import numpy as np
from PIL import Image

os.environ["DEEPFACE_HOME"] = os.getenv("DEEPFACE_HOME", "./model_cache")

log = logging.getLogger("face_service")

POSITIVE = {"happy", "surprised", "calm"}
NEGATIVE = {"sad", "angry", "fearful", "disgusted", "anxious", "confused", "stressed"}

DEEPFACE_TO_CANONICAL = {
    "happy":    "happy",
    "sad":      "sad",
    "angry":    "angry",
    "fear":     "fearful",
    "disgust":  "disgusted",
    "surprise": "surprised",
    "neutral":  "neutral",
}

CANONICAL_ZERO = {
    "happy": 0.0, "sad": 0.0, "angry": 0.0, "fearful": 0.0,
    "disgusted": 0.0, "surprised": 0.0, "neutral": 0.0,
    "anxious": 0.0, "confused": 0.0, "stressed": 0.0, "calm": 0.0,
}


class FaceEmotionService:

    def __init__(self):
        self.detector_backend = "opencv"
        self.min_confidence   = float(os.getenv("MIN_FACE_CONFIDENCE", "30.0"))
        self._deepface        = None
        log.info(f"FaceEmotionService initialised (detector={self.detector_backend})")
        self._warmup()

    def analyze_base64(self, image_b64: str, session_id: Optional[str] = None) -> Dict:
        img_array = self._decode_base64(image_b64)
        return self._run_analysis(img_array, session_id)

    def analyze_bytes(self, image_bytes: bytes, session_id: Optional[str] = None) -> Dict:
        img_array = self._decode_bytes(image_bytes)
        return self._run_analysis(img_array, session_id)

    def _warmup(self):
        try:
            from deepface import DeepFace
            self._deepface = DeepFace
            dummy = np.zeros((48, 48, 3), dtype=np.uint8)
            try:
                DeepFace.analyze(
                    img_path=dummy,
                    actions=["emotion"],
                    detector_backend="opencv",
                    enforce_detection=False,
                    silent=True,
                )
            except Exception:
                pass
            log.info("DeepFace models loaded successfully.")
        except Exception as e:
            log.error(f"DeepFace warmup failed: {e}")

    def _run_analysis(self, img_array: np.ndarray, session_id: Optional[str]) -> Dict:
        t0 = time.monotonic()

        if self._deepface is None:
            from deepface import DeepFace
            self._deepface = DeepFace

        warning          = None
        raw_emotions     = {}
        dominant_emotion = "neutral"
        confidence       = 0.0
        action_units     = {}

        try:
            # Convert to RGB for DeepFace
            img_rgb = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)

            results = self._deepface.analyze(
                img_path=img_rgb,
                actions=["emotion"],
                detector_backend="opencv",
                enforce_detection=False,
                silent=True,
            )

            result = results[0] if isinstance(results, list) else results

            # Handle case where result might be a tuple
            if isinstance(result, tuple):
                result = result[0] if len(result) > 0 else {}

            raw_emotions     = result.get("emotion", {})
            dominant_raw     = result.get("dominant_emotion", "neutral")
            dominant_emotion = DEEPFACE_TO_CANONICAL.get(dominant_raw, "neutral")
            confidence       = raw_emotions.get(dominant_raw, 0.0)

            region = result.get("region", {})
            action_units = {
                "face_x": region.get("x"),
                "face_y": region.get("y"),
                "face_w": region.get("w"),
                "face_h": region.get("h"),
            }

        except ValueError as e:
            warning          = f"No face detected: {e}"
            dominant_emotion = "neutral"
            confidence       = 0.0

        except Exception as e:
            warning          = f"Analysis error: {e}"
            log.error(warning)
            dominant_emotion = "neutral"
            confidence       = 0.0

        if confidence < self.min_confidence and dominant_emotion != "neutral":
            dominant_emotion = "neutral"
            warning = (warning or "") + f" Low confidence {confidence:.1f}%"

        emotion_scores = dict(CANONICAL_ZERO)
        for df_label, score in raw_emotions.items():
            canonical = DEEPFACE_TO_CANONICAL.get(df_label)
            if canonical:
                emotion_scores[canonical] = round(score, 2)

        if dominant_emotion in POSITIVE:
            sentiment = "positive"
        elif dominant_emotion in NEGATIVE:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        processing_ms = int((time.monotonic() - t0) * 1000)
        log.info(f"Face: {dominant_emotion} ({confidence:.1f}%) in {processing_ms}ms")

        return {
            "detectionType":     "face",
            "emotion":           dominant_emotion,
            "confidence":        round(confidence, 2),
            "sentiment":         sentiment,
            "emotionScores":     emotion_scores,
            "sessionId":         session_id,
            "facialActionUnits": action_units,
            "modelBackend":      "deepface/opencv",
            "processingMs":      processing_ms,
            "warning":           warning,
        }

    @staticmethod
    def _decode_base64(b64: str) -> np.ndarray:
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        raw   = base64.b64decode(b64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    @staticmethod
    def _decode_bytes(data: bytes) -> np.ndarray:
        arr   = np.frombuffer(data, np.uint8)
        image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Could not decode image bytes")
        return image