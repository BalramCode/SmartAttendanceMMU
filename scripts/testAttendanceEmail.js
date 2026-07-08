require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const Session = require('../models/Session');
require('../models/User');
require('../models/Subject');
require('../models/Batch');
require('../models/Attendance');
const { sendAttendanceReportEmail } = require('../services/emailService');
const { getReportData } = require('../services/attendanceReportService');
const { generateAttendanceCSV, getSubjectLabel } = require('../services/reportGenerator');

const main = async () => {
  console.log('[SMTPTest] Starting standalone attendance email test');
  console.log(`[SMTPTest] EMAIL_USER configured: ${Boolean(process.env.EMAIL_USER)}`);
  console.log(`[SMTPTest] EMAIL_PASS configured: ${Boolean(process.env.EMAIL_PASS)}`);

  await connectDB();

  const session = await Session.findOne({ status: 'completed' })
    .sort({ createdAt: -1 })
    .lean();

  if (!session) {
    throw new Error('No completed session found in database');
  }

  const { session: reportSession, attendanceRecords } = await getReportData(session._id);
  const teacherEmail = reportSession.teacherId?.email;
  if (!teacherEmail) {
    throw new Error(`Latest session ${session._id} has no teacher email`);
  }

  console.log(`[SMTPTest] Using session: ${session._id}`);
  console.log(`[SMTPTest] Teacher email from DB: ${teacherEmail}`);
  console.log(`[SMTPTest] Real CSV row count: ${attendanceRecords.length}`);

  const csvBuffer = generateAttendanceCSV(reportSession, attendanceRecords);
  console.log('[SMTPTest] Real CSV content start');
  console.log(csvBuffer.toString('utf-8'));
  console.log('[SMTPTest] Real CSV content end');

  const info = await sendAttendanceReportEmail({
    to: teacherEmail,
    sessionTitle: getSubjectLabel(reportSession.subject),
    dateStr: new Date(reportSession.createdAt || Date.now()).toLocaleDateString(),
    csvBuffer,
    attendanceCount: attendanceRecords.length,
  });

  console.log(`[SMTPTest] sendMail accepted: ${(info.accepted || []).join(', ')}`);
  console.log(`[SMTPTest] sendMail rejected: ${(info.rejected || []).join(', ') || '(none)'}`);
  console.log(`[SMTPTest] messageId: ${info.messageId}`);
};

main()
  .catch((err) => {
    console.error('[SMTPTest] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB().catch((err) => {
      console.error('[SMTPTest] DB disconnect failed:', err.message);
    });
  });
