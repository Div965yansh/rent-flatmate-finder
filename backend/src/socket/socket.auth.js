import { verifyToken } from '../utils/jwt.js';
import prisma from '../config/prisma.js';

/**
 * Socket.io Authentication Middleware
 * Validates JWT from socket handshake, verifies user active status,
 * and attaches authenticated user information to socket.user.
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    let token = socket.handshake.auth?.token;

    // Fallback to handshake authorization header if token not in auth payload
    if (!token && socket.handshake.headers?.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      } else {
        token = authHeader;
      }
    }

    if (!token || typeof token !== 'string') {
      const err = new Error('Authentication required');
      err.data = { code: 'UNAUTHORIZED', message: 'Authentication required' };
      return next(err);
    }

    // Clean any Bearer prefix if provided directly in auth.token
    if (token.startsWith('Bearer ')) {
      token = token.slice(7).trim();
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch {
      const err = new Error('Invalid or expired token');
      err.data = { code: 'UNAUTHORIZED', message: 'Invalid or expired token' };
      return next(err);
    }

    if (!decoded || !decoded.id) {
      const err = new Error('Invalid token payload');
      err.data = { code: 'UNAUTHORIZED', message: 'Invalid token payload' };
      return next(err);
    }

    // Load user from PostgreSQL
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      const err = new Error('User not found');
      err.data = { code: 'UNAUTHORIZED', message: 'User not found' };
      return next(err);
    }

    if (!user.isActive) {
      const err = new Error('User account is inactive');
      err.data = { code: 'UNAUTHORIZED', message: 'User account is inactive' };
      return next(err);
    }

    // Attach authenticated user information (never include passwordHash)
    socket.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (error) {
    const err = new Error('Authentication error');
    err.data = { code: 'UNAUTHORIZED', message: 'Authentication error' };
    next(err);
  }
}
