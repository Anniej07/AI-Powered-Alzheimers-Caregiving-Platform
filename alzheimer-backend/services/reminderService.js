const cron       = require('node-cron');
const Medication = require('../models/Medication');
const User       = require('../models/User');
const { sendMedicationReminder } = require('./notificationService');

// In-memory map of active cron tasks keyed by medication id + time slot
const activeTasks = new Map();

// ─────────────────────────────────────────────────────────────
// Convert HH:MM to cron expression  →  "MM HH * * *"
// ─────────────────────────────────────────────────────────────
const toCronExpression = (timeStr) => {
  const [hour, minute] = timeStr.split(':');
  return `${parseInt(minute)} ${parseInt(hour)} * * *`;
};

// ─────────────────────────────────────────────────────────────
// Create future dose log entries for the next N days
// ─────────────────────────────────────────────────────────────
const generateDoseLogs = (medication, days = 30) => {
  const logs     = [];
  const now      = new Date();
  const endLimit = medication.endDate
    ? new Date(Math.min(medication.endDate, now.getTime() + days * 86400000))
    : new Date(now.getTime() + days * 86400000);

  let current = new Date(medication.startDate > now ? medication.startDate : now);
  current.setHours(0, 0, 0, 0);

  while (current <= endLimit) {
    for (const timeStr of medication.scheduledTimes || []) {
      const [hour, minute] = timeStr.split(':').map(Number);
      const scheduled      = new Date(current);
      scheduled.setHours(hour, minute, 0, 0);

      if (scheduled > now) {
        // Avoid duplicates
        const exists = medication.doseLogs.some(
          l => Math.abs(l.scheduledTime - scheduled) < 60000
        );
        if (!exists) logs.push({ scheduledTime: scheduled, status: 'pending' });
      }
    }
    current.setDate(current.getDate() + 1);
  }

  return logs;
};

// ─────────────────────────────────────────────────────────────
// Register cron tasks for a medication's scheduled times
// ─────────────────────────────────────────────────────────────
const scheduleMedicationReminders = async (medication) => {
  if (!medication.isActive || !medication.scheduledTimes?.length) return;

  const patient = await User.findById(medication.patient);
  if (!patient) return;

  // Generate dose log entries for the next 30 days and persist
  const newLogs = generateDoseLogs(medication);
  if (newLogs.length) {
    await require('../models/Medication').findByIdAndUpdate(medication._id, {
      $push: { doseLogs: { $each: newLogs } },
    });
  }

  // Register / replace cron jobs for each scheduled time
  for (const timeStr of medication.scheduledTimes) {
    const taskKey = `${medication._id}-${timeStr}`;

    // Stop existing task for this slot
    if (activeTasks.has(taskKey)) {
      activeTasks.get(taskKey).stop();
      activeTasks.delete(taskKey);
    }

    const cronExpr = toCronExpression(timeStr);
    const task     = cron.schedule(cronExpr, async () => {
      try {
        console.log(`⏰ Reminder: ${patient.name} → ${medication.name} at ${timeStr}`);
        await sendMedicationReminder(patient, medication, timeStr);
      } catch (err) {
        console.error('Reminder send error:', err.message);
      }
    });

    activeTasks.set(taskKey, task);
  }
};

// ─────────────────────────────────────────────────────────────
// Stop all cron tasks for a medication (on deactivation)
// ─────────────────────────────────────────────────────────────
const stopMedicationReminders = (medicationId) => {
  for (const [key, task] of activeTasks.entries()) {
    if (key.startsWith(medicationId.toString())) {
      task.stop();
      activeTasks.delete(key);
    }
  }
};

// ─────────────────────────────────────────────────────────────
// On server startup – reload all active medication schedules
// ─────────────────────────────────────────────────────────────
const reloadAllReminders = async () => {
  try {
    const meds = await Medication.find({ isActive: true });
    for (const med of meds) {
      await scheduleMedicationReminders(med);
    }
    console.log(`✅  Loaded reminders for ${meds.length} active medication(s).`);
  } catch (err) {
    console.error('reloadAllReminders error:', err.message);
  }
};

module.exports = { scheduleMedicationReminders, stopMedicationReminders, reloadAllReminders };
