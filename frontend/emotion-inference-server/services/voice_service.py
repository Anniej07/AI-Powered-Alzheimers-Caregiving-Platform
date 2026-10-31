import io
import os
import logging
import time
import tempfile
import subprocess
from typing import Dict, Optional, Tuple

import re
import numpy as np
import librosa
import soundfile as sf

log = logging.getLogger("voice_service")

XLSR_MAP = {
    "angry":     "angry",
    "calm":      "calm",
    "disgust":   "disgusted",
    "fearful":   "fearful",
    "happy":     "happy",
    "neutral":   "neutral",
    "sad":       "sad",
    "surprised": "surprised",
}

SUPERB_MAP = {
    "ang": "angry",
    "hap": "happy",
    "neu": "neutral",
    "sad": "sad",
}

POSITIVE = {"happy", "surprised", "calm"}
NEGATIVE = {"sad", "angry", "fearful", "disgusted", "anxious", "confused", "stressed"}

CANONICAL_ZERO = {
    "happy": 0.0, "sad": 0.0, "angry": 0.0, "fearful": 0.0,
    "disgusted": 0.0, "surprised": 0.0, "neutral": 0.0,
    "anxious": 0.0, "confused": 0.0, "stressed": 0.0, "calm": 0.0,
}
# ── Text-based emotion keyword dictionary ─────────────────────
TEXT_EMOTION_KEYWORDS = {
    "happy": [
        "happy", "joy", "joyful", "excited", "wonderful", "great", "fantastic",
        "amazing", "love", "lovely", "excellent", "good", "pleased", "glad",
        "delighted", "cheerful", "thrilled", "blessed", "grateful", "thankful",
        "smile", "laugh", "fun", "enjoy", "celebrate", "wonderful"
    ],
    "sad": [
        "sad", "unhappy", "cry", "crying", "tears", "grief", "depressed",
        "hopeless", "alone", "lonely", "miss", "lost", "hurt", "pain",
        "sorry", "unfortunate", "heartbroken", "disappointed", "upset",
        "gloomy", "miserable", "suffering", "sorrow", "mourn", "tragic"
    ],
    "angry": [
        "angry", "furious", "rage", "hate", "mad", "frustrated", "irritated",
        "annoyed", "outraged", "disgusted", "sick of", "fed up", "terrible",
        "horrible", "awful", "worst", "unacceptable", "ridiculous", "stupid",
        "idiot", "cannot stand", "unbearable", "infuriating", "enraged"
    ],
    "fearful": [
        "scared", "afraid", "fear", "terrified", "panic", "worried", "nervous",
        "anxious", "dread", "horrified", "frightened", "phobia", "terror",
        "shaking", "trembling", "danger", "threat", "unsafe", "help", "please help"
    ],
    "surprised": [
        "wow", "amazing", "incredible", "unbelievable", "shocking", "surprised",
        "cannot believe", "unexpected", "astonishing", "whoa", "oh my god",
        "no way", "really", "seriously", "omg", "suddenly", "never expected"
    ],
    "anxious": [
        "stress", "stressed", "overwhelmed", "pressure", "cannot cope",
        "too much", "worried", "concern", "tense", "uneasy", "restless",
        "uncertain", "nervous", "apprehensive", "on edge", "unsure"
    ],
    "calm": [
        "calm", "peaceful", "relaxed", "fine", "okay", "alright", "normal",
        "comfortable", "content", "serene", "quiet", "stable", "steady",
        "balanced", "at ease", "composed", "tranquil"
    ],
    "confused": [
        "confused", "do not understand", "lost", "unclear", "what happened",
        "where am i", "who are you", "forget", "forgotten", "cannot remember",
        "mixed up", "disoriented", "puzzled", "bewildered", "uncertain"
    ],
}

def analyze_text_emotion(text: str) -> tuple:
    """
    Analyze transcript text to detect emotion using keyword matching.
    Returns (emotion, confidence_score, all_scores_dict)
    """
    if not text or len(text.strip()) < 3:
        return None, 0.0, {}

    text_lower = text.lower()
    scores = {}

    for emotion, keywords in TEXT_EMOTION_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            if keyword in text_lower:
                # Longer keyword phrases score higher
                score += len(keyword.split())
        if score > 0:
            scores[emotion] = score

    if not scores:
        return None, 0.0, {}

    total = sum(scores.values())
    normalized = {k: round(v / total, 3) for k, v in scores.items()}

    best_emotion = max(scores, key=scores.get)
    best_score   = normalized[best_emotion]

    # Confidence scales with how many keywords matched
    # 1 keyword = 40%, 2 = 60%, 3+ = 80%+
    total_matches = sum(scores.values())
    confidence = min(40.0 + (total_matches - 1) * 20.0, 95.0)

    return best_emotion, confidence, normalized
TARGET_SR = 16_000


