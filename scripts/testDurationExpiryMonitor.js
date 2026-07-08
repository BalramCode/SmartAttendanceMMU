require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const Session = require('../models/Session');
require('../models/User');
require('../models/Subject');
require('../models/Batch');
require('../models/Attendance');
const { processExpiredSessions } = require('../services/sessionExpiryService');

const main = async () => {
  console.log('[MonitorTest] Starting duration expiry monitor test');
  await connectDB();

  const session = await Session.findOne()
    .sort({ createdAt: -1 })
    .populate('teacherId', 'name email');

  if (!session) {
    throw new Error('No session found in database');
  }

  console.log(`[MonitorTest] Selected session: ${session._id}`);
  console.log(`[MonitorTest] Teacher email from DB: ${session.teacherId?.email || '(missing)'}`);
  console.log(
    `[MonitorTest] Before reset: status=${session.status}, isActive=${session.isActive}, emailSent=${session.emailSent}, expiresAt=${session.expiresAt?.toISOString()}`
  );

  session.status = 'active';
  session.isActive = true;
  session.emailSent = false;
  session.expiresAt = new Date(Date.now() - 5000);
  await session.save();

  console.log(
    `[MonitorTest] Before monitor run: status=${session.status}, isActive=${session.isActive}, emailSent=${session.emailSent}, expiresAt=${session.expiresAt.toISOString()}`
  );

  const count = await processExpiredSessions();
  console.log(`[MonitorTest] processExpiredSessions returned count=${count}`);

  const after = await Session.findById(session._id).lean();
  console.log(
    `[MonitorTest] After monitor run: status=${after.status}, isActive=${after.isActive}, emailSent=${after.emailSent}, expiresAt=${after.expiresAt?.toISOString()}`
  );
};

main()
  .catch((err) => {
    console.error('[MonitorTest] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB().catch((err) => {
      console.error('[MonitorTest] DB disconnect failed:', err.message);
    });
  });
