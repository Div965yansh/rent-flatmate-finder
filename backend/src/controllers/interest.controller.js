import * as interestService from '../services/interest.service.js';

/**
 * POST /api/interests
 * Express interest in an available listing (TENANT only)
 */
export async function createInterest(req, res, next) {
  try {
    const interest = await interestService.createInterest(req.user.id, req.body);
    res.status(201).json({ interest });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/interests/mine
 * Get authenticated tenant's sent interests (TENANT only)
 */
export async function getTenantInterests(req, res, next) {
  try {
    const interests = await interestService.getTenantInterests(req.user.id);
    res.status(200).json({ interests });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/interests/inbox
 * Get received interests for owner's listings (OWNER only)
 */
export async function getOwnerInbox(req, res, next) {
  try {
    const interests = await interestService.getOwnerInbox(req.user.id);
    res.status(200).json({ interests });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/interests/:interestId/accept
 * Accept a pending interest for a listing (OWNER only)
 */
export async function acceptInterest(req, res, next) {
  try {
    const { interestId } = req.params;
    const interest = await interestService.acceptInterest(req.user.id, interestId);
    res.status(200).json({ interest });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/interests/:interestId/decline
 * Decline a pending interest for a listing (OWNER only)
 */
export async function declineInterest(req, res, next) {
  try {
    const { interestId } = req.params;
    const interest = await interestService.declineInterest(req.user.id, interestId);
    res.status(200).json({ interest });
  } catch (error) {
    next(error);
  }
}