class VoiceEmotionService:

    def __init__(self):
        self.model_name     = os.getenv("VOICE_MODEL", "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition")
        self.min_confidence = float(os.getenv("MIN_VOICE_CONFIDENCE", "95.0"))
        self._pipeline      = None
        self._label_map     = None
        log.info(f"VoiceEmotionService initialised (model={self.model_name})")
        self._load_model()
        

    def analyze(self, audio_bytes: bytes, session_id: Optional[str] = None,
                original_filename: str = "audio.webm") -> Dict:
        t0 = time.monotonic()

        waveform, features, warning = self._load_audio(audio_bytes, original_filename)
        if waveform is None:
            return self._fallback_result(session_id, warning)

        model_emotion, confidence, all_scores, warning2 = self._classify(waveform)
        if warning2:
            warning = (warning or "") + " " + warning2

        # Try to get transcript for text-based emotion detection
        speech_text = None
        text_emotion = None
        text_confidence = 0.0
        try:
            from services.transcription_service import TranscriptionService
            _ts = TranscriptionService.__new__(TranscriptionService)
            _ts.model_name = "base"
            _ts._model = None
            # Use the already loaded whisper model from app state if available
            import whisper
            _ts._model = whisper.load_model("base")
            result = _ts.transcribe(audio_bytes, original_filename)
            speech_text = result.get("text", "")
            if speech_text:
                text_emotion, text_confidence, _ = analyze_text_emotion(speech_text)
        except Exception as e:
            log.warning(f"Text emotion analysis skipped: {e}")

        # Decide final emotion:
        # Priority 1 — text emotion if confidence is high (text is most reliable)
        # Priority 2 — acoustic model if confident
        # Priority 3 — acoustic heuristics
        if text_emotion and text_confidence >= 60.0:
            final_emotion = text_emotion
            confidence    = text_confidence
            log.info(f"Text emotion override: {final_emotion} ({confidence:.1f}%)")
        else:
            final_emotion = self._apply_heuristics(model_emotion, confidence, features)

        emotion_scores = dict(CANONICAL_ZERO)
        for canonical, score in all_scores.items():
            emotion_scores[canonical] = round(score, 3)

        emotion_scores[final_emotion] = max(
            emotion_scores.get(final_emotion, 0.0),
            round(confidence / 100.0, 3)
        )

        if final_emotion in POSITIVE:
            sentiment = "positive"
        elif final_emotion in NEGATIVE:
            sentiment = "negative"
        else:
            sentiment = "neutral"

        processing_ms = int((time.monotonic() - t0) * 1000)
        log.info(f"Voice: {final_emotion} ({confidence:.1f}%) in {processing_ms}ms")

        return {
            "detectionType":  "voice",
            "emotion":        final_emotion,
            "confidence":     round(confidence, 2),
            "sentiment":      sentiment,
            "emotionScores":  emotion_scores,
            "sessionId":      session_id,
            "audioFeatures":  features,
            "speechText":     speech_text or None,
            "modelBackend":   self.model_name,
            "processingMs":   processing_ms,
            "warning":        warning.strip() if warning else None,
        }

    def _load_model(self):
        try:
            from transformers import pipeline as hf_pipeline
            log.info(f"Loading HuggingFace pipeline: {self.model_name}")
            self._pipeline = hf_pipeline(
                "audio-classification",
                model=self.model_name,
                device=-1,
                return_all_scores=True,
            )
            self._label_map = self._build_label_map()
            log.info("Voice model loaded successfully.")
        except Exception as e:
            log.error(f"Voice model failed to load: {e}")

    def _build_label_map(self) -> Dict[str, str]:
        if "superb" in self.model_name:
            return SUPERB_MAP
        return XLSR_MAP

    def _load_audio(self, audio_bytes: bytes, filename: str) -> Tuple[Optional[np.ndarray], Dict, Optional[str]]:
        warning = None
        tmp_path = None
        tmp_out_path = None
        try:
            suffix = os.path.splitext(filename)[-1] or ".webm"

            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            tmp_out_path = tmp_path.replace(suffix, "_converted.wav")

            cmd = [
                "ffmpeg", "-y",
                "-i", tmp_path,
                "-ar", str(TARGET_SR),
                "-ac", "1",
                "-f", "wav",
                tmp_out_path
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

            if result.returncode != 0:
                raise ValueError(f"ffmpeg failed: {result.stderr[-300:]}")

            y, sr = sf.read(tmp_out_path, dtype="float32", always_2d=False)

            if sr != TARGET_SR:
                y = librosa.resample(y, orig_sr=sr, target_sr=TARGET_SR)

            if y.ndim > 1:
                y = y.mean(axis=1)

            if len(y) < TARGET_SR * 0.3:
                warning = "Audio clip is very short (< 0.3s). Results may be inaccurate."

            features = self._extract_features(y, TARGET_SR)
            return y, features, warning

        except Exception as e:
            return None, {}, f"Audio decode error: {e}"

        finally:
            try:
                if tmp_path: os.unlink(tmp_path)
            except Exception:
                pass
            try:
                if tmp_out_path: os.unlink(tmp_out_path)
            except Exception:
                pass

    @staticmethod
    def _extract_features(y: np.ndarray, sr: int) -> Dict:
        try:
            f0 = librosa.yin(y, fmin=80, fmax=500, sr=sr)
            voiced = f0[f0 > 0]
            pitch_mean = float(np.mean(voiced)) if len(voiced) else 0.0
            pitch_std  = float(np.std(voiced))  if len(voiced) else 0.0

            rms = librosa.feature.rms(y=y)[0]
            energy_mean = float(np.mean(rms))
            energy_std  = float(np.std(rms))

            tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
            tempo = float(tempo) if np.isscalar(tempo) else float(tempo[0]) if len(tempo) else 0.0

            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_mean = [round(float(v), 4) for v in np.mean(mfcc, axis=1)]

            zcr_mean = float(np.mean(librosa.feature.zero_crossing_rate(y)))
            centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

            return {
                "pitch":            round(pitch_mean, 2),
                "pitchVariance":    round(pitch_std,  2),
                "energy":           round(energy_mean, 6),
                "energyVariance":   round(energy_std,  6),
                "tempo":            round(tempo, 2),
                "zeroCrossingRate": round(zcr_mean, 6),
                "spectralCentroid": round(centroid, 2),
                "mfcc":             mfcc_mean,
                "durationSeconds":  round(len(y) / sr, 2),
            }
        except Exception as e:
            log.warning(f"Feature extraction partial failure: {e}")
            return {}

    def _classify(self, waveform: np.ndarray) -> Tuple[str, float, Dict[str, float], Optional[str]]:
        warning = None
        all_scores: Dict[str, float] = {}

        if self._pipeline is None:
            warning = "Voice model not loaded."
            return "neutral", 0.0, all_scores, warning

        try:
            outputs = self._pipeline({"array": waveform.astype(np.float32), "sampling_rate": TARGET_SR})
            outputs_sorted = sorted(outputs, key=lambda x: x["score"], reverse=True)

            for item in outputs_sorted:
                raw_label = item["label"].lower().strip()
                canonical = (self._label_map or {}).get(raw_label, raw_label)
                if canonical in CANONICAL_ZERO:
                    all_scores[canonical] = round(item["score"] * 100, 2)

            top_raw       = outputs_sorted[0]["label"].lower().strip()
            top_canonical = (self._label_map or {}).get(top_raw, top_raw)
            confidence    = outputs_sorted[0]["score"] * 100

            if top_canonical not in CANONICAL_ZERO:
                top_canonical = "neutral"
                warning = f"Unknown label '{top_raw}'; defaulting to neutral."

            return top_canonical, confidence, all_scores, warning

        except Exception as e:
            warning = f"Inference error: {e}"
            log.error(warning)
            return "neutral", 0.0, all_scores, warning

    def _apply_heuristics(self, model_emotion: str, confidence: float, features: Dict) -> str:
        if confidence >= self.min_confidence:
            return model_emotion

        energy  = features.get("energy", 0.0)
        pitch   = features.get("pitch",  0.0)
        pitch_v = features.get("pitchVariance", 0.0)

        # Calibrated thresholds for real conversational speech
        # (lower than acted speech thresholds)
        HIGH_ENERGY  = 0.04   # lowered from 0.08
        LOW_ENERGY   = 0.005  # lowered from 0.01
        HIGH_PITCH_V = 25.0   # lowered from 40.0
        HIGH_PITCH   = 160.0  # lowered from 200.0

        if energy > HIGH_ENERGY and pitch_v > HIGH_PITCH_V:
            return "stressed"
        if energy > HIGH_ENERGY and pitch > HIGH_PITCH:
            return "anxious"
        if energy > HIGH_ENERGY and pitch_v < 10.0:
            return "angry"   # loud flat voice = angry
        if energy < LOW_ENERGY and pitch < 100:
            return "calm"
        if energy < LOW_ENERGY and model_emotion in ("sad", "neutral"):
            return "sad"
        if pitch_v > HIGH_PITCH_V and energy > LOW_ENERGY:
            return "fearful"  # high pitch variance = fear/excitement
        if model_emotion in ("happy", "surprised") and confidence > 20.0:
            return model_emotion  # trust model for positive emotions

        return model_emotion

    @staticmethod
    def _fallback_result(session_id: Optional[str], warning: Optional[str]) -> Dict:
        return {
            "detectionType":  "voice",
            "emotion":        "neutral",
            "confidence":     0.0,
            "sentiment":      "neutral",
            "emotionScores":  dict(CANONICAL_ZERO),
            "sessionId":      session_id,
            "audioFeatures":  {},
            "speechText":     None,
            "modelBackend":   "fallback",
            "processingMs":   0,
            "warning":        warning,
        }  