import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import * as interestController from '../controllers/interest.controller.js';

const router = Router();

// TENANT endpoints
router.post('/', authenticate, requireRole('TENANT'), interestController.createInterest);
router.get('/mine', authenticate, requireRole('TENANT'), interestController.getTenantInterests);

// OWNER endpoints
router.get('/inbox', authenticate, requireRole('OWNER'), interestController.getOwnerInbox);
router.patch('/:interestId/accept', authenticate, requireRole('OWNER'), interestController.acceptInterest);
router.patch('/:interestId/decline', authenticate, requireRole('OWNER'), interestController.declineInterest);

export default router;
