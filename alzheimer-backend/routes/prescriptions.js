const express = require('express');
const router  = express.Router();

const {
  getPrescriptions, getPrescription, createPrescription,
  updatePrescription, deletePrescription, sharePrescription,
} = require('../controllers/prescriptionController');

const { protect, authorize, checkPatientAccess } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(protect);

router.get   ('/patient/:patientId',  checkPatientAccess, getPrescriptions);
router.get   ('/:id',                 getPrescription);
router.post  ('/',                    authorize('doctor'), upload.single('prescription'), createPrescription);
router.put   ('/:id',                 authorize('doctor'), upload.single('prescription'), updatePrescription);
router.delete('/:id',                 authorize('doctor'), deletePrescription);
router.post  ('/:id/share',           authorize('doctor'), sharePrescription);

module.exports = router;
