process.env.NODE_ENV = 'test';

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';
import {
  setCustomProvider,
  resetCustomProvider,
} from '../src/services/email/email.provider.js';
import * as emailService from '../src/services/email/email.service.js';
import {
  escapeHtml,
  buildInterestReceivedTemplate,
  buildInterestAcceptedTemplate,
  buildInterestDeclinedTemplate,
} from '../src/services/email/email.templates.js';

describe('Phase 7 — Step 3 Transactional Email Notifications Test Suite', () => {
  let server;
  let baseUrl;

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
  let filledListingId;

  const createdInterestIds = [];
  const createdListingIds = [];

  // In-memory capture of dispatched emails during tests
  let sentEmails = [];

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Authenticate demo accounts
    const [o1Res, o2Res, t1Res, t2Res] = await Promise.all([
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

    owner1Token = o1Res.token;
    owner1User = o1Res.user;
    owner2Token = o2Res.token;
    owner2User = o2Res.user;
    tenant1Token = t1Res.token;
    tenant1User = t1Res.user;
    tenant2Token = t2Res.token;
    tenant2User = t2Res.user;

    // Create listings for Owner 1
    const l1 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Email Test Penthouse in Indiranagar',
        description: 'Spacious apartment for email workflow tests',
        location: 'Indiranagar, Bangalore',
        rent: 25000,
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
        title: 'Email Test Studio in Koramangala',
        description: 'Single studio for email workflow tests',
        location: 'Koramangala, Bangalore',
        rent: 16000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    testListing2Id = l2.id;
    createdListingIds.push(l2.id);

    const lFilled = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Email Test Filled Listing',
        description: 'Already filled listing',
        location: 'Whitefield, Bangalore',
        rent: 20000,
        availableFrom: new Date('2026-10-01'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'FILLED',
      },
    });
    filledListingId = lFilled.id;
    createdListingIds.push(lFilled.id);
  });

  beforeEach(() => {
    sentEmails = [];
    // Default mock email provider recording all dispatched emails
    setCustomProvider(async (params) => {
      sentEmails.push(params);
      return { sent: true, id: `mock-email-id-${Date.now()}` };
    });
  });

  afterEach(() => {
    resetCustomProvider();
  });

  after(async () => {
    const validInterestIds = createdInterestIds.filter(Boolean);
    const validListingIds = createdListingIds.filter(Boolean);

    try {
      if (validInterestIds.length > 0) {
        await prisma.interest.deleteMany({
          where: { id: { in: validInterestIds } },
        });
      }
      if (validListingIds.length > 0) {
        await prisma.interest.deleteMany({
          where: { listingId: { in: validListingIds } },
        });
        await prisma.listing.deleteMany({
          where: { id: { in: validListingIds } },
        });
      }
    } catch {
      // Ignore teardown errors
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
  // SECTION 1: Email Provider & Service Unit Tests
  // =========================================================================

  test('1. Provider sends successfully via mocked custom provider', async () => {
    const result = await emailService.sendTransactionalEmail({
      to: 'recipient@example.com',
      subject: 'Test Subject',
      html: '<p>Test body</p>',
      text: 'Test body',
    });

    assert.equal(result.sent, true);
    assert.ok(result.id);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'recipient@example.com');
    assert.equal(sentEmails[0].subject, 'Test Subject');
  });

  test('2. Provider failure is caught and returns safe result without throwing', async () => {
    setCustomProvider(async () => {
      throw new Error('Provider network timeout or socket reset');
    });

    const result = await emailService.sendTransactionalEmail({
      to: 'recipient@example.com',
      subject: 'Failing Subject',
      html: '<p>Failing body</p>',
    });

    assert.equal(result.sent, false);
    assert.ok(result.reason.includes('Provider network timeout'));
  });

  test('3. Missing or empty provider API key does not crash and yields fallback result', async () => {
    resetCustomProvider();
    const prevKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    try {
      const result = await emailService.sendTransactionalEmail({
        to: 'recipient@example.com',
        subject: 'No Key Test',
        html: '<p>Content</p>',
      });

      assert.equal(result.sent, false);
      assert.ok(result.reason.includes('not configured'));
    } finally {
      process.env.RESEND_API_KEY = prevKey;
    }
  });

  test('4. Secrets and API keys are redacted and never exposed in error reasons', async () => {
    setCustomProvider(async () => {
      throw new Error('Failed with key re_1234567890abcdef and Bearer eyJhbGciOiJIUzI1NiJ9.test');
    });

    const result = await emailService.sendTransactionalEmail({
      to: 'recipient@example.com',
      subject: 'Secret Redaction Test',
      html: '<p>Content</p>',
    });

    assert.equal(result.sent, false);
    assert.ok(!result.reason.includes('re_1234567890abcdef'), 'API key must be redacted');
    assert.ok(!result.reason.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT must be redacted');
    assert.ok(result.reason.includes('[REDACTED_API_KEY]'));
  });

  test('5. Invalid or missing recipient email address is safely rejected without provider call', async () => {
    const result = await emailService.sendTransactionalEmail({
      to: 'invalid-email',
      subject: 'Invalid to',
      html: '<p>Test</p>',
    });

    assert.equal(result.sent, false);
    assert.equal(sentEmails.length, 0);
  });

  // =========================================================================
  // SECTION 2: Template Sanitization and Content
  // =========================================================================

  test('6. HTML escaping prevents XSS tag injection in templates', () => {
    const rawEvil = '<script>alert("hacked")</script> & <b>bold</b> "quote"';
    const escaped = escapeHtml(rawEvil);

    assert.ok(!escaped.includes('<script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
  });

  test('7. Templates contain required fields and safe non-sensitive wording', () => {
    const received = buildInterestReceivedTemplate({
      ownerName: 'Alice Owner',
      tenantName: 'Bob Tenant',
      listingTitle: 'Sunny 2BHK',
      listingLocation: 'Indiranagar',
      rent: 20000,
    });
    assert.ok(received.subject.includes('Sunny 2BHK'));
    assert.ok(received.html.includes('Alice Owner'));
    assert.ok(received.html.includes('Bob Tenant'));
    assert.ok(received.html.includes('Indiranagar'));
    assert.ok(received.html.includes('20,000'));
    assert.ok(received.html.includes('Interest Inbox'));
    assert.ok(!received.html.includes('passwordHash'));

    const accepted = buildInterestAcceptedTemplate({
      tenantName: 'Bob Tenant',
      ownerName: 'Alice Owner',
      listingTitle: 'Sunny 2BHK',
      listingLocation: 'Indiranagar',
      rent: 20000,
    });
    assert.ok(accepted.subject.includes('accepted'));
    assert.ok(accepted.html.includes('Alice Owner'));
    assert.ok(accepted.html.includes('Bob Tenant'));
    assert.ok(accepted.html.includes('continue in the application'));
    // Ensure we do not falsely claim chat is ready
    assert.ok(!accepted.html.includes('open realtime chat room now'));

    const declined = buildInterestDeclinedTemplate({
      tenantName: 'Bob Tenant',
      listingTitle: 'Sunny 2BHK',
      listingLocation: 'Indiranagar',
    });
    assert.ok(declined.subject.includes('Update on your rental interest'));
    assert.ok(declined.html.includes('Sunny 2BHK'));
    assert.ok(declined.html.includes('browse other available listings') || declined.html.includes('available listings'));
  });

  // =========================================================================
  // SECTION 3: Interest Creation Email Workflow
  // =========================================================================

  test('8. Successful interest creation triggers owner notification email with listing details', async () => {
    sentEmails = [];

    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: testListing1Id }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.interest);
    assert.equal(data.interest.status, 'PENDING');
    createdInterestIds.push(data.interest.id);

    // Verify email was dispatched to owner1
    assert.equal(sentEmails.length, 1);
    const email = sentEmails[0];
    assert.equal(email.to, owner1User.email);
    assert.ok(email.subject.includes('Email Test Penthouse in Indiranagar'));
    assert.ok(email.html.includes(owner1User.name));
    assert.ok(email.html.includes(tenant1User.name));
    assert.ok(email.html.includes('Indiranagar, Bangalore'));
    assert.ok(email.html.includes('25,000'));
  });

  test('9. Failed interest creation does not trigger email', async () => {
    sentEmails = [];

    // Attempting interest on filled listing
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ listingId: filledListingId }),
    });

    assert.equal(res.status, 400);
    assert.equal(sentEmails.length, 0, 'No email must be sent on failed creation');
  });

  test('10. Duplicate interest creation does not trigger another email', async () => {
    sentEmails = [];

    // tenant1 already expressed interest in testListing1Id in test 8
    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: testListing1Id }),
    });

    assert.equal(res.status, 409);
    assert.equal(sentEmails.length, 0, 'No email must be sent on duplicate conflict');
  });

  test('11. Email provider failure does not fail the interest creation request', async () => {
    // Inject mock that throws an unhandled error
    setCustomProvider(async () => {
      throw new Error('Resend HTTP 500: Server down');
    });

    const res = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ listingId: testListing1Id }),
    });

    // Request MUST succeed 201 despite provider failure
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.interest);
    assert.equal(data.interest.status, 'PENDING');
    createdInterestIds.push(data.interest.id);

    // Verify record in PostgreSQL database actually exists
    const inDb = await prisma.interest.findUnique({
      where: { id: data.interest.id },
    });
    assert.ok(inDb);
    assert.equal(inDb.status, 'PENDING');
  });

  // =========================================================================
  // SECTION 4: Interest Accept Email Workflow
  // =========================================================================

  test('12. Successful ACCEPTED transition triggers tenant notification email', async () => {
    // 1. Tenant 1 expresses interest in testListing2Id
    sentEmails = [];
    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: testListing2Id }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.interest);
    createdInterestIds.push(createData.interest.id);

    // Reset sent emails to observe accept
    sentEmails = [];

    // 2. Owner accepts interest
    const acceptRes = await fetch(`${baseUrl}/interests/${createData.interest.id}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.ok(acceptData.interest);
    assert.equal(acceptData.interest.status, 'ACCEPTED');

    // 3. Verify tenant email was triggered
    assert.equal(sentEmails.length, 1);
    const email = sentEmails[0];
    assert.equal(email.to, tenant1User.email);
    assert.ok(email.subject.includes('accepted'));
    assert.ok(email.html.includes(tenant1User.name));
    assert.ok(email.html.includes('Email Test Studio in Koramangala'));
  });

  test('13. Invalid accept transition does not trigger email', async () => {
    sentEmails = [];

    const interestId = createdInterestIds[createdInterestIds.length - 1];
    // Another owner (owner2) tries to accept owner1's interest
    const res = await fetch(`${baseUrl}/interests/${interestId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner2Token}`,
      },
    });

    assert.equal(res.status, 403);
    assert.equal(sentEmails.length, 0);

    // Owner1 tries to accept already accepted interest
    const duplicateAccept = await fetch(`${baseUrl}/interests/${interestId}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(duplicateAccept.status, 409);
    assert.equal(sentEmails.length, 0);
  });

  test('14. Email failure does not roll back or prevent ACCEPTED state', async () => {
    // Create new interest for tenant2 on testListing2Id
    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ listingId: testListing2Id }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.interest);
    createdInterestIds.push(createData.interest.id);

    // Make email provider throw
    setCustomProvider(async () => {
      throw new Error('Resend network timeout during accept');
    });

    // Accept interest
    const acceptRes = await fetch(`${baseUrl}/interests/${createData.interest.id}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(acceptRes.status, 200);
    const acceptData = await acceptRes.json();
    assert.ok(acceptData.interest);
    assert.equal(acceptData.interest.status, 'ACCEPTED');

    // Direct DB check: state in DB is indeed ACCEPTED
    const inDb = await prisma.interest.findUnique({
      where: { id: createData.interest.id },
    });
    assert.equal(inDb.status, 'ACCEPTED');
  });

  // =========================================================================
  // SECTION 5: Interest Decline Email Workflow
  // =========================================================================

  test('15. Successful DECLINED transition triggers tenant notification email', async () => {
    // Create a new listing and interest for decline test
    const declineListing = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Listing for Decline Email Test',
        description: 'Test decline email',
        location: 'HSR Layout, Bangalore',
        rent: 17000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    createdListingIds.push(declineListing.id);

    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant1Token}`,
      },
      body: JSON.stringify({ listingId: declineListing.id }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.interest);
    createdInterestIds.push(createData.interest.id);

    // Reset captured emails
    sentEmails = [];

    // Owner declines
    const declineRes = await fetch(`${baseUrl}/interests/${createData.interest.id}/decline`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(declineRes.status, 200);
    const declineData = await declineRes.json();
    assert.ok(declineData.interest);
    assert.equal(declineData.interest.status, 'DECLINED');

    // Verify tenant notification email was triggered
    assert.equal(sentEmails.length, 1);
    const email = sentEmails[0];
    assert.equal(email.to, tenant1User.email);
    assert.ok(email.subject.includes('Update on your rental interest'));
    assert.ok(email.html.includes('Listing for Decline Email Test'));
  });

  test('16. Invalid decline transition does not trigger email', async () => {
    sentEmails = [];

    const interestId = createdInterestIds[createdInterestIds.length - 1];
    // Owner tries to decline an already declined interest
    const res = await fetch(`${baseUrl}/interests/${interestId}/decline`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(res.status, 409);
    assert.equal(sentEmails.length, 0);
  });

  test('17. Email failure does not roll back or prevent DECLINED state', async () => {
    const declineListing2 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Listing for Failing Email Decline Test',
        description: 'Test decline resilience',
        location: 'Koramangala, Bangalore',
        rent: 18000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    createdListingIds.push(declineListing2.id);

    const createRes = await fetch(`${baseUrl}/interests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tenant2Token}`,
      },
      body: JSON.stringify({ listingId: declineListing2.id }),
    });
    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    assert.ok(createData.interest);
    createdInterestIds.push(createData.interest.id);

    // Make provider throw
    setCustomProvider(async () => {
      throw new Error('Resend connection reset during decline');
    });

    const declineRes = await fetch(`${baseUrl}/interests/${createData.interest.id}/decline`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
    });

    assert.equal(declineRes.status, 200);
    const declineData = await declineRes.json();
    assert.ok(declineData.interest);
    assert.equal(declineData.interest.status, 'DECLINED');

    // Direct DB check: state is DECLINED
    const inDb = await prisma.interest.findUnique({
      where: { id: createData.interest.id },
    });
    assert.equal(inDb.status, 'DECLINED');
  });
});
