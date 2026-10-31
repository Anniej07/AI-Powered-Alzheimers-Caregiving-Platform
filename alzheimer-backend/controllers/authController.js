const crypto   = require('crypto');
const User     = require('../models/User');
const Activity = require('../models/Activity');
const { sendEmail } = require('../services/notificationService');

const sendToken = (user, code, res, message = 'Success') => {
  const token = user.getSignedJwtToken();
  const obj   = user.toObject();
  delete obj.password;
  res.status(code).json({ success: true, message, token, user: obj });
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, dateOfBirth, gender,
            specialization, licenseNumber, hospital } = req.body;
    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }
    const user = await User.create({
      name, email, password, role, phone, dateOfBirth, gender,
      specialization, licenseNumber, hospital,
    });
    sendToken(user, 201, res, 'Registration successful');
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user)               return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive)      return res.status(401).json({ success: false, message: 'Account deactivated' });
    if (!(await user.matchPassword(password)))
                             return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (user.role === 'patient') {
      await Activity.log({ patient: user._id, actor: user._id, type: 'patient_login', source: 'patient', title: 'Patient logged in' });
    }
    sendToken(user, 200, res, 'Login successful');
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('assignedDoctors',    'name email specialization hospital')
      .populate('assignedCaregivers', 'name email phone')
      .populate('patients',           'name email diagnosisStage lastActive');
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name','phone','address','dateOfBirth','gender',
                     'emergencyContact','specialization','hospital','notificationPreferences'];
    const data = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.file) data.profileImage = req.file.path;
    const user = await User.findByIdAndUpdate(req.user._id, data, { new: true, runValidators: true });
    if (req.user.role === 'patient') {
      await Activity.log({ patient: req.user._id, actor: req.user._id, type: 'profile_updated', source: 'patient', title: 'Profile updated' });
    }
    res.json({ success: true, message: 'Profile updated', user });
  } catch (err) { next(err); }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond OK to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
    }

    // Generate raw token and store its hash
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const hashed    = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken  = hashed;
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${rawToken}`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px;">
        <h2 style="color:#3D5248;margin-bottom:8px;">Reset your password</h2>
        <p style="color:#4A5450;margin-bottom:24px;">You requested a password reset for your AlzheimerCare account. Click the button below within <strong>30 minutes</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#5C7A6E;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:500;">Reset password</a>
        <p style="color:#8A9490;font-size:13px;margin-top:24px;">If you didn't request this, you can safely ignore this email. The link expires in 30 minutes.</p>
        <p style="color:#8A9490;font-size:12px;margin-top:8px;">Or copy this URL: ${resetUrl}</p>
      </div>`;

    await sendEmail({ to: user.email, subject: 'AlzheimerCare — Password Reset', html });
    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password/:token
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user   = await User.findOne({
      resetPasswordToken:  hashed,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    user.password            = password;
    user.resetPasswordToken  = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendToken(user, 200, res, 'Password reset successful');
  } catch (err) { next(err); }
};

// POST /api/auth/logout
exports.logout = (_req, res) => res.json({ success: true, message: 'Logged out' });
