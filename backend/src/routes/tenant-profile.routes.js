import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import * as tenantProfileController from '../controllers/tenant-profile.controller.js';

const router = Router();

// Endpoints strictly protected for TENANT role
router.get('/', authenticate, requireRole('TENANT'), tenantProfileController.getProfile);
router.put('/', authenticate, requireRole('TENANT'), tenantProfileController.updateProfile);

export default router;
