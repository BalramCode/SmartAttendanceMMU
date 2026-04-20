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

module.exports = { protect, authorise };