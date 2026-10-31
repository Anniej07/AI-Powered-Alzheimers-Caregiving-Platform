const express = require('express');
const router  = express.Router();

const {
  getAlerts, getAlertCount, createAlert, acknowledgeAlert, resolveAlert,
} = require('../controllers/alertController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get ('/',              getAlerts);
router.get ('/count',         getAlertCount);
router.post('/',              authorize('doctor', 'caregiver'), createAlert);
router.put ('/:id/acknowledge', authorize('doctor', 'caregiver'), acknowledgeAlert);
router.put ('/:id/resolve',     authorize('doctor', 'caregiver'), resolveAlert);

module.exports = router;
