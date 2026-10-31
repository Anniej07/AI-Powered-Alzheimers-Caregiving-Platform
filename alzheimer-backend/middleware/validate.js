const { body, validationResult } = require('express-validator');

// Run validation and return 400 if there are errors
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ── Reusable rule sets ────────────────────────────────────────
exports.registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be ≥ 6 chars'),
  body('role').isIn(['patient', 'caregiver', 'doctor']).withMessage('Invalid role'),
];

exports.loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];

exports.medicationRules = [
  body('patient').isMongoId().withMessage('Valid patient ID required'),
  body('name').trim().notEmpty().withMessage('Medication name required'),
  body('dosage.amount').isNumeric().withMessage('Dosage amount must be a number'),
  body('dosage.unit').isIn(['mg','ml','mcg','g','tablet','capsule']).withMessage('Invalid dosage unit'),
  body('frequency').notEmpty().withMessage('Frequency is required'),
  body('startDate').isISO8601().withMessage('Valid start date required'),
];
