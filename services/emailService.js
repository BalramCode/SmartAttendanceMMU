const nodemailer = require('nodemailer');

const createTransporter = () =>
  nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

async function sendAttendanceReportEmail({
  to,
  sessionTitle,
  dateStr,
  csvBuffer,
  attendanceCount,
}) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be configured');
  }

  const safeTitle = sessionTitle.replace(/[^\w.-]+/g, '_');
  const safeDate = dateStr.replace(/[^\w.-]+/g, '_');

  return createTransporter().sendMail({
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Attendance Report - ${sessionTitle} (${dateStr})`,
    text:
      `Hi,\n\nAttached is the attendance report for "${sessionTitle}" held on ${dateStr}.\n` +
      `Total students marked: ${attendanceCount}.\n\nRegards,\nSmart Attendance System`,
    attachments: [
      {
        filename: `attendance_${safeTitle}_${safeDate}.csv`,
        contentType: 'text/csv',
        content: csvBuffer,
      },
    ],
  });
}

module.exports = { sendAttendanceReportEmail };
