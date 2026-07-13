const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Subject = require('../models/Subject');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const { protect, authorise, requireOnboardingComplete } = require('../middleware/auth');

router.use(protect, authorise('teacher'), requireOnboardingComplete);

// GET subjects for a specific batch and semester.
router.get('/:batchId/:semId', async (req, res) => {
  try {
    const { batchId, semId } = req.params;

    const subjects = await Subject.find({ batch: batchId, semester: semId })
      .populate('batch', 'name')
      .populate('teacher', 'name email')
      .sort({ createdAt: -1 });

    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching subjects' });
  }
});

// POST a new subject.
router.post('/', async (req, res) => {
  try {
    const { name, fullName, batch, semester } = req.body;

    const savedSubject = await Subject.create({
      name,
      fullName,
      batch,
      semester,
      teacher: req.user._id,
    });

    const populatedSubject = await savedSubject.populate([
      { path: 'batch', select: 'name' },
      { path: 'teacher', select: 'name email' },
    ]);

    res.status(201).json(populatedSubject);
  } catch (err) {
    res.status(400).json({ message: 'Error creating subject' });
  }
});

// DELETE a subject and cascade delete related sessions and attendance.
router.delete('/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const subjectId = req.params.id;

    // Find the subject
    const subject = await Subject.findById(subjectId).session(session);
    if (!subject) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Subject not found' });
    }

    // 1. Find all Sessions that reference this Subject ID
    const sessions = await Session.find({ subject: subject._id }).session(session);
    const sessionIds = sessions.map(s => s._id);

    // 2. Delete all Attendance records referencing those Session IDs
    if (sessionIds.length > 0) {
      await Attendance.deleteMany({ sessionId: { $in: sessionIds } }).session(session);
    }

    // 3. Delete those Sessions
    if (sessionIds.length > 0) {
      await Session.deleteMany({ subject: subject._id }).session(session);
    }

    // 4. Delete the Subject
    await Subject.findByIdAndDelete(subject._id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({ message: 'Subject and related records deleted successfully' });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("deleteSubject error:", err);
    res.status(500).json({ message: 'Error deleting subject and related records' });
  }
});

module.exports = router;
