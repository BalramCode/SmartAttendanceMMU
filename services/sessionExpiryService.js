const Session = require('../models/Session');
const { handleSessionCompleted } = require('./attendanceReportService');

const DEFAULT_EXPIRY_CHECK_INTERVAL_MS = 15000;

const processExpiredSessions = async () => {
  const expiredSessions = await Session.find({
    isActive: true,
    status: 'active',
    expiresAt: { $lte: new Date() },
  }).select('_id expiresAt emailSent');

  for (const session of expiredSessions) {
    const updated = await Session.findOneAndUpdate(
      {
        _id: session._id,
        isActive: true,
        status: 'active',
        expiresAt: { $lte: new Date() },
      },
      {
        isActive: false,
        status: 'completed',
      },
      { new: true }
    );

    if (!updated) {
      continue;
    }

    console.log(
      `[ExpiryEmailTest] Duration expiry monitor completed session: sessionId=${updated._id}, emailSent=${updated.emailSent}, expiresAt=${updated.expiresAt?.toISOString()}`
    );

    await handleSessionCompleted(updated._id);
  }

  return expiredSessions.length;
};

const startSessionExpiryMonitor = () => {
  const intervalMs = parseInt(
    process.env.SESSION_EXPIRY_CHECK_INTERVAL_MS || `${DEFAULT_EXPIRY_CHECK_INTERVAL_MS}`,
    10
  );

  if (process.env.DISABLE_SESSION_EXPIRY_MONITOR === 'true') {
    console.log('[ExpiryEmailTest] Duration expiry monitor disabled');
    return null;
  }

  console.log(`[ExpiryEmailTest] Duration expiry monitor running every ${intervalMs}ms`);

  processExpiredSessions().catch((err) => {
    console.error('[ExpiryEmailTest] Duration expiry monitor failed:', err.message);
  });

  const timer = setInterval(() => {
    processExpiredSessions().catch((err) => {
      console.error('[ExpiryEmailTest] Duration expiry monitor failed:', err.message);
    });
  }, intervalMs);

  return timer;
};

module.exports = {
  processExpiredSessions,
  startSessionExpiryMonitor,
};
