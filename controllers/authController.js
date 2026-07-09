const User = require('../models/User');
const { signToken } = require('../utils/token');
const { sendSuccess, sendError } = require('../utils/response');
const { OAuth2Client } = require("google-auth-library");
const crypto = require('crypto');
const { getOnboardingStatus } = require('../middleware/auth');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const validateTeacherRegistrationKey = (teacherKey = '') => {
  const expectedKey = process.env.TEACHER_REGISTRATION_KEY;

  if (!expectedKey) {
    return { ok: false, status: 500, message: 'Teacher registration is not configured.' };
  }

  const provided = Buffer.from(String(teacherKey));
  const expected = Buffer.from(expectedKey);

  if (provided.length !== expected.length) {
    return { ok: false, status: 403, message: 'Invalid teacher registration key.' };
  }

  if (!crypto.timingSafeEqual(provided, expected)) {
    return { ok: false, status: 403, message: 'Invalid teacher registration key.' };
  }

  return { ok: true };
};

const buildAuthData = (token, user) => ({
  token,
  user,
  ...getOnboardingStatus(user),
});

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
const getBatchFromRoll = require("../utils/batchMapper");
const Batch = require("../models/Batch");

const register = async (req, res, next) => {
  try {
    const { name, email, password, role, rollNo, teacherKey } = req.body;

    let batch = null;

    if (role === "teacher") {
      const keyCheck = validateTeacherRegistrationKey(teacherKey);
      if (!keyCheck.ok) {
        return sendError(res, {
          status: keyCheck.status,
          message: keyCheck.message,
        });
      }
    }

    if (role === "student") {
      if (!rollNo) {
        return sendError(res, {
          status: 422,
          message: "Roll Number is required for students."
        });
      }

      const existingRoll = await User.findOne({ rollNo });
      if (existingRoll) {
        return sendError(res, {
          status: 409,
          message: "This Roll Number is already registered."
        });
      }

      // ✅ Single declaration
      const batchName = getBatchFromRoll(rollNo); // "2024-2027"

      if (batchName) {
        const batchDoc = await Batch.findOne({ name: batchName });
        if (batchDoc) {
          batch = batchDoc._id; // ✅ link if teacher already created it
        }
        // batch stays null if not created yet — no error, no auto-create
      }

      // ✅ Find or create batch
      // let batchDoc = await Batch.findOne({ name: batchName });
      // if (!batchDoc) {
      //   batchDoc = await Batch.create({
      //     name: batchName,
      //     startYear: 2024,
      //     endYear: 2027
      //   });
      // }
      // batch = batchDoc._id;
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return sendError(res, {
        status: 409,
        message: "Email is already registered."
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role,
      batch,
      rollNo: role === "student" ? rollNo : undefined,
      onboardingCompleted: true,
      teacherRegistrationKeyVerified: role === "teacher" ? true : undefined,
    });

    const token = signToken(user._id, user.role);

    return sendSuccess(res, {
      status: 201,
      message: "Registration successful.",
      data: buildAuthData(token, user),
    });

  } catch (err) {
    if (err.code === 11000) {
      return sendError(res, {
        status: 409,
        message: "Duplicate field value entered."
      });
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
      data: buildAuthData(token, safeUser),
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/auth/me (protected)
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate('batch');
  return sendSuccess(res, {
    message: 'Authenticated user.',
    data: { user, ...getOnboardingStatus(user) },
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
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      if (role && user.role !== role) {
        return sendError(res, {
          status: 409,
          message: `This Google account is already registered as a ${user.role}.`,
        });
      }

      const jwtToken = signToken(user._id, user.role);
      const status = getOnboardingStatus(user);

      return sendSuccess(res, {
        message:
          status.needsProfileCompletion || status.needsTeacherRegistrationKey
            ? "Complete your onboarding"
            : "Google login successful",
        data: buildAuthData(jwtToken, user),
      });
    }

    // ✅ If user exists
    if (user) {
      // 🔥 Student without rollNo → complete profile
      if (user.role === "student" && !user.rollNo) {
        const jwtToken = signToken(user._id, user.role);

        return sendSuccess(res, {
          message: "Complete your profile",
          data: {
            token: jwtToken,
            user,
            needsProfileCompletion: true,
          },
        });
      }

      const jwtToken = signToken(user._id, user.role);
      return sendSuccess(res, {
        message: "Google login successful",
        data: { token: jwtToken, user },
      });
    }

    // ❌ No user → must send role
    if (!role) {
      return sendError(res, {
        status: 400,
        message: "Role is required",
      });
    }

    if (!["student", "teacher"].includes(role)) {
      return sendError(res, {
        status: 400,
        message: 'Role must be "student" or "teacher"',
      });
    }

    // 🔥 STUDENT → DO NOT CREATE
    if (role === "student") {
      user = await User.create({
        name,
        email: normalizedEmail,
        password: Math.random().toString(36).slice(-10),
        role: "student",
        onboardingCompleted: false,
      });

      const jwtToken = signToken(user._id, user.role);

      return sendSuccess(res, {
        message: "Complete your profile",
        data: buildAuthData(jwtToken, user),
      });
    }


    // ✅ TEACHER → create directly
    user = await User.create({
      name,
      email: normalizedEmail,
      password: Math.random().toString(36).slice(-10),
      role: "teacher",
      onboardingCompleted: false,
      teacherRegistrationKeyVerified: false,
    });

    const jwtToken = signToken(user._id, user.role);

    return sendSuccess(res, {
      message: "Verify your teacher registration key",
      data: buildAuthData(jwtToken, user),
    });

  } catch (error) {
    console.log("Google Auth Error:", error);
    return sendError(res, {
      status: 401,
      message: "Google authentication failed",
    });
  }
};



module.exports = {
  register,
  login,
  getMe,
  googleAuth,
  validateTeacherRegistrationKey,
  buildAuthData,
};
