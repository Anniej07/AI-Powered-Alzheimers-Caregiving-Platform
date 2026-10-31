const express = require('express');
const router  = express.Router();
const { getActivity, getActivitySummary } = require('../controllers/activityController');
const { protect, checkPatientAccess }     = require('../middleware/auth');

router.use(protect);
router.get('/:patientId',         checkPatientAccess, getActivity);
router.get('/:patientId/summary', checkPatientAccess, getActivitySummary);

module.exports = router;
