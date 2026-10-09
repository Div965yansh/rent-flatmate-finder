process.env.NODE_ENV = 'test';

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeListingCompatibility,
  buildStructuredLLMInput,
  buildCompatibilityPrompt,
  llmCompatibilityResultSchema,
} from '../src/services/llm-compatibility.service.js';
import {
  setCustomProvider,
  resetCustomProvider,
} from '../src/services/llm/llm.provider.js';
import { calculateCompatibility } from '../src/services/compatibility.service.js';

describe('Phase 6 LLM Provider Abstraction & Compatibility Service Test Suite', () => {
  const mockTenantProfile = {
    preferredLocation: 'Indiranagar, Bangalore',
    budgetMin: 10000,
    budgetMax: 20000,
    moveInDate: new Date('2026-11-01'),
    preferredRoomType: 'SINGLE',
    preferredFurnishing: 'FULLY_FURNISHED',
    lifestyle: {
      nonSmoking: true,
      pets: true,
      tags: ['Non-Smoking', 'Pet Friendly'],
    },
    notes: 'Quiet professional looking for a clean home.',
  };

  const mockListing = {
    title: 'Sunny Studio in Indiranagar',
    description: 'Pet friendly single room with smoke-free policy.',
    location: 'Indiranagar, Bangalore',
    rent: 15000,
    availableFrom: new Date('2026-10-15'),
    roomType: 'SINGLE',
    furnishing: 'FULLY_FURNISHED',
  };

  const mockRuleBasedResult = {
    score: 85,
    breakdown: {
      budget: { score: 30, max: 30 },
      location: { score: 25, max: 25 },
      roomType: { score: 15, max: 15 },
      furnishing: { score: 15, max: 15 },
      moveInDate: { score: 10, max: 10 },
      lifestyle: { score: 5, max: 5 },
    },
  };

  afterEach(() => {
    resetCustomProvider();
  });

  // 1. Valid LLM response is accepted
  test('1. Valid LLM response is accepted and parsed', async () => {
    const validLLMResponse = {
      recommendation: 'excellent',
      score: 90,
      summary: 'Ideal match for budget, location, and pet preferences.',
      strengths: ['Under maximum budget', 'Pet-friendly building'],
      concerns: ['Available slightly earlier than move-in date'],
    };

    setCustomProvider(async () => validLLMResponse);

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    assert.equal(result.source, 'llm');
    assert.equal(result.score, 90);
    assert.equal(result.llm.recommendation, 'excellent');
    assert.equal(result.llm.summary, validLLMResponse.summary);
    assert.deepEqual(result.llm.strengths, validLLMResponse.strengths);
    assert.deepEqual(result.llm.concerns, validLLMResponse.concerns);
    assert.deepEqual(result.breakdown, mockRuleBasedResult.breakdown);
  });

  // 2. LLM score is validated
  test('2. LLM score is validated by Zod schema', () => {
    const valid = {
      recommendation: 'good',
      score: 75,
      summary: 'Solid overall match with reasonable rent.',
      strengths: ['Within budget'],
      concerns: ['Slightly noisy area'],
    };

    assert.ok(llmCompatibilityResultSchema.safeParse(valid).success);

    // Boundary scores: 0 and 100
    assert.ok(llmCompatibilityResultSchema.safeParse({ ...valid, score: 0 }).success);
    assert.ok(llmCompatibilityResultSchema.safeParse({ ...valid, score: 100 }).success);

    // Negative score rejected
    assert.ok(!llmCompatibilityResultSchema.safeParse({ ...valid, score: -1 }).success);

    // Score > 100 rejected
    assert.ok(!llmCompatibilityResultSchema.safeParse({ ...valid, score: 105 }).success);

    // Non-integer float score rejected
    assert.ok(!llmCompatibilityResultSchema.safeParse({ ...valid, score: 85.5 }).success);
  });

  // 3. Recommendation enum is validated
  test('3. Recommendation enum is validated and normalized', () => {
    const validBase = {
      score: 80,
      summary: 'Consistent preferences across room and furnishing.',
      strengths: ['Matches well'],
      concerns: [],
    };

    const allowed = ['excellent', 'good', 'moderate', 'low'];
    for (const rec of allowed) {
      const res = llmCompatibilityResultSchema.safeParse({
        ...validBase,
        recommendation: rec,
      });
      assert.ok(res.success, `Expected ${rec} to be valid`);
      assert.equal(res.data.recommendation, rec);
    }

    // Uppercase is normalized to lowercase
    const upperRes = llmCompatibilityResultSchema.safeParse({
      ...validBase,
      recommendation: 'EXCELLENT',
    });
    assert.ok(upperRes.success);
    assert.equal(upperRes.data.recommendation, 'excellent');

    // Invalid enum rejected
    const invalidRec = llmCompatibilityResultSchema.safeParse({
      ...validBase,
      recommendation: 'exceptional',
    });
    assert.ok(!invalidRec.success);
  });

  // 4. Malformed JSON triggers fallback
  test('4. Malformed JSON triggers graceful fallback to rule-based score', async () => {
    setCustomProvider(async () => {
      throw new Error('Failed to parse Gemini response as JSON: Unexpected token < in JSON at position 0');
    });

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, mockRuleBasedResult.score);
    assert.deepEqual(result.breakdown, mockRuleBasedResult.breakdown);
    assert.equal(result.llm, null);
  });

  // 5. Invalid score triggers fallback
  test('5. Invalid score (out of 0-100 range) triggers fallback', async () => {
    setCustomProvider(async () => ({
      recommendation: 'good',
      score: 150, // Invalid: exceeds 100
      summary: 'Out of bounds score from model.',
      strengths: [],
      concerns: [],
    }));

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, mockRuleBasedResult.score);
    assert.equal(result.llm, null);
  });

  // 6. Invalid recommendation triggers fallback
  test('6. Invalid recommendation enum triggers fallback', async () => {
    setCustomProvider(async () => ({
      recommendation: 'superb', // Invalid enum
      score: 85,
      summary: 'Invalid recommendation label.',
      strengths: [],
      concerns: [],
    }));

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, mockRuleBasedResult.score);
    assert.equal(result.llm, null);
  });

  // 7. Missing API key triggers fallback
  test('7. Missing or empty API key triggers fallback without crashing', async () => {
    const savedKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;

      const result = await analyzeListingCompatibility({
        tenantProfile: mockTenantProfile,
        listing: mockListing,
        ruleBasedResult: mockRuleBasedResult,
      });

      assert.equal(result.source, 'rule_based');
      assert.equal(result.score, mockRuleBasedResult.score);
      assert.equal(result.llm, null);
    } finally {
      if (savedKey !== undefined) {
        process.env.GEMINI_API_KEY = savedKey;
      }
    }
  });

  // 8. Provider/network error triggers fallback
  test('8. Provider network error triggers fallback', async () => {
    setCustomProvider(async () => {
      throw new Error('fetch failed: ENOTFOUND generativelanguage.googleapis.com');
    });

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, mockRuleBasedResult.score);
    assert.equal(result.llm, null);
  });

  // 9. Provider timeout triggers fallback
  test('9. Provider timeout triggers fallback', async () => {
    setCustomProvider(async () => {
      throw new Error('The operation was aborted due to timeout');
    });

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: mockRuleBasedResult,
      timeoutMs: 50,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, mockRuleBasedResult.score);
    assert.equal(result.llm, null);
  });

  // 10. Rule-based score remains available during fallback
  test('10. Rule-based score and breakdown remain intact during any fallback', async () => {
    setCustomProvider(async () => {
      throw new Error('Critical LLM failure');
    });

    const customRuleResult = {
      score: 64,
      breakdown: {
        budget: { score: 18, max: 30 },
        location: { score: 20, max: 25 },
        roomType: { score: 15, max: 15 },
        furnishing: { score: 8, max: 15 },
        moveInDate: { score: 0, max: 10 },
        lifestyle: { score: 3, max: 5 },
      },
    };

    const result = await analyzeListingCompatibility({
      tenantProfile: mockTenantProfile,
      listing: mockListing,
      ruleBasedResult: customRuleResult,
    });

    assert.equal(result.source, 'rule_based');
    assert.equal(result.score, 64);
    assert.deepEqual(result.breakdown, customRuleResult.breakdown);
    assert.equal(result.llm, null);
  });

  // 11. Password/JWT/private fields are not included in the LLM input
  test('11. Password/JWT/private fields are excluded from the LLM input', () => {
    const dirtyProfile = {
      ...mockTenantProfile,
      userId: 'user-uuid-123',
      passwordHash: '$2b$10$supersecretprivatehash12345',
      jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy',
      secretPrivateNotes: 'private medical details',
    };

    const dirtyListing = {
      ...mockListing,
      ownerId: 'owner-uuid-456',
      ownerPasswordHash: '$2b$10$ownersecrethash',
    };

    const structuredInput = buildStructuredLLMInput({
      tenantProfile: dirtyProfile,
      listing: dirtyListing,
      ruleBasedResult: mockRuleBasedResult,
    });

    const serialized = JSON.stringify(structuredInput);

    // Assert sensitive strings are completely absent
    assert.ok(!serialized.includes('supersecretprivatehash12345'));
    assert.ok(!serialized.includes('eyJhbGciOiJIUzI1Ni'));
    assert.ok(!serialized.includes('ownersecrethash'));
    assert.ok(!serialized.includes('passwordHash'));
    assert.ok(!serialized.includes('jwtToken'));

    // Check prompt string as well
    const prompt = buildCompatibilityPrompt(structuredInput);
    assert.ok(!prompt.includes('supersecretprivatehash12345'));
    assert.ok(!prompt.includes('eyJhbGciOiJIUzI1Ni'));
    assert.ok(!prompt.includes('ownersecrethash'));
  });

  // 12. Existing deterministic scoring remains unchanged
  test('12. Existing deterministic scoring remains unchanged and reproducible', () => {
    const score1 = calculateCompatibility(mockTenantProfile, mockListing);
    const score2 = calculateCompatibility(mockTenantProfile, mockListing);

    assert.equal(score1.score, 100);
    assert.equal(score2.score, 100);
    assert.deepEqual(score1.breakdown, score2.breakdown);
  });
});
