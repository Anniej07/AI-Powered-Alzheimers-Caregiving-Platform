const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema(
  {
    patient:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    prescriptionDate: { type: Date, default: Date.now },
    expiryDate:       Date,
    followUpDate:     Date,

    diagnosis: { type: String, required: [true, 'Diagnosis is required'] },
    medications: [{
      name:         { type: String, required: true },
      dosage:       String,
      frequency:    String,
      duration:     String,
      instructions: String,
    }],
    notes: String,

    // ── Uploaded file ─────────────────────────────────────────
    fileUrl:  String,
    fileName: String,
    fileType: String,

    isActive:    { type: Boolean, default: true },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prescription', PrescriptionSchema);
