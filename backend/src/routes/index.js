import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import listingRoutes from './listing.routes.js';
import tenantProfileRoutes from './tenant-profile.routes.js';
import compatibilityRoutes from './compatibility.routes.js';
import interestRoutes from './interest.routes.js';
import messageRoutes from './message.routes.js';
import adminRoutes from './admin.routes.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import { authLimiter, compatibilityLimiter } from '../middleware/rate-limit.middleware.js';

const router = Router();

router.use('/', healthRoutes);
router.use('/auth', authLimiter, authRoutes);
router.use('/listings', listingRoutes);
router.use('/tenant-profile', tenantProfileRoutes);
router.use('/compatibility', compatibilityLimiter, compatibilityRoutes);
router.use('/interests', interestRoutes);
router.use('/messages', messageRoutes);
router.use('/admin', adminRoutes);

// Role verification endpoints for RBAC middleware testing
router.get('/test-role/owner', authenticate, requireRole('OWNER'), (req, res) => {
  res.json({ message: 'Welcome owner' });
});

router.get('/test-role/admin', authenticate, requireRole('ADMIN'), (req, res) => {
  res.json({ message: 'Welcome admin' });
});

export default router;
