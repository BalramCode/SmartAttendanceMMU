require('dotenv').config();

const { v4: uuidv4 } = require('uuid');
const { connectDB, disconnectDB } = require('../config/db');
const Session = require('../models/Session');
require('../models/User');
require('../models/Subject');
require('../models/Attendance');
const { markAttendance } = require('../controllers/attendanceController');

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    console.log(`[ExpiryTest] Controller response status=${this.statusCode}`);
    console.log(`[ExpiryTest] Controller response body=${JSON.stringify(payload)}`);
    return this;
  },
});

const main = async () => {
  console.log('[ExpiryTest] Starting lazy QR expiry trigger test');
  await connectDB();

  const session = await Session.findOne()
    .sort({ createdAt: -1 })
    .populate('teacherId', 'name email');

  if (!session) {
    throw new Error('No session found in database');
  }

  console.log(`[ExpiryTest] Selected session: ${session._id}`);
  console.log(`[ExpiryTest] Teacher email from DB: ${session.teacherId?.email || '(missing)'}`);
  console.log(
    `[ExpiryTest] Before reset: status=${session.status}, isActive=${session.isActive}, emailSent=${session.emailSent}, expiresAt=${session.expiresAt?.toISOString()}`
  );

  session.status = 'active';
  session.isActive = true;
  session.emailSent = false;
  session.expiresAt = new Date(Date.now() - 5000);
  await session.save();

  console.log(
    `[ExpiryTest] Before trigger: status=${session.status}, isActive=${session.isActive}, emailSent=${session.emailSent}, expiresAt=${session.expiresAt.toISOString()}`
  );

  const req = {
    body: {
      qrToken: session.qrToken,
      installationId: uuidv4(),
    },
    app: {
      get() {
        return null;
      },
    },
    user: {
      _id: '000000000000000000000000',
      name: 'Expiry Test Student',
      rollNo: 'EXPIRY-TEST',
    },
  };

  const res = makeResponse();
  await markAttendance(req, res, (err) => {
    if (err) {
      console.error('[ExpiryTest] Controller next(err):', err);
    }
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));

  const after = await Session.findById(session._id).lean();
  console.log(
    `[ExpiryTest] After trigger: status=${after.status}, isActive=${after.isActive}, emailSent=${after.emailSent}, expiresAt=${after.expiresAt?.toISOString()}`
  );
};

main()
  .catch((err) => {
    console.error('[ExpiryTest] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB().catch((err) => {
      console.error('[ExpiryTest] DB disconnect failed:', err.message);
    });
  });
