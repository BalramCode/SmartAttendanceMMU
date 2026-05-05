const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const User = require("../models/User");
const { sendSuccess, sendError } = require('../utils/response');

const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user._id;

    // 1. Get all attendance records for this student (no batch matching needed)
    const attendance = await Attendance.find({ studentId });

    const sessionIds = attendance.map(a => a.sessionId);
    const present = attendance.filter(a => a.status === "present").length;

    // 2. Get ALL sessions that belong to the same batch as student
    //    by looking at sessions they actually have attendance for
    const student = await User.findById(studentId);

    // 3. Find all sessions for student's batch
    const allBatchSessions = await Session.find({ 
      batch: student.batch 
    });
    const attendanceMap = {};
attendance.forEach(a => {
  attendanceMap[a.sessionId.toString()] = a.status;
});

    // Get recent 5 sessions from batch, show present/absent
const recentSessions = await Session.find({ batch: student.batch })
  .populate("subject", "name")
  .sort({ createdAt: -1 })
  .limit(5);

    const total = allBatchSessions.length; // All sessions in batch (including unattended)
    const percentage = total === 0 ? 0 : (present / total) * 100;

    // 4. Recent logs with subject name
   const logs = recentSessions.map(session => ({
  _id: session._id,
  status: attendanceMap[session._id.toString()] || "absent",
  markedAt: session.createdAt,
  sessionId: {
    subject: session.subject,
    createdAt: session.createdAt
  }
}));
res.json({ percentage, total, present, logs });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ message: "Dashboard error" });
  }
};


function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}



// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/attendance/mark  [student]
// ─────────────────────────────────────────────────────────────────────────────
const markAttendance = async (req, res, next) => {
    try {
        const { qrToken } = req.body;

        // 1. Find the session by token
        const session = await Session.findOne({
            qrToken: qrToken,
            isActive: true,
            expiresAt: { $gt: new Date() }
        });

        if (!session) {
            return sendError(res, { status: 404, message: 'Invalid QR code. Session not found.' });
        }

        // 2. Check if session is still active
        if (!session.isActive) {
            return sendError(res, { status: 400, message: 'This attendance session has been closed.' });
        }

        // 3. Check token expiry
        if (new Date() > session.expiresAt) {
            // Auto-deactivate stale session
            session.isActive = false;
            await session.save();
            return sendError(res, { status: 400, message: 'QR code has expired. Please ask the teacher to generate a new one.' });
        }

        const { lat, lng } = req.body;

        if (!lat || !lng) {
            return sendError(res, { status: 400, message: "Location required" });
        }

        if (!session.location) {
            return sendError(res, { status: 500, message: "Session location not set" });
        }

        // attendanceController.js -> markAttendance function
        const distance = getDistance(
            lat,
            lng,
            session.location.lat,
            session.location.lng
        );

        // Increase tolerance to 150m for better UX in university buildings
        if (distance > 150) {
            return sendError(res, {
                status: 403,
                message: `Location mismatch. You are ${Math.round(distance)}m away (150m limit).`
            });
        }




        // 4. Prevent duplicate attendance (compound index will also catch this, but we give a nicer message)
        const alreadyMarked = await Attendance.findOne({
            studentId: req.user._id,
            sessionId: session._id,
        });
        if (alreadyMarked) {
            return sendError(res, { status: 409, message: 'You have already marked attendance for this session.' });
        }

        // 5. Save attendance record
        const attendance = await Attendance.create({
            studentId: req.user._id,
            sessionId: session._id,
            status: 'present',
        });

        // 6. Emit real-time update to teacher dashboard
        const io = req.app.get('io');
        if (io) {
            // You must use an async function here to use 'await'
            const handleSocketUpdate = async () => {
                const count = await Attendance.countDocuments({ sessionId: session._id });

                io.to(`session_${session._id}`).emit('attendance:new', {
                    studentId: req.user._id,
                    name: req.user.name,
                    rollNo: req.user.rollNo,
                    sessionId: session._id,
                    markedAt: attendance.markedAt,
                    totalCount: count,
                });
            };

            handleSocketUpdate(); // Run the async function
        }

        return sendSuccess(res, {
            status: 201,
            message: `Attendance marked! Welcome to class, ${req.user.name}.`,
            data: { attendance },
        });
    } catch (err) {
        // Handle Mongoose duplicate key for the compound index
        if (err.code === 11000) {
            return sendError(res, { status: 409, message: 'You have already marked attendance for this session.' });
        }
        next(err);
    }
};

// ... (Your existing steps 1-5 remain the same)

// 6. Emit real-time update to teacher dashboard
// ... inside your markAttendance function ...



// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/attendance/student  [student]
//  Returns all attendance records for the logged-in student
// ─────────────────────────────────────────────────────────────────────────────
const getStudentAttendance = async (req, res, next) => {
    try {
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
        const skip = (page - 1) * limit;

        const [records, total] = await Promise.all([
            Attendance.find({ studentId: req.user._id })
                .populate({ path: 'sessionId', select: 'subject createdAt expiresAt teacherId', populate: { path: 'teacherId', select: 'name email' } })
                .sort({ markedAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Attendance.countDocuments({ studentId: req.user._id }),
        ]);

        return sendSuccess(res, {
            message: 'Attendance records retrieved.',
            data: { records },
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/attendance/session/:id  [teacher]
//  Returns all student attendance for a specific session
// ─────────────────────────────────────────────────────────────────────────────
const getSessionAttendance = async (req, res, next) => {
    try {
        const { id: sessionId } = req.params;

        // Ensure the session belongs to the requesting teacher
        const session = await Session.findOne({ _id: sessionId, teacherId: req.user._id }).lean();
        if (!session) {
            return sendError(res, { status: 404, message: 'Session not found or access denied.' });
        }

        // Inside your attendance controller
        const records = await Attendance.find({ sessionId })
            .populate('studentId', 'name rollNo') // This brings in the student's name
            .sort({ markedAt: -1 });

        return sendSuccess(res, {
            message: 'Session attendance retrieved.',
            data: {
                session,
                records,
                totalPresent: records.length,
            },
        });
    } catch (err) {
        next(err);
    }
};

module.exports = { markAttendance, getStudentAttendance, getSessionAttendance, getStudentDashboard };