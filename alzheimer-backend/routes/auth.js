const express = require('express');
const router  = express.Router();

const { register, login, getMe, updateProfile, changePassword, logout, forgotPassword, resetPassword } = require('../controllers/authController');
const { protect }  = require('../middleware/auth');
const upload       = require('../middleware/upload');
const { registerRules, loginRules, validate } = require('../middleware/validate');

// Public
router.post('/register',              registerRules, validate, register);
router.post('/login',                 loginRules,    validate, login);
router.post('/forgot-password',       forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected
router.use(protect);
router.get ('/me',              getMe);
router.put ('/profile',         upload.single('profileImage'), updateProfile);
router.put ('/change-password', changePassword);
router.post('/logout',          logout);

module.exports = router;
