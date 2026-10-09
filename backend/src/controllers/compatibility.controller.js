import * as compatibilityService from '../services/compatibility.service.js';

/**
 * GET /api/compatibility/:listingId
 * Calculates/retrieves compatibility score for the authenticated tenant and listing
 */
export async function getCompatibility(req, res, next) {
  try {
    const { listingId } = req.params;
    const result = await compatibilityService.getOrComputeCompatibility(req.user.id, listingId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/compatibility
 * Calculates/retrieves batch compatibility scores for multiple listings
 */
export async function getBatchCompatibility(req, res, next) {
  try {
    const { listingIds } = req.query;
    const result = await compatibilityService.getOrComputeBatchCompatibility(req.user.id, listingIds);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
