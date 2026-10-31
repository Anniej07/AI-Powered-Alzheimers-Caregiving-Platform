const mongoose   = require('mongoose');
const User       = require('../models/User');
const Medication = require('../models/Medication');
const Emotion    = require('../models/Emotion');
const Alert      = require('../models/Alert');

// ── Helper: today's date range ────────────────────────────────
const todayRange = () => {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { start, end };
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/patient/:patientId
// Full patient snapshot for the caregiver / doctor view
// ─────────────────────────────────────────────────────────────
exports.getPatientDashboard = async (req, res, next) => {
  try {
    const patientId = new mongoose.Types.ObjectId(req.params.patientId || req.user._id);
    const { start, end } = todayRange();
    const since7d  = new Date(Date.now() - 7  * 86400000);
    const since30d = new Date(Date.now() - 30 * 86400000);

    const [
      patient,
      activeMeds,
      todaysDoses,
      openAlerts,
      latestFace,
      latestVoice,
      sentimentWeek,
      adherenceData,
    ] = await Promise.all([
      // 1. Patient profile
      User.findById(patientId).select('name email phone diagnosisStage lastActive emergencyContact profileImage'),

      // 2. Active medications count
      Medication.countDocuments({ patient: patientId, isActive: true }),

      // 3. Today's dose summary
      Medication.aggregate([
        { $match: { patient: patientId, isActive: true } },
        { $unwind: '$doseLogs' },
        { $match: { 'doseLogs.scheduledTime': { $gte: start, $lte: end } } },
        { $group: {
          _id: '$doseLogs.status',
          count: { $sum: 1 },
        }},
      ]),

      // 4. Open (pending / sent) alerts
      Alert.find({ patient: patientId, status: { $in: ['pending', 'sent'] } })
        .sort({ createdAt: -1 }).limit(5).select('type severity title createdAt'),

      // 5. Latest face emotion
      Emotion.findOne({ patient: patientId, detectionType: 'face' }).sort({ recordedAt: -1 }),

      // 6. Latest voice emotion
      Emotion.findOne({ patient: patientId, detectionType: 'voice' }).sort({ recordedAt: -1 }),

      // 7. Sentiment breakdown last 7 days
      Emotion.aggregate([
        { $match: { patient: patientId, recordedAt: { $gte: since7d } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),

      // 8. 30-day adherence per medication
      Medication.find({ patient: patientId }).select('name doseLogs'),
    ]);

    // Build dose summary map
    const doseSummary = { pending: 0, taken: 0, missed: 0, skipped: 0 };
    todaysDoses.forEach(d => { doseSummary[d._id] = d.count; });
    const totalDoses = Object.values(doseSummary).reduce((a, b) => a + b, 0);

    // Adherence per medication (30-day)
    const adherence = adherenceData.map(m => {
      const logs    = m.doseLogs.filter(l => l.scheduledTime >= since30d && l.status !== 'pending');
      const taken   = logs.filter(l => l.status === 'taken').length;
      return {
        name:          m.name,
        adherenceRate: logs.length ? Math.round((taken / logs.length) * 100) : null,
      };
    });

    // Sentiment map
    const sentiment = { positive: 0, negative: 0, neutral: 0 };
    sentimentWeek.forEach(s => { sentiment[s._id] = s.count; });

    res.json({
      success: true,
      dashboard: {
        patient,
        medications: {
          activeCount: activeMeds,
          todaySummary: { ...doseSummary, total: totalDoses },
          adherence30d: adherence,
        },
        emotions: {
          latestFace,
          latestVoice,
          sentimentLast7Days: sentiment,
        },
        alerts: {
          openCount: openAlerts.length,
          recent: openAlerts,
        },
        lastActive: patient?.lastActive,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/caregiver
// Caregiver overview: all assigned patients
// ─────────────────────────────────────────────────────────────
exports.getCaregiverDashboard = async (req, res, next) => {
  try {
    const patientIds = req.user.patients;
    const { start, end } = todayRange();

    const [patientProfiles, alertCounts, doseStats, emotionStats] = await Promise.all([
      // Patient list with last-active status
      User.find({ _id: { $in: patientIds } })
        .select('name email diagnosisStage lastActive profileImage isActive'),

      // Alert counts per patient (open)
      Alert.aggregate([
        { $match: { patient: { $in: patientIds }, status: { $in: ['pending', 'sent'] } } },
        { $group: { _id: '$patient', count: { $sum: 1 } } },
      ]),

      // Today's dose compliance per patient
      Medication.aggregate([
        { $match: { patient: { $in: patientIds }, isActive: true } },
        { $unwind: '$doseLogs' },
        { $match: { 'doseLogs.scheduledTime': { $gte: start, $lte: end } } },
        { $group: {
          _id: { patient: '$patient', status: '$doseLogs.status' },
          count: { $sum: 1 },
        }},
      ]),

      // Latest emotion per patient
      Emotion.aggregate([
        { $match: { patient: { $in: patientIds } } },
        { $sort:  { recordedAt: -1 } },
        { $group: { _id: '$patient', emotion: { $first: '$emotion' }, sentiment: { $first: '$sentiment' }, recordedAt: { $first: '$recordedAt' } } },
      ]),
    ]);

    // Index alerts & doses & emotions by patient string id
    const alertMap   = Object.fromEntries(alertCounts.map(a => [a._id.toString(), a.count]));
    const emotionMap = Object.fromEntries(emotionStats.map(e => [e._id.toString(), e]));

    const doseMap = {};
    doseStats.forEach(d => {
      const pid = d._id.patient.toString();
      if (!doseMap[pid]) doseMap[pid] = {};
      doseMap[pid][d._id.status] = d.count;
    });

    const patients = patientProfiles.map(p => {
      const pid = p._id.toString();
      return {
        ...p.toObject(),
        openAlerts:    alertMap[pid]   || 0,
        todaysDoses:   doseMap[pid]    || {},
        latestEmotion: emotionMap[pid] || null,
      };
    });

    res.json({
      success: true,
      totalPatients: patients.length,
      patients,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/doctor
// Doctor overview: patients + prescriptions + adherence
// ─────────────────────────────────────────────────────────────
exports.getDoctorDashboard = async (req, res, next) => {
  try {
    const patientIds = req.user.patients;
    const since30d   = new Date(Date.now() - 30 * 86400000);

    const [patientProfiles, prescriptionStats, alertCounts, adherenceStats] = await Promise.all([
      User.find({ _id: { $in: patientIds } })
        .select('name email diagnosisStage lastActive profileImage'),

      // Prescriptions created by this doctor this month
      require('../models/Prescription').aggregate([
        { $match: { doctor: req.user._id, prescriptionDate: { $gte: since30d } } },
        { $group: { _id: '$patient', count: { $sum: 1 } } },
      ]),

      Alert.aggregate([
        { $match: { patient: { $in: patientIds }, status: { $in: ['pending', 'sent'] } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
      ]),

      // Overall adherence across all patients
      Medication.aggregate([
        { $match: { patient: { $in: patientIds }, isActive: true } },
        { $unwind: '$doseLogs' },
        { $match: { 'doseLogs.scheduledTime': { $gte: since30d }, 'doseLogs.status': { $ne: 'pending' } } },
        { $group: {
          _id: '$doseLogs.status',
          count: { $sum: 1 },
        }},
      ]),
    ]);

    const presMap = Object.fromEntries(prescriptionStats.map(p => [p._id.toString(), p.count]));

    const doseBreakdown = { taken: 0, missed: 0, skipped: 0 };
    adherenceStats.forEach(d => { doseBreakdown[d._id] = d.count; });
    const totalDoses    = Object.values(doseBreakdown).reduce((a, b) => a + b, 0);
    const overallRate   = totalDoses ? Math.round((doseBreakdown.taken / totalDoses) * 100) : null;

    const alertBreakdown = Object.fromEntries(alertCounts.map(a => [a._id, a.count]));

    res.json({
      success: true,
      totalPatients: patientProfiles.length,
      patients: patientProfiles.map(p => ({
        ...p.toObject(),
        prescriptionsThisMonth: presMap[p._id.toString()] || 0,
      })),
      overallMedicationAdherence30d: overallRate,
      doseBreakdown30d: doseBreakdown,
      alertBreakdown,
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/dashboard/patient-self
// What a logged-in patient sees for themselves
// ─────────────────────────────────────────────────────────────
exports.getPatientSelfDashboard = async (req, res, next) => {
  req.params.patientId = req.user._id.toString();
  return exports.getPatientDashboard(req, res, next);
};
exports.getFamilyDashboard = async (req, res, next) => {
  try {
    const patientIds = req.user.patients;

    if (!patientIds || patientIds.length === 0) {
      return res.json({
        success: true,
        message: 'No patient assigned yet',
        patient: null,
      });
    }

    const patientId = new mongoose.Types.ObjectId(patientIds[0]);
    const { start, end } = todayRange();
    const since7d = new Date(Date.now() - 7 * 86400000);

    const [
      patient,
      activeMeds,
      todaysDoses,
      openAlerts,
      latestFace,
      latestVoice,
      sentimentWeek,
    ] = await Promise.all([
      User.findById(patientId).select('name email diagnosisStage lastActive emergencyContact profileImage'),
      Medication.countDocuments({ patient: patientId, isActive: true }),
      Medication.aggregate([
        { $match: { patient: patientId, isActive: true } },
        { $unwind: '$doseLogs' },
        { $match: { 'doseLogs.scheduledTime': { $gte: start, $lte: end } } },
        { $group: { _id: '$doseLogs.status', count: { $sum: 1 } } },
      ]),
      Alert.find({ patient: patientId, status: { $in: ['pending', 'sent'] } })
        .sort({ createdAt: -1 }).limit(5)
        .select('type severity title createdAt'),
      Emotion.findOne({ patient: patientId, detectionType: 'face' }).sort({ recordedAt: -1 }),
      Emotion.findOne({ patient: patientId, detectionType: 'voice' }).sort({ recordedAt: -1 }),
      Emotion.aggregate([
        { $match: { patient: patientId, recordedAt: { $gte: since7d } } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
    ]);

    const doseSummary = { pending: 0, taken: 0, missed: 0, skipped: 0 };
    todaysDoses.forEach(d => { doseSummary[d._id] = d.count; });
    const totalDoses = Object.values(doseSummary).reduce((a, b) => a + b, 0);

    const sentimentMap = { positive: 0, negative: 0, neutral: 0 };
    sentimentWeek.forEach(s => { sentimentMap[s._id] = s.count; });

    res.json({
      success: true,
      patient,
      medications: {
        activeCount: activeMeds,
        todaySummary: { ...doseSummary, total: totalDoses },
      },
      emotions: {
        latestFace,
        latestVoice,
        sentimentLast7Days: sentimentMap,
      },
      alerts: {
        openCount: openAlerts.length,
        recent: openAlerts,
      },
    });
  } catch (err) { next(err); }
};
