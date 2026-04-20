const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');

// GET subjects for a specific batch and semester
router.get('/:batchId/:semId', async (req, res) => {
  try {
    const { batchId, semId } = req.params;
    const subjects = await Subject.find({ batch: batchId, semester: semId });
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ message: "Error fetching subjects" });
  }
});

// POST a new subject
router.post('/', async (req, res) => {
  try {
    const { name, fullName, batch, semester } = req.body;
    const newSubject = new Subject({ name, fullName, batch, semester });
    const savedSubject = await newSubject.save();
    res.status(201).json(savedSubject);
  } catch (err) {
    res.status(400).json({ message: "Error creating subject" });
  }
});

module.exports = router;