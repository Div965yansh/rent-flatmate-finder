process.env.NODE_ENV = 'test';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';
import { initSocket } from '../src/socket/socket.js';
import { generateToken, verifyToken } from '../src/utils/jwt.js';

describe('Phase 10 — Production Hardening & Security Audit Test Suite', () => {
  let server;
  let baseUrl;
  let socketUrl;
  let ioServer;

  let ownerToken;
  let ownerUser;
  let tenantToken;
  let tenantUser;

  let testListingId;
  let testInterestId;
  const activeSockets = [];

  function createSocket(token, options = {}) {
    const socket = ioClient(socketUrl, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      forceNew: true,
      autoConnect: true,
      reconnection: false,
      ...options,
    });
    activeSockets.push(socket);
    return socket;
  }

  function waitForConnect(socket) {
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  }

  before(async () => {
    // 1. Setup HTTP and Socket server
    server = http.createServer(app);
    ioServer = initSocket(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        socketUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    // 2. Authenticate demo owner and tenant
    const [ownerRes, tenantRes] = await Promise.all([
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

    ownerToken = ownerRes.token;
    ownerUser = ownerRes.user;
    tenantToken = tenantRes.token;
    tenantUser = tenantRes.user;

    // 3. Create a listing owned by owner1
    const listing = await prisma.listing.create({
      data: {
        ownerId: ownerUser.id,
        title: 'Security Hardening Test Property',
        description: 'Testing security and hardening behaviors',
        rent: 22000,
        location: 'Cyber City, Gurgaon',
        roomType: 'SINGLE',
        furnishing: 'FULLY_FURNISHED',
        availableFrom: new Date(),
        status: 'AVAILABLE',
      },
    });
    testListingId = listing.id;

    // 4. Create an ACCEPTED interest between tenant1 and listing
    const interest = await prisma.interest.create({
      data: {
        tenantId: tenantUser.id,
        listingId: testListingId,
        status: 'ACCEPTED',
      },
    });
    testInterestId = interest.id;
  });

  after(async () => {
    // Disconnect active test sockets
    for (const socket of activeSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    }

    // Cleanup created database records
    if (testInterestId) {
      await prisma.message.deleteMany({ where: { interestId: testInterestId } }).catch(() => {});
      await prisma.interest.delete({ where: { id: testInterestId } }).catch(() => {});
    }
    if (testListingId) {
      await prisma.compatibilityScore.deleteMany({ where: { listingId: testListingId } }).catch(() => {});
      await prisma.listing.delete({ where: { id: testListingId } }).catch(() => {});
    }

    // Ensure tenant is active
    if (tenantUser?.id) {
      await prisma.user.update({
        where: { id: tenantUser.id },
        data: { isActive: true },
      }).catch(() => {});
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // --- SECTION 1: SECURITY HEADERS & FINGERPRINTING ---
  test('1. Express disables X-Powered-By header to prevent fingerprinting', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  test('2. Helmet security headers are present in HTTP responses', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  });

  // --- SECTION 2: REQUEST BODY AND MALFORMED JSON ---
  test('3. Malformed JSON payload returns HTTP 400 with structured error', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"email": "broken, json}',
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'Invalid JSON payload provided');
  });

  test('4. Oversized JSON payload (>1MB) returns HTTP 413 Payload Too Large', async () => {
    const largeString = 'a'.repeat(1.2 * 1024 * 1024);
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', payload: largeString }),
    });

    assert.equal(res.status, 413);
    const body = await res.json();
    assert.equal(body.error, 'Request payload too large');
  });

  // --- SECTION 3: FILE UPLOAD HARDENING ---
  test('5. Non-image file upload is rejected by Multer with HTTP 400', async () => {
    const formData = new FormData();
    formData.append('title', 'Property with executable');
    formData.append('description', 'Test description for invalid upload');
    formData.append('rent', '25000');
    formData.append('location', 'Noida');
    formData.append('roomType', 'PRIVATE');
    formData.append('furnishing', 'FURNISHED');

    const fakeExe = new Blob(['MZ\x90\x00\x03\x00\x00\x00'], { type: 'application/x-msdownload' });
    formData.append('photos', fakeExe, 'malware.exe');

    const res = await fetch(`${baseUrl}/listings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: formData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Only image files \(JPEG, PNG, WebP\) are allowed/);
  });

  // --- SECTION 4: JWT ALGORITHM PINNING ---
  test('6. JWT verification rejects tokens signed with unauthorized algorithms (e.g. none)', async () => {
    // Manually forge an unsigned token with algorithm 'none'
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: tenantUser.id, role: 'TENANT' })).toString('base64url');
    const forgedToken = `${header}.${payload}.`;

    assert.throws(
      () => {
        verifyToken(forgedToken);
      },
      (err) => {
        return err.name === 'JsonWebTokenError';
      }
    );
  });

  test('7. Valid token generated with generateToken verifies successfully with HS256', async () => {
    const token = generateToken({ id: tenantUser.id, role: 'TENANT' });
    const decoded = verifyToken(token);
    assert.equal(decoded.id, tenantUser.id);
    assert.equal(decoded.role, 'TENANT');
  });

  // --- SECTION 5: SOCKET.IO POST-CONNECTION USER DEACTIVATION MITIGATION (SEC-01) ---
  test('8. Deactivated user socket is rejected and disconnected when attempting conversation:join', async () => {
    // Ensure tenant is active to connect
    await prisma.user.update({
      where: { id: tenantUser.id },
      data: { isActive: true },
    });

    const clientSocket = createSocket(tenantToken);
    await waitForConnect(clientSocket);
    assert.equal(clientSocket.connected, true);

    // Now deactivate tenant account in database
    await prisma.user.update({
      where: { id: tenantUser.id },
      data: { isActive: false },
    });

    try {
      // Attempt to join conversation
      const result = await new Promise((resolve) => {
        let errorReceived = null;
        let disconnected = false;

        clientSocket.on('error', (err) => {
          errorReceived = err;
        });

        clientSocket.on('disconnect', () => {
          disconnected = true;
          resolve({ errorReceived, disconnected });
        });

        clientSocket.emit('conversation:join', { interestId: testInterestId }, (ack) => {
          if (ack?.error) {
            errorReceived = ack.error;
          }
        });

        // Fallback timer if disconnect doesn't happen
        setTimeout(() => {
          resolve({ errorReceived, disconnected: !clientSocket.connected });
        }, 1500);
      });

      assert.ok(result.errorReceived, 'Expected error response on deactivation');
      assert.equal(result.errorReceived.error?.code || result.errorReceived.code, 'UNAUTHORIZED');
      assert.match(result.errorReceived.error?.message || result.errorReceived.message, /User account is inactive/);
      assert.equal(clientSocket.connected, false, 'Socket should be disconnected after deactivation');
    } finally {
      // Restore tenant active status
      await prisma.user.update({
        where: { id: tenantUser.id },
        data: { isActive: true },
      });
    }
  });

  test('9. Deactivated user socket is rejected and disconnected when attempting message:send', async () => {
    // Ensure tenant is active to connect and join room
    await prisma.user.update({
      where: { id: tenantUser.id },
      data: { isActive: true },
    });

    const clientSocket = createSocket(tenantToken);
    await waitForConnect(clientSocket);
    assert.equal(clientSocket.connected, true);

    // Join room while active
    await new Promise((resolve) => {
      clientSocket.emit('conversation:join', { interestId: testInterestId }, () => {
        resolve();
      });
    });

    // Now deactivate tenant account in database
    await prisma.user.update({
      where: { id: tenantUser.id },
      data: { isActive: false },
    });

    try {
      // Attempt to send message
      const result = await new Promise((resolve) => {
        let errorReceived = null;
        let disconnected = false;

        clientSocket.on('error', (err) => {
          errorReceived = err;
        });

        clientSocket.on('disconnect', () => {
          disconnected = true;
          resolve({ errorReceived, disconnected });
        });

        clientSocket.emit(
          'message:send',
          { interestId: testInterestId, body: 'Malicious post-deactivation message' },
          (ack) => {
            if (ack?.error) {
              errorReceived = ack.error;
            }
          }
        );

        setTimeout(() => {
          resolve({ errorReceived, disconnected: !clientSocket.connected });
        }, 1500);
      });

      assert.ok(result.errorReceived, 'Expected error response on message send after deactivation');
      assert.equal(result.errorReceived.error?.code || result.errorReceived.code, 'UNAUTHORIZED');
      assert.match(result.errorReceived.error?.message || result.errorReceived.message, /User account is inactive/);
      assert.equal(clientSocket.connected, false, 'Socket should be disconnected after deactivation');
    } finally {
      // Restore tenant active status
      await prisma.user.update({
        where: { id: tenantUser.id },
        data: { isActive: true },
      });
    }
  });

  // --- SECTION 6: RATE LIMITING BEHAVIOR ---
  test('10. Isolated rate limiter responds with HTTP 429 when threshold exceeded', async () => {
    const testApp = express();
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please slow down' },
      statusCode: 429,
    });

    testApp.get('/test-limit', limiter, (req, res) => {
      res.json({ ok: true });
    });

    const testServer = http.createServer(testApp);
    await new Promise((resolve) => testServer.listen(0, resolve));
    const testPort = testServer.address().port;
    const testUrl = `http://127.0.0.1:${testPort}/test-limit`;

    try {
      const res1 = await fetch(testUrl);
      assert.equal(res1.status, 200);

      const res2 = await fetch(testUrl);
      assert.equal(res2.status, 200);

      const res3 = await fetch(testUrl);
      assert.equal(res3.status, 429);
      const data3 = await res3.json();
      assert.equal(data3.error, 'Too many requests, please slow down');
    } finally {
      await new Promise((resolve) => testServer.close(resolve));
    }
  });

  // --- SECTION 7: SAFE ERROR RESPONSES ---
  test('11. Production error responses do not leak stack traces, database internals, or secrets', async () => {
    const res = await fetch(`${baseUrl}/listings/non-existent-listing-id-12345`);
    assert.equal(res.status, 404);
    const body = await res.json();

    assert.ok(body.error);
    assert.equal(typeof body.error, 'string');
    assert.equal(body.stack, undefined);
    assert.equal(body.prisma, undefined);
    assert.equal(body.password, undefined);
    assert.equal(body.passwordHash, undefined);
  });
});
