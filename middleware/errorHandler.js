const { sendError } = require('../utils/response');

/**
 * Global error-handling middleware.
 * Must be registered LAST in server.js (4 parameters = Express error handler).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return sendError(res, {
      status: 409,
      message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`,
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return sendError(res, { status: 422, message: 'Validation error', errors });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    return sendError(res, { status: 400, message: `Invalid ${err.path}: ${err.value}` });
  }

  // Default
  const status = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : 'Something went wrong. Please try again.';
  return sendError(res, { status, message });
};

module.exports = errorHandler;