const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher reference is required'],
      index: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      trim: true,
      ref: 'Subject',
      maxlength: [100, 'Subject cannot exceed 100 characters'],
      default: null,
    },
    batch: {
  type: String,
  required: true
},
    qrToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active'
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailStatus: {
      type: String,
      enum: ['pending', 'delivered', 'failed'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      // index: { expireAfterSeconds: 0 }, // TTL index – MongoDB auto-deletes expired docs
    },
    location: {
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      }
    },

  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

// ── Virtual: check if session is currently valid ─────────────────────────────
sessionSchema.virtual('isValid').get(function () {
  return this.isActive && new Date() < this.expiresAt;
});

module.exports = mongoose.model('Session', sessionSchema);
