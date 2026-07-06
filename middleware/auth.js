const User = require('../models/User');
const { verifyToken } = require('../utils/token');
const { sendError } = require('../utils/response');

/**
 * protect
 * Verifies JWT in the Authorization header and attaches `req.user`.
 * Usage: router.get('/route', protect, handler)
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, { status: 401, message: 'No token provided. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token); // throws if invalid / expired

    // Fetch fresh user data (ensures token is still valid after role changes, etc.)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return sendError(res, { status: 401, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, { status: 401, message: 'Session expired. Please log in again.' });
    }
    return sendError(res, { status: 401, message: 'Invalid token.' });
  }
};

/**
 * authorise(...roles)
 * Must be used AFTER protect.
 * Usage: router.post('/route', protect, authorise('teacher'), handler)
 */
const authorise = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return sendError(res, {
      status: 403,
      message: `Access denied. Required role: ${roles.join(' or ')}.`,
    });
  }
  next();
};

const hasRollNumber = (user) =>
  typeof user.rollNo === 'string' && user.rollNo.trim().length > 0;

const isStudentOnboardingComplete = (user) =>
  user.role === 'student' && hasRollNumber(user) && user.onboardingCompleted !== false;

const isTeacherOnboardingComplete = (user) =>
  user.role === 'teacher' &&
  user.teacherRegistrationKeyVerified !== false &&
  user.onboardingCompleted !== false;

const getOnboardingStatus = (user) => ({
  studentOnboardingComplete:
    user.role === 'student' ? isStudentOnboardingComplete(user) : undefined,
  teacherOnboardingComplete:
    user.role === 'teacher' ? isTeacherOnboardingComplete(user) : undefined,
  needsProfileCompletion:
    user.role === 'student' ? !isStudentOnboardingComplete(user) : false,
  needsTeacherRegistrationKey:
    user.role === 'teacher' ? !isTeacherOnboardingComplete(user) : false,
});

const requireOnboardingComplete = (req, res, next) => {
  if (req.user.role === 'student' && !isStudentOnboardingComplete(req.user)) {
    return sendError(res, {
      status: 403,
      message: 'Complete your roll number onboarding before continuing.',
      errors: {
        code: 'ONBOARDING_REQUIRED',
        onboardingRoute: '/complete-profile',
      },
    });
  }

  if (req.user.role === 'teacher' && !isTeacherOnboardingComplete(req.user)) {
    return sendError(res, {
      status: 403,
      message: 'Verify your teacher registration key before continuing.',
      errors: {
        code: 'ONBOARDING_REQUIRED',
        onboardingRoute: '/complete-teacher-profile',
      },
    });
  }

  next();
};

module.exports = {
  protect,
  authorise,
  requireOnboardingComplete,
  getOnboardingStatus,
  isStudentOnboardingComplete,
  isTeacherOnboardingComplete,
};
