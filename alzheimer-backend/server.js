require('dotenv').config();
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const connectDB     = require('./config/db');
const errorHandler  = require('./middleware/errorHandler');
const { startCronJobs } = require('./services/cronService');
const socketService = require('./services/socketService');

// ── Route imports ────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth');
const userRoutes         = require('./routes/users');
const medicationRoutes   = require('./routes/medications');
const prescriptionRoutes = require('./routes/prescriptions');
const emotionRoutes      = require('./routes/emotions');
const alertRoutes        = require('./routes/alerts');
const dashboardRoutes    = require('./routes/dashboard');
const activityRoutes     = require('./routes/activity');

// ── Bootstrap ────────────────────────────────────────────────────────────────
connectDB();
const app        = express();
const httpServer = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
socketService.init(httpServer);

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  message: { success: false, message: 'Too many requests – try again later.' },
}));
app.use('/api/auth/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many auth attempts – try again later.' },
}));

// ── General middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static uploads ───────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/medications',   medicationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/emotions',      emotionRoutes);
app.use('/api/alerts',        alertRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/activity',      activityRoutes);

app.get('/api/health', (_req, res) =>
  res.json({ success: true, message: 'API is running', timestamp: new Date() })
);
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 5000;
const server = httpServer.listen(PORT, () => {
  console.log(`\n🏥  AlzheimerCare API  [${process.env.NODE_ENV}]  →  http://localhost:${PORT}/api`);
  console.log(`⚡  WebSocket ready on the same port`);
});

startCronJobs();

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = app;
