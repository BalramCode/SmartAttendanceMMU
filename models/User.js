const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12; // OWASP recommended minimum

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
  type: String,
  required: [true, 'Email is required'],
  unique: true,
  lowercase: true, // This is key
  trim: true,
  match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
},
    password: {
      type: String,
      required: false,
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never returned in queries unless explicitly asked
    },
    rollNo: {
      type: String,
      required: function () { return this.role === 'student'; },
      unique: true,
      sparse: true // This allows teachers to have 'null' without crashing the unique check
    }, role: {
      type: String,
      enum: {
        values: ['student', 'teacher'],
        message: 'Role must be either "student" or "teacher"',
      },
      required: [true, 'Role is required'],
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt
    toJSON: {
      transform(_, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// ── Pre-save hook: hash password before storing ──────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.password) return next(); // 🔥 add this
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  next();
});


// ── Instance method: compare plain-text password with hash ───────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);