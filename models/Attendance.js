const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session reference is required'],
      index: true,
    },
    installationId: {
      type: String,
      required: [true, 'Installation ID is required'],
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'present',
    },
    isMockLocation: {
      type: Boolean,
      default: false
    },
    isRooted: {
      type: Boolean,
      default: false
    },
    rootBeerError: {
      type: Boolean,
      default: false
    },
    developerOptionsEnabled: {
      type: Boolean,
      default: false
    },
    gpsAccuracy: {
      type: Number,
      default: null
    },
    locationTimestamp: {
      type: Date,
      default: null
    },
    location: {
      lat: { type: Number },
      lng: { type: Number }
    },
    velocityRisk: {
      type: Boolean,
      default: false
    },
    markedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

// ── Compound unique index: one attendance record per student per session ──────
attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ sessionId: 1, installationId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
