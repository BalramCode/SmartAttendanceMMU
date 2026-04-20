const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const { sendSuccess, sendError } = require('../utils/response');

const SESSION_DURATION = () =>
  parseInt(process.env.SESSION_DURATION_SECONDS || '60', 10) * 1000;

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/session/create  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
const createSession = async (req, res, next) => {
  try {
    const { subject } = req.body;

    // Deactivate any currently active session by this teacher
    await Session.updateMany(
      { teacherId: req.user._id, isActive: true },
      { isActive: false }
    );

    const qrToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION());

    const session = await Session.create({
      teacherId: req.user._id,
      subject: subject || 'General',
      qrToken,
      isActive: true,
      expiresAt,
    });

    // Emit real-time event if Socket.io is available
    const io = req.app.get('io');
    if (io) {
      io.to(`teacher_${req.user._id}`).emit('session:created', {
        sessionId: session._id,
        qrToken,
        expiresAt,
        subject: session.subject,
      });
    }

    return sendSuccess(res, {
      status: 201,
      message: 'Attendance session created.',
      data: { session },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/session/end  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
const endSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    const query = { teacherId: req.user._id, isActive: true };
    if (sessionId) query._id = sessionId;

    const session = await Session.findOneAndUpdate(
      query,
      { isActive: false },
      { new: true }
    );

    if (!session) {
      return sendError(res, { status: 404, message: 'No active session found.' });
    }

    // Emit close event
    const io = req.app.get('io');
    if (io) {
      io.to(`session_${session._id}`).emit('session:ended', { sessionId: session._id });
    }

    return sendSuccess(res, { message: 'Session ended.', data: { session } });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/session/active  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
const getActiveSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      teacherId: req.user._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      return sendSuccess(res, { message: 'No active session.', data: null });
    }

    // Attach live attendance count
    const attendanceCount = await Attendance.countDocuments({ sessionId: session._id });

    return sendSuccess(res, {
      message: 'Active session found.',
      data: { session, attendanceCount },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/session/history  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
const getSessionHistory = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find({ teacherId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Session.countDocuments({ teacherId: req.user._id }),
    ]);

    return sendSuccess(res, {
      message: 'Session history retrieved.',
      data: { sessions },
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createSession, endSession, getActiveSession, getSessionHistory };