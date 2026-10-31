const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    // ── Core ─────────────────────────────────────────────────
    name: {
      type: String, required: [true, 'Name is required'],
      trim: true, maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String, required: [true, 'Email is required'],
      unique: true, lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },
    password: {
      type: String, required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'], select: false,
    },
    role: {
      type: String, enum: ['patient', 'caregiver', 'doctor', 'family'],
      required: [true, 'Role is required'],
    },

    // ── Profile ───────────────────────────────────────────────
    phone:        String,
    profileImage: String,
    dateOfBirth:  Date,
    gender:       { type: String, enum: ['male', 'female', 'other'] },
    address: {
      street: String, city: String, state: String, zipCode: String, country: String,
    },

    // ── Doctor fields ─────────────────────────────────────────
    specialization: String,
    licenseNumber:  String,
    hospital:       String,

    // ── Patient fields ────────────────────────────────────────
    emergencyContact: { name: String, phone: String, relation: String },
    diagnosisStage: { type: String, enum: ['early', 'moderate', 'severe'] },
    medicalHistory: [String],

    // ── Relationships ─────────────────────────────────────────
    assignedDoctors:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    assignedCaregivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    patients:           [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // ── Preferences & status ──────────────────────────────────
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms:   { type: Boolean, default: true },
    },
    isActive:   { type: Boolean, default: true },
    lastActive: { type: Date,    default: Date.now },

    // ── Password reset ────────────────────────────────────────
    resetPasswordToken:  String,
    resetPasswordExpire: Date,
  },
  { timestamps: true }
);

// ── Hooks ─────────────────────────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Methods ───────────────────────────────────────────────────
UserSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

UserSchema.methods.updateLastActive = async function () {
  this.lastActive = new Date();
  await this.save({ validateBeforeSave: false });
};

module.exports = mongoose.model('User', UserSchema);
