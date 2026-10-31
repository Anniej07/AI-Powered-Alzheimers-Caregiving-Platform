const express = require('express');
const router  = express.Router();

const { getPatientDashboard, getPatientSelfDashboard, getCaregiverDashboard, getDoctorDashboard, getFamilyDashboard } = require('../controllers/dashboardController');
const { protect, authorize, checkPatientAccess } = require('../middleware/auth');

router.use(protect);

// Patient views their own dashboard
router.get('/me',                    authorize('patient'), getPatientSelfDashboard);

// Caregiver / doctor view a specific patient's dashboard
router.get('/patient/:patientId',    authorize('doctor', 'caregiver'), checkPatientAccess, getPatientDashboard);

// Role-level overview dashboards
router.get('/caregiver',             authorize('caregiver'), getCaregiverDashboard);
router.get('/doctor',                authorize('doctor'),    getDoctorDashboard);
router.get('/family',                authorize('family'),    getFamilyDashboard);
module.exports = router;
