process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

describe('Phase 9 Admin Dashboard & Platform Management Test Suite', () => {
  let server;
  let baseUrl;

  let adminToken;
  let adminUser;
  let ownerToken;
  let ownerUser;
  let tenantToken;
  let tenantUser;

  // Track created entities for cleanup
  let testListingId;
  let testInterestId;
  let testDeactivateUserId;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // 1. Authenticate demo users
    const [adminRes, ownerRes, tenantRes] = await Promise.all([
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
        body: JSON.stringify({ email: 'tenant1@example.com', password: DEMO_PASSWORD }),
      }).then((r) => r.json()),
    ]);

    adminToken = adminRes.token;
    adminUser = adminRes.user;
    ownerToken = ownerRes.token;
    ownerUser = ownerRes.user;
    tenantToken = tenantRes.token;
    tenantUser = tenantRes.user;

    // 2. Create dedicated listing and interest for admin monitoring tests
    const listing = await prisma.listing.create({
      data: {
        ownerId: ownerUser.id,
        title: 'Admin Test Luxury Penthouse',
        description: 'Penthouse used for admin listing moderation tests.',
        location: 'Central Avenue',
        rent: 45000,
        availableFrom: new Date(),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    testListingId = listing.id;

    const interest = await prisma.interest.create({
      data: {
        tenantId: tenantUser.id,
        listingId: testListingId,
        status: 'PENDING',
      },
    });
    testInterestId = interest.id;

    // 3. Create a disposable user for activation/deactivation testing
    const disposable = await prisma.user.create({
      data: {
        name: 'Disposable User',
        email: `disposable_${Date.now()}@example.com`,
        passwordHash: 'dummy_hash',
        role: 'TENANT',
        isActive: true,
      },
    });
    testDeactivateUserId = disposable.id;
  });

  after(async () => {
    // Clean up created entities
    if (testInterestId) {
      await prisma.interest.deleteMany({ where: { id: testInterestId } });
    }
    if (testListingId) {
      await prisma.listing.deleteMany({ where: { id: testListingId } });
    }
    if (testDeactivateUserId) {
      await prisma.user.deleteMany({ where: { id: testDeactivateUserId } });
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ================= 1. AUTHENTICATION & AUTHORIZATION =================
  test('1. Unauthenticated request to GET /api/admin/stats is rejected (401)', async () => {
    const res = await fetch(`${baseUrl}/admin/stats`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.match(data.error, /token required|authentication/i);
  });

  test('2. TENANT user is forbidden from admin endpoints (403)', async () => {
    const res = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /forbidden|insufficient permissions/i);
  });

  test('3. OWNER user is forbidden from admin endpoints (403)', async () => {
    const res = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /forbidden|insufficient permissions/i);
  });

  test('4. ADMIN user is allowed to access admin endpoints (200)', async () => {
    const res = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
  });

  // ================= 2. PLATFORM STATISTICS =================
  test('5. Admin can retrieve platform statistics with expected structure', async () => {
    const res = await fetch(`${baseUrl}/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.users);
    assert.ok(typeof data.users.total === 'number');
    assert.ok(typeof data.users.tenants === 'number');
    assert.ok(typeof data.users.owners === 'number');
    assert.ok(typeof data.users.admins === 'number');
    assert.ok(typeof data.users.active === 'number');

    assert.ok(data.listings);
    assert.ok(typeof data.listings.total === 'number');
    assert.ok(typeof data.listings.available === 'number');
    assert.ok(typeof data.listings.filled === 'number');
    assert.ok(typeof data.listings.unavailable === 'number');

    assert.ok(data.interests);
    assert.ok(typeof data.interests.total === 'number');
    assert.ok(typeof data.interests.pending === 'number');
    assert.ok(typeof data.interests.accepted === 'number');
    assert.ok(typeof data.interests.declined === 'number');

    assert.ok(data.messages);
    assert.ok(typeof data.messages.total === 'number');

    // Security check
    const raw = JSON.stringify(data);
    assert.ok(!raw.includes('passwordHash'));
    assert.ok(!raw.includes('jwt'));
  });

  // ================= 3. USER MANAGEMENT =================
  test('6. Admin can list users with default pagination', async () => {
    const res = await fetch(`${baseUrl}/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(Array.isArray(data.users));
    assert.ok(data.pagination);
    assert.equal(data.pagination.page, 1);
    assert.equal(data.pagination.limit, 50);
    assert.ok(data.users.length > 0);

    // Verify fields of users
    const sample = data.users[0];
    assert.ok(sample.id);
    assert.ok(sample.email);
    assert.ok(sample.name);
    assert.ok(sample.role);
    assert.equal(typeof sample.isActive, 'boolean');

    // Security check: Never return passwordHash
    for (const u of data.users) {
      assert.strictEqual(u.passwordHash, undefined);
    }
  });

  test('7. Admin can filter users by role (role=TENANT)', async () => {
    const res = await fetch(`${baseUrl}/admin/users?role=TENANT`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.users.length > 0);
    for (const u of data.users) {
      assert.equal(u.role, 'TENANT');
    }
  });

  test('8. Admin can filter users by isActive (isActive=true)', async () => {
    const res = await fetch(`${baseUrl}/admin/users?isActive=true`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.ok(data.users.length > 0);
    for (const u of data.users) {
      assert.equal(u.isActive, true);
    }
  });

  test('9. Invalid role filter is rejected with 400 validation error', async () => {
    const res = await fetch(`${baseUrl}/admin/users?role=SUPERUSER`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /invalid role/i);
  });

  // ================= 4. USER ACTIVATION / DEACTIVATION =================
  test('10. Admin can deactivate a user (isActive=false)', async () => {
    const res = await fetch(`${baseUrl}/admin/users/${testDeactivateUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.id, testDeactivateUserId);
    assert.equal(data.user.isActive, false);
    assert.strictEqual(data.user.passwordHash, undefined);
  });

  test('11. Deactivated user cannot authenticate (account is inactive)', async () => {
    // Attempt to authenticate disposable user
    const checkUser = await prisma.user.findUnique({ where: { id: testDeactivateUserId } });
    assert.equal(checkUser.isActive, false);
  });

  test('12. Admin can reactivate a user (isActive=true)', async () => {
    const res = await fetch(`${baseUrl}/admin/users/${testDeactivateUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: true }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.user.id, testDeactivateUserId);
    assert.equal(data.user.isActive, true);
  });

  test('13. Nonexistent user returns 404', async () => {
    const res = await fetch(`${baseUrl}/admin/users/00000000-0000-0000-0000-000000000000/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.match(data.error, /user not found/i);
  });

  test('14. Invalid body for user status is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/admin/users/${testDeactivateUserId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: 'invalid_boolean' }),
    });
    assert.equal(res.status, 400);
  });

  test('15. Admin cannot deactivate their own account (self-deactivation prevented with 400)', async () => {
    const res = await fetch(`${baseUrl}/admin/users/${adminUser.id}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /cannot deactivate their own account/i);
  });

  // ================= 5. LISTING MANAGEMENT & MODERATION =================
  test('16. Admin can list listings with pagination', async () => {
    const res = await fetch(`${baseUrl}/admin/listings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.listings));
    assert.ok(data.pagination);
    assert.ok(data.listings.length > 0);

    const sample = data.listings[0];
    assert.ok(sample.id);
    assert.ok(sample.title);
    assert.ok(sample.status);
    assert.ok(sample.owner);
    assert.ok(sample.owner.email);
    assert.strictEqual(sample.owner.passwordHash, undefined);
  });

  test('17. Admin can filter listings by status (status=AVAILABLE)', async () => {
    const res = await fetch(`${baseUrl}/admin/listings?status=AVAILABLE`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    for (const l of data.listings) {
      assert.equal(l.status, 'AVAILABLE');
    }
  });

  test('18. Invalid listing status filter is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/admin/listings?status=INVALID_STATUS`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /invalid.*status/i);
  });

  test('19. Admin can update listing status (moderate to UNAVAILABLE)', async () => {
    const res = await fetch(`${baseUrl}/admin/listings/${testListingId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'UNAVAILABLE' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.listing.id, testListingId);
    assert.equal(data.listing.status, 'UNAVAILABLE');
  });

  test('20. Admin can update listing status back to AVAILABLE', async () => {
    const res = await fetch(`${baseUrl}/admin/listings/${testListingId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'AVAILABLE' }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.listing.status, 'AVAILABLE');
  });

  test('21. Invalid listing status update is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/admin/listings/${testListingId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /AVAILABLE, FILLED, or UNAVAILABLE/i);
  });

  test('22. Non-existent listing ID returns 404', async () => {
    const res = await fetch(`${baseUrl}/admin/listings/00000000-0000-0000-0000-000000000000/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'FILLED' }),
    });
    assert.equal(res.status, 404);
  });

  test('23. Non-admin is rejected from updating listing status (403)', async () => {
    const res = await fetch(`${baseUrl}/admin/listings/${testListingId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tenantToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'FILLED' }),
    });
    assert.equal(res.status, 403);
  });

  // ================= 6. INTEREST MONITORING =================
  test('24. Admin can list interests for monitoring', async () => {
    const res = await fetch(`${baseUrl}/admin/interests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.interests));
    assert.ok(data.pagination);
    assert.ok(data.interests.length > 0);

    const sample = data.interests[0];
    assert.ok(sample.id);
    assert.ok(sample.status);
    assert.ok(sample.tenant);
    assert.ok(sample.tenant.email);
    assert.ok(sample.listing);
    assert.ok(sample.listing.title);
  });

  test('25. Admin can filter interests by status (status=PENDING)', async () => {
    const res = await fetch(`${baseUrl}/admin/interests?status=PENDING`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    for (const i of data.interests) {
      assert.equal(i.status, 'PENDING');
    }
  });

  test('26. Invalid interest status filter is rejected with 400', async () => {
    const res = await fetch(`${baseUrl}/admin/interests?status=INVALID_STATUS`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /invalid.*status/i);
  });

  test('27. Non-admin is rejected from interest monitoring (403)', async () => {
    const res = await fetch(`${baseUrl}/admin/interests`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    assert.equal(res.status, 403);
  });

  // ================= 7. COMPREHENSIVE SECURITY AUDIT =================
  test('28. Responses across all admin endpoints never contain sensitive credentials', async () => {
    const [usersRes, listingsRes, interestsRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/admin/users`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.text()),
      fetch(`${baseUrl}/admin/listings`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.text()),
      fetch(`${baseUrl}/admin/interests`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.text()),
      fetch(`${baseUrl}/admin/stats`, { headers: { Authorization: `Bearer ${adminToken}` } }).then((r) => r.text()),
    ]);

    for (const body of [usersRes, listingsRes, interestsRes, statsRes]) {
      assert.ok(!body.includes('passwordHash'), 'Response must not contain passwordHash');
      assert.ok(!body.includes('JWT_SECRET'), 'Response must not contain JWT_SECRET');
      assert.ok(!body.includes('supersecret'), 'Response must not contain secrets');
    }
  });
});
