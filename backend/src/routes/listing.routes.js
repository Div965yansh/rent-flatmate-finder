import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';
import * as listingController from '../controllers/listing.controller.js';
import { ValidationError } from '../utils/errors.js';

const router = Router();

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

// Store files in memory buffer for streaming to Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.test(ext)) {
      return cb(new ValidationError('Only image files (JPEG, PNG, WebP) are allowed'), false);
    }
    cb(null, true);
  },
});

// Public: Browse available listings
router.get('/', listingController.getPublicListings);

// Owner: Get own listings
router.get('/my-listings', authenticate, requireRole('OWNER'), listingController.getMyListings);

// Owner: Create new listing
router.post('/', authenticate, requireRole('OWNER'), upload.array('photos', 10), listingController.create);

// Get single listing details
router.get('/:id', listingController.getOne);

// Owner: Edit existing listing
router.put('/:id', authenticate, requireRole('OWNER'), upload.array('photos', 10), listingController.update);

// Owner: Mark as Filled or update status
router.patch('/:id/status', authenticate, requireRole('OWNER'), listingController.changeStatus);

// Owner: Delete listing
router.delete('/:id', authenticate, requireRole('OWNER'), listingController.remove);

export default router;
