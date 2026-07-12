const nodemailer = require('nodemailer');

const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });

  transporter.verify((err, success) => {
    if (err) {
      console.error("SMTP VERIFY FAILED:", err);
    } else {
      console.log("SMTP VERIFIED");
    }
  });

  return transporter;
};

async function sendAttendanceReportEmail({
  to,
  sessionTitle,
  emailBody,
}) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be configured');
  }

  return createTransporter().sendMail({
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Attendance Report - ${sessionTitle}`,
    text: emailBody,
  });
}

module.exports = { sendAttendanceReportEmail };
