import { z } from 'zod';
import prisma from '../config/prisma.js';
import { uploadImages } from './cloudinary.service.js';
import { ValidationError, ForbiddenError, AppError } from '../utils/errors.js';

// Schema for listing creation and update
export const listingSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(3, 'Title must be at least 3 characters'),
  description: z.string({ required_error: 'Description is required' }).trim().min(5, 'Description must be at least 5 characters'),
  location: z.string({ required_error: 'Location is required' }).trim().min(2, 'Location is required'),
  rent: z.coerce.number({ required_error: 'Rent amount is required' }).positive('Rent must be greater than 0'),
  availableFrom: z.coerce.date({ required_error: 'Available from date is required' }),
  roomType: z
    .string({ required_error: 'Room type is required' })
    .trim()
    .transform((val) => val.toUpperCase())
    .refine((val) => ['SINGLE', 'SHARED', 'ENTIRE_FLAT'].includes(val), {
      message: 'Room type must be SINGLE, SHARED, or ENTIRE_FLAT',
    }),
  furnishing: z
    .string({ required_error: 'Furnishing type is required' })
    .trim()
    .transform((val) => val.toUpperCase())
    .refine((val) => ['FULLY_FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'].includes(val), {
      message: 'Furnishing must be FULLY_FURNISHED, SEMI_FURNISHED, or UNFURNISHED',
    }),
});

const emptyToUndefined = (val) => {
  if (val === '' || val === undefined || val === null) return undefined;
  return val;
};

// Zod Schema for Listing Search Query Parameters
export const listingSearchQuerySchema = z
  .object({
    location: z.preprocess(emptyToUndefined, z.string().trim().max(150, 'Location parameter too long').optional()),
    minRent: z.preprocess(
      emptyToUndefined,
      z
        .coerce.number({ invalid_type_error: 'minRent must be a valid number' })
        .min(0, 'minRent must be greater than or equal to 0')
        .optional()
    ),
    maxRent: z.preprocess(
      emptyToUndefined,
      z
        .coerce.number({ invalid_type_error: 'maxRent must be a valid number' })
        .min(0, 'maxRent must be greater than or equal to 0')
        .optional()
    ),
    roomType: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .transform((val) => val.toUpperCase())
        .refine((val) => ['SINGLE', 'SHARED', 'ENTIRE_FLAT'].includes(val), {
          message: 'Invalid roomType. Must be SINGLE, SHARED, or ENTIRE_FLAT',
        })
        .optional()
    ),
    furnishing: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .transform((val) => val.toUpperCase())
        .refine((val) => ['FULLY_FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'].includes(val), {
          message: 'Invalid furnishing. Must be FULLY_FURNISHED, SEMI_FURNISHED, or UNFURNISHED',
        })
        .optional()
    ),
    availableFrom: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'availableFrom must be a valid date' })
        .transform((val) => new Date(val))
        .optional()
    ),
  })
  .refine(
    (data) => {
      if (
        data.minRent !== undefined &&
        data.maxRent !== undefined &&
        !isNaN(data.minRent) &&
        !isNaN(data.maxRent)
      ) {
        return Number(data.minRent) <= Number(data.maxRent);
      }
      return true;
    },
    {
      message: 'minRent cannot be greater than maxRent',
      path: ['minRent'],
    }
  );

/**
 * Create a new property listing
 */
export async function createListing(ownerId, inputData, files = []) {
  const parseResult = listingSchema.safeParse(inputData);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { title, description, location, rent, availableFrom, roomType, furnishing } = parseResult.data;

  // Upload photos via Cloudinary service (or local fallback)
  let photoUrls = [];
  if (files && files.length > 0) {
    photoUrls = await uploadImages(files);
  } else if (inputData.photos && Array.isArray(inputData.photos)) {
    photoUrls = inputData.photos;
  }

  const listing = await prisma.listing.create({
    data: {
      ownerId,
      title,
      description,
      location,
      rent,
      availableFrom,
      roomType,
      furnishing,
      status: 'AVAILABLE',
      photos: photoUrls,
    },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return listing;
}

/**
 * Get all listings owned by a specific owner
 */
export async function getOwnerListings(ownerId) {
  return prisma.listing.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get public available listings with advanced filtering (Tenant Search)
 * Only returns listings with status === 'AVAILABLE'
 */
export async function getAvailableListings(query = {}) {
  const parseResult = listingSearchQuerySchema.safeParse(query);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { location, minRent, maxRent, roomType, furnishing, availableFrom } = parseResult.data;

  // Business Rule: ONLY listings with status 'AVAILABLE' appear in search
  const where = {
    status: 'AVAILABLE',
  };

  // Location filter: case-insensitive partial match
  if (location && location.trim().length > 0) {
    where.location = {
      contains: location.trim(),
      mode: 'insensitive',
    };
  }

  // Room type filter
  if (roomType) {
    where.roomType = roomType;
  }

  // Furnishing filter
  if (furnishing) {
    where.furnishing = furnishing;
  }

  // Rent range filter
  if (minRent !== undefined || maxRent !== undefined) {
    where.rent = {};
    if (minRent !== undefined) {
      where.rent.gte = minRent;
    }
    if (maxRent !== undefined) {
      where.rent.lte = maxRent;
    }
  }

  // AvailableFrom filter: available on or before the requested date
  if (availableFrom) {
    where.availableFrom = {
      lte: availableFrom,
    };
  }

  return prisma.listing.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

/**
 * Get single listing by ID
 */
export async function getListingById(id) {
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!listing) {
    throw new AppError(404, 'Listing not found');
  }

  return listing;
}

/**
 * Update an existing listing (Owner only)
 */
export async function updateListing(id, ownerId, inputData, files = []) {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Listing not found');
  }

  if (existing.ownerId !== ownerId) {
    throw new ForbiddenError('You can only modify your own listings');
  }

  const parseResult = listingSchema.safeParse(inputData);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { title, description, location, rent, availableFrom, roomType, furnishing } = parseResult.data;

  let photoUrls = existing.photos;
  if (files && files.length > 0) {
    const newUrls = await uploadImages(files);
    photoUrls = [...photoUrls, ...newUrls];
  }

  return prisma.listing.update({
    where: { id },
    data: {
      title,
      description,
      location,
      rent,
      availableFrom,
      roomType,
      furnishing,
      photos: photoUrls,
    },
  });
}

/**
 * Update listing status (e.g. Mark as FILLED or AVAILABLE)
 */
export async function updateListingStatus(id, ownerId, status) {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Listing not found');
  }

  if (existing.ownerId !== ownerId) {
    throw new ForbiddenError('You can only update your own listings');
  }

  const normalizedStatus = (status || '').toUpperCase();
  if (!['AVAILABLE', 'FILLED', 'UNAVAILABLE'].includes(normalizedStatus)) {
    throw new ValidationError('Status must be AVAILABLE, FILLED, or UNAVAILABLE');
  }

  return prisma.listing.update({
    where: { id },
    data: { status: normalizedStatus },
  });
}

/**
 * Delete listing (Owner only)
 */
export async function deleteListing(id, ownerId) {
  const existing = await prisma.listing.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Listing not found');
  }

  if (existing.ownerId !== ownerId) {
    throw new ForbiddenError('You can only delete your own listings');
  }

  await prisma.listing.delete({ where: { id } });
  return { success: true };
}
