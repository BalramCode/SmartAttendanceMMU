const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe ,googleAuth } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

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
router.post("/complete-profile", async (req, res) => {
  const { name, email, role, rollNo } = req.body;

  if (!rollNo) {
    return sendError(res, { message: "Roll number is required" });
  }

  const user = await User.create({
    name,
    email,
    password: Math.random().toString(36).slice(-10),
    role: "student",
    rollNo,
  });

  const token = signToken(user._id, user.role);

  return sendSuccess(res, {
    message: "Profile completed",
    data: { token, user },
  });
});

router.post('/register', registerValidation, validate, register);
router.post('/login',    loginValidation,    validate, login);
router.get('/me',        protect,            getMe);
router.post("/google", googleAuth);

module.exports = router;