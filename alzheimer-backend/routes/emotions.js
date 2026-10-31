const express = require('express');
const router  = express.Router();
const {
  submitEmotion, getEmotionHistory, getEmotionAnalytics, getLatestEmotion,
} = require('../controllers/emotionController');
const { protect, checkPatientAccess } = require('../middleware/auth');

router.use(protect);

// Submit a detection result
router.post('/', submitEmotion);

// History — patient can view own, caregiver/doctor can view assigned patients
router.get('/patient/:patientId',   checkPatientAccess, getEmotionHistory);

// Analytics — all roles can view (checkPatientAccess ensures correct access)
router.get('/analytics/:patientId', checkPatientAccess, getEmotionAnalytics);

// Latest emotion snapshot
router.get('/latest/:patientId',    checkPatientAccess, getLatestEmotion);

module.exports = router;