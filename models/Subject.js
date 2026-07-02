const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., "DBMS"
    fullName: { type: String, required: true }, // e.g., "Database Management Systems"
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    semester: { type: String, required: true }, // e.g., "sem1"
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    color: { type: String, default: "from-slate-700 to-slate-900" }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
