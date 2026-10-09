import { verifyToken } from '../utils/jwt.js';
import prisma from '../config/prisma.js';
import { UnauthorizedError } from '../utils/errors.js';

/**
 * Express middleware to authenticate requests using JWT Bearer token.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authorization token required');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Authorization token required');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    if (!decoded || !decoded.id) {
      throw new UnauthorizedError('Invalid token payload');
    }

    // Load user from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is inactive');
    }

    // Attach safe user to req.user (never include passwordHash)
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (error) {
    next(error);
  }
}
