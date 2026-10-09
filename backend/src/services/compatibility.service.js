import prisma from '../config/prisma.js';
import { AppError, ValidationError } from '../utils/errors.js';
import { analyzeListingCompatibility } from './llm-compatibility.service.js';

/**
 * Deterministic Rule-Based Compatibility Engine
 *
 * Weights breakdown (Total: 100 points):
 * 1. Budget Compatibility: 30 points
 * 2. Location Compatibility: 25 points
 * 3. Room Type Compatibility: 15 points
 * 4. Furnishing Compatibility: 15 points
 * 5. Move-in Date Compatibility: 10 points
 * 6. Lifestyle / Preferences: 5 points
 *
 * Clamped strictly between 0 and 100.
 */

export function calculateBudgetScore(tenantProfile, listing) {
  const max = 30;
  const rent = Number(listing.rent);

  const minBudget =
    tenantProfile.budgetMin !== null && tenantProfile.budgetMin !== undefined
      ? Number(tenantProfile.budgetMin)
      : null;
  const maxBudget =
    tenantProfile.budgetMax !== null && tenantProfile.budgetMax !== undefined
      ? Number(tenantProfile.budgetMax)
      : null;

  // Case 1: No budget specified by tenant -> neutral partial score
  if (minBudget === null && maxBudget === null) {
    return { score: 15, max };
  }

  // Case 2: Both min and max budget specified
  if (minBudget !== null && maxBudget !== null) {
    if (rent >= minBudget && rent <= maxBudget) {
      return { score: 30, max };
    }
    if (rent < minBudget) {
      // Slightly below min budget is mostly acceptable
      return { score: rent >= minBudget * 0.8 ? 24 : 18, max };
    }
    // rent > maxBudget
    if (rent <= maxBudget * 1.1) {
      return { score: 18, max }; // within 10% above budget
    }
    if (rent <= maxBudget * 1.25) {
      return { score: 9, max }; // within 25% above budget
    }
    return { score: 0, max }; // significantly over budget
  }

  // Case 3: Only max budget specified
  if (maxBudget !== null) {
    if (rent <= maxBudget) {
      return { score: 30, max };
    }
    if (rent <= maxBudget * 1.1) {
      return { score: 18, max };
    }
    if (rent <= maxBudget * 1.25) {
      return { score: 9, max };
    }
    return { score: 0, max };
  }

  // Case 4: Only min budget specified
  if (minBudget !== null) {
    if (rent >= minBudget) {
      return { score: 30, max };
    }
    if (rent >= minBudget * 0.8) {
      return { score: 20, max };
    }
    return { score: 10, max };
  }

  return { score: 15, max };
}

export function calculateLocationScore(tenantProfile, listing) {
  const max = 25;
  const preferred = (tenantProfile.preferredLocation || '').trim().toLowerCase();
  const listingLoc = (listing.location || '').trim().toLowerCase();

  // If tenant has no location preference -> neutral score
  if (!preferred) {
    return { score: 12, max };
  }

  // Exact match
  if (preferred === listingLoc) {
    return { score: 25, max };
  }

  // Direct substring match (e.g. "Noida" in "Noida Sector 62")
  if (listingLoc.includes(preferred) || preferred.includes(listingLoc)) {
    return { score: 20, max };
  }

  // Word/token overlap
  const prefWords = preferred.split(/[\s,.-]+/).filter((w) => w.length >= 3);
  const locWords = listingLoc.split(/[\s,.-]+/).filter((w) => w.length >= 3);

  const hasOverlap = prefWords.some((w) => locWords.includes(w));
  if (hasOverlap) {
    return { score: 15, max };
  }

  // Complete mismatch
  return { score: 0, max };
}

export function calculateRoomTypeScore(tenantProfile, listing) {
  const max = 15;
  const prefRoom = (tenantProfile.preferredRoomType || tenantProfile.roomType || '').toUpperCase();
  const listingRoom = (listing.roomType || '').toUpperCase();

  // No preference -> neutral score
  if (!prefRoom) {
    return { score: 8, max };
  }

  // Exact match
  if (prefRoom === listingRoom) {
    return { score: 15, max };
  }

  // Mismatch
  return { score: 0, max };
}

