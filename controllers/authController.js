const User = require('../models/User');
const { signToken } = require('../utils/token');
const { sendSuccess, sendError } = require('../utils/response');
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, rollNo } = req.body;

    // 1. Check for existing email
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return sendError(res, { status: 409, message: 'Email is already registered.' });
    }

    // 2. Validate Student Roll Number
    if (role === 'student') {
      if (!rollNo) {
        return sendError(res, { status: 422, message: 'Roll Number is required for students.' });
      }

      // Check for duplicate Roll Number
      const existingRoll = await User.findOne({ rollNo });
      if (existingRoll) {
        return sendError(res, { status: 409, message: 'This Roll Number is already registered.' });
      }
    }

    // 3. Create User (including rollNo)
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      rollNo: role === 'student' ? rollNo : undefined
    });

    const token = signToken(user._id, user.role);

    return sendSuccess(res, {
      status: 201,
      message: 'Registration successful.',
      data: { token, user },
    });
  } catch (err) {
    // Catch Mongoose unique constraint errors (e.g., duplicate rollNo)
    if (err.code === 11000) {
      return sendError(res, { status: 409, message: 'Duplicate field value entered (Email or Roll Number).' });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return sendError(res, { status: 401, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, { status: 401, message: 'Invalid email or password.' });
    }

    const token = signToken(user._id, user.role);
    const safeUser = user.toJSON();

    return sendSuccess(res, {
      status: 200,
      message: 'Login successful.',
      data: { token, user: safeUser },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/auth/me (protected)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  return sendSuccess(res, {
    message: 'Authenticated user.',
    data: { user: req.user },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/google
// ─────────────────────────────────────────────────────────────────────────────
const googleAuth = async (req, res, next) => {
  try {
    const { token, role } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      if (!role) {
        return sendError(res, {
          status: 400,
          message: "Role is required",
        });
      }

      // 🔥 If student → DON'T create yet
      if (role === "student") {
        return sendSuccess(res, {
          status: 200,
          message: "Additional details required",
          data: {
            tempUser: { name, email, role },
            needsProfileCompletion: true,
          },
        });
      }

      // ✅ Teacher → create directly
      user = await User.create({
        name,
        email,
        password: Math.random().toString(36).slice(-10),
        role: "teacher",
      });
    }


    const jwtToken = signToken(user._id, user.role);

    return sendSuccess(res, {
      status: 200,
      message: "Google login successful",
      data: { token: jwtToken, user },
    });

  } catch (error) {
    console.log("Google Auth Error:", error);
    return sendError(res, {
      status: 401,
      message: "Google authentication failed",
    });
  }
};

module.exports = { register, login, getMe, googleAuth };