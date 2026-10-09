import rateLimit from 'express-rate-limit';

/**
 * Common configuration helper for rate limiters.
 * Rate limiting is skipped in the test environment (NODE_ENV === 'test')
 * to ensure test suites can execute without interference.
 */
function createLimiter({ windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    message: { error: message },
    statusCode: 429,
  });
}

// Global API rate limiter: 600 requests per 15 minutes per IP
export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '600', 10),
  message: 'Too many requests from this IP, please try again later',
});

// Sensitive Auth limiter: 60 requests per 15 minutes per IP (login, register)
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '60', 10),
  message: 'Too many authentication attempts, please try again later',
});

// Resource-intensive AI & compatibility limiter: 100 requests per 15 minutes per IP
export const compatibilityLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_COMPATIBILITY_MAX || '100', 10),
  message: 'Too many compatibility calculations requested, please try again later',
});

// Chat message dispatch limiter: 120 messages per 1 minute per IP
export const messageLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MESSAGES_MAX || '120', 10),
  message: 'Too many messages sent in a short period, please slow down',
});
