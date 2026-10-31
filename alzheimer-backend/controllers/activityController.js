const mongoose  = require('mongoose');
const Activity  = require('../models/Activity');

// GET /api/activity/:patientId?type=&days=30&page=1&limit=30
exports.getActivity = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { type, days = 30, page = 1, limit = 30 } = req.query;

    const since  = new Date(Date.now() - parseInt(days) * 86400000);
    const filter = { patient: patientId, createdAt: { $gte: since } };
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate('actor', 'name role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Activity.countDocuments(filter),
    ]);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      activities,
    });
  } catch (err) { next(err); }
};

// GET /api/activity/:patientId/summary  — counts by type for charts
exports.getActivitySummary = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const days  = parseInt(req.query.days) || 30;
    const since = new Date(Date.now() - days * 86400000);

    const [byType, byDay] = await Promise.all([
      Activity.aggregate([
        { $match: { patient: new mongoose.Types.ObjectId(patientId), createdAt: { $gte: since } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Activity.aggregate([
        { $match: { patient: new mongoose.Types.ObjectId(patientId), createdAt: { $gte: since } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({ success: true, period: `${days} days`, byType, byDay });
  } catch (err) { next(err); }
};
