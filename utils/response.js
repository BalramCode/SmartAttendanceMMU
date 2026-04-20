/**
 * Standardised API response helpers.
 * Every route uses these so the client always sees the same shape:
 *
 *   { success, message, data?, meta? }
 */

const sendSuccess = (res, { status = 200, message = 'OK', data = null, meta = null } = {}) => {
  const body = { success: true, message };
  if (data !== null) body.data = data;
  if (meta !== null) body.meta = meta;
  return res.status(status).json(body);
};

const sendError = (res, { status = 500, message = 'Internal Server Error', errors = null } = {}) => {
  const body = { success: false, message };
  if (errors !== null) body.errors = errors;
  return res.status(status).json(body);
};

module.exports = { sendSuccess, sendError };