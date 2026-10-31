"""
Transcription Service
======================
Uses OpenAI Whisper (open-source, runs locally — no API key needed)
to transcribe speech recordings to text.

Model sizes and their tradeoffs:
  tiny   — ~39 MB, fastest, least accurate
  base   — ~74 MB, fast, decent accuracy  ← default
  small  — ~244 MB, good balance
  medium — ~769 MB, high accuracy
  large  — ~1550 MB, best accuracy, slowest

The model downloads automatically on first use.
Set WHISPER_MODEL in .env to control which size is loaded.
"""

import os
import io
import logging
import tempfile
import time
from typing import Optional, Dict

log = logging.getLogger("transcription_service")

TARGET_SR = 16_000


class TranscriptionService:
    """
    Wraps OpenAI Whisper for local speech-to-text transcription.
    Can be used standalone or chained with VoiceEmotionService
    so a single audio upload produces both a transcript and emotion scores.
    """

    def __init__(self):
        self.model_name = os.getenv("WHISPER_MODEL", "base")
        self._model     = None
        log.info(f"TranscriptionService initialised (model={self.model_name})")
        self._load_model()

    # ── Public API ────────────────────────────────────────────

    def transcribe(self, audio_bytes: bytes, original_filename: str = "audio.webm",
                   language: Optional[str] = None) -> Dict:
        """
        Transcribe audio bytes to text.

        Parameters
        ----------
        audio_bytes : bytes
            Any format librosa / ffmpeg can decode (webm, mp3, wav, ogg, m4a)
        original_filename : str
            Used to infer format for the temp file suffix
        language : str, optional
            ISO 639-1 language code (e.g. "en", "ta", "hi"). If None,
            Whisper auto-detects the language.

        Returns
        -------
        dict with keys: text, language, segments, duration_seconds, processing_ms
        """
        if self._model is None:
            return { "text": None, "language": None, "segments": [], "warning": "Whisper model not loaded" }

        t0 = time.monotonic()
        suffix = os.path.splitext(original_filename)[-1] or ".webm"

        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            options = { "fp16": False }  # fp16 requires CUDA; disable for CPU
            if language:
                options["language"] = language

            result = self._model.transcribe(tmp_path, **options)

            # Extract clean segment data
            segments = [
                {
                    "start": round(s["start"], 2),
                    "end":   round(s["end"],   2),
                    "text":  s["text"].strip(),
                }
                for s in result.get("segments", [])
            ]

            processing_ms = int((time.monotonic() - t0) * 1000)
            log.info(f"Transcribed {len(result.get('text',''))} chars in {processing_ms}ms  [{result.get('language','?')}]")

            return {
                "text":             result.get("text", "").strip(),
                "language":         result.get("language"),
                "segments":         segments,
                "duration_seconds": round(segments[-1]["end"], 2) if segments else None,
                "processing_ms":    processing_ms,
                "warning":          None,
            }

        except Exception as e:
            log.error(f"Transcription failed: {e}")
            return { "text": None, "language": None, "segments": [], "warning": str(e) }

        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    # ── Model loading ─────────────────────────────────────────

    def _load_model(self):
        try:
            import whisper
            log.info(f"Loading Whisper model '{self.model_name}'…")
            self._model = whisper.load_model(self.model_name)
            log.info("Whisper model loaded successfully.")
        except ImportError:
            log.error("openai-whisper not installed. Run: pip install openai-whisper")
        except Exception as e:
            log.error(f"Whisper model failed to load: {e}")
