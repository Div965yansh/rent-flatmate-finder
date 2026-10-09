import { AppError } from '../utils/errors.js';

/**
 * Central error handling middleware.
 * Ensures consistent JSON responses: { "error": "message" }
 */
export function errorHandler(err, req, res, next) {
  // If it's a known operational AppError
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    });
  }

  // Handle Prisma unique constraint violation (P2002) if uncaught
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'A resource with this identifier already exists',
    });
  }

  // Handle JSON parse errors from body-parser
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON payload provided',
    });
  }

  // Handle request payload size exceeded (413 Payload Too Large)
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request payload too large',
    });
  }

  // Handle Multer upload errors (e.g. file size exceeded, too many files)
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: err.message || 'File upload error',
    });
  }

  // Handle Zod error if thrown directly
  if (err.name === 'ZodError') {
    const message = err.issues.map((i) => i.message).join(', ');
    return res.status(400).json({
      error: message,
    });
  }

  // Default to 500 internal server error without exposing sensitive internals
  return res.status(500).json({
    error: 'Internal server error',
  });
}
