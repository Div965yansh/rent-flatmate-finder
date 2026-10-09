process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

describe('Phase 8 — Step 1: Chat Backend — Database + REST API Test Suite', () => {
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

  let testListing1Id;
  let testListing2Id;

  let acceptedInterestId;
  let pendingInterestId;
  let declinedInterestId;

  const createdMessageIds = [];
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

    // 1. Authenticate demo accounts
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

    // 2. Create test listings for Owner 1
    const l1 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Chat Test Luxury Apartment',
        description: 'Listing for conversation testing',
        location: 'Indiranagar, Bangalore',
        rent: 28000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    testListing1Id = l1.id;
    createdListingIds.push(l1.id);

    const l2 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Chat Test Private Studio',
        description: 'Second listing for conversation testing',
        location: 'Koramangala, Bangalore',
        rent: 17000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    testListing2Id = l2.id;
    createdListingIds.push(l2.id);

    // 3. Create test interests
    // Interest 1: ACCEPTED interest between tenant1 and owner1
    const intAccepted = await prisma.interest.create({
      data: {
        tenantId: tenant1User.id,
        listingId: testListing1Id,
        status: 'ACCEPTED',
      },
    });
    acceptedInterestId = intAccepted.id;
    createdInterestIds.push(intAccepted.id);

    // Interest 2: PENDING interest between tenant2 and owner1
    const intPending = await prisma.interest.create({
      data: {
        tenantId: tenant2User.id,
        listingId: testListing1Id,
        status: 'PENDING',
      },
    });
    pendingInterestId = intPending.id;
    createdInterestIds.push(intPending.id);

    // Interest 3: DECLINED interest between tenant2 and owner1
    const intDeclined = await prisma.interest.create({
      data: {
        tenantId: tenant2User.id,
        listingId: testListing2Id,
        status: 'DECLINED',
      },
    });
    declinedInterestId = intDeclined.id;
    createdInterestIds.push(intDeclined.id);
  });

  after(async () => {
    try {
      const validMsgIds = createdMessageIds.filter(Boolean);
      if (validMsgIds.length > 0) {
        await prisma.message.deleteMany({
          where: { id: { in: validMsgIds } },
        });
      }
      const validIntIds = createdInterestIds.filter(Boolean);
      if (validIntIds.length > 0) {
        await prisma.message.deleteMany({
          where: { interestId: { in: validIntIds } },
        });
        await prisma.interest.deleteMany({
          where: { id: { in: validIntIds } },
        });
      }
      const validListingIds = createdListingIds.filter(Boolean);
      if (validListingIds.length > 0) {
        await prisma.listing.deleteMany({
          where: { id: { in: validListingIds } },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // =========================================================================
  // SECTION 1: Message Creation & Database Persistence
  // =========================================================================

  test('1. Valid message can be created for ACCEPTED interest by tenant participant (201)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Hello! I am excited about your listing. Is it available for a visit?',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.message);
    assert.equal(data.message.interestId, acceptedInterestId);
    assert.equal(data.message.senderId, tenant1User.id);
    assert.equal(
      data.message.body,
      'Hello! I am excited about your listing. Is it available for a visit?'
    );
    assert.ok(data.message.createdAt);
    createdMessageIds.push(data.message.id);

    // Verify record in PostgreSQL database
    const inDb = await prisma.message.findUnique({
      where: { id: data.message.id },
    });
    assert.ok(inDb);
    assert.equal(inDb.interestId, acceptedInterestId);
    assert.equal(inDb.senderId, tenant1User.id);
  });

  test('2. Valid message can be created for ACCEPTED interest by owner participant (201)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Welcome! Yes, you can come by this Saturday afternoon.',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.message);
    assert.equal(data.message.interestId, acceptedInterestId);
    assert.equal(data.message.senderId, owner1User.id);
    createdMessageIds.push(data.message.id);
  });

  // =========================================================================
  // SECTION 2: Conversation Authorization (Server-side Enforcement)
  // =========================================================================

  test('3. Unauthenticated request to send message is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Unauthenticated message',
      }),
    });

    assert.equal(res.status, 401);
  });

  test('4. Unrelated tenant cannot send message to another tenant/owner conversation (403)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`, // Tenant 2 is NOT a participant
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Intruder message from Tenant 2',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('5. Unrelated owner cannot send message to another owner listing conversation (403)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner2Token}`, // Owner 2 does NOT own listing 1
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Intruder message from Owner 2',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('6. Admin cannot send message as a conversation participant (403)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: 'Admin message attempt',
      }),
    });

    assert.equal(res.status, 403);
  });

  // =========================================================================
  // SECTION 3: Interest State Authorization
  // =========================================================================

  test('7. PENDING interest cannot send messages (403)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        interestId: pendingInterestId,
        body: 'Attempt to message before acceptance',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('8. DECLINED interest cannot send messages (403)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        interestId: declinedInterestId,
        body: 'Attempt to message after decline',
      }),
    });

    assert.equal(res.status, 403);
  });

  // =========================================================================
  // SECTION 4: Reading Messages & Authorization
  // =========================================================================

  test('9. Accepted tenant participant can read conversation messages (200)', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.messages));
    assert.equal(data.messages.length, 2);
    // Messages must be ordered createdAt ASC
    const firstDate = new Date(data.messages[0].createdAt).getTime();
    const secondDate = new Date(data.messages[1].createdAt).getTime();
    assert.ok(firstDate <= secondDate);
  });

  test('10. Accepted owner participant can read conversation messages (200)', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.messages));
    assert.equal(data.messages.length, 2);
  });

  test('11. Unrelated tenant cannot read conversation messages (403)', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant2Token}`,
      },
    });

    assert.equal(res.status, 403);
  });

  test('12. Unrelated owner cannot read conversation messages (403)', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${owner2Token}`,
      },
    });

    assert.equal(res.status, 403);
  });

  test('13. Admin cannot read conversation messages (403)', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert.equal(res.status, 403);
  });

  test('14. Nonexistent interestId returns 404', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${baseUrl}/messages/${fakeUuid}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 404);
  });

  // =========================================================================
  // SECTION 5: Input Validation & Sanitization
  // =========================================================================

  test('15. Empty message body is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: '',
      }),
    });

    assert.equal(res.status, 400);
  });

  test('16. Whitespace-only message body is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: '     \n  \t   ',
      }),
    });

    assert.equal(res.status, 400);
  });

  test('17. Oversized message body (>2000 chars) is rejected (400)', async () => {
    const oversizedBody = 'a'.repeat(2001);
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        interestId: acceptedInterestId,
        body: oversizedBody,
      }),
    });

    assert.equal(res.status, 400);
  });

  test('18. Missing or empty interestId is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        interestId: '',
        body: 'Valid body text',
      }),
    });

    assert.equal(res.status, 400);
  });

  // =========================================================================
  // SECTION 6: Data Safety & Credential Protection
  // =========================================================================

  test('19. Responses never expose passwordHash, tokens, or private secrets', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const text = await res.text();
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('password'), false);
    assert.equal(text.includes('JWT'), false);
    assert.equal(text.includes('RESEND'), false);
  });

  // =========================================================================
  // SECTION 7: Pagination
  // =========================================================================

  test('20. Default pagination returns expected metadata', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.pagination);
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.limit, 50);
    assert.equal(data.pagination.total, 2);
    assert.equal(data.pagination.hasMore, false);
  });

  test('21. Custom page and limit work correctly', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}?page=1&limit=1`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.messages.length, 1);
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.limit, 1);
    assert.equal(data.pagination.total, 2);
    assert.equal(data.pagination.hasMore, true);
  });

  test('22. Limit is capped at 100 maximum', async () => {
    const res = await fetch(`${baseUrl}/messages/${acceptedInterestId}?page=1&limit=500`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenant1Token}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.pagination.limit, 100);
  });
});
