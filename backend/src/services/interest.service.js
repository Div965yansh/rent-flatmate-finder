import { z } from 'zod';
import prisma from '../config/prisma.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AppError,
} from '../utils/errors.js';
import * as emailService from './email/email.service.js';

// Zod schemas for interest endpoints
export const createInterestSchema = z.object({
  listingId: z
    .string({ required_error: 'Listing ID is required' })
    .trim()
    .min(1, 'Listing ID is required'),
});

export const interestIdSchema = z
  .string({ required_error: 'Interest ID is required' })
  .trim()
  .min(1, 'Interest ID is required');

/**
 * 1. Express Interest in a Listing
 * Role: TENANT only
 */
export async function createInterest(tenantId, payload) {
  const parseResult = createInterestSchema.safeParse(payload);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(errorMsg);
  }

  const { listingId } = parseResult.data;

  // Verify listing exists
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw new NotFoundError('Listing not found');
  }

  // Verify listing is AVAILABLE
  if (listing.status === 'FILLED') {
    throw new AppError(400, 'Cannot express interest in a filled listing');
  }

  if (listing.status === 'UNAVAILABLE') {
    throw new AppError(400, 'Cannot express interest in an unavailable listing');
  }

  if (listing.status !== 'AVAILABLE') {
    throw new AppError(400, 'Cannot express interest: listing is not available');
  }

  // Verify tenant has not already expressed interest
  const existingInterest = await prisma.interest.findUnique({
    where: {
      tenantId_listingId: {
        tenantId,
        listingId,
      },
    },
  });

  if (existingInterest) {
    throw new ConflictError('Interest has already been expressed for this listing');
  }

  // Create PENDING interest
  const interest = await prisma.interest.create({
    data: {
      tenantId,
      listingId,
      status: 'PENDING',
    },
    select: {
      id: true,
      listingId: true,
      tenantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Trigger owner notification email (failure must not roll back or fail the interest workflow)
  try {
    const details = await prisma.interest.findUnique({
      where: { id: interest.id },
      select: {
        listing: {
          select: {
            title: true,
            location: true,
            rent: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
        tenant: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (details?.listing?.owner?.email) {
      await emailService.notifyOwnerInterestReceived({
        ownerEmail: details.listing.owner.email,
        ownerName: details.listing.owner.name,
        tenantName: details.tenant?.name,
        listingTitle: details.listing.title,
        listingLocation: details.listing.location,
        rent: Number(details.listing.rent),
      });
    }
  } catch (emailErr) {
    console.error('[InterestService] Email dispatch failed for interest creation:', emailErr?.message || emailErr);
  }

  return interest;
}

/**
 * 2. Get Authenticated Tenant's Interests
 * Role: TENANT only
 */
export async function getTenantInterests(tenantId) {
  const interests = await prisma.interest.findMany({
    where: { tenantId },
    select: {
      id: true,
      listingId: true,
      tenantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      listing: {
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
    orderBy: { createdAt: 'desc' },
  });

  return interests;
}

/**
 * 3. Get Owner Inbox (Interests received for owner's listings)
 * Role: OWNER only
 */
export async function getOwnerInbox(ownerId) {
  const interests = await prisma.interest.findMany({
    where: {
      listing: {
        ownerId,
      },
    },
    select: {
      id: true,
      listingId: true,
      tenantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      listing: {
        select: {
          id: true,
          title: true,
          location: true,
          rent: true,
          status: true,
          photos: true,
        },
      },
      tenant: {
        select: {
          id: true,
          name: true,
          email: true,
          tenantProfile: {
            select: {
              preferredLocation: true,
              budgetMin: true,
              budgetMax: true,
              moveInDate: true,
              preferredRoomType: true,
              preferredFurnishing: true,
              lifestyle: true,
              notes: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return interests;
}

/**
 * 4. Accept Interest
 * Role: OWNER only (must own the associated listing)
 */
export async function acceptInterest(ownerId, interestId) {
  const parseResult = interestIdSchema.safeParse(interestId);
  if (!parseResult.success) {
    throw new ValidationError('Invalid interest ID format');
  }

  const interest = await prisma.interest.findUnique({
    where: { id: parseResult.data },
    include: {
      listing: true,
    },
  });

  if (!interest) {
    throw new NotFoundError('Interest not found');
  }

  // Authorization: must own the listing
  if (interest.listing.ownerId !== ownerId) {
    throw new ForbiddenError('Access forbidden: you do not own this listing');
  }

  // Listing status rule: Cannot accept interest for a FILLED listing
  if (interest.listing.status === 'FILLED') {
    throw new ConflictError('Cannot accept interest for a filled listing');
  }

  // Status transitions
  if (interest.status === 'ACCEPTED') {
    throw new ConflictError('Interest has already been accepted');
  }

  if (interest.status === 'DECLINED') {
    throw new ConflictError('Interest has already been declined');
  }

  if (interest.status !== 'PENDING') {
    throw new ConflictError('Only pending interests can be accepted');
  }

  const updatedInterest = await prisma.interest.update({
    where: { id: parseResult.data },
    data: { status: 'ACCEPTED' },
    select: {
      id: true,
      listingId: true,
      tenantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Trigger tenant notification email (failure must not affect ACCEPTED status)
  try {
    const details = await prisma.interest.findUnique({
      where: { id: updatedInterest.id },
      select: {
        listing: {
          select: {
            title: true,
            location: true,
            rent: true,
            owner: {
              select: {
                name: true,
              },
            },
          },
        },
        tenant: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (details?.tenant?.email) {
      await emailService.notifyTenantInterestAccepted({
        tenantEmail: details.tenant.email,
        tenantName: details.tenant.name,
        ownerName: details.listing?.owner?.name,
        listingTitle: details.listing?.title,
        listingLocation: details.listing?.location,
        rent: Number(details.listing?.rent),
      });
    }
  } catch (emailErr) {
    console.error('[InterestService] Email dispatch failed for interest accept:', emailErr?.message || emailErr);
  }

  return updatedInterest;
}

/**
 * 5. Decline Interest
 * Role: OWNER only (must own the associated listing)
 */
export async function declineInterest(ownerId, interestId) {
  const parseResult = interestIdSchema.safeParse(interestId);
  if (!parseResult.success) {
    throw new ValidationError('Invalid interest ID format');
  }

  const interest = await prisma.interest.findUnique({
    where: { id: parseResult.data },
    include: {
      listing: true,
    },
  });

  if (!interest) {
    throw new NotFoundError('Interest not found');
  }

  // Authorization: must own the listing
  if (interest.listing.ownerId !== ownerId) {
    throw new ForbiddenError('Access forbidden: you do not own this listing');
  }

  // Status transitions
  if (interest.status === 'DECLINED') {
    throw new ConflictError('Interest has already been declined');
  }

  if (interest.status === 'ACCEPTED') {
    throw new ConflictError('Interest has already been accepted');
  }

  if (interest.status !== 'PENDING') {
    throw new ConflictError('Only pending interests can be declined');
  }

  const updatedInterest = await prisma.interest.update({
    where: { id: parseResult.data },
    data: { status: 'DECLINED' },
    select: {
      id: true,
      listingId: true,
      tenantId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Trigger tenant notification email (failure must not affect DECLINED status)
  try {
    const details = await prisma.interest.findUnique({
      where: { id: updatedInterest.id },
      select: {
        listing: {
          select: {
            title: true,
            location: true,
          },
        },
        tenant: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (details?.tenant?.email) {
      await emailService.notifyTenantInterestDeclined({
        tenantEmail: details.tenant.email,
        tenantName: details.tenant.name,
        listingTitle: details.listing?.title,
        listingLocation: details.listing?.location,
      });
    }
  } catch (emailErr) {
    console.error('[InterestService] Email dispatch failed for interest decline:', emailErr?.message || emailErr);
  }

  return updatedInterest;
}
