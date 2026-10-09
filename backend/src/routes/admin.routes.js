import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

// Enforce authentication and ADMIN role check across all admin routes
router.use(authenticate, requireRole('ADMIN'));

// 1. Platform Statistics
router.get('/stats', adminController.getStats);

// 2. User Management
router.get('/users', adminController.getUsers);
router.patch('/users/:userId/status', adminController.updateUserStatus);

// 3. Listing Management & Moderation
router.get('/listings', adminController.getListings);
router.patch('/listings/:listingId/status', adminController.updateListingStatus);

// 4. Interest Inquiries Monitoring
router.get('/interests', adminController.getInterests);

export default router;
