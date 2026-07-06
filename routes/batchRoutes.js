const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const User = require('../models/User');
const { protect, authorise, requireOnboardingComplete } = require('../middleware/auth');
const getBatchFromRoll = require('../utils/batchMapper');

// GET all batches
router.get('/', protect, requireOnboardingComplete, async (req, res) => {
  try {
    const batches = await Batch.find();
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET batch by ID
router.get('/:id', protect, requireOnboardingComplete, async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);
    res.json(batch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST - only teacher can create batch
router.post('/', protect, authorise('teacher'), requireOnboardingComplete, async (req, res) => {
  try {
    const { startYear, endYear } = req.body;
    const name = `${startYear}-${endYear}`; // "2024-2027" ✅ consistent format

    // Check duplicate
    const existing = await Batch.findOne({ name });
    if (existing) {
      return res.status(409).json({ message: `Batch "${name}" already exists.` });
    }

    const newBatch = await Batch.create({ name, startYear, endYear });

    // ✅ Auto-link any students whose roll prefix maps to this batch name
    const matchingPrefixes = Object.entries({
      "BS23": "2023-2026",
      "BS24": "2024-2027",
      "BS25": "2025-2028",
      "BS26": "2026-2029",
      "BS27": "2027-2030",
      "BS28": "2028-2031",
    })
      .filter(([, v]) => v === name)
      .map(([k]) => k); // e.g. ["BS24"]

    if (matchingPrefixes.length > 0) {
      const regexList = matchingPrefixes.map(p => new RegExp(`^${p}`));
      const result = await User.updateMany(
        {
          role: "student",
          batch: null, // only unlinked students
          rollNo: { $in: await User.find({ 
            role: "student", 
            batch: null,
            $or: regexList.map(r => ({ rollNo: r }))
          }).distinct('rollNo') }
        },
        { $set: { batch: newBatch._id } }
      );
      console.log(`Auto-linked ${result.modifiedCount} students to batch "${name}"`);
    }

    res.status(201).json({ batch: newBatch });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
