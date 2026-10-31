const express = require('express');
const router  = express.Router();

const {
  getMyPatients, getPatient, assignPatient,
  removePatient, getProviders, updatePatientMedical,
} = require('../controllers/userController');

const { protect, authorize, checkPatientAccess } = require('../middleware/auth');

router.use(protect);

// Providers only
router.get('/patients', authorize('doctor', 'caregiver', 'family'), getMyPatients);
router.get   ('/patients/:patientId',         authorize('doctor', 'caregiver'), checkPatientAccess, getPatient);
router.post  ('/assign-patient',              authorize('doctor', 'caregiver'), assignPatient);
router.delete('/assign-patient/:patientId',   authorize('doctor', 'caregiver'), removePatient);
router.get   ('/providers',                   getProviders);

// Doctor only – update patient medical details
router.put('/patients/:patientId/medical',    authorize('doctor'), checkPatientAccess, updatePatientMedical);

module.exports = router;
