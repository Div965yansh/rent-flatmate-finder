process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

describe('Phase 7 Interest Workflow Backend Test Suite', () => {
  let server;
  let baseUrl;

  let adminToken;
  let owner1Token;
  let owner1User;
  let owner2Token;
  let owner2User;
  let tenant1Token;
  let tenant1User;
  let tenant2Token;
  let tenant2User;

  // Test listings
  let availableListing1Id;
  let availableListing2Id;
  let filledListingId;
  let unavailableListingId;
  let owner2ListingId;

  // Tracked interest IDs for cleanup
  const createdInterestIds = [];
  const createdListingIds = [];

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // 1. Authenticate demo users
    const [adminRes, o1Res, o2Res, t1Res, t2Res] = await Promise.all([
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner1@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'owner2@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tenant1@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'tenant2@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
    ]);

    adminToken = adminRes.token;
    owner1Token = o1Res.token;
    owner1User = o1Res.user;
    owner2Token = o2Res.token;
    owner2User = o2Res.user;
    tenant1Token = t1Res.token;
    tenant1User = t1Res.user;
    tenant2Token = t2Res.token;
    tenant2User = t2Res.user;

    // 2. Create dedicated listings for Owner 1
    const l1 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Interest Test Available Listing 1',
        description: 'Prime 2BHK rental for interest tests',
        location: 'Indiranagar, Bangalore',
        rent: 22000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    availableListing1Id = l1.id;
    createdListingIds.push(l1.id);

    const l2 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Interest Test Available Listing 2',
        description: 'Cozy private room for decline test',
        location: 'Koramangala, Bangalore',
        rent: 14000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    availableListing2Id = l2.id;
    createdListingIds.push(l2.id);

    const lFilled = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Interest Test Filled Listing',
        description: 'Already filled rental',
        location: 'HSR Layout, Bangalore',
        rent: 18000,
        availableFrom: new Date('2026-10-01'),
        roomType: 'SHARED',
        furnishing: 'UNFURNISHED',
        status: 'FILLED',
      },
    });
    filledListingId = lFilled.id;
    createdListingIds.push(lFilled.id);

    const lUnavail = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Interest Test Unavailable Listing',
        description: 'Temporarily unavailable rental',
        location: 'Whitefield, Bangalore',
        rent: 19000,
        availableFrom: new Date('2026-12-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'UNAVAILABLE',
      },
    });
    unavailableListingId = lUnavail.id;
    createdListingIds.push(lUnavail.id);

    // 3. Create dedicated listing for Owner 2
    const lOwner2 = await prisma.listing.create({
      data: {
        ownerId: owner2User.id,
        title: 'Owner2 Exclusive Listing',
        description: 'Belongs strictly to owner 2',
        location: 'Jayanagar, Bangalore',
        rent: 25000,
        availableFrom: new Date('2026-11-15'),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    owner2ListingId = lOwner2.id;
    createdListingIds.push(lOwner2.id);
  });

  after(async () => {
    // Clean up created interests
    if (createdInterestIds.length > 0) {
      await prisma.interest.deleteMany({
        where: { id: { in: createdInterestIds } },
      }).catch(() => {});
    }

    // Clean up created listings
    if (createdListingIds.length > 0) {
      await prisma.interest.deleteMany({
        where: { listingId: { in: createdListingIds } },
      }).catch(() => {});
      await prisma.listing.deleteMany({
        where: { id: { in: createdListingIds } },
      }).catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Unauthenticated request rejected
  test('1. Unauthenticated tenant interest request rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId: availableListing1Id }),
    });
    assert.strictEqual(res.status, 401);
  });

  // 2. OWNER cannot create interest
  test('2. OWNER cannot create interest (403)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({ listingId: availableListing1Id }),
    });
    assert.strictEqual(res.status, 403);
  });

  // 3. ADMIN cannot create interest
  test('3. ADMIN cannot create interest (403)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ listingId: availableListing1Id }),
    });
    assert.strictEqual(res.status, 403);
  });

  // 4. TENANT can create interest for AVAILABLE listing
  let tenant1Interest1Id;
  test('4. TENANT can create interest for AVAILABLE listing (201)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: availableListing1Id }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.interest);
    assert.strictEqual(data.interest.listingId, availableListing1Id);
    assert.strictEqual(data.interest.tenantId, tenant1User.id);
    tenant1Interest1Id = data.interest.id;
    createdInterestIds.push(tenant1Interest1Id);
  });

  // 5. Created interest starts as PENDING
  test('5. Created interest starts as PENDING', async () => {
    const interest = await prisma.interest.findUnique({
      where: { id: tenant1Interest1Id },
    });
    assert.ok(interest);
    assert.strictEqual(interest.status, 'PENDING');
  });

  // 6. Tenant cannot create duplicate interest
  test('6. Tenant cannot create duplicate interest (409)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: availableListing1Id }),
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('already'));
  });

  // 7. Tenant cannot interest in FILLED listing
  test('7. Tenant cannot interest in FILLED listing (400)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: filledListingId }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('filled'));
  });

  // 8. Tenant cannot interest in UNAVAILABLE listing
  test('8. Tenant cannot interest in UNAVAILABLE listing (400)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: unavailableListingId }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('unavailable'));
  });

  // 9. Tenant cannot interest in nonexistent listing
  test('9. Tenant cannot interest in nonexistent listing (404)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: '00000000-0000-0000-0000-000000000000' }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 10. Tenant can retrieve own interests
  test('10. Tenant can retrieve own interests via GET /interests/mine (200)', async () => {
    const res = await fetch(`${baseUrl}/interests/mine`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.interests));
    const found = data.interests.find((i) => i.id === tenant1Interest1Id);
    assert.ok(found);
    assert.strictEqual(found.listing.id, availableListing1Id);
    assert.ok(found.listing.title);
  });

  // 11. Tenant cannot retrieve another tenant's interests
  test("11. Tenant cannot retrieve another tenant's interests", async () => {
    const res = await fetch(`${baseUrl}/interests/mine`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.interests));
    const found = data.interests.find((i) => i.id === tenant1Interest1Id);
    assert.strictEqual(found, undefined, "Tenant 2 should not see Tenant 1's interests");
  });

  // 12. OWNER can retrieve inbox for their own listings
  test('12. OWNER can retrieve inbox for their own listings (200)', async () => {
    const res = await fetch(`${baseUrl}/interests/inbox`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.interests));
    const found = data.interests.find((i) => i.id === tenant1Interest1Id);
    assert.ok(found, "Owner 1 should see tenant1's interest for their listing");
    assert.strictEqual(found.tenant.email, 'tenant1@example.com');
  });

  // 13. OWNER cannot retrieve another owner's inbox
  test("13. OWNER cannot retrieve another owner's inbox", async () => {
    const res = await fetch(`${baseUrl}/interests/inbox`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.interests));
    const found = data.interests.find((i) => i.id === tenant1Interest1Id);
    assert.strictEqual(found, undefined, "Owner 2 should not see Owner 1's listing interests");
  });

  // 14. OWNER can accept own listing's pending interest
  test("14. OWNER can accept own listing's pending interest (200)", async () => {
    const res = await fetch(`${baseUrl}/interests/${tenant1Interest1Id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.interest);
    assert.strictEqual(data.interest.status, 'ACCEPTED');

    // Confirm in DB
    const dbInterest = await prisma.interest.findUnique({
      where: { id: tenant1Interest1Id },
    });
    assert.strictEqual(dbInterest.status, 'ACCEPTED');
  });

  // 15. OWNER can decline own listing's pending interest
  let tenant1Interest2Id;
  test("15. OWNER can decline own listing's pending interest (200)", async () => {
    // Tenant1 creates interest for availableListing2
    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: availableListing2Id }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    tenant1Interest2Id = createData.interest.id;
    createdInterestIds.push(tenant1Interest2Id);

    // Owner declines it
    const declineRes = await fetch(`${baseUrl}/interests/${tenant1Interest2Id}/decline`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(declineRes.status, 200);
    const declineData = await declineRes.json();
    assert.strictEqual(declineData.interest.status, 'DECLINED');

    // Confirm in DB
    const dbInterest = await prisma.interest.findUnique({
      where: { id: tenant1Interest2Id },
    });
    assert.strictEqual(dbInterest.status, 'DECLINED');
  });

  // 16. OWNER cannot accept another owner's interest
  let tenant1Owner2InterestId;
  test("16. OWNER cannot accept another owner's interest (403)", async () => {
    // Tenant 1 expresses interest in Owner 2's listing
    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: owner2ListingId }),
    });
    assert.strictEqual(createRes.status, 201);
    const createData = await createRes.json();
    tenant1Owner2InterestId = createData.interest.id;
    createdInterestIds.push(tenant1Owner2InterestId);

    // Owner 1 attempts to accept Owner 2's interest
    const res = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 17. OWNER cannot decline another owner's interest
  test("17. OWNER cannot decline another owner's interest (403)", async () => {
    // Owner 1 attempts to decline Owner 2's interest
    const res = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/decline`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 18. TENANT cannot accept interest
  test('18. TENANT cannot accept interest (403)', async () => {
    const res = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 19. TENANT cannot decline interest
  test('19. TENANT cannot decline interest (403)', async () => {
    const res = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/decline`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 20. ADMIN cannot accept/decline interest through these endpoints
  test('20. ADMIN cannot accept/decline interest through these endpoints (403)', async () => {
    const acceptRes = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(acceptRes.status, 403);

    const declineRes = await fetch(`${baseUrl}/interests/${tenant1Owner2InterestId}/decline`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(declineRes.status, 403);
  });

  // 21. Already accepted interest cannot be accepted again
  test('21. Already accepted interest cannot be accepted again (409)', async () => {
    const res = await fetch(`${baseUrl}/interests/${tenant1Interest1Id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('already'));
  });

  // 22. Already declined interest cannot be declined again
  test('22. Already declined interest cannot be declined again (409)', async () => {
    const res = await fetch(`${baseUrl}/interests/${tenant1Interest2Id}/decline`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('already'));
  });

  // 23. Declined interest cannot be re-created for same tenant/listing
  test('23. Declined interest cannot be re-created for same tenant/listing (409)', async () => {
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: availableListing2Id }),
    });
    assert.strictEqual(res.status, 409);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('already'));
  });

  // 24. Filled listing pending interest cannot be accepted
  test('24. Filled listing pending interest cannot be accepted (409)', async () => {
    // Create an interest while listing is available
    const tempListing = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Listing to be filled',
        description: 'Listing that gets filled before accepting',
        location: 'Marathahalli, Bangalore',
        rent: 16000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    createdListingIds.push(tempListing.id);

    const intRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ listingId: tempListing.id }),
    });
    assert.strictEqual(intRes.status, 201);
    const intData = await intRes.json();
    createdInterestIds.push(intData.interest.id);

    // Owner marks listing as FILLED
    await prisma.listing.update({
      where: { id: tempListing.id },
      data: { status: 'FILLED' },
    });

    // Owner attempts to accept the interest for now-filled listing
    const acceptRes = await fetch(`${baseUrl}/interests/${intData.interest.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert.strictEqual(acceptRes.status, 409);
    const acceptData = await acceptRes.json();
    assert.ok(acceptData.error.toLowerCase().includes('filled'));
  });

  // 25. Response does not expose passwordHash
  test('25. Response does not expose passwordHash in any interest endpoint', async () => {
    // Check GET /interests/mine
    const mineRes = await fetch(`${baseUrl}/interests/mine`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const mineData = await mineRes.json();
    const rawMineStr = JSON.stringify(mineData);
    assert.strictEqual(rawMineStr.includes('passwordHash'), false);
    assert.strictEqual(rawMineStr.includes('password'), false);

    // Check GET /interests/inbox
    const inboxRes = await fetch(`${baseUrl}/interests/inbox`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const inboxData = await inboxRes.json();
    const rawInboxStr = JSON.stringify(inboxData);
    assert.strictEqual(rawInboxStr.includes('passwordHash'), false);
    assert.strictEqual(rawInboxStr.includes('password'), false);
  });

  // 26. Malformed input validation fails gracefully with 400
  test('26. Malformed input validation fails gracefully with 400', async () => {
    const emptyBodyRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({}),
    });
    assert.strictEqual(emptyBodyRes.status, 400);

    const emptyListingIdRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: '   ' }),
    });
    assert.strictEqual(emptyListingIdRes.status, 400);
  });
});
