const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
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

module.exports = router;
