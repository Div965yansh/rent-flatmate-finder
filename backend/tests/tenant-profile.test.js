process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

describe('Phase 4 Tenant Profile Backend Test Suite', () => {
  let server;
  let baseUrl;
  let tenant1Token;
  let tenant1Id;
  let tenant2Token;
  let tenant2Id;
  let ownerToken;
  let adminToken;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Login as tenant1
    const t1Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant1@example.com', password: DEMO_PASSWORD }),
    });
    const t1Data = await t1Res.json();
    tenant1Token = t1Data.token;
    tenant1Id = t1Data.user.id;

    // Login as tenant2
    const t2Res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant2@example.com', password: DEMO_PASSWORD }),
    });
    const t2Data = await t2Res.json();
    tenant2Token = t2Data.token;
    tenant2Id = t2Data.user.id;

    // Login as owner1
    const ownerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner1@example.com', password: DEMO_PASSWORD }),
    });
    const ownerData = await ownerRes.json();
    ownerToken = ownerData.token;

    // Login as admin
    const adminRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: DEMO_PASSWORD }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    // Clean any prior profiles for test tenants
    await prisma.tenantProfile.deleteMany({
      where: { userId: { in: [tenant1Id, tenant2Id] } },
    });
  });

  after(async () => {
    // Cleanup profiles
    await prisma.tenantProfile.deleteMany({
      where: { userId: { in: [tenant1Id, tenant2Id] } },
    }).catch(() => {});

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Unauthenticated request rejected
  test('1. Unauthenticated request rejected (401)', async () => {
    const resGet = await fetch(`${baseUrl}/tenant-profile`);
    assert.equal(resGet.status, 401);

    const resPut = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferredLocation: 'Indiranagar' }),
    });
    assert.equal(resPut.status, 401);
  });

  // 2. Owner cannot access tenant profile endpoint
  test('2. Owner forbidden from accessing tenant profile endpoint (403)', async () => {
    const resGet = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resGet.status, 403);

    const resPut = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ preferredLocation: 'Indiranagar' }),
    });
    assert.equal(resPut.status, 403);
  });

  // 3. Admin cannot access tenant profile endpoint
  test('3. Admin forbidden from accessing tenant profile endpoint (403)', async () => {
    const resGet = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(resGet.status, 403);

    const resPut = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ preferredLocation: 'Indiranagar' }),
    });
    assert.equal(resPut.status, 403);
  });

  // 4. Tenant can retrieve own profile when empty
  test('4. Tenant retrieves own empty profile before creation (200, profile: null)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.profile, null);
  });

  // 5. Invalid budget rejected (budgetMin < 0)
  test('5. Invalid negative budget rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        budgetMin: -500,
        budgetMax: 2000,
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 6. budgetMin > budgetMax rejected
  test('6. budgetMin > budgetMax rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        budgetMin: 3000,
        budgetMax: 1500,
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /budget/i);
  });

  // 7. Invalid room / furnishing enum rejected
  test('7. Invalid room / furnishing enum rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        preferredRoomType: 'PENTHOUSE_MANSION',
      }),
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 8. Tenant can create profile
  test('8. Tenant successfully creates profile (200)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        preferredLocation: 'Koramangala, Bangalore',
        budgetMin: 12000,
        budgetMax: 20000,
        moveInDate: '2026-11-01',
        preferredRoomType: 'SINGLE',
        preferredFurnishing: 'FULLY_FURNISHED',
        lifestyle: {
          cleanliness: 'High',
          sleepSchedule: 'Night Owl',
          smoking: false,
          pets: false,
        },
        notes: 'Software engineer looking for a calm flatmate close to tech parks.',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.profile);
    assert.equal(data.profile.userId, tenant1Id);
    assert.equal(data.profile.preferredLocation, 'Koramangala, Bangalore');
    assert.equal(Number(data.profile.budgetMin), 12000);
    assert.equal(Number(data.profile.budgetMax), 20000);
    assert.equal(data.profile.preferredRoomType, 'SINGLE');
    assert.equal(data.profile.preferredFurnishing, 'FULLY_FURNISHED');
    assert.equal(data.profile.lifestyle.cleanliness, 'High');
  });

  // 9. Tenant profile is persisted in PostgreSQL
  test('9. Tenant profile is directly verified in PostgreSQL database', async () => {
    const dbProfile = await prisma.tenantProfile.findUnique({
      where: { userId: tenant1Id },
    });
    assert.ok(dbProfile, 'Profile record must exist in PostgreSQL');
    assert.equal(dbProfile.preferredLocation, 'Koramangala, Bangalore');
    assert.equal(Number(dbProfile.budgetMin), 12000);
    assert.equal(Number(dbProfile.budgetMax), 20000);
    assert.equal(dbProfile.preferredRoomType, 'SINGLE');
  });

  // 10. Tenant can retrieve own profile
  test('10. Tenant retrieves own created profile via GET /tenant-profile (200)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.profile);
    assert.equal(data.profile.userId, tenant1Id);
    assert.equal(data.profile.preferredLocation, 'Koramangala, Bangalore');
  });

  // 11. Tenant can update own profile
  test('11. Tenant updates own profile (200)', async () => {
    const res = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({
        preferredLocation: 'Indiranagar 100ft Road',
        budgetMin: 15000,
        budgetMax: 25000,
        preferredRoomType: 'ENTIRE_FLAT',
        preferredFurnishing: 'SEMI_FURNISHED',
        notes: 'Updated budget and preferred flat type.',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.profile.preferredLocation, 'Indiranagar 100ft Road');
    assert.equal(Number(data.profile.budgetMin), 15000);
    assert.equal(Number(data.profile.budgetMax), 25000);
    assert.equal(data.profile.preferredRoomType, 'ENTIRE_FLAT');
    assert.equal(data.profile.preferredFurnishing, 'SEMI_FURNISHED');
  });

  // 12. Profile update does not affect another tenant
  test('12. Profile update does not affect another tenant profile', async () => {
    // Tenant2 profile should still be null
    const resT2 = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${tenant2Token}` },
    });
    assert.equal(resT2.status, 200);
    const dataT2 = await resT2.json();
    assert.equal(dataT2.profile, null);

    // Tenant2 creates their own profile
    const putT2 = await fetch(`${baseUrl}/tenant-profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({
        preferredLocation: 'Whitefield',
        budgetMin: 8000,
        budgetMax: 12000,
        preferredRoomType: 'SHARED',
      }),
    });
    assert.equal(putT2.status, 200);

    // Verify Tenant1's profile remains untouched
    const resT1 = await fetch(`${baseUrl}/tenant-profile`, {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    const dataT1 = await resT1.json();
    assert.equal(dataT1.profile.preferredLocation, 'Indiranagar 100ft Road');
    assert.equal(Number(dataT1.profile.budgetMin), 15000);
  });
});
