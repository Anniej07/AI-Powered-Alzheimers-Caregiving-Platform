const Emotion    = require('../models/Emotion');
const Alert      = require('../models/Alert');
const User       = require('../models/User');
const Activity   = require('../models/Activity');
const { sendAlertNotifications } = require('./notificationService');
const { broadcastAlert }         = require('./socketService');

const THRESHOLD  = parseInt(process.env.NEGATIVE_EMOTION_THRESHOLD) || 3;
const WINDOW_MIN = parseInt(process.env.NEGATIVE_EMOTION_WINDOW_MIN) || 60;

// ─────────────────────────────────────────────────────────────
// Check if repeated negative emotions warrant an alert
// Called each time an emotion is submitted
// ─────────────────────────────────────────────────────────────
const checkAndTriggerEmotionAlert = async (patientId, emotionRecord) => {
  if (emotionRecord.sentiment !== 'negative') return false;

  const count = await Emotion.getRecentNegativeCount(patientId, WINDOW_MIN);

  if (count < THRESHOLD) return false;

  // Avoid duplicate alerts within the same window
  const existing = await Alert.findOne({
    patient: patientId,
    type:    'negative_emotion',
    status:  { $in: ['pending', 'sent'] },
    createdAt: { $gte: new Date(Date.now() - WINDOW_MIN * 60 * 1000) },
  });
  if (existing) return false;

  // Mark the recent emotions as "triggered"
  const recentIds = await Emotion.find({
    patient:    patientId,
    sentiment:  'negative',
    recordedAt: { $gte: new Date(Date.now() - WINDOW_MIN * 60 * 1000) },
    triggeredAlert: false,
  }).select('_id');

  const ids = recentIds.map(e => e._id);

  const alert = await Alert.create({
    patient:  patientId,
    type:     'negative_emotion',
    severity: 'high',
    title:    'Repeated Negative Emotions Detected',
    message:  `${count} negative emotion(s) detected in the past ${WINDOW_MIN} minutes. Immediate attention may be needed.`,
    relatedData: { emotionIds: ids },
  });

  // Tag emotions as having triggered this alert
  await Emotion.updateMany(
    { _id: { $in: ids } },
    { triggeredAlert: true, alertId: alert._id }
  );

  // Dispatch notifications
  await sendAlertNotifications(alert);
  broadcastAlert(alert);

  return true;
};

// ─────────────────────────────────────────────────────────────
// Create a missed-medication alert
// Called by cron after a dose window passes without logging
// ─────────────────────────────────────────────────────────────
const createMissedMedicationAlert = async (patientId, medication, doseLog) => {
  // Avoid duplicate for the same dose
  const existing = await Alert.findOne({
    patient:             patientId,
    type:                'missed_medication',
    'relatedData.medicationId': medication._id,
    createdAt:           { $gte: new Date(Date.now() - 24 * 3600000) },
  });
  if (existing) return null;

  const patient = await User.findById(patientId).select('name');
  if (!patient) return null;
  const alert   = await Alert.create({
    patient:  patientId,
    type:     'missed_medication',
    severity: 'medium',
    title:    'Missed Medication Dose',
    message:  `${patient.name} missed their ${medication.name} dose scheduled at ${doseLog.scheduledTime.toLocaleTimeString()}.`,
    relatedData: { medicationId: medication._id },
  });

  await sendAlertNotifications(alert);
  return alert;
};

// ─────────────────────────────────────────────────────────────
// Create an inactivity alert
// Called by cron when patient lastActive is old
// ─────────────────────────────────────────────────────────────
const createInactivityAlert = async (patient) => {
  const hours = parseInt(process.env.INACTIVITY_HOURS) || 6;

  // Avoid repeated alerts for same patient today
  const existing = await Alert.findOne({
    patient: patient._id,
    type:    'inactivity',
    createdAt: { $gte: new Date(Date.now() - 24 * 3600000) },
  });
  if (existing) return null;

  const alert = await Alert.create({
    patient:  patient._id,
    type:     'inactivity',
    severity: 'high',
    title:    'Patient Inactivity Detected',
    message:  `${patient.name} has not been active for over ${hours} hours. Last seen: ${patient.lastActive?.toLocaleString() || 'unknown'}.`,
  });

  await sendAlertNotifications(alert);
  return alert;
};

// ─────────────────────────────────────────────────────────────
// Create low-adherence alert
// ─────────────────────────────────────────────────────────────
const createLowAdherenceAlert = async (patient, medicationName, rate) => {
  const existing = await Alert.findOne({
    patient: patient._id,
    type:    'low_adherence',
    createdAt: { $gte: new Date(Date.now() - 7 * 86400000) }, // once per week
  });
  if (existing) return null;

  const alert = await Alert.create({
    patient:  patient._id,
    type:     'low_adherence',
    severity: 'medium',
    title:    'Low Medication Adherence',
    message:  `${patient.name}'s adherence for ${medicationName} has dropped to ${rate}% over the past 7 days.`,
  });

  await sendAlertNotifications(alert);
  return alert;
};

module.exports = {
  checkAndTriggerEmotionAlert,
  createMissedMedicationAlert,
  createInactivityAlert,
  createLowAdherenceAlert,
};