export function calculateFurnishingScore(tenantProfile, listing) {
  const max = 15;
  const prefFurn = (tenantProfile.preferredFurnishing || tenantProfile.furnishing || '').toUpperCase();
  const listingFurn = (listing.furnishing || '').toUpperCase();

  // No preference -> neutral score
  if (!prefFurn) {
    return { score: 8, max };
  }

  // Exact match
  if (prefFurn === listingFurn) {
    return { score: 15, max };
  }

  // Mismatch
  return { score: 0, max };
}

export function calculateMoveInDateScore(tenantProfile, listing) {
  const max = 10;

  if (!tenantProfile.moveInDate || !listing.availableFrom) {
    return { score: 5, max };
  }

  const tenantDate = new Date(tenantProfile.moveInDate);
  const listingDate = new Date(listing.availableFrom);

  // Normalize to UTC calendar dates
  const tenantTime = Date.UTC(tenantDate.getUTCFullYear(), tenantDate.getUTCMonth(), tenantDate.getUTCDate());
  const listingTime = Date.UTC(listingDate.getUTCFullYear(), listingDate.getUTCMonth(), listingDate.getUTCDate());

  // Listing is available on or before tenant move-in date
  if (listingTime <= tenantTime) {
    return { score: 10, max };
  }

  // Listing is available after tenant move-in date
  const diffDays = (listingTime - tenantTime) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) {
    return { score: 4, max }; // within 1 week window
  }

  return { score: 0, max };
}

export function calculateLifestyleScore(tenantProfile, listing) {
  const max = 5;
  const ls = tenantProfile.lifestyle;

  // No lifestyle preferences specified -> neutral score
  if (!ls || typeof ls !== 'object' || Object.keys(ls).length === 0) {
    return { score: 3, max };
  }

  const text = `${listing.title || ''} ${listing.description || ''}`.toLowerCase();
  const tags = Array.isArray(ls.tags) ? ls.tags.map((t) => String(t).toLowerCase()) : [];

  const prefersNonSmoking = Boolean(ls.nonSmoking) || tags.includes('non-smoking');
  const allowsSmoking = Boolean(ls.smoking) || tags.includes('smoking friendly');
  const prefersPets = Boolean(ls.pets) || tags.includes('pet friendly');
  const prefersVeg = Boolean(ls.vegetarian) || tags.includes('vegetarian');
  const prefersQuiet = Boolean(ls.quiet) || tags.includes('quiet living');

  let modifier = 0;

  if (prefersNonSmoking) {
    if (/no smoking|non-smoking|smoke-free|smoke free/.test(text)) modifier += 1;
    if (/smoking allowed|smokers welcome|smoke friendly/.test(text)) modifier -= 2;
  } else if (allowsSmoking) {
    if (/smoking allowed|smokers welcome|smoke friendly/.test(text)) modifier += 1;
  }

  if (prefersPets) {
    if (/pet friendly|pets allowed|pets welcome/.test(text)) modifier += 1;
    if (/no pets|pets not allowed|pets prohibited/.test(text)) modifier -= 2;
  }

  if (prefersVeg) {
    if (/veg only|vegetarian only|veg preferred|vegetarian preferred/.test(text)) modifier += 1;
  }

  if (prefersQuiet) {
    if (/quiet|peaceful|study friendly|calm environment/.test(text)) modifier += 1;
    if (/party house|frequent parties|loud/.test(text)) modifier -= 2;
  }

  const baseScore = 3;
  const finalScore = Math.min(5, Math.max(0, baseScore + modifier));

  return { score: finalScore, max };
}

/**
 * Calculate deterministic compatibility score between a tenant profile and a listing
 * @param {object} tenantProfile
 * @param {object} listing
 * @returns {{ score: number, breakdown: object }}
 */
export function calculateCompatibility(tenantProfile, listing) {
  const budget = calculateBudgetScore(tenantProfile, listing);
  const location = calculateLocationScore(tenantProfile, listing);
  const roomType = calculateRoomTypeScore(tenantProfile, listing);
  const furnishing = calculateFurnishingScore(tenantProfile, listing);
  const moveInDate = calculateMoveInDateScore(tenantProfile, listing);
  const lifestyle = calculateLifestyleScore(tenantProfile, listing);

  const rawTotal =
    budget.score +
    location.score +
    roomType.score +
    furnishing.score +
    moveInDate.score +
    lifestyle.score;

  // Strict clamp 0 <= score <= 100
  const score = Math.min(100, Math.max(0, rawTotal));

  return {
    score,
    breakdown: {
      budget,
      location,
      roomType,
      furnishing,
      moveInDate,
      lifestyle,
    },
  };
}

