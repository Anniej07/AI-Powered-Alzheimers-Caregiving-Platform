const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
      type: String,
      enum: [
        'negative_emotion',    // Repeated negative emotions
        'missed_medication',   // Patient missed a dose
        'inactivity',          // No activity for N hours
        'low_adherence',       // Adherence below threshold
        'prescription_expiry', // Prescription expiring soon
        'emergency',           // Manual emergency alert
      ],
      required: true,
    },
    severity: {
      type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium',
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },

    // Related records for traceability
    relatedData: {
      emotionIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Emotion' }],
      medicationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Medication' },
      prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription' },
    },

    status: {
      type: String,
      enum: ['pending', 'sent', 'acknowledged', 'resolved', 'failed'],
      default: 'pending',
    },

    notifiedUsers: [{
      user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      method: { type: String, enum: ['email', 'sms'] },
      sentAt: Date,
      status: { type: String, enum: ['sent', 'failed'] },
    }],

    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: Date,
    resolvedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt:     Date,
    notes:          String,
  },
  { timestamps: true }
);

AlertSchema.index({ patient: 1, status: 1, createdAt: -1 });
AlertSchema.index({ patient: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', AlertSchema);
