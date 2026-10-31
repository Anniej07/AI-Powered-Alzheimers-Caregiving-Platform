const Alert    = require('../models/Alert');
const Activity = require('../models/Activity');
const { sendAlertNotifications } = require('../services/notificationService');

exports.getAlerts = async (req, res, next) => {
  try {
    const { patientId, status, type, severity, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (req.user.role === 'patient') {
      filter.patient = req.user._id;
    } else {
      const ids = patientId ? [patientId] : req.user.patients;
      filter.patient = { $in: ids };
    }
    if (status)   filter.status   = status;
    if (type)     filter.type     = type;
    if (severity) filter.severity = severity;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate('patient',        'name email')
        .populate('acknowledgedBy', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Alert.countDocuments(filter),
    ]);
    res.json({ success: true, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), alerts });
  } catch (err) { next(err); }
};

exports.getAlertCount = async (req, res, next) => {
  try {
    const ids  = req.user.role === 'patient' ? [req.user._id] : req.user.patients;
    const rows = await Alert.aggregate([
      { $match: { patient: { $in: ids }, status: { $in: ['pending', 'sent'] } } },
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]);
    const counts = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
    rows.forEach(r => { counts[r._id] = r.count; counts.total += r.count; });
    res.json({ success: true, counts });
  } catch (err) { next(err); }
};

exports.createAlert = async (req, res, next) => {
  try {
    const { patient, type, severity, title, message } = req.body;
    const alert = await Alert.create({ patient, type, severity, title, message });
    await sendAlertNotifications(alert);
    await Activity.log({
      patient, actor: req.user._id,
      type: 'alert_triggered', source: req.user.role,
      title: `Alert: ${title}`,
      description: message,
      relatedModel: 'Alert', relatedId: alert._id,
      meta: { alertType: type, severity },
    });
    res.status(201).json({ success: true, message: 'Alert created', alert });
  } catch (err) { next(err); }
};

exports.acknowledgeAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged', acknowledgedBy: req.user._id, acknowledgedAt: new Date() },
      { new: true }
    ).populate('patient', 'name');
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await Activity.log({
      patient: alert.patient._id, actor: req.user._id,
      type: 'alert_acknowledged', source: req.user.role,
      title: `Alert acknowledged: ${alert.title}`,
      relatedModel: 'Alert', relatedId: alert._id,
    });
    res.json({ success: true, message: 'Alert acknowledged', alert });
  } catch (err) { next(err); }
};

exports.resolveAlert = async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { status: 'resolved', resolvedBy: req.user._id, resolvedAt: new Date(), notes: req.body.notes },
      { new: true }
    ).populate('patient', 'name');
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    await Activity.log({
      patient: alert.patient._id, actor: req.user._id,
      type: 'alert_resolved', source: req.user.role,
      title: `Alert resolved: ${alert.title}`,
      relatedModel: 'Alert', relatedId: alert._id,
      meta: { notes: req.body.notes },
    });
    res.json({ success: true, message: 'Alert resolved', alert });
  } catch (err) { next(err); }
};
