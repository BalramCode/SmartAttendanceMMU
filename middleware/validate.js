const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

/**
 * Middleware factory: runs after express-validator chains.
 * If there are validation errors, short-circuits with a 422 response.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, {
      status: 422,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = validate;