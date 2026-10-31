# AlzheimerCare — Emotion Inference Server

FastAPI Python service that provides real AI-powered emotion detection.

| Endpoint                   | Model          | Input          |
|----------------------------|----------------|----------------|
| `POST /analyze/face/base64`| DeepFace + FER+| Base64 image   |
| `POST /analyze/face/upload`| DeepFace + FER+| JPEG/PNG file  |
| `POST /analyze/voice`      | Wav2Vec2 XLSR  | WebM/WAV audio |
| `GET  /health`             | —              | —              |

---

## Architecture

```
Browser (React)
    │
    ├── POST /analyze/face/base64  ──►  FaceEmotionService
    │                                      │
    │                               DeepFace.analyze()
    │                               (FER+ model, retinaface detector)
    │                                      │
    │                               ◄── EmotionResult JSON
    │
    └── POST /analyze/voice  ──────►  VoiceEmotionService
                                          │
                                   librosa (decode + resample)
                                   Wav2Vec2 (HuggingFace pipeline)
                                   Acoustic heuristics
                                          │
                                   ◄── EmotionResult JSON

React frontend POSTs EmotionResult → Node.js /api/emotions
```

---

## Quick Start

```bash
# 1. Extract
unzip emotion-inference-server.zip
cd emotion-inference-server

# 2. Python environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Install ffmpeg (needed for webm/mp3 audio decoding)
# Ubuntu/Debian:  sudo apt install ffmpeg
# macOS:          brew install ffmpeg
# Windows:        https://ffmpeg.org/download.html

# 5. Configure
cp .env.example .env

# 6. Run
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

On first startup, models are downloaded automatically:
- DeepFace / FER+ weights: ~4 MB
- RetinaFace detector: ~105 MB
- Wav2Vec2 XLSR model: ~1.2 GB  ← takes a few minutes on first run

---

## Environment Variables

| Variable                  | Default                                         | Description                          |
|---------------------------|-------------------------------------------------|--------------------------------------|
| `HOST`                    | `0.0.0.0`                                       | Bind address                         |
| `PORT`                    | `8000`                                          | Bind port                            |
| `ALLOWED_ORIGINS`         | `http://localhost:3000`                         | CORS origins (comma-separated)       |
| `FACE_DETECTOR_BACKEND`   | `retinaface`                                    | `opencv` (fast) or `retinaface` (accurate) |
| `VOICE_MODEL`             | `ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition` | HuggingFace model ID |
| `MIN_FACE_CONFIDENCE`     | `40.0`                                          | Below this → neutral fallback        |
| `MIN_VOICE_CONFIDENCE`    | `30.0`                                          | Below this → acoustic heuristics     |
| `DEEPFACE_HOME`           | `./model_cache`                                 | Where DeepFace caches weights        |

---

## React Frontend Integration

Add to your React `.env`:
```
REACT_APP_INFERENCE_URL=http://localhost:8000
```

The updated `EmotionsPage.js` calls the inference server directly from
the browser, then saves results to the Node.js backend.

---

## Emotion Labels

### Face (DeepFace → canonical)
| DeepFace label | Canonical    |
|----------------|--------------|
| happy          | happy        |
| sad            | sad          |
| angry          | angry        |
| fear           | fearful      |
| disgust        | disgusted    |
| surprise       | surprised    |
| neutral        | neutral      |

### Voice (Wav2Vec2 XLSR → canonical)
| Model label | Canonical  |
|-------------|------------|
| angry       | angry      |
| calm        | calm       |
| disgust     | disgusted  |
| fearful     | fearful    |
| happy       | happy      |
| neutral     | neutral    |
| sad         | sad        |
| surprised   | surprised  |

Plus acoustic heuristics detect: **stressed**, **anxious**

---

## Lighter Alternative (less accurate, faster startup)

Change `VOICE_MODEL` in `.env`:
```
VOICE_MODEL=superb/wav2vec2-base-superb-er
```
This model is ~360 MB vs 1.2 GB but only classifies 4 emotions.
The acoustic heuristic layer still adds stressed/anxious/calm detection.

---

## Running All Three Services Together

```
Terminal 1: mongod
Terminal 2: cd alzheimer-care-backend  && npm run dev
Terminal 3: cd emotion-inference-server && uvicorn main:app --port 8000 --reload
Terminal 4: cd alzheimer-care-frontend  && npm start
```

| Service           | URL                        |
|-------------------|----------------------------|
| React frontend    | http://localhost:3000       |
| Node.js API       | http://localhost:5000/api   |
| Inference server  | http://localhost:8000       |
| API docs (Swagger)| http://localhost:8000/docs  |
