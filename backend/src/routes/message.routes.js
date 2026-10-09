import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { messageLimiter } from '../middleware/rate-limit.middleware.js';
import * as messageController from '../controllers/message.controller.js';

const router = Router();

// TENANT or OWNER endpoints
router.post(
  '/',
  authenticate,
  requireRole('TENANT', 'OWNER'),
  messageLimiter,
  messageController.sendMessage
);

router.get(
  '/:interestId',
  authenticate,
  requireRole('TENANT', 'OWNER'),
  messageController.getMessages
);

export default router;
