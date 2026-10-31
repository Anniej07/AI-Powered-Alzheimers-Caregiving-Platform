const Medication = require('../models/Medication');
const Activity   = require('../models/Activity');
const { scheduleMedicationReminders } = require('../services/reminderService');

// GET /api/medications/patient/:patientId
exports.getMedications = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.user._id;
    const filter    = { patient: patientId };
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    const medications = await Medication.find(filter)
      .populate('addedBy', 'name role')
      .populate('prescription', 'prescriptionDate doctor')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: medications.length, medications });
  } catch (err) { next(err); }
};

// POST /api/medications
exports.addMedication = async (req, res, next) => {
  try {
    const med = await Medication.create({ ...req.body, addedBy: req.user._id });
    await scheduleMedicationReminders(med);
    await Activity.log({
      patient: req.body.patient, actor: req.user._id,
      type: 'medication_added', source: req.user.role,
      title: `Medication added: ${med.name}`,
      description: `${med.dosage.amount}${med.dosage.unit} ${med.frequency.replace(/_/g,' ')}`,
      relatedModel: 'Medication', relatedId: med._id,
      meta: { medicationName: med.name, dosage: med.dosage, frequency: med.frequency },
    });
    const populated = await Medication.findById(med._id).populate('addedBy', 'name role');
    res.status(201).json({ success: true, message: 'Medication added', medication: populated });
  } catch (err) { next(err); }
};

// PUT /api/medications/:id
exports.updateMedication = async (req, res, next) => {
  try {
    const allowed = ['name','dosage','frequency','scheduledTimes','instructions',
                     'endDate','isActive','pillsRemaining','sideEffects','refillReminderDays'];
    const data = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    const med = await Medication.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!med) return res.status(404).json({ success: false, message: 'Medication not found' });
    if (req.body.scheduledTimes || req.body.frequency) await scheduleMedicationReminders(med);
    await Activity.log({
      patient: med.patient, actor: req.user._id,
      type: 'medication_updated', source: req.user.role,
      title: `Medication updated: ${med.name}`,
      relatedModel: 'Medication', relatedId: med._id,
    });
    res.json({ success: true, message: 'Medication updated', medication: med });
  } catch (err) { next(err); }
};

// DELETE /api/medications/:id
exports.deleteMedication = async (req, res, next) => {
  try {
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Medication not found' });
    med.isActive = false;
    await med.save();
    await Activity.log({
      patient: med.patient, actor: req.user._id,
      type: 'medication_removed', source: req.user.role,
      title: `Medication deactivated: ${med.name}`,
      relatedModel: 'Medication', relatedId: med._id,
    });
    res.json({ success: true, message: 'Medication deactivated' });
  } catch (err) { next(err); }
};

// POST /api/medications/:id/dose-log
exports.logDose = async (req, res, next) => {
  try {
    const { doseLogId, status, notes, takenAt } = req.body;
    const med = await Medication.findById(req.params.id);
    if (!med) return res.status(404).json({ success: false, message: 'Medication not found' });
    const log = med.doseLogs.id(doseLogId);
    if (!log) return res.status(404).json({ success: false, message: 'Dose log not found' });
    log.status   = status;
    log.markedBy = req.user._id;
    log.notes    = notes;
    if (status === 'taken') log.takenAt = takenAt || new Date();
    await med.save();
    const actType = status === 'taken' ? 'dose_taken' : status === 'missed' ? 'dose_missed' : 'dose_skipped';
    await Activity.log({
      patient: med.patient, actor: req.user._id,
      type: actType, source: req.user.role,
      title: `${med.name} — dose ${status}`,
      description: `Scheduled: ${new Date(log.scheduledTime).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`,
      relatedModel: 'Medication', relatedId: med._id,
      meta: { medicationName: med.name, scheduledTime: log.scheduledTime, status },
    });
    res.json({ success: true, message: `Dose marked as ${status}`, doseLog: log, adherenceRate: med.adherenceRate });
  } catch (err) { next(err); }
};

// GET /api/medications/schedule/:patientId
exports.getTodaysSchedule = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.user._id;
    const meds = await Medication.find({ patient: patientId, isActive: true }).populate('addedBy', 'name');
    const schedule = meds.map(m => ({
      medicationId: m._id, name: m.name, dosage: m.dosage,
      route: m.route, instructions: m.instructions,
      scheduledTimes: m.scheduledTimes,
      todaysDoses: m.getTodaysDoses(), adherenceRate: m.adherenceRate,
    }));
    res.json({ success: true, date: new Date().toDateString(), schedule });
  } catch (err) { next(err); }
};

// GET /api/medications/adherence/:patientId?days=30
exports.getAdherenceReport = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000);
    const meds  = await Medication.find({ patient: patientId });
    const report = meds.map(m => {
      const logs   = m.doseLogs.filter(l => l.scheduledTime >= since && l.status !== 'pending');
      const taken  = logs.filter(l => l.status === 'taken').length;
      const missed = logs.filter(l => l.status === 'missed').length;

      // Build daily breakdown for trend chart
      const daily = {};
      logs.forEach(l => {
        const day = new Date(l.scheduledTime).toISOString().split('T')[0];
        if (!daily[day]) daily[day] = { taken: 0, missed: 0, skipped: 0 };
        daily[day][l.status] = (daily[day][l.status] || 0) + 1;
      });

      return {
        medicationId: m._id,
        medication:   m.name,
        dosage:       m.dosage,
        frequency:    m.frequency,
        totalDoses:   logs.length,
        takenDoses:   taken,
        missedDoses:  missed,
        adherenceRate: logs.length ? Math.round((taken / logs.length) * 100) : null,
        dailyBreakdown: Object.entries(daily).map(([date, counts]) => ({ date, ...counts })).sort((a,b) => a.date.localeCompare(b.date)),
      };
    });
    const validRates = report.map(r => r.adherenceRate).filter(r => r !== null);
    const overall    = validRates.length ? Math.round(validRates.reduce((a,b) => a+b, 0) / validRates.length) : null;
    res.json({ success: true, period: `${days} days`, overallAdherenceRate: overall, medications: report });
  } catch (err) { next(err); }
};
