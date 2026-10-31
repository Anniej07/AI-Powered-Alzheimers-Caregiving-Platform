const User     = require('../models/User');
const Activity = require('../models/Activity');
const { broadcastActivity } = require('../services/socketService');

// GET /api/users/patients
exports.getMyPatients = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'patients',
      select: 'name email phone dateOfBirth gender diagnosisStage lastActive emergencyContact profileImage isActive',
    });
    res.json({ success: true, count: user.patients.length, patients: user.patients });
  } catch (err) { next(err); }
};

// GET /api/users/patients/:patientId
exports.getPatient = async (req, res, next) => {
  try {
    const patient = await User.findById(req.params.patientId)
      .populate('assignedDoctors',    'name email specialization hospital phone')
      .populate('assignedCaregivers', 'name email phone');
    if (!patient || patient.role !== 'patient')
      return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, patient });
  } catch (err) { next(err); }
};

// POST /api/users/assign-patient
exports.assignPatient = async (req, res, next) => {
  try {
    const { patientEmail } = req.body;
    const provider = req.user;

    const patient = await User.findOne({ email: patientEmail.toLowerCase(), role: 'patient' });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found with that email' });

    if (provider.patients.some(p => p.toString() === patient._id.toString()))
      return res.status(400).json({ success: false, message: 'Patient already assigned' });

    provider.patients.push(patient._id);
    await provider.save();

    if (provider.role === 'doctor')    patient.assignedDoctors.push(provider._id);
    else                               patient.assignedCaregivers.push(provider._id);
    await patient.save();

    // Log activity for the patient
    const actType = provider.role === 'doctor' ? 'doctor_assigned' : 'caregiver_assigned';
    const act = await Activity.log({
      patient: patient._id, actor: provider._id,
      type: actType, source: provider.role,
      title: `${provider.role === 'doctor' ? 'Doctor' : 'Caregiver'} assigned: ${provider.name}`,
      meta: { providerName: provider.name, providerRole: provider.role },
    });
    if (act) broadcastActivity(act);

    res.json({ success: true, message: `Patient ${patient.name} assigned successfully` });
  } catch (err) { next(err); }
};

// DELETE /api/users/assign-patient/:patientId
exports.removePatient = async (req, res, next) => {
  try {
    const provider  = req.user;
    const patientId = req.params.patientId;

    provider.patients = provider.patients.filter(p => p.toString() !== patientId);
    await provider.save();

    const patient = await User.findById(patientId);
    if (patient) {
      if (provider.role === 'doctor')
        patient.assignedDoctors    = patient.assignedDoctors.filter(d => d.toString() !== provider._id.toString());
      else
        patient.assignedCaregivers = patient.assignedCaregivers.filter(c => c.toString() !== provider._id.toString());
      await patient.save();
    }
    res.json({ success: true, message: 'Patient removed from your list' });
  } catch (err) { next(err); }
};

// GET /api/users/providers?role=doctor|caregiver
exports.getProviders = async (req, res, next) => {
  try {
    const filter = { isActive: true };
    filter.role  = req.query.role ? req.query.role : { $in: ['doctor', 'caregiver'] };
    const providers = await User.find(filter).select('name email role phone specialization hospital');
    res.json({ success: true, count: providers.length, providers });
  } catch (err) { next(err); }
};

// PUT /api/users/patients/:patientId/medical
exports.updatePatientMedical = async (req, res, next) => {
  try {
    const { diagnosisStage, medicalHistory } = req.body;
    const patient = await User.findByIdAndUpdate(
      req.params.patientId,
      { diagnosisStage, medicalHistory },
      { new: true, runValidators: true }
    );
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });
    res.json({ success: true, message: 'Medical record updated', patient });
  } catch (err) { next(err); }
};
