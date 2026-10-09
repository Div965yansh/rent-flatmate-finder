import * as adminService from '../services/admin.service.js';

/**
 * GET /api/admin/stats
 * Platform statistics (ADMIN only)
 */
export async function getStats(req, res, next) {
  try {
    const stats = await adminService.getPlatformStats();
    res.status(200).json(stats);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/users
 * Paginated user list with role and isActive filters (ADMIN only)
 */
export async function getUsers(req, res, next) {
  try {
    const result = await adminService.getUsers(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/users/:userId/status
 * Activate or deactivate a user (ADMIN only)
 */
export async function updateUserStatus(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await adminService.updateUserStatus(req.user.id, userId, req.body);
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/listings
 * Paginated listings list with status filter (ADMIN only)
 */
export async function getListings(req, res, next) {
  try {
    const result = await adminService.getListings(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/admin/listings/:listingId/status
 * Moderate listing status (ADMIN only)
 */
export async function updateListingStatus(req, res, next) {
  try {
    const { listingId } = req.params;
    const listing = await adminService.updateListingStatus(listingId, req.body);
    res.status(200).json({ listing });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/admin/interests
 * Paginated interest inquiry monitoring (ADMIN only)
 */
export async function getInterests(req, res, next) {
  try {
    const result = await adminService.getInterests(req.query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
