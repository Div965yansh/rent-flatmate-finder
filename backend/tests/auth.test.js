process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';

describe('Phase 2 Authentication & Authorization Test Suite', () => {
  let server;
  let baseUrl;
  let tenantToken;
  let ownerToken;
  let testTenantEmail;
  let testOwnerEmail;
  let inactiveUserEmail;

  before(async () => {
    // Start server on dynamic port
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    const timestamp = Date.now();
    testTenantEmail = `tenant_${timestamp}@test.com`;
    testOwnerEmail = `owner_${timestamp}@test.com`;
    inactiveUserEmail = `inactive_${timestamp}@test.com`;
  });

  after(async () => {
    // Clean up created test users
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [testTenantEmail, testOwnerEmail, inactiveUserEmail],
          },
        },
      });
    } catch (err) {
      // ignore cleanup errors
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect();
  });

  // 1. Successful tenant registration
  test('1. Successful tenant registration', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Tenant',
        email: testTenantEmail,
        password: 'securePassword123',
        role: 'tenant',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.token, 'Token should be returned');
    assert.equal(data.user.email, testTenantEmail);
    assert.equal(data.user.role, 'TENANT');
    assert.equal(data.user.isActive, true);
    assert.equal(data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    tenantToken = data.token;
  });

  // 2. Successful owner registration
  test('2. Successful owner registration', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Owner',
        email: testOwnerEmail,
        password: 'securePassword123',
        role: 'owner',
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.email, testOwnerEmail);
    assert.equal(data.user.role, 'OWNER');
    assert.equal(data.user.passwordHash, undefined);
    ownerToken = data.token;
  });

  // 3. Admin registration rejected
  test('3. Admin registration rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Admin',
        email: `hacker_${Date.now()}@test.com`,
        password: 'securePassword123',
        role: 'admin',
      }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /admin/i);
  });

  // 4. Duplicate email rejected
  test('4. Duplicate email rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate Jane',
        email: testTenantEmail,
        password: 'anotherPassword123',
        role: 'tenant',
      }),
    });

    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 5. Successful login
  test('5. Successful login', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testTenantEmail,
        password: 'securePassword123',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.equal(data.user.email, testTenantEmail);
    assert.equal(data.user.passwordHash, undefined);
  });

  // 6. Wrong password rejected
  test('6. Wrong password rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testTenantEmail,
        password: 'WrongPassword999',
      }),
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 7. Missing JWT rejected
  test('7. Missing JWT rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 8. Invalid JWT rejected
  test('8. Invalid JWT rejected', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid.fake.token123',
      },
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error);
  });

  // 9. /auth/me works with valid JWT
  test('9. /auth/me works with valid JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantToken}`,
      },
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.user);
    assert.equal(data.user.email, testTenantEmail);
    assert.equal(data.user.role, 'TENANT');
    assert.equal(data.user.passwordHash, undefined);
  });

  // 10. Inactive user rejected
  test('10. Inactive user rejected', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Deactivated User',
        email: inactiveUserEmail,
        password: 'securePassword123',
        role: 'tenant',
      }),
    });
    const regData = await regRes.json();
    const token = regData.token;

    // Set isActive to false directly in DB
    await prisma.user.update({
      where: { email: inactiveUserEmail },
      data: { isActive: false },
    });

    // Test login rejected
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inactiveUserEmail,
        password: 'securePassword123',
      }),
    });
    assert.equal(loginRes.status, 401);

    // Test authenticate middleware rejected
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    assert.equal(meRes.status, 401);
  });

  // 11. Tenant rejected from OWNER role
  test('11. Tenant rejected from OWNER role', async () => {
    const res = await fetch(`${baseUrl}/test-role/owner`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantToken}`,
      },
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /insufficient role|forbidden/i);
  });

  // 12. Owner rejected from ADMIN role
  test('12. Owner rejected from ADMIN role', async () => {
    const res = await fetch(`${baseUrl}/test-role/admin`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error);
    assert.match(data.error, /insufficient role|forbidden/i);
  });
});
