import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import * as compatibilityController from '../controllers/compatibility.controller.js';

const router = Router();

// Strictly protected for authenticated TENANT role
router.get('/', authenticate, requireRole('TENANT'), compatibilityController.getBatchCompatibility);
router.get('/:listingId', authenticate, requireRole('TENANT'), compatibilityController.getCompatibility);

export default router;
