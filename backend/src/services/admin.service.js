import { z } from 'zod';
import prisma from '../config/prisma.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

// Base Pagination Schema
export const paginationQuerySchema = z.object({
  page: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 1 : val),
    z.coerce.number().int().min(1, 'Page must be a positive integer greater than or equal to 1')
  ),
  limit: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? 50 : val),
    z.coerce
      .number()
      .int()
      .min(1, 'Limit must be a positive integer')
      .max(100, 'Limit cannot exceed 100')
  ),
});

// Users Filter Schema
export const userFilterSchema = paginationQuerySchema.extend({
  role: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? undefined : String(val).trim()),
    z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['TENANT', 'OWNER', 'ADMIN'].includes(val), {
        message: 'Invalid role filter. Allowed values: TENANT, OWNER, ADMIN',
      })
      .optional()
  ),
  isActive: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (val === 'true' || val === true) return true;
      if (val === 'false' || val === false) return false;
      return val;
    },
    z.boolean({ invalid_type_error: 'isActive filter must be a boolean' }).optional()
  ),
});

// User Status Update Schema
export const userStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive must be a boolean' }),
});

// Listings Filter Schema
export const listingFilterSchema = paginationQuerySchema.extend({
  status: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? undefined : String(val).trim()),
    z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['AVAILABLE', 'FILLED', 'UNAVAILABLE'].includes(val), {
        message: 'Invalid status filter. Allowed values: AVAILABLE, FILLED, UNAVAILABLE',
      })
      .optional()
  ),
});

// Listing Status Update Schema
export const listingStatusSchema = z.object({
  status: z
    .string({ required_error: 'Status is required' })
    .trim()
    .transform((val) => val.toUpperCase())
    .refine((val) => ['AVAILABLE', 'FILLED', 'UNAVAILABLE'].includes(val), {
      message: 'Status must be AVAILABLE, FILLED, or UNAVAILABLE',
    }),
});

// Interests Filter Schema
export const interestFilterSchema = paginationQuerySchema.extend({
  status: z.preprocess(
    (val) => (val === undefined || val === null || val === '' ? undefined : String(val).trim()),
    z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['PENDING', 'ACCEPTED', 'DECLINED'].includes(val), {
        message: 'Invalid status filter. Allowed values: PENDING, ACCEPTED, DECLINED',
      })
      .optional()
  ),
});

/**
 * 1. Get Platform Statistics
 * Aggregates high-level platform counts across all entities using database-side counting.
 *
 * @returns {Promise<object>} Platform statistics summary
 */
export async function getPlatformStats() {
  const [
    totalUsers,
    tenantUsers,
    ownerUsers,
    adminUsers,
    activeUsers,
    totalListings,
    availableListings,
    filledListings,
    unavailableListings,
    totalInterests,
    pendingInterests,
    acceptedInterests,
    declinedInterests,
    totalMessages,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'TENANT' } }),
    prisma.user.count({ where: { role: 'OWNER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { isActive: true } }),

    prisma.listing.count(),
    prisma.listing.count({ where: { status: 'AVAILABLE' } }),
    prisma.listing.count({ where: { status: 'FILLED' } }),
    prisma.listing.count({ where: { status: 'UNAVAILABLE' } }),

    prisma.interest.count(),
    prisma.interest.count({ where: { status: 'PENDING' } }),
    prisma.interest.count({ where: { status: 'ACCEPTED' } }),
    prisma.interest.count({ where: { status: 'DECLINED' } }),

    prisma.message.count(),
  ]);

  return {
    users: {
      total: totalUsers,
      tenants: tenantUsers,
      owners: ownerUsers,
      admins: adminUsers,
      active: activeUsers,
    },
    listings: {
      total: totalListings,
      available: availableListings,
      filled: filledListings,
      unavailable: unavailableListings,
    },
    interests: {
      total: totalInterests,
      pending: pendingInterests,
      accepted: acceptedInterests,
      declined: declinedInterests,
    },
    messages: {
      total: totalMessages,
    },
  };
}

/**
 * 2. Get Users List with Pagination and Filtering
 *
 * @param {object} query - Query parameters (page, limit, role, isActive)
 * @returns {Promise<{ users: Array, pagination: object }>}
 */
export async function getUsers(query = {}) {
  const parseResult = userFilterSchema.safeParse(query);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { page, limit, role, isActive } = parseResult.data;
  const where = {};

  if (role) {
    where.role = role;
  }
  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + users.length < total,
    },
  };
}

/**
 * 3. Update User Status (Activate / Deactivate)
 *
 * @param {string} adminUserId - Authenticated admin ID (prevents self-deactivation)
 * @param {string} targetUserId - Target user ID to modify
 * @param {object} payload - { isActive: boolean }
 * @returns {Promise<object>} Updated user
 */
export async function updateUserStatus(adminUserId, targetUserId, payload) {
  if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
    throw new ValidationError('User ID is required');
  }

  const parseResult = userStatusSchema.safeParse(payload);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const targetId = targetUserId.trim();
  const { isActive } = parseResult.data;

  // Prevent admin from self-deactivating
  if (adminUserId === targetId && isActive === false) {
    throw new ValidationError('Admins cannot deactivate their own account');
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: targetId },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetId },
    data: { isActive },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
}

/**
 * 4. Get Listings List with Pagination and Status Filtering
 *
 * @param {object} query - Query parameters (page, limit, status)
 * @returns {Promise<{ listings: Array, pagination: object }>}
 */
export async function getListings(query = {}) {
  const parseResult = listingFilterSchema.safeParse(query);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { page, limit, status } = parseResult.data;
  const where = {};

  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [total, listings] = await Promise.all([
    prisma.listing.count({ where }),
    prisma.listing.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        rent: true,
        availableFrom: true,
        roomType: true,
        furnishing: true,
        status: true,
        photos: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return {
    listings,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + listings.length < total,
    },
  };
}

/**
 * 5. Update Listing Moderation Status
 *
 * @param {string} listingId - ID of the listing
 * @param {object} payload - { status: 'AVAILABLE' | 'FILLED' | 'UNAVAILABLE' }
 * @returns {Promise<object>} Updated listing
 */
export async function updateListingStatus(listingId, payload) {
  if (!listingId || typeof listingId !== 'string' || !listingId.trim()) {
    throw new ValidationError('Listing ID is required');
  }

  const parseResult = listingStatusSchema.safeParse(payload);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const targetId = listingId.trim();
  const { status } = parseResult.data;

  const existingListing = await prisma.listing.findUnique({
    where: { id: targetId },
  });

  if (!existingListing) {
    throw new NotFoundError('Listing not found');
  }

  const updatedListing = await prisma.listing.update({
    where: { id: targetId },
    data: { status },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      rent: true,
      availableFrom: true,
      roomType: true,
      furnishing: true,
      status: true,
      photos: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updatedListing;
}

/**
 * 6. Get Interests List with Pagination and Status Filtering (Monitoring only)
 *
 * @param {object} query - Query parameters (page, limit, status)
 * @returns {Promise<{ interests: Array, pagination: object }>}
 */
export async function getInterests(query = {}) {
  const parseResult = interestFilterSchema.safeParse(query);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const { page, limit, status } = parseResult.data;
  const where = {};

  if (status) {
    where.status = status;
  }

  const skip = (page - 1) * limit;

  const [total, interests] = await Promise.all([
    prisma.interest.count({ where }),
    prisma.interest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        listing: {
          select: {
            id: true,
            title: true,
            location: true,
            rent: true,
            status: true,
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    interests,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + interests.length < total,
    },
  };
}
