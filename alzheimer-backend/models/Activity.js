const mongoose = require('mongoose');

/**
 * Activity — audit log for all patient-related events.
 * Every meaningful action creates one record here so caregivers
 * and doctors can see a chronological timeline per patient.
 */
const ActivitySchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // who caused the event (null = system)

    type: {
      type: String,
      required: true,
      enum: [
        'dose_taken',           // patient marked a dose taken
        'dose_missed',          // cron marked a dose missed
        'dose_skipped',         // patient/caregiver skipped a dose
        'medication_added',     // caregiver/doctor added medication
        'medication_updated',   // caregiver/doctor updated medication
        'medication_removed',   // doctor deactivated medication
        'prescription_created', // doctor created a prescription
        'prescription_updated', // doctor updated a prescription
        'emotion_recorded',     // face/voice emotion detected
        'alert_triggered',      // system created an alert
        'alert_acknowledged',   // caregiver/doctor acknowledged alert
        'alert_resolved',       // caregiver/doctor resolved alert
        'patient_login',        // patient logged in
        'profile_updated',      // user updated their profile
        'caregiver_assigned',   // caregiver linked to patient
        'doctor_assigned',      // doctor linked to patient
        'inactivity_detected',  // system flagged inactivity
      ],
    },

    title:       { type: String, required: true },
    description: String,

    // Flexible reference to the related document
    relatedModel: { type: String, enum: ['Medication', 'Prescription', 'Emotion', 'Alert', 'User'] },
    relatedId:    { type: mongoose.Schema.Types.ObjectId },

    // Extra structured data (varies by event type)
    meta: { type: mongoose.Schema.Types.Mixed },

    // Derived from actor vs patient for quick filtering
    source: { type: String, enum: ['patient', 'caregiver', 'doctor', 'system'], default: 'system' },
  },
  { timestamps: true }
);

ActivitySchema.index({ patient: 1, createdAt: -1 });
ActivitySchema.index({ patient: 1, type: 1, createdAt: -1 });

/**
 * Static helper — create an activity record without boilerplate at call sites.
 * Usage: await Activity.log({ patient, actor, type, title, ... })
 */
ActivitySchema.statics.log = async function (data) {
  try {
    return await this.create(data);
  } catch (err) {
    // Never let audit logging crash the main request
    console.error('Activity.log error:', err.message);
    return null;
  }
};

module.exports = mongoose.model('Activity', ActivitySchema);
