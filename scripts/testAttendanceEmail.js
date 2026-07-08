require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const Session = require('../models/Session');
require('../models/User');
require('../models/Subject');
const { sendAttendanceReportEmail } = require('../services/emailService');

const main = async () => {
  console.log('[SMTPTest] Starting standalone attendance email test');
  console.log(`[SMTPTest] EMAIL_USER configured: ${Boolean(process.env.EMAIL_USER)}`);
  console.log(`[SMTPTest] EMAIL_PASS configured: ${Boolean(process.env.EMAIL_PASS)}`);

  await connectDB();

  const session = await Session.findOne()
    .sort({ createdAt: -1 })
    .populate('teacherId', 'name email')
    .populate('subject', 'name fullName')
    .lean();

  if (!session) {
    throw new Error('No session found in database');
  }

  const teacherEmail = session.teacherId?.email;
  if (!teacherEmail) {
    throw new Error(`Latest session ${session._id} has no teacher email`);
  }

  console.log(`[SMTPTest] Using session: ${session._id}`);
  console.log(`[SMTPTest] Teacher email from DB: ${teacherEmail}`);

  const info = await sendAttendanceReportEmail({
    to: teacherEmail,
    sessionTitle: session.subject?.fullName || session.subject?.name || 'SMTP Test Session',
    dateStr: new Date().toLocaleDateString(),
    csvBuffer: Buffer.from(
      'SMTP connectivity test for Smart Attendance\n\nstudentName,rollNo,status,markedAt\nTest Student,TEST001,present,' +
        new Date().toISOString(),
      'utf-8'
    ),
    attendanceCount: 1,
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
