import io
import os
import logging
import tempfile
import subprocess

import numpy as np

log = logging.getLogger("audio_convert")

TARGET_SR = 16000


def decode_audio(audio_bytes: bytes, original_filename: str = "audio.webm") -> tuple:
    """
    Decode audio bytes to numpy array using ffmpeg directly.
    Works with webm, mp3, wav, ogg, m4a on Windows.
    
    Returns
    -------
    tuple: (numpy_array, sample_rate)
    """
    suffix = os.path.splitext(original_filename)[-1] or ".webm"
    
    # Write to temp file
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(audio_bytes)
        tmp_in_path = tmp_in.name

    tmp_out_path = tmp_in_path.replace(suffix, ".wav")

    try:
        # Use ffmpeg to convert to wav
        cmd = [
            "ffmpeg", "-y",
            "-i", tmp_in_path,
            "-ar", str(TARGET_SR),
            "-ac", "1",
            "-f", "wav",
            tmp_out_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            log.error(f"ffmpeg error: {result.stderr}")
            raise ValueError(f"ffmpeg conversion failed: {result.stderr}")

        # Read the converted wav file
        import soundfile as sf
        audio_array, sr = sf.read(tmp_out_path)
        
        # Convert to float32 mono
        if audio_array.ndim > 1:
            audio_array = audio_array.mean(axis=1)
        audio_array = audio_array.astype(np.float32)
        
        log.info(f"Audio decoded: {len(audio_array)} samples at {sr}Hz")
        return audio_array, sr

    except Exception as e:
        log.error(f"Audio decode error: {e}")
        raise

    finally:
        # Clean up temp files
        try:
            os.unlink(tmp_in_path)
        except Exception:
            pass
        try:
            os.unlink(tmp_out_path)
        except Exception:
            pass