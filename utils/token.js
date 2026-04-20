const jwt = require('jsonwebtoken');

const SECRET = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not defined');
  return process.env.JWT_SECRET;
};

/**
 * Sign a JWT for an authenticated user.
 * Payload is intentionally minimal – only id and role.
 */
const signToken = (userId, role) =>
  jwt.sign({ id: userId, role }, SECRET(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Verify and decode a JWT.
 * Returns the decoded payload or throws if invalid / expired.
 */
const verifyToken = (token) => jwt.verify(token, SECRET());

module.exports = { signToken, verifyToken };