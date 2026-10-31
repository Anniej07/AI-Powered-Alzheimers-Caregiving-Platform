const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// ── Verify JWT ────────────────────────────────────────────────
exports.protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);

    if (!user)          return res.status(401).json({ success: false, message: 'User not found' });
    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated' });

    await user.updateLastActive();
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// ── Role guard ────────────────────────────────────────────────
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not allowed to perform this action`,
    });
  }
  next();
};

// ── Patient access guard ──────────────────────────────────────
// Ensures caregivers/doctors can only access patients assigned to them.
// Ensures caregivers/doctors/family can only access patients assigned to them.
exports.checkPatientAccess = (req, res, next) => {
  const patientId = req.params.patientId || req.body.patient || req.query.patientId;
  if (!patientId) return next();

  const { role, _id, patients } = req.user;

  if (role === 'patient') {
    if (patientId.toString() !== _id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return next();
  }

  if (['caregiver', 'family', 'doctor'].includes(role)) {
    const assigned = patients.some(p => p.toString() === patientId.toString());
    if (!assigned) {
      return res.status(403).json({ success: false, message: 'Patient not assigned to you' });
    }
    return next();
  }

  next();
};