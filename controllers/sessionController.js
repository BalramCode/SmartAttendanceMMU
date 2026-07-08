const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const { sendSuccess, sendError } = require('../utils/response');
const mongoose = require('mongoose');
const Subject = require('../models/Subject');
const {
  handleSessionCompleted,
  resendSessionReport,
} = require('../services/attendanceReportService');
const SESSION_DURATION = () =>
  parseInt(process.env.SESSION_DURATION_SECONDS || '60', 10) * 1000;

const populateSessionTeacherData = (query) =>
  query
    .populate('teacherId', 'name email')
    .populate({
      path: 'subject',
      select: 'name fullName semester batch teacher',
      populate: [
        { path: 'batch', select: 'name' },
        { path: 'teacher', select: 'name email' },
      ],
    });

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/session/create  [teacher]
// ─────────────────────────────────────────────────────────────────────────────

const createSession = async (req, res, next) => {
  try {
    const { subject, lat, lng } = req.body;
    const subjectDoc = await Subject.findById(subject);
    if (!subjectDoc) {
      return sendError(res, { message: "Subject not found" });
    }

    // Create a timestamp for the very start of the current day (00:00:00)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    //FOR SPECIFIC TEACHER
    // 1. Check if ANY session exists for this subject since the start of today
    // const existingSession = await Session.findOne({
    //   teacherId: req.user._id,
    //   subject: new mongoose.Types.ObjectId(subject),
    //   createdAt: { $gte: startOfToday } // Look for anything created today
    // });

    //FOR EVERY TEACHER CAN SEE
    const existingSession = await populateSessionTeacherData(Session.findOne({
      subject: new mongoose.Types.ObjectId(subject)
    }).sort({ createdAt: -1 })).lean();


    if (existingSession) {
      // If found, we RETURN it. The frontend will see this and 
      // stay on "See Attendance" instead of showing "Launch".
      return sendSuccess(res, {
        status: 200,
        message: 'A session for this subject was already handled today.',
        data: { session: existingSession },
      });
    }

    // 2. If no session for THIS subject exists, deactivate OTHER subjects' sessions
    // This prevents a teacher from having two different classes live at the same time.
    await Session.updateMany(
      { teacherId: req.user._id, isActive: true },
      { isActive: false }
    );

    // 3. Create a brand new session
    const qrToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION());

    const session = await Session.create({
      teacherId: req.user._id,
      subject: subjectDoc._id,
      batch: subjectDoc.batch, // 🔥 THIS IS THE KEY FIX
      qrToken,
      isActive: true,
      expiresAt,
      location: { lat, lng }
    });

    const populatedSession = await populateSessionTeacherData(
      Session.findById(session._id)
    ).lean();

    // 4. Socket.io Emit
    const io = req.app.get('io');
    if (io) {
      io.to(`teacher_${req.user._id}`).emit('session:created', {
        sessionId: session._id,
        qrToken,
        expiresAt,
        subject: populatedSession?.subject || session.subject,
      });
    }

    return sendSuccess(res, {
      status: 201,
      message: 'New attendance session created.',
      data: { session: populatedSession || session },
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

    // Find the session and mark it inactive
    const session = await Session.findOneAndUpdate(
      { _id: sessionId, teacherId: req.user._id },
      {
        isActive: false,
        status: 'completed'
      },
      { new: true }
    );

    if (!session) {
      return sendError(res, { status: 404, message: 'Session not found.' });
    }

    // Emit event so students get kicked out of the join screen
    const io = req.app.get('io');
    if (io) {
      io.to(`session_${session._id}`).emit('session:ended', { sessionId: session._id });
    }

    handleSessionCompleted(session._id);

    return sendSuccess(res, { message: 'Session ended successfully.', data: { session } });
  } catch (err) {
    next(err);
  }
};

const resendAttendanceReport = async (req, res, next) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, teacherId: req.user._id });
    if (!session) {
      return sendError(res, { status: 404, message: 'Session not found or access denied.' });
    }

    await resendSessionReport(session._id);

    return sendSuccess(res, { message: 'Report resent successfully.' });
  } catch (err) {
    if (err.statusCode) {
      return sendError(res, { status: err.statusCode, message: err.message });
    }

    console.error(`[AttendanceEmail] Resend failed for session ${req.params.id}:`, err.message);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/session/active  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/session/active/:subjectId  [teacher]
// ─────────────────────────────────────────────────────────────────────────────
const getActiveSession = async (req, res, next) => {
  try {
    const { subjectId } = req.params;

    let query = {};

    // ✅ FIX: only use ObjectId if valid
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      query.subject = new mongoose.Types.ObjectId(subjectId);
    }

    const session = await populateSessionTeacherData(
      Session.findOne(query).sort({ createdAt: -1 })
    ).lean();

    if (!session) {
      return sendSuccess(res, {
        message: 'No session found.',
        data: { session: null }
      });
    }

    const attendanceCount = await Attendance.countDocuments({
      sessionId: session._id
    });

    return sendSuccess(res, {
      message: 'Session retrieved successfully.',
      data: { session, attendanceCount },
    });

  } catch (err) {
    console.error("getActiveSession error:", err); // 🔥 ADD THIS
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/session/history  [teacher]
const getSessionHistory = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const skip = (page - 1) * limit;

    // sessionController.js
    const [sessions, total] = await Promise.all([
      populateSessionTeacherData(Session.find({ teacherId: req.user._id }))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Session.countDocuments({ teacherId: req.user._id }),
    ]);

    // FIX 2: Attach attendance counts to each session in the history
    const sessionsWithCounts = await Promise.all(
      sessions.map(async (session) => {
        const count = await Attendance.countDocuments({ sessionId: session._id });
        return { ...session, attendanceCount: count };
      })
    );

    return sendSuccess(res, {
      message: 'Session history retrieved.',
      data: { sessions: sessionsWithCounts }, // Send the enriched data
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createSession,
  endSession,
  resendAttendanceReport,
  getActiveSession,
  getSessionHistory,
};
