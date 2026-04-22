const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, googleAuth } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const User = require('../models/User');
const { signToken } = require('../utils/token');
const { sendSuccess, sendError } = require('../utils/response');

const router = express.Router();

// ── Validation chains ─────────────────────────────────────────────────────────

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 4 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['student', 'teacher']).withMessage('Role must be "student" or "teacher"'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

// ── Routes ────────────────────────────────────────────────────────────────────
router.post("/complete-profile", protect, async (req, res) => {
  try {
    const { rollNo } = req.body;

    if (!rollNo) {
      return sendError(res, { message: "Roll number is required" });
    }

    const user = req.user; // 🔥 secure (from JWT)

    // Only students allowed
    if (user.role !== "student") {
      return sendError(res, {
        status: 403,
        message: "Only students can complete profile",
      });
    }

    // Prevent overwrite if already set
    if (user.rollNo) {
      return sendError(res, {
        status: 400,
        message: "Roll number already set",
      });
    }

    user.rollNo = rollNo;
    await user.save();

    const token = signToken(user._id, user.role);

    return sendSuccess(res, {
      message: "Profile completed successfully",
      data: { token, user },
    });

  } catch (error) {
    return sendError(res, {
      status: 500,
      message: "Failed to complete profile",
    });
  }
});


router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);
router.post("/google", googleAuth);

module.exports = router;