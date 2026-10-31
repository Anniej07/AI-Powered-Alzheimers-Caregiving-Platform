/**
 * Socket.io service — real-time event broadcasting.
 *
 * Architecture:
 *   - Each authenticated user joins a personal room: "user:<userId>"
 *   - Caregivers/doctors also join rooms for each assigned patient: "patient:<patientId>"
 *   - When an alert fires or emotion is logged, we emit to all rooms watching that patient.
 *
 * Usage (from other services):
 *   const { emitToPatientRoom, emitToUserRoom } = require('./socketService');
 *   emitToPatientRoom(patientId, 'new_alert', alertData);
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

// ── Initialise (called once from server.js) ───────────────────
const init = (httpServer) => {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  // ── Connection handler ───────────────────────────────────────
  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`⚡ Socket connected: ${user.name} (${user.role})`);

    // Personal room — for direct notifications
    socket.join(`user:${user._id}`);

    // Patient rooms — caregivers and doctors join rooms for their patients
    if (['doctor', 'caregiver'].includes(user.role) && user.patients?.length) {
      user.patients.forEach(patientId => {
        socket.join(`patient:${patientId}`);
      });
    }

    // Patients join their own room
    if (user.role === 'patient') {
      socket.join(`patient:${user._id}`);
    }

    socket.on('disconnect', () => {
      console.log(`⚡ Socket disconnected: ${user.name}`);
    });

    // Allow client to join additional patient rooms dynamically
    socket.on('join_patient', (patientId) => {
      if (['doctor', 'caregiver'].includes(user.role)) {
        socket.join(`patient:${patientId}`);
      }
    });
  });

  console.log('⚡ Socket.io initialised');
  return io;
};

// ── Emit helpers ─────────────────────────────────────────────

/**
 * Emit to everyone watching a patient (caregivers, doctors, patient themselves).
 */
const emitToPatientRoom = (patientId, event, data) => {
  if (!io) return;
  io.to(`patient:${patientId}`).emit(event, data);
};

/**
 * Emit to a specific user's personal room.
 */
const emitToUserRoom = (userId, event, data) => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
};

/**
 * Broadcast a new alert to all patient watchers.
 * Called by alertService after creating an alert.
 */
const broadcastAlert = (alert) => {
  emitToPatientRoom(alert.patient.toString(), 'new_alert', {
    id:       alert._id,
    type:     alert.type,
    severity: alert.severity,
    title:    alert.title,
    message:  alert.message,
    createdAt:alert.createdAt,
  });
};

/**
 * Broadcast a new emotion reading.
 * Called by emotionController after saving.
 */
const broadcastEmotion = (emotion) => {
  emitToPatientRoom(emotion.patient.toString(), 'new_emotion', {
    id:           emotion._id,
    detectionType:emotion.detectionType,
    emotion:      emotion.emotion,
    sentiment:    emotion.sentiment,
    confidence:   emotion.confidence,
    recordedAt:   emotion.recordedAt,
  });
};

/**
 * Broadcast a dose log update.
 */
const broadcastDoseUpdate = (patientId, medicationName, status) => {
  emitToPatientRoom(patientId.toString(), 'dose_update', { medicationName, status, time: new Date() });
};

/**
 * Broadcast an activity event.
 */
const broadcastActivity = (activity) => {
  emitToPatientRoom(activity.patient.toString(), 'new_activity', {
    id:    activity._id,
    type:  activity.type,
    title: activity.title,
    source: activity.source,
    createdAt: activity.createdAt,
  });
};

module.exports = { init, emitToPatientRoom, emitToUserRoom, broadcastAlert, broadcastEmotion, broadcastDoseUpdate, broadcastActivity };
