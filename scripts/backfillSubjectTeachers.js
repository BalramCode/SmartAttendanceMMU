require('dotenv').config();

const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const Subject = require('../models/Subject');
const Session = require('../models/Session');
const Batch = require('../models/Batch');

const missingTeacherQuery = {
  $or: [{ teacher: { $exists: false } }, { teacher: null }],
};

const getTeacherForSubject = async (subject) => {
  const latestSession = await Session.findOne({
    subject: subject._id,
    teacherId: { $exists: true, $ne: null },
  })
    .sort({ createdAt: -1 })
    .select('teacherId')
    .lean();

  if (latestSession?.teacherId) {
    return latestSession.teacherId;
  }

  const batch = await Batch.findById(subject.batch).select('teacher').lean();
  if (batch?.teacher) {
    return batch.teacher;
  }

  if (process.env.DEFAULT_TEACHER_ID && mongoose.Types.ObjectId.isValid(process.env.DEFAULT_TEACHER_ID)) {
    return new mongoose.Types.ObjectId(process.env.DEFAULT_TEACHER_ID);
  }

  return null;
};

const run = async () => {
  await connectDB();

  const subjects = await Subject.find(missingTeacherQuery).select('_id name batch').lean();
  let updated = 0;
  let skipped = 0;

  for (const subject of subjects) {
    const teacher = await getTeacherForSubject(subject);

    if (!teacher) {
      skipped += 1;
      console.warn(`[skip] ${subject.name} (${subject._id}) has no session, batch teacher, or DEFAULT_TEACHER_ID.`);
      continue;
    }

    await Subject.updateOne({ _id: subject._id }, { $set: { teacher } });
    updated += 1;
    console.log(`[ok] ${subject.name} (${subject._id}) -> teacher ${teacher}`);
  }

  console.log(`Backfill complete. Updated: ${updated}. Skipped: ${skipped}.`);
  await disconnectDB();
};

run().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
