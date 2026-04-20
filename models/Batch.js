const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "2024–2027"
    startYear: { type: Number, required: true },
    endYear: { type: Number, required: true },
    studentCount: { type: Number, default: 0 },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Reference to the teacher who created it
}, { timestamps: true });

module.exports = mongoose.model('Batch', batchSchema);