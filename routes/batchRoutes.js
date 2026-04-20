const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');

// GET all batches
router.get('/', async (req, res) => {
  try {
    const batches = await Batch.find();
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new batch
router.post('/', async (req, res) => {
  const { startYear, endYear } = req.body;
  const newBatch = new Batch({
    name: `${startYear}–${endYear}`,
    startYear,
    endYear
  });

  try {
    const savedBatch = await newBatch.save();
    res.status(201).json(savedBatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



module.exports = router;