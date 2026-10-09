import * as listingService from '../services/listing.service.js';

export async function create(req, res, next) {
  try {
    const listing = await listingService.createListing(req.user.id, req.body, req.files);
    res.status(201).json({ listing });
  } catch (error) {
    next(error);
  }
}

export async function getMyListings(req, res, next) {
  try {
    const listings = await listingService.getOwnerListings(req.user.id);
    res.status(200).json({ listings });
  } catch (error) {
    next(error);
  }
}

export async function getPublicListings(req, res, next) {
  try {
    const listings = await listingService.getAvailableListings(req.query);
    res.status(200).json({ listings });
  } catch (error) {
    next(error);
  }
}

export async function getOne(req, res, next) {
  try {
    const listing = await listingService.getListingById(req.params.id);
    res.status(200).json({ listing });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const listing = await listingService.updateListing(req.params.id, req.user.id, req.body, req.files);
    res.status(200).json({ listing });
  } catch (error) {
    next(error);
  }
}

export async function changeStatus(req, res, next) {
  try {
    const listing = await listingService.updateListingStatus(req.params.id, req.user.id, req.body.status);
    res.status(200).json({ listing });
  } catch (error) {
    next(error);
  }
}

export async function remove(req, res, next) {
  try {
    await listingService.deleteListing(req.params.id, req.user.id);
    res.status(200).json({ message: 'Listing deleted successfully' });
  } catch (error) {
    next(error);
  }
}
