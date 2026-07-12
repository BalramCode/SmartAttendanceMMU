const nodemailer = require('nodemailer');

const createPrimaryTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
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
      console.error("PRIMARY SMTP VERIFY FAILED:", err);
    } else {
      console.log("PRIMARY SMTP VERIFIED");
    }
  });

  return transporter;
};

const createFallbackTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
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
      console.error("FALLBACK SMTP VERIFY FAILED:", err);
    } else {
      console.log("FALLBACK SMTP VERIFIED");
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

  const mailOptions = {
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Attendance Report - ${sessionTitle}`,
    text: emailBody,
  };

  try {
    const info = await createPrimaryTransporter().sendMail(mailOptions);
    console.log("Email sent successfully using primary configuration (port 465)");
    return info;
  } catch (error) {
    console.error("Primary email configuration failed (port 465):", error.message);
    console.log("Retrying using fallback configuration (port 587)...");
    
    try {
      const fallbackInfo = await createFallbackTransporter().sendMail(mailOptions);
      console.log("Email sent successfully using fallback configuration (port 587)");
      return fallbackInfo;
    } catch (fallbackError) {
      console.error("Fallback email configuration also failed (port 587):", fallbackError.message);
      throw fallbackError;
    }
  }
}

module.exports = { sendAttendanceReportEmail };
