process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';

describe('Phase 3 Listings & Owner Management Test Suite', () => {
  let server;
  let baseUrl;
  let ownerToken;
  let otherOwnerToken;
  let tenantToken;
  let createdListingId;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Login as owner1
    const ownerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner1@example.com', password: DEMO_PASSWORD }),
    });
    const ownerData = await ownerRes.json();
    ownerToken = ownerData.token;

    // Login as owner2
    const otherOwnerRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner2@example.com', password: DEMO_PASSWORD }),
    });
    const otherOwnerData = await otherOwnerRes.json();
    otherOwnerToken = otherOwnerData.token;

    // Login as tenant1
    const tenantRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tenant1@example.com', password: DEMO_PASSWORD }),
    });
    const tenantData = await tenantRes.json();
    tenantToken = tenantData.token;
  });

  after(async () => {
    // Clean up created test listings
    if (createdListingId) {
      await prisma.listing.deleteMany({ where: { id: createdListingId } }).catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Tenant rejected from creating listing
  test('1. Tenant rejected from creating listing (403)', async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenantToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Flat',
        description: 'Tenant trying to post listing',
        location: 'Downtown',
        rent: 1200,
        availableFrom: new Date().toISOString(),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
      }),
    });

    assert.equal(res.status, 403);
  });

  // 2. Owner can successfully create a listing
  test('2. Owner successfully creates listing with photos (201)', async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: 'Modern 2BHK Apartment in Downtown',
        description: 'Spacious high-rise flat with panoramic views and fast wifi.',
        location: 'Downtown Core',
        rent: 1850,
        availableFrom: new Date().toISOString(),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.listing.id);
    assert.equal(data.listing.title, 'Modern 2BHK Apartment in Downtown');
    assert.equal(data.listing.status, 'AVAILABLE');
    assert.equal(data.listing.photos.length, 1);
    createdListingId = data.listing.id;
  });

  // 3. Owner can view their own listings
  test('3. Owner retrieves own listings via /my-listings (200)', async () => {
    const res = await fetch(`${baseUrl}/listings/my-listings`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.listings));
    const found = data.listings.some((l) => l.id === createdListingId);
    assert.ok(found, 'Created listing should appear in owner listings');
  });

  // 4. Listing appears in public / tenant search while AVAILABLE
  test('4. Listing appears in tenant search when AVAILABLE (200)', async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: 'GET',
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const found = data.listings.some((l) => l.id === createdListingId);
    assert.ok(found, 'Available listing must be visible in search');
  });

  // 5. Owner can edit listing
  test('5. Owner can edit listing details (200)', async () => {
    const res = await fetch(`${baseUrl}/listings/${createdListingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        title: 'Updated Modern 2BHK Apartment',
        description: 'Updated description: all utilities included in rent.',
        location: 'Downtown Core - Block B',
        rent: 1900,
        availableFrom: new Date().toISOString(),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.listing.title, 'Updated Modern 2BHK Apartment');
    assert.equal(Number(data.listing.rent), 1900);
  });

  // 6. Another owner cannot edit this listing
  test('6. Other owner forbidden from modifying listing (403)', async () => {
    const res = await fetch(`${baseUrl}/listings/${createdListingId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherOwnerToken}`,
      },
      body: JSON.stringify({
        title: 'Malicious Hijack',
        description: 'Should fail',
        location: 'Nowhere',
        rent: 500,
        availableFrom: new Date().toISOString(),
        roomType: 'SINGLE',
        furnishing: 'UNFURNISHED',
      }),
    });

    assert.equal(res.status, 403);
  });

  // 7. Owner marks listing as FILLED
  test('7. Owner marks listing as FILLED (200)', async () => {
    const res = await fetch(`${baseUrl}/listings/${createdListingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'FILLED' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.listing.status, 'FILLED');
  });

  // 8. CRITICAL: Filled listing disappears from future tenant search!
  test('8. FILLED listing disappears from public search results (200)', async () => {
    const res = await fetch(`${baseUrl}/listings`, {
      method: 'GET',
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    const found = data.listings.some((l) => l.id === createdListingId);
    assert.equal(found, false, 'Filled listing must NOT appear in future search results');
  });

  // 9. Owner can toggle status back to AVAILABLE
  test('9. Owner toggles status back to AVAILABLE and it reappears (200)', async () => {
    const patchRes = await fetch(`${baseUrl}/listings/${createdListingId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({ status: 'AVAILABLE' }),
    });
    assert.equal(patchRes.status, 200);

    const searchRes = await fetch(`${baseUrl}/listings`, { method: 'GET' });
    const searchData = await searchRes.json();
    const found = searchData.listings.some((l) => l.id === createdListingId);
    assert.ok(found, 'Re-opened listing must appear in search results again');
  });
});
