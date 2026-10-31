const cron       = require('node-cron');
const User       = require('../models/User');
const Medication = require('../models/Medication');
const Activity   = require('../models/Activity');
const { createMissedMedicationAlert, createInactivityAlert, createLowAdherenceAlert } = require('./alertService');
const { reloadAllReminders } = require('./reminderService');
const { broadcastActivity }  = require('./socketService');

// ── JOB 1: Check missed doses every 30 minutes ────────────────
const checkMissedDoses = async () => {
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const meds   = await Medication.find({
      isActive: true,
      'doseLogs.status': 'pending',
      'doseLogs.scheduledTime': { $lte: cutoff },
    });

    for (const med of meds) {
      for (const log of med.doseLogs) {
        if (log.status === 'pending' && log.scheduledTime <= cutoff) {
          log.status = 'missed';
          await createMissedMedicationAlert(med.patient, med, log);

          // Log activity
          const act = await Activity.log({
            patient: med.patient,
            type: 'dose_missed', source: 'system',
            title: `${med.name} — dose missed`,
            description: `Scheduled at ${log.scheduledTime.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`,
            relatedModel: 'Medication', relatedId: med._id,
            meta: { medicationName: med.name, scheduledTime: log.scheduledTime },
          });
          if (act) broadcastActivity(act);
        }
      }
      await med.save();
    }
  } catch (err) { console.error('checkMissedDoses error:', err.message); }
};

// ── JOB 2: Check patient inactivity every hour ────────────────
const checkInactivePatients = async () => {
  try {
    const hours  = parseInt(process.env.INACTIVITY_HOURS) || 6;
    const cutoff = new Date(Date.now() - hours * 3600000);
    const inactive = await User.find({ role: 'patient', isActive: true, lastActive: { $lte: cutoff } });

    for (const patient of inactive) {
      await createInactivityAlert(patient);
      const act = await Activity.log({
        patient: patient._id,
        type: 'inactivity_detected', source: 'system',
        title: `Patient inactivity detected`,
        description: `No activity for over ${hours} hours. Last active: ${patient.lastActive?.toLocaleString() || 'unknown'}`,
        meta: { inactivityHours: hours, lastActive: patient.lastActive },
      });
      if (act) broadcastActivity(act);
    }

    if (inactive.length) console.log(`🔔 Inactivity alerts: ${inactive.length} patient(s)`);
  } catch (err) { console.error('checkInactivePatients error:', err.message); }
};

// ── JOB 3: Low adherence check daily at 08:00 ─────────────────
const checkLowAdherence = async () => {
  try {
    const since = new Date(Date.now() - 7 * 86400000);
    const meds  = await Medication.find({ isActive: true });

    for (const med of meds) {
      const logs  = med.doseLogs.filter(l => l.scheduledTime >= since && l.status !== 'pending');
      if (!logs.length) continue;
      const taken = logs.filter(l => l.status === 'taken').length;
      const rate  = Math.round((taken / logs.length) * 100);
      if (rate < 50) {
        const patient = await User.findById(med.patient);
        if (patient) await createLowAdherenceAlert(patient, med.name, rate);
      }
    }
  } catch (err) { console.error('checkLowAdherence error:', err.message); }
};

// ── Register all jobs ─────────────────────────────────────────
const startCronJobs = async () => {
  await reloadAllReminders();

  cron.schedule('*/30 * * * *', () => {
    console.log('🔄 [cron] Checking missed doses…');
    checkMissedDoses();
  });

  cron.schedule('0 * * * *', () => {
    console.log('🔄 [cron] Checking inactive patients…');
    checkInactivePatients();
  });

  cron.schedule('0 8 * * *', () => {
    console.log('🔄 [cron] Checking medication adherence…');
    checkLowAdherence();
  });

  console.log('⏱  Cron jobs started (missed doses / inactivity / adherence)');
};

module.exports = { startCronJobs };
