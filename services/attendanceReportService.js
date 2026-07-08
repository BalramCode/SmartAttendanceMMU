const Attendance = require('../models/Attendance');
const Session = require('../models/Session');
require('../models/User');
require('../models/Subject');
require('../models/Batch');
const { sendAttendanceReportEmail } = require('./emailService');
const { generateAttendanceCSV, getSubjectLabel } = require('./reportGenerator');

const populateReportSession = (query) =>
  query
    .populate('teacherId', 'name email')
    .populate({
      path: 'subject',
      select: 'name fullName semester batch',
      populate: { path: 'batch', select: 'name' },
    });

const getReportData = async (sessionId) => {
  const session = await populateReportSession(Session.findById(sessionId));
  if (!session) {
    throw new Error('Session not found');
  }

  const attendanceRecords = await Attendance.find({ sessionId: session._id })
    .populate('studentId', 'name rollNo')
    .sort({ markedAt: 1 })
    .lean();

  return { session, attendanceRecords };
};

const sendSessionReport = async (session, attendanceRecords) => {
  const teacherEmail = session.teacherId?.email;
  console.log(
    `[ExpiryEmailTest] Resolved teacher email before send: sessionId=${session._id}, teacherEmail=${teacherEmail || '(missing)'}`
  );
  if (!teacherEmail) {
    throw new Error(`No teacher email found for session ${session._id}`);
  }

  const sessionTitle = getSubjectLabel(session.subject);
  const dateStr = new Date(session.createdAt || Date.now()).toLocaleDateString();
  const csvBuffer = generateAttendanceCSV(session, attendanceRecords);

  console.log(
    `[ExpiryEmailTest] About to call sendAttendanceReportEmail: sessionId=${session._id}, to=${teacherEmail}, attendanceCount=${attendanceRecords.length}`
  );
  await sendAttendanceReportEmail({
    to: teacherEmail,
    sessionTitle,
    dateStr,
    csvBuffer,
    attendanceCount: attendanceRecords.length,
  });
};

const handleSessionCompleted = async (sessionId) => {
  try {
    const { session, attendanceRecords } = await getReportData(sessionId);
    if (session.status !== 'completed' || session.emailSent) {
      return;
    }

    await sendSessionReport(session, attendanceRecords);
    session.emailSent = true;
    await session.save();
  } catch (err) {
    console.error(`[AttendanceEmail] Failed for session ${sessionId}:`, err.message);
  }
};

const resendSessionReport = async (sessionId) => {
  const { session, attendanceRecords } = await getReportData(sessionId);
  if (session.status !== 'completed') {
    const err = new Error('Session has not ended yet');
    err.statusCode = 400;
    throw err;
  }

  await sendSessionReport(session, attendanceRecords);
  session.emailSent = true;
  await session.save();
};

module.exports = {
  handleSessionCompleted,
  resendSessionReport,
};
