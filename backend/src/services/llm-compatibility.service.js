import { z } from 'zod';
import * as llmProvider from './llm/llm.provider.js';

/**
 * Zod validation schema for structured LLM compatibility analysis
 */
export const llmCompatibilityResultSchema = z.object({
  recommendation: z
    .string()
    .trim()
    .transform((val) => val.toLowerCase())
    .pipe(z.enum(['excellent', 'good', 'moderate', 'low'])),
  score: z.coerce
    .number({ invalid_type_error: 'Score must be a number' })
    .int('Score must be an integer')
    .min(0, 'Score must be at least 0')
    .max(100, 'Score cannot exceed 100'),
  summary: z.string().trim().min(5, 'Summary is too short').max(1000, 'Summary is too long'),
  strengths: z.array(z.string().trim().max(300)).max(10),
  concerns: z.array(z.string().trim().max(300)).max(10),
});

/**
 * Convert database objects into a sanitized, LLM-safe input structure.
 * Strips all authentication tokens, password hashes, and unnecessary private identifiers.
 *
 * @param {object} params
 * @param {object} params.tenantProfile
 * @param {object} params.listing
 * @param {object} params.ruleBasedResult
 * @returns {object} Minimal sanitized input
 */
export function buildStructuredLLMInput({ tenantProfile = {}, listing = {}, ruleBasedResult = {} }) {
  const formatIsoDate = (d) => {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt.toISOString().split('T')[0];
  };

  const tenant = {
    preferredLocation: tenantProfile.preferredLocation || null,
    budgetMin:
      tenantProfile.budgetMin !== null && tenantProfile.budgetMin !== undefined
        ? Number(tenantProfile.budgetMin)
        : null,
    budgetMax:
      tenantProfile.budgetMax !== null && tenantProfile.budgetMax !== undefined
        ? Number(tenantProfile.budgetMax)
        : null,
    moveInDate: formatIsoDate(tenantProfile.moveInDate),
    preferredRoomType: tenantProfile.preferredRoomType || tenantProfile.roomType || null,
    preferredFurnishing: tenantProfile.preferredFurnishing || tenantProfile.furnishing || null,
    lifestyle: tenantProfile.lifestyle || null,
    notes: tenantProfile.notes || null,
  };

  const sanitizedListing = {
    title: listing.title || null,
    description: listing.description || null,
    location: listing.location || null,
    rent: listing.rent !== undefined && listing.rent !== null ? Number(listing.rent) : null,
    availableFrom: formatIsoDate(listing.availableFrom),
    roomType: listing.roomType || null,
    furnishing: listing.furnishing || null,
  };

  const sanitizedRuleBasedScore = {
    score: typeof ruleBasedResult.score === 'number' ? ruleBasedResult.score : null,
    breakdown: ruleBasedResult.breakdown || null,
  };

  return {
    tenant,
    listing: sanitizedListing,
    ruleBasedScore: sanitizedRuleBasedScore,
  };
}

/**
 * Build the system prompt instructing the model to perform structured compatibility analysis
 * @param {object} structuredInput - Output from buildStructuredLLMInput
 * @returns {string} Formatted prompt string
 */
export function buildCompatibilityPrompt(structuredInput) {
  return `You are an expert rental property and roommate compatibility analyst.
Your task is to analyze the compatibility between a tenant's stated preferences and an available property listing.

Analyze ONLY the supplied tenant and listing information below.
Rules:
1. Base your evaluation strictly on the provided tenant preferences and listing features.
2. Do not invent facts, amenities, or rules that are not mentioned.
3. Treat the ruleBasedScore as a baseline reference, not as an unquestionable truth. You may calibrate the final score if lifestyle factors or qualitative details warrant it.
4. Output valid JSON ONLY matching the required schema. Do not include markdown formatting or commentary outside the JSON.
5. Provide concise, helpful reasoning.
6. Clearly enumerate key strengths and legitimate concerns.
7. Focus exclusively on rental and flatmate living compatibility.

Input Data:
${JSON.stringify(structuredInput, null, 2)}

Required JSON Output Schema:
{
  "recommendation": "excellent" | "good" | "moderate" | "low",
  "score": <integer from 0 to 100>,
  "summary": "<2-3 sentence overview of why this listing matches or mismatches the tenant's needs>",
  "strengths": ["<clear positive match factor 1>", "<clear positive match factor 2>"],
  "concerns": ["<clear friction point or drawback 1>", "<clear friction point or drawback 2>"]
}`;
}

/**
 * Analyze compatibility with optional LLM reasoning and guaranteed fallback to deterministic scores
 *
 * @param {object} params
 * @param {object} params.tenantProfile - TenantProfile database model or object
 * @param {object} params.listing - Listing database model or object
 * @param {object} params.ruleBasedResult - Output from calculateCompatibility ({ score, breakdown })
 * @param {number} [params.timeoutMs] - Maximum timeout in ms for LLM call
 * @returns {Promise<object>} Complete compatibility analysis with source indicator
 */
export async function analyzeListingCompatibility({
  tenantProfile,
  listing,
  ruleBasedResult,
  timeoutMs = 6000,
}) {
  const fallbackResult = {
    source: 'rule_based',
    score: ruleBasedResult?.score ?? 0,
    breakdown: ruleBasedResult?.breakdown ?? null,
    llm: null,
  };

  // If no rule-based result was supplied, we cannot proceed
  if (!ruleBasedResult || typeof ruleBasedResult.score !== 'number') {
    return fallbackResult;
  }

  try {
    // 1. Build sanitized input and prompt
    const structuredInput = buildStructuredLLMInput({ tenantProfile, listing, ruleBasedResult });
    const prompt = buildCompatibilityPrompt(structuredInput);

    // 2. Call the configured LLM provider
    const rawResult = await llmProvider.analyzeCompatibility({
      prompt,
      timeoutMs,
    });

    // 3. Validate structured response with Zod
    const parseResult = llmCompatibilityResultSchema.safeParse(rawResult);

    if (!parseResult.success) {
      // Validation failure -> gracefully trigger fallback
      return fallbackResult;
    }

    const validated = parseResult.data;

    // 4. Return successful LLM-enhanced result
    return {
      source: 'llm',
      score: validated.score,
      breakdown: ruleBasedResult.breakdown,
      llm: {
        recommendation: validated.recommendation,
        summary: validated.summary,
        strengths: validated.strengths,
        concerns: validated.concerns,
      },
    };
  } catch (error) {
    // Any error (missing API key, timeout, network failure, malformed JSON) safely falls back
    return fallbackResult;
  }
}
