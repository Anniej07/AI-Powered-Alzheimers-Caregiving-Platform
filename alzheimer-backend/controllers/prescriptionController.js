const Prescription = require('../models/Prescription');
const Activity     = require('../models/Activity');
const { broadcastActivity } = require('../services/socketService');

// GET /api/prescriptions/patient/:patientId
exports.getPrescriptions = async (req, res, next) => {
  try {
    const patientId     = req.params.patientId || req.user._id;
    const prescriptions = await Prescription.find({ patient: patientId })
      .populate('doctor', 'name specialization hospital email phone')
      .sort({ prescriptionDate: -1 });
    res.json({ success: true, count: prescriptions.length, prescriptions });
  } catch (err) { next(err); }
};

// GET /api/prescriptions/:id
exports.getPrescription = async (req, res, next) => {
  try {
    const p = await Prescription.findById(req.params.id)
      .populate('doctor',  'name specialization hospital email phone')
      .populate('patient', 'name email dateOfBirth');
    if (!p) return res.status(404).json({ success: false, message: 'Prescription not found' });
    res.json({ success: true, prescription: p });
  } catch (err) { next(err); }
};

// POST /api/prescriptions
exports.createPrescription = async (req, res, next) => {
  try {
    const { patient, diagnosis, medications, notes, followUpDate, expiryDate, sharedWith } = req.body;
    const data = {
      patient, doctor: req.user._id, diagnosis,
      medications: typeof medications === 'string' ? JSON.parse(medications) : medications,
      notes, followUpDate, expiryDate,
      sharedWith: typeof sharedWith === 'string' ? JSON.parse(sharedWith) : sharedWith,
    };
    if (req.file) { data.fileUrl = req.file.path; data.fileName = req.file.originalname; data.fileType = req.file.mimetype; }
    const p = await Prescription.create(data);

    const act = await Activity.log({
      patient, actor: req.user._id,
      type: 'prescription_created', source: 'doctor',
      title: `Prescription created: ${diagnosis}`,
      description: `${data.medications?.length || 0} medication(s) prescribed`,
      relatedModel: 'Prescription', relatedId: p._id,
      meta: { diagnosis, medicationCount: data.medications?.length },
    });
    if (act) broadcastActivity(act);

    const populated = await Prescription.findById(p._id)
      .populate('doctor', 'name specialization')
      .populate('patient', 'name email');
    res.status(201).json({ success: true, message: 'Prescription created', prescription: populated });
  } catch (err) { next(err); }
};

// PUT /api/prescriptions/:id
exports.updatePrescription = async (req, res, next) => {
  try {
    const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user._id });
    if (!p) return res.status(404).json({ success: false, message: 'Not found or not authorized' });
    const fields = ['diagnosis','medications','notes','followUpDate','expiryDate','isActive','sharedWith'];
    fields.forEach(f => {
      if (req.body[f] !== undefined)
        p[f] = (f === 'medications' || f === 'sharedWith') && typeof req.body[f] === 'string' ? JSON.parse(req.body[f]) : req.body[f];
    });
    if (req.file) { p.fileUrl = req.file.path; p.fileName = req.file.originalname; p.fileType = req.file.mimetype; }
    await p.save();

    await Activity.log({
      patient: p.patient, actor: req.user._id,
      type: 'prescription_updated', source: 'doctor',
      title: `Prescription updated: ${p.diagnosis}`,
      relatedModel: 'Prescription', relatedId: p._id,
    });

    res.json({ success: true, message: 'Prescription updated', prescription: p });
  } catch (err) { next(err); }
};

// DELETE /api/prescriptions/:id
exports.deletePrescription = async (req, res, next) => {
  try {
    const p = await Prescription.findOneAndDelete({ _id: req.params.id, doctor: req.user._id });
    if (!p) return res.status(404).json({ success: false, message: 'Not found or not authorized' });
    res.json({ success: true, message: 'Prescription deleted' });
  } catch (err) { next(err); }
};

// POST /api/prescriptions/:id/share
exports.sharePrescription = async (req, res, next) => {
  try {
    const p = await Prescription.findOne({ _id: req.params.id, doctor: req.user._id });
    if (!p) return res.status(404).json({ success: false, message: 'Prescription not found' });
    const { caregiverId } = req.body;
    if (!p.sharedWith.includes(caregiverId)) { p.sharedWith.push(caregiverId); await p.save(); }
    res.json({ success: true, message: 'Prescription shared' });
  } catch (err) { next(err); }
};
