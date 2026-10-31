const mongoose = require('mongoose');
const Emotion  = require('../models/Emotion');
const Activity = require('../models/Activity');
const { checkAndTriggerEmotionAlert } = require('../services/alertService');
const { broadcastEmotion }            = require('../services/socketService');

exports.submitEmotion = async (req, res, next) => {
  try {
    const { patient, detectionType, emotion, confidence, emotionScores,
            facialActionUnits, audioFeatures, speechText, sessionId } = req.body;
    const patientId = patient || req.user._id;
    const record    = await Emotion.create({
      patient: patientId, detectionType, emotion, confidence,
      emotionScores, facialActionUnits, audioFeatures, speechText, sessionId,
    });
    const alertTriggered = await checkAndTriggerEmotionAlert(patientId, record);

    // Real-time broadcast to caregivers/doctors watching this patient
    broadcastEmotion(record);

    // Activity log for significant emotions
    if (record.sentiment === 'negative') {
      await Activity.log({
        patient: patientId, actor: patientId,
        type: 'emotion_recorded', source: 'patient',
        title: `${detectionType} emotion: ${emotion}`,
        description: `Sentiment: ${record.sentiment}, confidence: ${confidence?.toFixed?.(1) ?? confidence}%`,
        relatedModel: 'Emotion', relatedId: record._id,
        meta: { detectionType, emotion, sentiment: record.sentiment, confidence },
      });
    }

    res.status(201).json({ success: true, message: 'Emotion recorded', emotion: record, alertTriggered });
  } catch (err) { next(err); }
};

exports.getEmotionHistory = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.user._id;
    const { type, days = 7, sentiment, limit = 50 } = req.query;
    const since  = new Date(Date.now() - parseInt(days) * 86400000);
    const filter = { patient: patientId, recordedAt: { $gte: since } };
    if (type)      filter.detectionType = type;
    if (sentiment) filter.sentiment     = sentiment;
    const emotions = await Emotion.find(filter).sort({ recordedAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, count: emotions.length, emotions });
  } catch (err) { next(err); }
};

exports.getEmotionAnalytics = async (req, res, next) => {
  try {
    const objId  = new mongoose.Types.ObjectId(req.params.patientId);
    const days   = parseInt(req.query.days) || 30;
    const since  = new Date(Date.now() - days * 86400000);
    const match  = { patient: objId, recordedAt: { $gte: since } };
    const [sentimentSummary, dailyTrend, byType] = await Promise.all([
      Emotion.aggregate([{ $match: match }, { $group: { _id: '$sentiment', count: { $sum: 1 } } }]),
      Emotion.aggregate([
        { $match: match },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$recordedAt' } }, sentiment: '$sentiment' }, count: { $sum: 1 } } },
        { $sort: { '_id.date': 1 } },
      ]),
      Emotion.aggregate([
        { $match: match },
        { $group: { _id: { type: '$detectionType', emotion: '$emotion' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    res.json({ success: true, period: `${days} days`, sentimentSummary, dailyTrend, byType });
  } catch (err) { next(err); }
};

exports.getLatestEmotion = async (req, res, next) => {
  try {
    const patientId = req.params.patientId || req.user._id;
    const [latestFace, latestVoice] = await Promise.all([
      Emotion.findOne({ patient: patientId, detectionType: 'face'  }).sort({ recordedAt: -1 }),
      Emotion.findOne({ patient: patientId, detectionType: 'voice' }).sort({ recordedAt: -1 }),
    ]);
    res.json({ success: true, latestFace, latestVoice });
  } catch (err) { next(err); }
};
