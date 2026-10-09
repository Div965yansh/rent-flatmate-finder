import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

/**
 * Reusable middleware to enforce role-based access control.
 * @param  {...string} roles Allowed roles, e.g. 'OWNER', 'TENANT', 'ADMIN'
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...roles) {
  const allowedRoles = roles.map((r) => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userRole = (req.user.role || '').toUpperCase();

    if (!allowedRoles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Access forbidden: requires one of the following roles: [${allowedRoles.join(', ')}]`
        )
      );
    }

    next();
  };
}
