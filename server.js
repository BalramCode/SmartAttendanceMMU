/**
 * Smart Attendance System – Server Entry Point
 *
 * Architecture:
 *   Express app  →  HTTP server  →  Socket.io (real-time layer)
 *
 * Real-time rooms:
 *   • teacher_{teacherId}   – teacher dashboard (session events)
 *   • session_{sessionId}   – per-session attendance feed
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const path = require("path");
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server: SocketServer } = require('socket.io');

const { connectDB, disconnectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { sendError } = require('./utils/response');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const batchRoutes = require("./routes/batchRoutes");
const subjectRoutes = require('./routes/subjectRoutes');


// ─────────────────────────────────────────────────────────────────────────────
//  App setup
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ── Security & Parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));



// ── CORS ──────────────────────────────────────────────────────────────────────
// This now pulls directly from your .env file
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'http://localhost:8080', // Your current dev URL
  'http://localhost:3000'  // Just in case
].filter(Boolean); // Removes any undefined values

app.use(
  cors({
    origin: (origin, cb) => {
      // allow server-to-server / Postman (no origin)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many auth attempts, please try again in 15 minutes.' },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Socket.io
// ─────────────────────────────────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

// Make io available in controllers via app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Teacher joins their personal room + a session room
  socket.on('join:teacher', ({ teacherId }) => {
    if (teacherId) {
      socket.join(`teacher_${teacherId}`);
      console.log(`[Socket] Teacher ${teacherId} joined room`);
    }
  });

  // Any client (teacher dashboard) subscribes to a session's live feed
  socket.on('join:session', ({ sessionId }) => {
    if (sessionId) {
      socket.join(`session_${sessionId}`);
      console.log(`[Socket] Joined session room: ${sessionId}`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/session', apiLimiter, sessionRoutes);
app.use('/api/attendance', apiLimiter, attendanceRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/subjects', subjectRoutes);
// Health-check endpoint (useful for Docker / load balancers)
app.get('/api/health', (_, res) =>
  res.json({ success: true, message: 'Smart Attendance API is running 🟢', timestamp: new Date() })
);

// 404 handler for unknown routes
app.use((req, res) =>
  sendError(res, { status: 404, message: `Route ${req.method} ${req.originalUrl} not found.` })
);

// Global error handler (must be last)
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║       Smart Attendance System  🎓            ║
║                                              ║
║  REST   → http://localhost:${PORT}/api         ║
║  Socket → ws://localhost:${PORT}               ║
║  Env    → ${(process.env.NODE_ENV || 'development').padEnd(34)}║
╚══════════════════════════════════════════════╝
    `);
  });
};

start();

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully…`);
  server.close(async () => {
    await disconnectDB();
    console.log('[Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('[Server] Unhandled rejection:', err.message);
  shutdown('unhandledRejection');
});