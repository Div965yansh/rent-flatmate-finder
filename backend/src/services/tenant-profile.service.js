import { z } from 'zod';
import prisma from '../config/prisma.js';
import { ValidationError } from '../utils/errors.js';

// Zod validation schema for Tenant Profile
export const tenantProfileSchema = z
  .object({
    preferredLocation: z.string().trim().max(150, 'Location must be at most 150 characters').optional().nullable(),
    budgetMin: z
      .coerce.number()
      .min(0, 'Minimum budget must be at least 0')
      .optional()
      .nullable(),
    budgetMax: z
      .coerce.number()
      .min(0, 'Maximum budget must be at least 0')
      .optional()
      .nullable(),
    moveInDate: z.coerce.date({ invalid_type_error: 'Invalid move-in date format' }).optional().nullable(),
    roomType: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['SINGLE', 'SHARED', 'ENTIRE_FLAT'].includes(val), {
        message: 'Invalid room type. Must be SINGLE, SHARED, or ENTIRE_FLAT',
      })
      .optional()
      .nullable(),
    preferredRoomType: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['SINGLE', 'SHARED', 'ENTIRE_FLAT'].includes(val), {
        message: 'Invalid room type. Must be SINGLE, SHARED, or ENTIRE_FLAT',
      })
      .optional()
      .nullable(),
    furnishing: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['FULLY_FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'].includes(val), {
        message: 'Invalid furnishing preference. Must be FULLY_FURNISHED, SEMI_FURNISHED, or UNFURNISHED',
      })
      .optional()
      .nullable(),
    preferredFurnishing: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .refine((val) => ['FULLY_FURNISHED', 'SEMI_FURNISHED', 'UNFURNISHED'].includes(val), {
        message: 'Invalid furnishing preference. Must be FULLY_FURNISHED, SEMI_FURNISHED, or UNFURNISHED',
      })
      .optional()
      .nullable(),
    lifestyle: z.any().optional().nullable(),
    preferences: z.any().optional().nullable(),
    notes: z.string().trim().max(1000, 'Notes must be at most 1000 characters').optional().nullable(),
  })
  .refine(
    (data) => {
      if (
        data.budgetMin !== undefined &&
        data.budgetMin !== null &&
        data.budgetMax !== undefined &&
        data.budgetMax !== null
      ) {
        return Number(data.budgetMin) <= Number(data.budgetMax);
      }
      return true;
    },
    {
      message: 'Minimum budget cannot be greater than maximum budget',
      path: ['budgetMin'],
    }
  );

/**
 * Retrieve the profile for a given tenant user ID
 * @param {string} userId
 */
export async function getTenantProfile(userId) {
  const profile = await prisma.tenantProfile.findUnique({
    where: { userId },
  });

  return profile;
}

/**
 * Upsert the profile for a given tenant user ID
 * @param {string} userId
 * @param {object} input
 */
export async function upsertTenantProfile(userId, input) {
  const parseResult = tenantProfileSchema.safeParse(input);
  if (!parseResult.success) {
    const message = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(message);
  }

  const {
    preferredLocation,
    budgetMin,
    budgetMax,
    moveInDate,
    roomType,
    preferredRoomType,
    furnishing,
    preferredFurnishing,
    lifestyle,
    preferences,
    notes,
  } = parseResult.data;

  const resolvedRoomType = roomType || preferredRoomType || null;
  const resolvedFurnishing = furnishing || preferredFurnishing || null;
  const resolvedLifestyle = lifestyle !== undefined ? lifestyle : preferences !== undefined ? preferences : null;

  const data = {
    preferredLocation: preferredLocation ?? null,
    budgetMin: budgetMin !== undefined && budgetMin !== null ? budgetMin : null,
    budgetMax: budgetMax !== undefined && budgetMax !== null ? budgetMax : null,
    moveInDate: moveInDate ?? null,
    preferredRoomType: resolvedRoomType,
    preferredFurnishing: resolvedFurnishing,
    lifestyle: resolvedLifestyle,
    notes: notes ?? null,
  };

  const profile = await prisma.tenantProfile.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data,
    },
  });

  return profile;
}
