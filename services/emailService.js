const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendAttendanceReportEmail({
  to,
  sessionTitle,
  emailBody,
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY must be configured in environment variables.');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Smart Attendance <onboarding@resend.dev>',
      to: [to],
      subject: `Attendance Report - ${sessionTitle}`,
      text: emailBody,
    });

    if (error) {
      console.error("[EmailService] Resend API error:", error);
      throw new Error(`Resend API Error: ${error.message}`);
    }

    console.log("[EmailService] Email sent successfully via Resend. ID:", data.id);
    return data;
  } catch (err) {
    console.error("[EmailService] Failed to send email:", err.message);
    throw err;
  }
}

module.exports = { sendAttendanceReportEmail };