/**
 * Retrieve or compute and persist compatibility score for a tenant and listing
 * @param {string} tenantId - User ID of tenant
 * @param {string} listingId - ID of listing
 */
export async function getOrComputeCompatibility(tenantId, listingId) {
  if (!listingId || typeof listingId !== 'string') {
    throw new ValidationError('Valid listingId is required');
  }

  // 1. Fetch tenant profile
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantId },
  });

  if (!tenantProfile) {
    throw new AppError(
      404,
      'Tenant profile not found. Please create a tenant profile first to calculate compatibility.'
    );
  }

  // 2. Fetch listing
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });

  if (!listing) {
    throw new AppError(404, 'Listing not found');
  }

  // 3. Compute baseline deterministic score
  const ruleBasedResult = calculateCompatibility(tenantProfile, listing);

  // 4. Run LLM compatibility analysis with guaranteed fallback
  const analysisResult = await analyzeListingCompatibility({
    tenantProfile,
    listing,
    ruleBasedResult,
  });

  // 5. Upsert final score & deterministic breakdown in PostgreSQL
  await prisma.compatibilityScore.upsert({
    where: {
      tenantId_listingId: {
        tenantId,
        listingId,
      },
    },
    update: {
      score: analysisResult.score,
      breakdown: ruleBasedResult.breakdown,
    },
    create: {
      tenantId,
      listingId,
      score: analysisResult.score,
      breakdown: ruleBasedResult.breakdown,
    },
  });

  return {
    source: analysisResult.source,
    score: analysisResult.score,
    breakdown: ruleBasedResult.breakdown,
    llm: analysisResult.llm,
  };
}

/**
 * Retrieve or compute batch compatibility scores for a tenant across requested listings
 * @param {string} tenantId - User ID of tenant
 * @param {string|string[]} [listingIdsInput] - Comma-separated or array of listing IDs
 */
export async function getOrComputeBatchCompatibility(tenantId, listingIdsInput) {
  // 1. Fetch tenant profile
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantId },
  });

  if (!tenantProfile) {
    throw new AppError(
      404,
      'Tenant profile not found. Please create a tenant profile first to calculate compatibility.'
    );
  }

  // 2. Parse listing IDs filter if provided
  let targetIds = null;
  if (typeof listingIdsInput === 'string' && listingIdsInput.trim().length > 0) {
    targetIds = listingIdsInput
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
  } else if (Array.isArray(listingIdsInput) && listingIdsInput.length > 0) {
    targetIds = listingIdsInput.map((id) => String(id).trim()).filter((id) => id.length > 0);
  }

  // If explicit empty list was passed, return empty scores
  if (targetIds && targetIds.length === 0) {
    return { scores: {} };
  }

  // 3. Query ONLY listings with status === 'AVAILABLE' (capped at 50 to prevent unbounded computation)
  const whereClause = {
    status: 'AVAILABLE',
  };
  if (targetIds && targetIds.length > 0) {
    whereClause.id = { in: targetIds };
  }

  const listings = await prisma.listing.findMany({
    where: whereClause,
    take: 50,
  });

  const scores = {};

  // 4. Compute compatibility with concurrency control (chunks of 5)
  const CONCURRENCY_LIMIT = 5;
  const chunks = [];
  for (let i = 0; i < listings.length; i += CONCURRENCY_LIMIT) {
    chunks.push(listings.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (listing) => {
        // Baseline deterministic score
        const ruleBasedResult = calculateCompatibility(tenantProfile, listing);

        // LLM compatibility analysis with independent fallback
        const analysisResult = await analyzeListingCompatibility({
          tenantProfile,
          listing,
          ruleBasedResult,
        });

        // Persist final score & deterministic breakdown
        await prisma.compatibilityScore.upsert({
          where: {
            tenantId_listingId: {
              tenantId,
              listingId: listing.id,
            },
          },
          update: {
            score: analysisResult.score,
            breakdown: ruleBasedResult.breakdown,
          },
          create: {
            tenantId,
            listingId: listing.id,
            score: analysisResult.score,
            breakdown: ruleBasedResult.breakdown,
          },
        });

        scores[listing.id] = {
          source: analysisResult.source,
          score: analysisResult.score,
          breakdown: ruleBasedResult.breakdown,
          llm: analysisResult.llm,
        };
      })
    );
  }

  return { scores };
}
