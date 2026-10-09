process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';
import { setCustomProvider, resetCustomProvider } from '../src/services/llm/llm.provider.js';

describe('Phase 5 Rule-Based Compatibility Engine Test Suite', () => {
  let server;
  let baseUrl;
  let ownerToken;
  let adminToken;
  let tenant1Token;
  let tenant1User;
  let tenant2Token;
  let tenant2User;
  let noProfileTenantToken;
  let noProfileTenantUser;

  let testListing1;
  let testListingFar;
  let testListingFilled;
  let createdUserIds = [];
  let createdListingIds = [];

  before(async () => {
    // 1. Start server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // 2. Obtain tokens for seeded accounts
    const ownerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner1@example.com', password: DEMO_PASSWORD }),
    });
    const ownerData = await ownerRes.json();
    ownerToken = ownerData.token;

    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: DEMO_PASSWORD }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    const t1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant1@example.com', password: DEMO_PASSWORD }),
    });
    const t1Data = await t1Res.json();
    tenant1Token = t1Data.token;
    tenant1User = t1Data.user;

    const t2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant2@example.com', password: DEMO_PASSWORD }),
    });
    const t2Data = await t2Res.json();
    tenant2Token = t2Data.token;
    tenant2User = t2Data.user;

    // 3. Create a tenant without profile for testing
    const timestamp = Date.now();
    const noProfileEmail = `noprofile_${timestamp}@example.com`;
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'No Profile Tenant',
        email: noProfileEmail,
        password: DEMO_PASSWORD,
        role: 'TENANT',
      }),
    });
    const regData = await regRes.json();
    noProfileTenantToken = regData.token;
    noProfileTenantUser = regData.user;
    createdUserIds.push(noProfileTenantUser.id);

    // 4. Create standard test listings
    const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });

    testListing1 = await prisma.listing.create({
      data: {
        ownerId: owner.id,
        title: 'Perfect Match Studio Indiranagar',
        description: 'Quiet smoke-free living with pet friendly policy and no smoking permitted.',
        location: 'Indiranagar, Bangalore',
        rent: 15000,
        availableFrom: new Date('2026-10-15'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    createdListingIds.push(testListing1.id);

    testListingFar = await prisma.listing.create({
      data: {
        ownerId: owner.id,
        title: 'Expensive Shared Space Noida',
        description: 'Loud party house smoking allowed.',
        location: 'Noida Sector 62',
        rent: 40000,
        availableFrom: new Date('2026-12-25'),
        roomType: 'SHARED',
        furnishing: 'UNFURNISHED',
        status: 'AVAILABLE',
      },
    });
    createdListingIds.push(testListingFar.id);

    testListingFilled = await prisma.listing.create({
      data: {
        ownerId: owner.id,
        title: 'Filled Apartment Indiranagar',
        description: 'Occupied apartment',
        location: 'Indiranagar, Bangalore',
        rent: 15000,
        availableFrom: new Date('2026-10-15'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'FILLED',
      },
    });
    createdListingIds.push(testListingFilled.id);

    // 5. Setup tenant1 profile for matching
    await prisma.tenantProfile.upsert({
      where: { userId: tenant1User.id },
      update: {
        preferredLocation: 'Indiranagar, Bangalore',
        budgetMin: 12000,
        budgetMax: 18000,
        moveInDate: new Date('2026-11-01'),
        preferredRoomType: 'SINGLE',
        preferredFurnishing: 'FULLY_FURNISHED',
        lifestyle: {
          nonSmoking: true,
          pets: true,
          quiet: true,
          tags: ['Non-Smoking', 'Pet Friendly', 'Quiet Living'],
        },
        notes: 'Looking for a calm, quiet place.',
      },
      create: {
        userId: tenant1User.id,
        preferredLocation: 'Indiranagar, Bangalore',
        budgetMin: 12000,
        budgetMax: 18000,
        moveInDate: new Date('2026-11-01'),
        preferredRoomType: 'SINGLE',
        preferredFurnishing: 'FULLY_FURNISHED',
        lifestyle: {
          nonSmoking: true,
          pets: true,
          quiet: true,
          tags: ['Non-Smoking', 'Pet Friendly', 'Quiet Living'],
        },
        notes: 'Looking for a calm, quiet place.',
      },
    });

    // 6. Setup tenant2 with different profile
    await prisma.tenantProfile.upsert({
      where: { userId: tenant2User.id },
      update: {
        preferredLocation: 'Noida Sector 62',
        budgetMin: 35000,
        budgetMax: 45000,
        moveInDate: new Date('2027-01-01'),
        preferredRoomType: 'SHARED',
        preferredFurnishing: 'UNFURNISHED',
        lifestyle: {
          smoking: true,
          tags: ['Smoking Friendly'],
        },
      },
      create: {
        userId: tenant2User.id,
        preferredLocation: 'Noida Sector 62',
        budgetMin: 35000,
        budgetMax: 45000,
        moveInDate: new Date('2027-01-01'),
        preferredRoomType: 'SHARED',
        preferredFurnishing: 'UNFURNISHED',
        lifestyle: {
          smoking: true,
          tags: ['Smoking Friendly'],
        },
      },
    });
  });

  after(async () => {
    // Clean up created records
    if (createdListingIds.length > 0) {
      await prisma.compatibilityScore.deleteMany({
        where: { listingId: { in: createdListingIds } },
      }).catch(() => {});

      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
      }).catch(() => {});
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }

    resetCustomProvider();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Unauthenticated user rejected
  test('1. Unauthenticated user rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`);
    assert.equal(res.status, 401);
  });

  // 2. OWNER rejected
  test('2. OWNER rejected from compatibility endpoint (403)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 403);
  });

  // 3. ADMIN rejected
  test('3. ADMIN rejected from compatibility endpoint (403)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 403);
  });

  // 4. TENANT without profile gets appropriate error
  test('4. TENANT without profile gets appropriate 404 error', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${noProfileTenantToken}` },
    });
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.match(data.error, /tenant profile not found/i);
  });

  // 5. TENANT with profile can calculate compatibility
  test('5. TENANT with profile can calculate compatibility (200)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.score === 'number');
    assert.ok(data.breakdown);
    assert.ok(data.breakdown.budget);
    assert.ok(data.breakdown.location);
    assert.ok(data.breakdown.roomType);
    assert.ok(data.breakdown.furnishing);
    assert.ok(data.breakdown.moveInDate);
    assert.ok(data.breakdown.lifestyle);
  });

  // 6. Matching budget receives expected budget points
  test('6. Matching budget receives expected budget points (30)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.budget.score, 30);
    assert.equal(data.breakdown.budget.max, 30);
  });

  // 7. Non-matching budget receives lower/zero budget points
  test('7. Non-matching budget receives lower/zero budget points (0)', async () => {
    // testListingFar rent is 40000, tenant1 budget is 12000-18000 (significantly over budget)
    const res = await fetch(`${baseUrl}/compatibility/${testListingFar.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.budget.score, 0);
  });

  // 8. Matching location receives expected location points
  test('8. Matching location receives expected location points (25)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.location.score, 25);
    assert.equal(data.breakdown.location.max, 25);
  });

  // 9. Non-matching location receives lower/zero points
  test('9. Non-matching location receives lower/zero points (0)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListingFar.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.location.score, 0);
  });

  // 10. Matching room type receives full room points
  test('10. Matching room type receives full room points (15)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.roomType.score, 15);
    assert.equal(data.breakdown.roomType.max, 15);
  });

  // 11. Matching furnishing receives full furnishing points
  test('11. Matching furnishing receives full furnishing points (15)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.equal(data.breakdown.furnishing.score, 15);
    assert.equal(data.breakdown.furnishing.max, 15);
  });

  // 12. Compatible move-in date receives full date points
  test('12. Compatible move-in date receives full date points (10)', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    // testListing1 available Oct 15 <= tenant moveIn Nov 1 -> 10 points
    assert.equal(data.breakdown.moveInDate.score, 10);
    assert.equal(data.breakdown.moveInDate.max, 10);
  });

  // 13. Lifestyle preferences affect the lifestyle score deterministically
  test('13. Lifestyle preferences affect the lifestyle score deterministically', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    // Non-smoking + pet friendly match in description -> 5 points
    assert.equal(data.breakdown.lifestyle.score, 5);
    assert.equal(data.breakdown.lifestyle.max, 5);
  });

  // 14. Final score never exceeds 100
  test('14. Final score never exceeds 100', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.ok(data.score <= 100);
    assert.equal(data.score, 100); // 30+25+15+15+10+5 = 100
  });

  // 15. Final score never goes below 0
  test('15. Final score never goes below 0', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListingFar.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    assert.ok(data.score >= 0);
  });

  // 16. Breakdown totals correctly equal the final score
  test('16. Breakdown totals correctly equal the final score', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();
    const bd = data.breakdown;
    const computedSum =
      bd.budget.score +
      bd.location.score +
      bd.roomType.score +
      bd.furnishing.score +
      bd.moveInDate.score +
      bd.lifestyle.score;
    assert.equal(data.score, computedSum);
  });

  // 17. CompatibilityScore is persisted in PostgreSQL
  test('17. CompatibilityScore is persisted in PostgreSQL', async () => {
    const record = await prisma.compatibilityScore.findUnique({
      where: {
        tenantId_listingId: {
          tenantId: tenant1User.id,
          listingId: testListing1.id,
        },
      },
    });
    assert.ok(record, 'CompatibilityScore record must exist in PostgreSQL');
    assert.equal(record.score, 100);
    assert.ok(record.breakdown);
  });

  // 18. Repeated request produces the same score
  test('18. Repeated request produces the same score (deterministic)', async () => {
    const res1 = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data1 = await res1.json();

    const res2 = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data2 = await res2.json();

    assert.equal(data1.score, data2.score);
    assert.deepEqual(data1.breakdown, data2.breakdown);
  });

  // 19. Updating tenant profile changes the recalculated score when relevant
  test('19. Updating tenant profile changes recalculated score', async () => {
    // Update tenant1 profile location from Bangalore to Mumbai
    await prisma.tenantProfile.update({
      where: { userId: tenant1User.id },
      data: { preferredLocation: 'Mumbai' },
    });

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const data = await res.json();

    // Location score drops from 25 to 0, total score drops from 100 to 75
    assert.equal(data.breakdown.location.score, 0);
    assert.equal(data.score, 75);

    // Restore location back to Bangalore
    await prisma.tenantProfile.update({
      where: { userId: tenant1User.id },
      data: { preferredLocation: 'Indiranagar, Bangalore' },
    });
  });

  // 20. Another tenant cannot access another tenant's compatibility score
  test("20. Tenant requests calculate only for the authenticated tenant's identity", async () => {
    // Tenant 2 requests compatibility for testListingFar (Noida listing)
    const res2 = await fetch(`${baseUrl}/compatibility/${testListingFar.id}`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    const data2 = await res2.json();

    // Check tenant2 record in DB
    const recordT2 = await prisma.compatibilityScore.findUnique({
      where: {
        tenantId_listingId: {
          tenantId: tenant2User.id,
          listingId: testListingFar.id,
        },
      },
    });
    assert.ok(recordT2);
    assert.equal(recordT2.tenantId, tenant2User.id);
    assert.equal(recordT2.score, data2.score);

    // Verify nonexistent listing returns 404
    const nonExistentRes = await fetch(`${baseUrl}/compatibility/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(nonExistentRes.status, 404);
  });

  // 21. TENANT can request batch compatibility scores (200)
  test('21. TENANT can request batch compatibility scores (200)', async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores);
    assert.ok(data.scores[testListing1.id]);
    assert.equal(data.scores[testListing1.id].score, 100);
  });

  // 22. OWNER cannot request batch compatibility scores (403)
  test('22. OWNER cannot request batch compatibility scores (403)', async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListing1.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 403);
  });

  // 23. ADMIN cannot request batch compatibility scores (403)
  test('23. ADMIN cannot request batch compatibility scores (403)', async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListing1.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 403);
  });

  // 24. Unauthenticated batch compatibility request rejected (401)
  test('24. Unauthenticated batch compatibility request rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListing1.id}`);
    assert.equal(res.status, 401);
  });

  // 25. Tenant without profile gets appropriate response in batch (404)
  test('25. Tenant without profile gets appropriate response in batch (404)', async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListing1.id}`, {
      headers: { Authorization: `Bearer ${noProfileTenantToken}` },
    });
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.match(data.error, /tenant profile not found/i);
  });

  // 26. Multiple listing scores returned in batch keyed by listing ID
  test('26. Multiple listing scores returned in batch keyed by listing ID', async () => {
    const res = await fetch(
      `${baseUrl}/compatibility?listingIds=${testListing1.id},${testListingFar.id}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores);
    assert.ok(data.scores[testListing1.id]);
    assert.ok(data.scores[testListingFar.id]);
    assert.equal(data.scores[testListing1.id].score, 100);
    assert.ok(typeof data.scores[testListingFar.id].score === 'number');
  });

  // 27. Only AVAILABLE listings are scored (FILLED listing excluded)
  test('27. Only AVAILABLE listings are scored (FILLED listing excluded)', async () => {
    const res = await fetch(
      `${baseUrl}/compatibility?listingIds=${testListing1.id},${testListingFilled.id}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores[testListing1.id]);
    assert.equal(data.scores[testListingFilled.id], undefined, 'FILLED listing must not be scored in batch');
  });

  // 28. Invalid/nonexistent listing IDs handled safely without crashing
  test('28. Invalid/nonexistent listing IDs handled safely without crashing', async () => {
    const invalidId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(
      `${baseUrl}/compatibility?listingIds=${testListing1.id},${invalidId}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores[testListing1.id]);
    assert.equal(data.scores[invalidId], undefined);
  });

  // 29. Another tenant requests batch compatibility for their own profile identity
  test("29. Another tenant requests batch compatibility for their own profile identity", async () => {
    const res = await fetch(`${baseUrl}/compatibility?listingIds=${testListingFar.id}`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores[testListingFar.id]);

    // Check DB record for tenant2
    const record = await prisma.compatibilityScore.findUnique({
      where: {
        tenantId_listingId: {
          tenantId: tenant2User.id,
          listingId: testListingFar.id,
        },
      },
    });
    assert.ok(record);
    assert.equal(record.tenantId, tenant2User.id);
  });

  // 30. Existing single-listing compatibility endpoint still works
  test('30. Existing single-listing compatibility endpoint still works', async () => {
    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.score, 100);
    assert.ok(data.breakdown);
  });

  // 31. Single listing with valid LLM response returns source "llm" and full explanation
  test('31. Single listing with valid LLM response returns source "llm" and explanation', async () => {
    setCustomProvider(async () => ({
      recommendation: 'excellent',
      score: 95,
      summary: 'Outstanding match for this quiet studio apartment.',
      strengths: ['Within budget', 'Pet-friendly', 'Exact location match'],
      concerns: ['Available slightly before target move-in date'],
    }));

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'llm');
    assert.equal(data.score, 95);
    assert.equal(data.llm.recommendation, 'excellent');
    assert.equal(data.llm.summary, 'Outstanding match for this quiet studio apartment.');
    assert.equal(data.llm.strengths.length, 3);
    assert.equal(data.llm.concerns.length, 1);
    assert.ok(data.breakdown);
    assert.equal(data.breakdown.budget.score, 30);
    resetCustomProvider();
  });

  // 32. Successful LLM score is persisted in CompatibilityScore database table
  test('32. Successful LLM score is persisted in CompatibilityScore table', async () => {
    setCustomProvider(async () => ({
      recommendation: 'excellent',
      score: 95,
      summary: 'Persisted LLM test.',
      strengths: ['Great rent'],
      concerns: [],
    }));

    await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });

    const record = await prisma.compatibilityScore.findUnique({
      where: {
        tenantId_listingId: {
          tenantId: tenant1User.id,
          listingId: testListing1.id,
        },
      },
    });
    assert.ok(record);
    assert.equal(record.score, 95);
    assert.ok(record.breakdown);
    resetCustomProvider();
  });

  // 33. Missing API key falls back to rule-based score
  test('33. Missing API key falls back to rule-based score', async () => {
    resetCustomProvider();
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.source, 'rule_based');
      assert.equal(data.score, 100);
      assert.equal(data.llm, null);
      assert.ok(data.breakdown);
    } finally {
      if (savedKey !== undefined) {
        process.env.GEMINI_API_KEY = savedKey;
      }
    }
  });

  // 34. Provider error falls back to rule-based score
  test('34. Provider error falls back to rule-based score', async () => {
    setCustomProvider(async () => {
      throw new Error('API quota exceeded / network error');
    });

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'rule_based');
    assert.equal(data.score, 100);
    assert.equal(data.llm, null);
    resetCustomProvider();
  });

  // 35. Provider timeout falls back to rule-based score
  test('35. Provider timeout falls back to rule-based score', async () => {
    setCustomProvider(async () => {
      throw new Error('The operation was aborted due to timeout');
    });

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'rule_based');
    assert.equal(data.score, 100);
    assert.equal(data.llm, null);
    resetCustomProvider();
  });

  // 36. Malformed LLM response falls back to rule-based score
  test('36. Malformed LLM response falls back to rule-based score', async () => {
    setCustomProvider(async () => {
      throw new Error('Failed to parse Gemini response as JSON');
    });

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'rule_based');
    assert.equal(data.score, 100);
    assert.equal(data.llm, null);
    resetCustomProvider();
  });

  // 37. Invalid LLM response (score > 100 or bad enum) falls back to rule-based score
  test('37. Invalid LLM response falls back to rule-based score', async () => {
    setCustomProvider(async () => ({
      recommendation: 'super-high',
      score: 999,
      summary: 'Invalid score and enum',
      strengths: [],
      concerns: [],
    }));

    const res = await fetch(`${baseUrl}/compatibility/${testListing1.id}`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.source, 'rule_based');
    assert.equal(data.score, 100);
    assert.equal(data.llm, null);
    resetCustomProvider();
  });

  // 38. Batch endpoint returns mixed results when one LLM call succeeds and another fails
  test('38. Batch endpoint returns mixed results when one LLM succeeds and another fails', async () => {
    setCustomProvider(async ({ prompt }) => {
      if (prompt.includes('Sunny Studio in Indiranagar') || prompt.includes('Perfect Match Studio Indiranagar')) {
        return {
          recommendation: 'excellent',
          score: 92,
          summary: 'Excellent match',
          strengths: ['Great location'],
          concerns: [],
        };
      }
      throw new Error('Rate limit exceeded for second listing');
    });

    const res = await fetch(
      `${baseUrl}/compatibility?listingIds=${testListing1.id},${testListingFar.id}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.scores);

    // Listing 1 succeeded with LLM
    assert.equal(data.scores[testListing1.id].source, 'llm');
    assert.equal(data.scores[testListing1.id].score, 92);
    assert.ok(data.scores[testListing1.id].llm);

    // Listing 2 failed LLM -> fell back to rule-based without breaking the batch
    assert.equal(data.scores[testListingFar.id].source, 'rule_based');
    assert.equal(data.scores[testListingFar.id].llm, null);
    assert.ok(typeof data.scores[testListingFar.id].score === 'number');
    resetCustomProvider();
  });

  // 39. Batch endpoint never fails entirely because of LLM failure
  test('39. Batch endpoint never fails entirely because of LLM failure', async () => {
    setCustomProvider(async () => {
      throw new Error('Global LLM outage');
    });

    const res = await fetch(
      `${baseUrl}/compatibility?listingIds=${testListing1.id},${testListingFar.id}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.scores[testListing1.id].source, 'rule_based');
    assert.equal(data.scores[testListingFar.id].source, 'rule_based');
    assert.equal(data.scores[testListing1.id].score, 100);
    resetCustomProvider();
  });
});
