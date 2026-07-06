const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getMe,
  googleAuth,
  validateTeacherRegistrationKey,
  buildAuthData,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const User = require('../models/User');
const Batch = require('../models/Batch');
const { signToken } = require('../utils/token');
const { sendSuccess, sendError } = require('../utils/response');
const getBatchFromRoll = require('../utils/batchMapper');
const router = express.Router();

// ── Validation chains ─────────────────────────────────────────────────────────

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['student', 'teacher']).withMessage('Role must be "student" or "teacher"'),
  body('teacherKey').optional().isString().trim().isLength({ max: 200 }).withMessage('Teacher registration key is invalid'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/complete-profile", protect, async (req, res) => {
  try {
    const rollNo = String(req.body.rollNo || '').trim().toUpperCase();

    // ❌ If rollNo missing
    if (!rollNo) {
      return sendError(res, {
        status: 400,
        message: "Roll number is required",
      });
    }

    // ✅ Logged-in user from JWT
    const user = await User.findById(req.user._id);

    if (!user) {
      return sendError(res, {
        status: 404,
        message: "User not found",
      });
    }

    // ❌ Only students allowed
    if (user.role !== "student") {
      return sendError(res, {
        status: 403,
        message: "Only students can complete profile",
      });
    }

    // ❌ Already has rollNo
    if (user.rollNo && user.rollNo.trim()) {
      return sendError(res, {
        status: 400,
        message: "Roll number already set",
      });
    }

    // ✅ Save roll number
    const existingRoll = await User.findOne({
      _id: { $ne: user._id },
      rollNo,
    });

    if (existingRoll) {
      return sendError(res, {
        status: 409,
        message: "This Roll Number is already registered.",
      });
    }

    const batchName = getBatchFromRoll(rollNo);
    if (batchName) {
      const batchDoc = await Batch.findOne({ name: batchName });
      user.batch = batchDoc?._id || null;
    }

    user.rollNo = rollNo;
    user.onboardingCompleted = true;
    await user.save();

    // ✅ Generate new token
    const token = signToken(user._id, user.role);

    return sendSuccess(res, {
      status: 200,
      message: "Profile completed successfully",
      data: buildAuthData(token, user),
    });

  } catch (error) {
    console.error("Complete Profile Error:", error);

    return sendError(res, {
      status: 500,
      message: "Failed to complete profile",
    });
  }
});

router.post("/complete-teacher-profile", protect, async (req, res) => {
  try {
    const { teacherKey } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return sendError(res, {
        status: 404,
        message: "User not found",
      });
    }

    if (user.role !== "teacher") {
      return sendError(res, {
        status: 403,
        message: "Only teachers can verify a registration key",
      });
    }

    if (user.teacherRegistrationKeyVerified && user.onboardingCompleted) {
      return sendError(res, {
        status: 400,
        message: "Teacher registration key is already verified",
      });
    }

    const keyCheck = validateTeacherRegistrationKey(teacherKey);
    if (!keyCheck.ok) {
      return sendError(res, {
        status: keyCheck.status,
        message: keyCheck.message,
      });
    }

    user.teacherRegistrationKeyVerified = true;
    user.onboardingCompleted = true;
    await user.save();

    const token = signToken(user._id, user.role);

    return sendSuccess(res, {
      status: 200,
      message: "Teacher registration key verified successfully",
      data: buildAuthData(token, user),
    });
  } catch (error) {
    console.error("Complete Teacher Profile Error:", error);

    return sendError(res, {
      status: 500,
      message: "Failed to verify teacher registration key",
    });
  }
});


router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);
router.post("/google", googleAuth);

module.exports = router;
