import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import { useAuth }   from '../context/AuthContext';
import { emotionAPI } from '../services/api';
import useFetch      from '../hooks/useFetch';
import { emotionIcon, sentimentColor, timeAgo } from '../utils/helpers';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './EmotionsPage.css';

const INFERENCE_URL  = process.env.REACT_APP_INFERENCE_URL || 'http://localhost:8000';
const EMOTIONS       = ['happy','calm','neutral','surprised','anxious','confused','stressed','sad','angry','fearful','disgusted'];
const VOICE_EMOTIONS = ['calm','anxious','stressed','happy','sad','neutral','angry','fearful'];
const EMOTION_KEYWORDS = {
  happy:    ['happy','joy','excited','wonderful','great','love','amazing','glad','cheerful','fantastic','enjoy','celebrate'],
  sad:      ['sad','cry','lonely','miss','hurt','pain','hopeless','depressed','upset','unhappy','grief','tears','mourn'],
  angry:    ['angry','furious','hate','mad','frustrated','annoyed','terrible','horrible','worst','unacceptable','rage','fed up'],
  fearful:  ['scared','afraid','fear','panic','worried','nervous','terrified','danger','frightened','dread','shaking'],
  surprised:['wow','unbelievable','shocking','surprised','cannot believe','unexpected','astonishing','omg','no way'],
  anxious:  ['stressed','overwhelmed','pressure','tense','uneasy','nervous','apprehensive','worried','concern'],
  confused: ['confused','lost','forget','forgotten','cannot remember','where am i','who are you','disoriented'],
  calm:     ['calm','peaceful','fine','okay','alright','comfortable','relaxed','content','serene','normal'],
};

function detectEmotionFromText(text) {
  const lower = text.toLowerCase();
  const scores = {};
  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += kw.split(' ').length;
    }
    if (score > 0) scores[emotion] = score;
  }
  if (Object.keys(scores).length === 0) return null;
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

const inferFace = async (imageBase64, patientId, sessionId) => {
  const res = await fetch(`${INFERENCE_URL}/analyze/face/base64`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ image_base64: imageBase64, patient_id: patientId, session_id: sessionId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Face inference failed (${res.status})`);
  }
  return res.json();
};

const inferVoice = async (audioBlob, patientId, sessionId) => {
  const fd = new FormData();
  fd.append('file',       audioBlob, 'recording.webm');
  fd.append('patient_id', patientId);
  fd.append('session_id', sessionId);
  const res = await fetch(`${INFERENCE_URL}/analyze/voice-full`, { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Voice inference failed (${res.status})`);
  }
  const data = await res.json();
  return {
    ...data.emotion,
    transcript: data.transcript,
    speechText: data.transcript?.text || null,
  };
};

