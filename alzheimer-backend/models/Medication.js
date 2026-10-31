const mongoose = require('mongoose');

// ── Sub-schema: individual dose log entry ─────────────────────
const DoseLogSchema = new mongoose.Schema({
  scheduledTime: { type: Date, required: true },
  takenAt:       Date,
  status: {
    type: String,
    enum: ['pending', 'taken', 'missed', 'skipped'],
    default: 'pending',
  },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes:    String,
});

const MedicationSchema = new mongoose.Schema(
  {
    patient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Drug info ─────────────────────────────────────────────
    name:        { type: String, required: [true, 'Medication name required'], trim: true },
    genericName: String,
    dosage: {
      amount: { type: Number, required: true },
      unit:   { type: String, enum: ['mg', 'ml', 'mcg', 'g', 'tablet', 'capsule'], required: true },
    },

    // ── Schedule ──────────────────────────────────────────────
    frequency: {
      type: String,
      enum: ['once_daily','twice_daily','three_times_daily','four_times_daily',
             'every_6h','every_8h','weekly','as_needed'],
      required: true,
    },
    scheduledTimes: [{ type: String, match: /^([01]\d|2[0-3]):([0-5]\d)$/ }], // HH:MM
    startDate: { type: Date, required: true },
    endDate:   Date,

    // ── Administration ────────────────────────────────────────
    route: {
      type: String,
      enum: ['oral','topical','injection','inhalation','sublingual','rectal'],
      default: 'oral',
    },
    instructions: String,
    sideEffects:  [String],

    // ── Stock / adherence ─────────────────────────────────────
    pillsRemaining:    Number,
    refillReminderDays: { type: Number, default: 7 },
    isActive:           { type: Boolean, default: true },

    // ── Relations ─────────────────────────────────────────────
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
    doseLogs:     [DoseLogSchema],
    remindersSent:[Date],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtual: adherence rate ───────────────────────────────────
MedicationSchema.virtual('adherenceRate').get(function () {
  const settled = this.doseLogs.filter(l => l.status !== 'pending');
  if (!settled.length) return null;
  const taken = settled.filter(l => l.status === 'taken').length;
  return Math.round((taken / settled.length) * 100);
});

// ── Instance method: today's logs ─────────────────────────────
MedicationSchema.methods.getTodaysDoses = function () {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return this.doseLogs.filter(l => l.scheduledTime >= start && l.scheduledTime <= end);
};

module.exports = mongoose.model('Medication', MedicationSchema);
