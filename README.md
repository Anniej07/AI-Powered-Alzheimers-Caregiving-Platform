# AlzheimerCare — Frontend

React 18 single-page application for the AI-Powered Alzheimer's Care Platform.

## Stack

| Technology      | Purpose                              |
|-----------------|--------------------------------------|
| React 18        | UI framework                         |
| React Router 6  | Client-side routing                  |
| Axios           | HTTP client + JWT interceptor        |
| Recharts        | Charts (sentiment trend, adherence)  |
| react-webcam    | Webcam access for face detection     |
| react-hot-toast | Toast notifications                  |
| date-fns        | Date formatting                      |
| lucide-react    | Icons                                |

## Pages

| Route            | Access           | Description                        |
|------------------|------------------|------------------------------------|
| `/login`         | Public           | Sign in with JWT                   |
| `/register`      | Public           | Create account (3 roles)           |
| `/dashboard`     | All roles        | Role-specific overview             |
| `/medications`   | All roles        | Medication list + dose logging     |
| `/prescriptions` | All roles        | Prescription viewer / uploader     |
| `/emotions`      | All roles        | Face + voice detection + history   |
| `/alerts`        | All roles        | Alert feed + acknowledge/resolve   |
| `/patients`      | Doctor/Caregiver | Patient management                 |
| `/profile`       | All roles        | Profile, password, notifications   |

## Quick Start

```bash
# 1. Extract and enter directory
unzip alzheimer-care-frontend.zip
cd alzheimer-care-frontend

# 2. Install dependencies
npm install

# 3. Configure API URL (edit .env)
REACT_APP_API_URL=http://localhost:5000/api

# 4. Start development server
npm start
# → http://localhost:3000
```

Make sure the backend is running first (see backend README).

## Design System

Fonts: DM Serif Display (headings) + DM Sans (body) + JetBrains Mono (code)

Color palette:
- `--sage` #5C7A6E — primary brand green
- `--cream` #FAF8F4 — page background
- `--ink` #1C1F1D — primary text

## Connecting Real AI Models

The emotion detection pages use simulated results by default.
To connect a real model:

**Face:** Replace the `captureAndAnalyze` function in `EmotionsPage.js`
with a call to your face-api.js / TensorFlow.js / Python model endpoint.
Post the real scores to `POST /api/emotions`.

**Voice:** Replace the `stopRecording` handler with a call to your
speech emotion model (e.g. Hugging Face Inference API).
