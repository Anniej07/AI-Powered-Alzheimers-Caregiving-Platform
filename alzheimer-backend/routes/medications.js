const express = require('express');
const router  = express.Router();

const {
  getMedications, addMedication, updateMedication, deleteMedication,
  logDose, getTodaysSchedule, getAdherenceReport,
} = require('../controllers/medicationController');

const { protect, authorize, checkPatientAccess } = require('../middleware/auth');
const { medicationRules, validate }              = require('../middleware/validate');

router.use(protect);

// Schedule & adherence (patient can view own)
router.get('/schedule/:patientId?',   checkPatientAccess, getTodaysSchedule);
router.get('/adherence/:patientId',   checkPatientAccess, getAdherenceReport);

// CRUD
router.get   ('/patient/:patientId',  checkPatientAccess, getMedications);
router.post  ('/',                    authorize('doctor', 'caregiver'), medicationRules, validate, addMedication);
router.put   ('/:id',                 authorize('doctor', 'caregiver'), updateMedication);
router.delete('/:id',                 authorize('doctor'), deleteMedication);

// Dose logging (patient or caregiver)
router.post('/:id/dose-log',          authorize('patient', 'caregiver'), logDose);

module.exports = router;
