import jwt from 'jsonwebtoken';

/**
 * Generate a signed JWT token containing user id and role.
 * @param {{ id: string, role: string }} payload
 * @returns {string}
 */
export function generateToken(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: payload.id,
      role: payload.role,
    },
    secret,
    { expiresIn, algorithm: 'HS256' }
  );
}

/**
 * Verify and decode a JWT token.
 * @param {string} token
 * @returns {object}
 */
export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}
