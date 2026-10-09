process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Phase 4 Listing Search & Filtering Test Suite', () => {
  let server;
  let baseUrl;
  let testListingIds = [];
  let ownerId;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Find an owner user from seed
    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
    });
    ownerId = owner.id;

    // Create 4 distinct listings for search tests
    const lA = await prisma.listing.create({
      data: {
        ownerId,
        title: 'SearchTest Cozy Single Room Noida',
        description: 'Single room in Noida Sector 62',
        location: 'Noida Sector 62',
        rent: 10000,
        availableFrom: new Date('2026-10-15'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });

    const lB = await prisma.listing.create({
      data: {
        ownerId,
        title: 'SearchTest Shared Room Noida Expressway',
        description: 'Shared room near expressway',
        location: 'Noida Expressway',
        rent: 16000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SHARED',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });

    const lC = await prisma.listing.create({
      data: {
        ownerId,
        title: 'SearchTest Luxury 2BHK Bangalore',
        description: 'Entire flat in Indiranagar',
        location: 'Bangalore Indiranagar',
        rent: 22000,
        availableFrom: new Date('2026-12-01'),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'UNFURNISHED',
        status: 'AVAILABLE',
      },
    });

    const lD = await prisma.listing.create({
      data: {
        ownerId,
        title: 'SearchTest Filled Flat Noida',
        description: 'This listing is already occupied and filled',
        location: 'Noida Sector 62',
        rent: 9000,
        availableFrom: new Date('2026-10-01'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'FILLED',
      },
    });

    testListingIds = [lA.id, lB.id, lC.id, lD.id];
  });

  after(async () => {
    if (testListingIds.length > 0) {
      await prisma.listing.deleteMany({
        where: { id: { in: testListingIds } },
      }).catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. No filters returns AVAILABLE listings
  test('1. No filters returns AVAILABLE listings', async () => {
    const res = await fetch(`${baseUrl}/listings`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.listings));

    const returnedIds = data.listings.map((l) => l.id);
    assert.ok(returnedIds.includes(testListingIds[0]));
    assert.ok(returnedIds.includes(testListingIds[1]));
    assert.ok(returnedIds.includes(testListingIds[2]));
  });

  // 2. FILLED listing never appears
  test('2. FILLED listing never appears in search results', async () => {
    const res = await fetch(`${baseUrl}/listings?location=Noida&roomType=SINGLE`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const returnedIds = data.listings.map((l) => l.id);
    assert.ok(!returnedIds.includes(testListingIds[3]), 'Listing D (FILLED) must NOT appear in search');
  });

  // 3. location filter works
  test('3. location filter works', async () => {
    const res = await fetch(`${baseUrl}/listings?location=Bangalore`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    assert.equal(foundTestListings.length, 1);
    assert.equal(foundTestListings[0].id, testListingIds[2]);
  });

  // 4. location matching is case-insensitive/partial
  test('4. location matching is case-insensitive/partial', async () => {
    const res = await fetch(`${baseUrl}/listings?location=noida`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0]));
    assert.ok(ids.includes(testListingIds[1]));
    assert.ok(!ids.includes(testListingIds[2]));
  });

  // 5. minRent works
  test('5. minRent works', async () => {
    const res = await fetch(`${baseUrl}/listings?minRent=15000`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[1]));
    assert.ok(ids.includes(testListingIds[2]));
    assert.ok(!ids.includes(testListingIds[0]));
  });

  // 6. maxRent works
  test('6. maxRent works', async () => {
    const res = await fetch(`${baseUrl}/listings?maxRent=12000`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0]));
    assert.ok(!ids.includes(testListingIds[1]));
    assert.ok(!ids.includes(testListingIds[2]));
  });

  // 7. minRent + maxRent works
  test('7. minRent + maxRent works', async () => {
    const res = await fetch(`${baseUrl}/listings?minRent=9000&maxRent=17000`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0]));
    assert.ok(ids.includes(testListingIds[1]));
    assert.ok(!ids.includes(testListingIds[2]));
  });

  // 8. roomType filter works
  test('8. roomType filter works', async () => {
    const res = await fetch(`${baseUrl}/listings?roomType=SINGLE`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0]));
    assert.ok(!ids.includes(testListingIds[1]));
    assert.ok(!ids.includes(testListingIds[2]));
  });

  // 9. furnishing filter works
  test('9. furnishing filter works', async () => {
    const res = await fetch(`${baseUrl}/listings?furnishing=FULLY_FURNISHED`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0]));
    assert.ok(!ids.includes(testListingIds[1]));
  });

  // 10. availableFrom filter works (available on or before requested date)
  test('10. availableFrom filter works (available on or before date)', async () => {
    const res = await fetch(`${baseUrl}/listings?availableFrom=2026-10-20`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    const ids = foundTestListings.map((l) => l.id);
    assert.ok(ids.includes(testListingIds[0])); // Oct 15 is <= Oct 20
    assert.ok(!ids.includes(testListingIds[1])); // Nov 1 is > Oct 20
    assert.ok(!ids.includes(testListingIds[2])); // Dec 1 is > Oct 20
  });

  // 11. Multiple filters combine correctly with AND logic
  test('11. Multiple filters combine correctly with AND logic', async () => {
    const res = await fetch(
      `${baseUrl}/listings?location=Noida&minRent=8000&maxRent=15000&roomType=SINGLE`
    );
    assert.equal(res.status, 200);
    const data = await res.json();

    const foundTestListings = data.listings.filter((l) => testListingIds.includes(l.id));
    assert.equal(foundTestListings.length, 1);
    assert.equal(foundTestListings[0].id, testListingIds[0]);
  });

  // 12. Invalid negative rent rejected
  test('12. Invalid negative rent rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/listings?minRent=-500`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 13. Invalid roomType rejected
  test('13. Invalid roomType rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/listings?roomType=PENTHOUSE`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /roomType/i);
  });

  // 14. Invalid furnishing rejected
  test('14. Invalid furnishing rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/listings?furnishing=PALATIAL`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /furnishing/i);
  });

  // 15. Invalid date rejected
  test('15. Invalid date rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/listings?availableFrom=not-a-valid-date`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /date/i);
  });

  // 16. minRent > maxRent rejected
  test('16. minRent > maxRent rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/listings?minRent=20000&maxRent=10000`);
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /minRent cannot be greater than maxRent/i);
  });
});
