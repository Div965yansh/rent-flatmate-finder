import { z } from 'zod';
import prisma from '../config/prisma.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UnauthorizedError,
} from '../utils/errors.js';

// Schema for sending a message
export const sendMessageSchema = z.object({
  interestId: z
    .string({ required_error: 'Interest ID is required' })
    .trim()
    .min(1, 'Interest ID is required'),
  body: z
    .string({ required_error: 'Message body is required' })
    .trim()
    .min(1, 'Message body cannot be empty')
    .max(2000, 'Message body cannot exceed 2000 characters'),
});

/**
 * Server-side authorization check for accessing conversation
 *
 * Rules:
 * 1. Interest must exist.
 * 2. Interest status must be ACCEPTED.
 * 3. User must be either the tenant who created the interest
 *    or the owner of the listing associated with that interest.
 *
 * @param {string} userId
 * @param {string} interestId
 * @returns {Promise<{ interest: object, isTenant: boolean, isOwner: boolean }>}
 */
export async function canAccessConversation(userId, interestId) {
  if (!interestId || typeof interestId !== 'string' || !interestId.trim()) {
    throw new ValidationError('Interest ID is required');
  }

  const interest = await prisma.interest.findUnique({
    where: { id: interestId.trim() },
    include: {
      listing: {
        select: {
          id: true,
          ownerId: true,
          title: true,
          status: true,
        },
      },
    },
  });

  if (!interest) {
    throw new NotFoundError('Interest not found');
  }

  // Verify that the user account is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User account is inactive');
  }

  const isTenant = interest.tenantId === userId;
  const isOwner = interest.listing?.ownerId === userId;

  if (!isTenant && !isOwner) {
    throw new ForbiddenError('Access forbidden: you are not a participant in this conversation');
  }

  if (interest.status !== 'ACCEPTED') {
    throw new ForbiddenError('Access forbidden: chat is only available for accepted interests');
  }

  return {
    interest,
    isTenant,
    isOwner,
  };
}

/**
 * 1. Send Message
 * Role: TENANT or OWNER (must be conversation participant with ACCEPTED status)
 *
 * @param {string} userId - Authenticated user's ID
 * @param {object} payload - { interestId, body }
 * @returns {Promise<object>} Created message
 */
export async function sendMessage(userId, payload) {
  const parseResult = sendMessageSchema.safeParse(payload);
  if (!parseResult.success) {
    const errorMsg = parseResult.error.issues.map((i) => i.message).join(', ');
    throw new ValidationError(errorMsg);
  }

  const { interestId, body } = parseResult.data;

  // Enforce server-side conversation authorization
  await canAccessConversation(userId, interestId);

  const message = await prisma.message.create({
    data: {
      interestId,
      senderId: userId,
      body,
    },
    select: {
      id: true,
      interestId: true,
      senderId: true,
      body: true,
      createdAt: true,
      updatedAt: true,
      sender: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return message;
}

/**
 * 2. Get Messages for Interest
 * Role: TENANT or OWNER (must be conversation participant with ACCEPTED status)
 *
 * @param {string} userId - Authenticated user's ID
 * @param {string} interestId - ID of the accepted interest
 * @param {object} [query] - { page, limit }
 * @returns {Promise<{ messages: Array, pagination: object }>}
 */
export async function getMessagesForInterest(userId, interestId, query = {}) {
  // Parse and enforce pagination constraints
  let page = 1;
  let limit = 50;

  if (query.page !== undefined) {
    const parsedPage = parseInt(query.page, 10);
    if (Number.isNaN(parsedPage) || parsedPage < 1) {
      throw new ValidationError('Page must be a positive integer greater than or equal to 1');
    }
    page = parsedPage;
  }

  if (query.limit !== undefined) {
    const parsedLimit = parseInt(query.limit, 10);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1) {
      throw new ValidationError('Limit must be a positive integer');
    }
    // Cap limit to maximum 100
    limit = Math.min(parsedLimit, 100);
  }

  // Enforce server-side conversation authorization
  await canAccessConversation(userId, interestId);

  const skip = (page - 1) * limit;

  const [total, messages] = await Promise.all([
    prisma.message.count({
      where: { interestId },
    }),
    prisma.message.findMany({
      where: { interestId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        interestId: true,
        senderId: true,
        body: true,
        createdAt: true,
        updatedAt: true,
        sender: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    }),
  ]);

  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      hasMore: skip + messages.length < total,
    },
  };
}
