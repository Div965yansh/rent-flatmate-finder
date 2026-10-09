import * as tenantProfileService from '../services/tenant-profile.service.js';

/**
 * Get authenticated tenant's profile
 */
export async function getProfile(req, res, next) {
  try {
    const profile = await tenantProfileService.getTenantProfile(req.user.id);
    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}

/**
 * Create or update authenticated tenant's profile
 */
export async function updateProfile(req, res, next) {
  try {
    const profile = await tenantProfileService.upsertTenantProfile(req.user.id, req.body);
    res.status(200).json({ profile });
  } catch (error) {
    next(error);
  }
}