export default function EmotionsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('face');

  const { data: histData,   loading: histLoading, refetch }  = useFetch(() => emotionAPI.getHistory(user._id, { days: 7, limit: 50 }), []);
  const { data: latestData, refetch: refetchLatest }          = useFetch(() => emotionAPI.getLatest(user._id), []);

  const emotions  = histData?.emotions || [];
  const chartData = emotions.slice().reverse().map(e => ({
    time:    new Date(e.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    score:   { positive: 100, negative: 0, neutral: 50 }[e.sentiment] ?? 50,
    emotion: e.emotion,
  }));

  const onSubmitted = () => { refetch(); refetchLatest(); };

  return (
    <div className="anim-fade-up">
      <div className="page-header">
        <div className="page-header__left">
          <h1>Emotion monitor</h1>
          <p>Real-time analysis · DeepFace (face) + Wav2Vec2 (voice)</p>
        </div>
      </div>

      <div className="emotion-latest">
        <LatestCard label="Face detection"  data={latestData?.latestFace}  />
        <LatestCard label="Voice detection" data={latestData?.latestVoice} />
      </div>

      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
            Emotional trend — last 7 days
          </p>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis hide domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', fontSize: 12 }}
                formatter={(v, n, p) => [p.payload.emotion, 'Emotion']} />
              <Line type="monotone" dataKey="score" stroke="var(--sage)" strokeWidth={2} dot={{ r: 3, fill: 'var(--sage)' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${tab === 'face'    ? 'tab--active' : ''}`} onClick={() => setTab('face')}>📷 Face</button>
        <button className={`tab ${tab === 'voice'   ? 'tab--active' : ''}`} onClick={() => setTab('voice')}>🎙 Voice</button>
        <button className={`tab ${tab === 'history' ? 'tab--active' : ''}`} onClick={() => setTab('history')}>📋 History</button>
      </div>

      <div style={{ marginTop: 20 }}>
        {tab === 'face'    && <FaceDetection  patientId={user._id} onSubmitted={onSubmitted} />}
        {tab === 'voice'   && <VoiceDetection patientId={user._id} onSubmitted={onSubmitted} />}
        {tab === 'history' && <EmotionHistory emotions={emotions} loading={histLoading} />}
      </div>
    </div>
  );
}

function LatestCard({ label, data }) {
  return (
    <div className="card emotion-latest__card">
      <p style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-muted)', marginBottom: 12 }}>
        {label}
      </p>
      {data ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 48 }}>{emotionIcon(data.emotion)}</span>
          <div>
            <p style={{ fontSize: 20, fontWeight: 500, textTransform: 'capitalize' }}>{data.emotion}</p>
            <span className={`badge badge-${sentimentColor(data.sentiment)}`}>{data.sentiment}</span>
            {data.confidence && (
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 4 }}>
                {data.confidence.toFixed(1)}% confidence
              </p>
            )}
            <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>{timeAgo(data.recordedAt)}</p>
          </div>
        </div>
      ) : (
        <div style={{ color: 'var(--ink-muted)', fontSize: 14 }}>No reading yet</div>
      )}
    </div>
  );
}

/* ── Face Detection ─────────────────────────────────────────── */
function FaceDetection({ patientId, onSubmitted }) {
  const webcamRef = useRef(null);
  const sessionId = useRef(Date.now().toString());

  const [analyzing,  setAnalyzing]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [override,   setOverride]   = useState('');
  const [autoMode,   setAutoMode]   = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Auto-save immediately after detection
  const saveEmotion = useCallback(async (inf, overrideEmotion) => {
    setSaving(true);
    const emotion = overrideEmotion || inf.emotion;
    try {
      await emotionAPI.submit({
        patient:           patientId,
        detectionType:     'face',
        emotion,
        confidence:        inf.confidence,
        sentiment:         inf.sentiment,
        emotionScores:     inf.emotionScores,
        facialActionUnits: inf.facialActionUnits,
        sessionId:         sessionId.current,
      });
      toast.success(`✓ ${emotionIcon(emotion)} ${emotion} saved automatically`);
      onSubmitted();
      sessionId.current = Date.now().toString();
    } catch {
      toast.error('Failed to save emotion');
    } finally {
      setSaving(false);
    }
  }, [patientId, onSubmitted]);

  const captureAndAnalyze = useCallback(async () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) { toast.error('Could not capture webcam frame'); return; }
    setAnalyzing(true); setResult(null); setOverride('');
    try {
      const inf = await inferFace(screenshot, patientId, sessionId.current);
      setResult(inf);
      if (inf.warning) toast(inf.warning, { icon: '⚠️' });
      else {
        toast.success(`${emotionIcon(inf.emotion)} ${inf.emotion} · ${inf.confidence.toFixed(1)}%`);
        // Auto-save immediately after detection
        await saveEmotion(inf, '');
      }
    } catch (err) {
      toast.error(err.message || 'Face analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }, [patientId, saveEmotion]);

  // Auto capture interval
  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(() => {
      if (webcamRef.current && !analyzing && !saving) {
        captureAndAnalyze();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [autoMode, analyzing, saving, captureAndAnalyze]);

  const handleOverride = async (emotion) => {
    if (!result) return;
    const newOverride = emotion === result.emotion ? '' : emotion;
    setOverride(newOverride);
    // Save with override immediately
    await saveEmotion(result, newOverride || result.emotion);
  };

  const display = override || result?.emotion;

  return (
    <div className="card">
      <div className="face-detection">
        <div className="webcam-wrap">
          <Webcam
  ref={webcamRef}
  screenshotFormat="image/jpeg"
  screenshotQuality={0.85}
  width="100%"
  style={{ borderRadius: 'var(--radius-md)', display: 'block' }}
  videoConstraints={{
    width: 640,
    height: 480,
    facingMode: "user",
  }}
  onUserMediaError={(err) => toast.error(`Camera error: ${err.message || 'Could not access camera'}`)}
/>
          {analyzing && (
            <div className="webcam-overlay">
              <div className="spinner" style={{ width: 32, height: 32, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 14, marginTop: 8 }}>DeepFace analysing…</span>
            </div>
          )}
          {saving && (
            <div className="webcam-overlay" style={{ background: 'rgba(92,122,110,0.7)' }}>
              <div className="spinner" style={{ width: 24, height: 24, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
              <span style={{ color: '#fff', fontSize: 13, marginTop: 8 }}>Saving…</span>
            </div>
          )}
          {result && !analyzing && !saving && (
            <div className="webcam-badge">
              <span style={{ fontSize: 20 }}>{emotionIcon(display)}</span>
              <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize' }}>{display}</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>{result.confidence.toFixed(1)}%</span>
            </div>
          )}
        </div>

        <div className="detection-controls">
          {/* Capture button */}
          <button
            className="btn btn-primary btn-lg"
            onClick={captureAndAnalyze}
            disabled={analyzing || saving}
          >
            {analyzing ? <><span className="spinner" /> Analysing…</> : '📷 Capture & analyse'}
          </button>

          {/* Auto capture toggle */}
          <button
            className={`btn ${autoMode ? 'btn-danger' : 'btn-secondary'}`}
            style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
            onClick={() => setAutoMode(a => !a)}
          >
            {autoMode ? '⏹ Stop auto capture' : '▶ Auto capture every 8s'}
          </button>

          {autoMode && (
            <p style={{ fontSize: 12, color: 'var(--sage)', textAlign: 'center', marginTop: 6 }}>
              Auto capturing and saving every 8 seconds
            </p>
          )}

          {result && (
            <>
              {/* Confidence bar */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>
                  <span>Confidence</span>
                  <span>{result.confidence.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--cream-dark)' }}>
                  <div style={{
                    width: `${result.confidence}%`, height: '100%', borderRadius: 3,
                    background: result.confidence >= 70 ? 'var(--success)' : result.confidence >= 50 ? 'var(--warn)' : 'var(--danger)',
                    transition: 'width 0.5s',
                  }} />
                </div>
              </div>

              {/* Emotion scores */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 6 }}>
                  All scores
                </p>
                {Object.entries(result.emotionScores)
                  .filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([e, s]) => (
                    <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                      <span style={{ width: 72, textTransform: 'capitalize', color: 'var(--ink-soft)' }}>{emotionIcon(e)} {e}</span>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--cream-dark)' }}>
                        <div style={{ width: `${s}%`, height: '100%', borderRadius: 2, background: 'var(--sage)', transition: 'width 0.4s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-muted)', minWidth: 36, textAlign: 'right' }}>{s.toFixed(1)}%</span>
                    </div>
                  ))}
              </div>

              {/* Override buttons — clicking saves immediately */}
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 6 }}>
                  Override & save
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                  {EMOTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      className={`emotion-btn ${display === e ? 'emotion-btn--active' : ''}`}
                      onClick={() => handleOverride(e)}
                      disabled={saving}
                    >
                      {emotionIcon(e)}<br />
                      <span style={{ fontSize: 10 }}>{e}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Voice Detection ────────────────────────────────────────── */
function VoiceDetection({ patientId, onSubmitted }) {
  const sessionId  = useRef(Date.now().toString());
  const mediaRef   = useRef(null);
  const chunksRef  = useRef([]);
  const timerRef   = useRef(null);
  const elapsedRef = useRef(null);
  const MAX_SECS   = 15;

  const [recording,  setRecording]  = useState(false);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [result,     setResult]     = useState(null);
  const [override,   setOverride]   = useState('');
  const [elapsed,    setElapsed]    = useState(0);

  // Auto-save immediately after detection
  const saveEmotion = useCallback(async (inf, overrideEmotion) => {
    setSaving(true);
    const emotion = overrideEmotion || inf.emotion;
    try {
      await emotionAPI.submit({
        patient:       patientId,
        detectionType: 'voice',
        emotion,
        confidence:    inf.confidence,
        sentiment:     inf.sentiment,
        emotionScores: inf.emotionScores,
        audioFeatures: inf.audioFeatures,
        speechText:    inf.speechText,
        sessionId:     sessionId.current,
      });
      toast.success(`✓ ${emotionIcon(emotion)} ${emotion} saved automatically`);
      onSubmitted();
      sessionId.current = Date.now().toString();
    } catch {
      toast.error('Failed to save voice emotion');
    } finally {
      setSaving(false);
    }
  }, [patientId, onSubmitted]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr     = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(250);
      setRecording(true); setResult(null); setOverride(''); setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      timerRef.current   = setTimeout(stopRecording, MAX_SECS * 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    clearTimeout(timerRef.current);
    clearInterval(elapsedRef.current);
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        mediaRef.current.stream?.getTracks().forEach(t => t.stop());
        setAnalyzing(true);
        try {
          const inf = await inferVoice(blob, patientId, sessionId.current);

          // Override emotion using transcript text if available
          if (inf.speechText && inf.speechText.trim().length > 3) {
            const textEmotion = detectEmotionFromText(inf.speechText);
            if (textEmotion) {
              inf.emotion   = textEmotion;
              inf.sentiment = ['happy','surprised','calm'].includes(textEmotion)
                ? 'positive' : ['sad','angry','fearful','disgusted','anxious','stressed','confused'].includes(textEmotion)
                ? 'negative' : 'neutral';
              inf.confidence = 75.0;
            }
          }

          setResult(inf);
          if (inf.warning) toast(inf.warning, { icon: '⚠️' });
          else {
            toast.success(`${emotionIcon(inf.emotion)} ${inf.emotion} · ${inf.confidence.toFixed(1)}%`);
            // Auto-save immediately after detection
            await saveEmotion(inf, '');
          }
        } catch (err) {
          toast.error(err.message || 'Voice analysis failed');
        } finally {
          setAnalyzing(false);
        }
      };
      mediaRef.current.stop();
    }
    setRecording(false);
  };

  const handleOverride = async (emotion) => {
    if (!result) return;
    const newOverride = emotion === result.emotion ? '' : emotion;
    setOverride(newOverride);
    await saveEmotion(result, newOverride || result.emotion);
  };

  const display = override || result?.emotion;

  return (
    <div className="card" style={{ padding: 40 }}>
      <div style={{ textAlign: 'center' }}>
        <div className="voice-visual">
          <div className={`voice-ring ${recording ? 'voice-ring--active' : ''}`}>
            <div className={`voice-core ${(recording || analyzing) ? 'voice-core--active' : ''}`}>
              {analyzing
                ? <span className="spinner" style={{ width: 24, height: 24 }} />
                : <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
              }
            </div>
          </div>
        </div>

        {recording && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, color: 'var(--danger)', marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', animation: 'pulse 1s infinite', display: 'inline-block' }} />
              Recording… {elapsed}s / {MAX_SECS}s
            </div>
            <div style={{ width: 200, height: 4, borderRadius: 2, background: 'var(--cream-dark)', margin: '0 auto' }}>
              <div style={{ width: `${(elapsed / MAX_SECS) * 100}%`, height: '100%', borderRadius: 2, background: 'var(--danger)', transition: 'width 1s linear' }} />
            </div>
          </div>
        )}

        {saving && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--sage)', fontSize: 13 }}>
            <span className="spinner" style={{ width: 16, height: 16 }} />
            Saving to patient record…
          </div>
        )}

        <p style={{ color: 'var(--ink-muted)', fontSize: 14, margin: '16px 0 24px' }}>
          {recording
            ? 'Speak naturally — describe how you feel'
            : analyzing
              ? 'Wav2Vec2 analysing your recording…'
              : saving
                ? 'Saving emotion to database…'
                : result
                  ? 'Analysis complete — saved automatically'
                  : 'Record 3–15 seconds of natural speech'
          }
        </p>

        {!analyzing && !saving && (
          <button
            className={`btn btn-lg ${recording ? 'btn-danger' : 'btn-primary'}`}
            onClick={recording ? stopRecording : startRecording}
            disabled={analyzing || saving}
          >
            {recording ? '⏹ Stop recording' : '🎙 Start recording'}
          </button>
        )}
      </div>

      {result && !analyzing && (
        <div style={{ marginTop: 32, borderTop: '1px solid rgba(28,31,29,0.07)', paddingTop: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 52 }}>{emotionIcon(display)}</p>
              <p style={{ fontSize: 20, fontWeight: 500, textTransform: 'capitalize' }}>{display}</p>
              <span className={`badge badge-${sentimentColor(result.sentiment)}`}>{result.sentiment}</span>
              <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
                {result.confidence.toFixed(1)}% · {result.processingMs}ms
              </p>
              {saving && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, color: 'var(--sage)', fontSize: 12 }}>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Saving…
                </div>
              )}
              {!saving && (
                <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 8 }}>
                  ✓ Saved automatically
                </p>
              )}
            </div>
            {result.audioFeatures && (
              <div style={{ fontSize: 13 }}>
                <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 8 }}>
                  Acoustic features
                </p>
                {[
                  ['Pitch',    `${result.audioFeatures.pitch?.toFixed(1)} Hz`],
                  ['Energy',   result.audioFeatures.energy?.toExponential(2)],
                  ['Tempo',    `${result.audioFeatures.tempo?.toFixed(1)} BPM`],
                  ['Duration', `${result.audioFeatures.durationSeconds?.toFixed(1)} s`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '0.5px solid rgba(28,31,29,0.06)' }}>
                    <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transcript */}
          {result.speechText && (
            <div style={{ marginTop: 20, background: 'var(--cream)', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
              <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 6 }}>
                Transcript
              </p>
              <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{result.speechText}"
              </p>
            </div>
          )}

          {/* Scores */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 6 }}>
              All scores
            </p>
            {Object.entries(result.emotionScores)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 7)
              .map(([e, s]) => (
                <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
                  <span style={{ width: 80, textTransform: 'capitalize', color: 'var(--ink-soft)' }}>{emotionIcon(e)} {e}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--cream-dark)' }}>
                    <div style={{ width: `${s * 100}%`, height: '100%', borderRadius: 2, background: 'var(--sage)', transition: 'width 0.4s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-muted)', minWidth: 40, textAlign: 'right' }}>{(s * 100).toFixed(1)}%</span>
                </div>
              ))}
          </div>

          {/* Override buttons — clicking saves immediately with new emotion */}
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ink-muted)', marginBottom: 6 }}>
              Override & re-save
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {VOICE_EMOTIONS.map(e => (
                <button
                  key={e}
                  type="button"
                  className={`emotion-btn ${display === e ? 'emotion-btn--active' : ''}`}
                  onClick={() => handleOverride(e)}
                  disabled={saving}
                >
                  {emotionIcon(e)} {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmotionHistory({ emotions, loading }) {
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (emotions.length === 0) return (
    <div className="empty-state card">
      <p>No emotion records yet. Capture a face or voice emotion to get started.</p>
    </div>
  );
  return (
    <div className="card">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Emotion</th>
              <th>Type</th>
              <th>Sentiment</th>
              <th>Confidence</th>
              <th>Model</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {emotions.map(e => (
              <tr key={e._id}>
                <td>
                  <span style={{ fontSize: 18 }}>{emotionIcon(e.emotion)}</span>{' '}
                  <strong style={{ textTransform: 'capitalize' }}>{e.emotion}</strong>
                </td>
                <td><span className="badge badge-neutral">{e.detectionType}</span></td>
                <td><span className={`badge badge-${sentimentColor(e.sentiment)}`}>{e.sentiment}</span></td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {e.confidence ? `${e.confidence.toFixed(1)}%` : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{e.modelBackend || '—'}</td>
                <td style={{ color: 'var(--ink-muted)', fontSize: 13 }}>{timeAgo(e.recordedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}