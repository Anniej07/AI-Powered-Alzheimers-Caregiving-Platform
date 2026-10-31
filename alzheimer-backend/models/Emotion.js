const mongoose = require('mongoose');

const EMOTIONS = ['happy','sad','angry','fearful','disgusted','surprised',
                  'neutral','anxious','confused','stressed','calm'];

const EmotionSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    detectionType: { type: String, enum: ['face', 'voice'], required: true },
    emotion:       { type: String, enum: EMOTIONS, required: true },
    confidence:    { type: Number, min: 0, max: 100 },
    sentiment:     { type: String, enum: ['positive', 'negative', 'neutral'] },

    // Raw probability scores from the model
    emotionScores: {
      happy: Number, sad: Number, angry: Number, fearful: Number,
      disgusted: Number, surprised: Number, neutral: Number,
      anxious: Number, confused: Number, stressed: Number, calm: Number,
    },

    // Face-specific
    facialActionUnits: mongoose.Schema.Types.Mixed,

    // Voice-specific
    audioFeatures: {
      pitch:  Number,
      energy: Number,
      tempo:  Number,
      mfcc:  [Number],    // Mel-frequency cepstral coefficients
    },
    speechText: String,   // Transcription (if available)

    sessionId:      String,
    triggeredAlert: { type: Boolean, default: false },
    alertId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Alert' },
    recordedAt:     { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
EmotionSchema.index({ patient: 1, recordedAt: -1 });
EmotionSchema.index({ patient: 1, sentiment: 1, recordedAt: -1 });

// ── Auto-derive sentiment before save ─────────────────────────
const POSITIVE = new Set(['happy', 'calm', 'surprised']);
const NEGATIVE = new Set(['sad', 'angry', 'fearful', 'disgusted', 'anxious', 'confused', 'stressed']);

EmotionSchema.pre('save', function (next) {
  if (POSITIVE.has(this.emotion))      this.sentiment = 'positive';
  else if (NEGATIVE.has(this.emotion)) this.sentiment = 'negative';
  else                                 this.sentiment = 'neutral';
  next();
});

// ── Static: count recent un-alerted negative emotions ─────────
EmotionSchema.statics.getRecentNegativeCount = function (patientId, windowMin = 60) {
  const since = new Date(Date.now() - windowMin * 60 * 1000);
  return this.countDocuments({
    patient: patientId,
    sentiment: 'negative',
    recordedAt: { $gte: since },
    triggeredAlert: false,
  });
};

module.exports = mongoose.model('Emotion', EmotionSchema);
