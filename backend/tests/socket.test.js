process.env.NODE_ENV = 'test';

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { io as ioClient } from 'socket.io-client';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { DEMO_PASSWORD } from '../prisma/seed.js';
import { initSocket } from '../src/socket/socket.js';

describe('Phase 8 — Step 2: Realtime Chat — Socket.io Test Suite', () => {
  let server;
  let socketUrl;
  let ioServer;

  let adminToken;
  let adminUser;
  let owner1Token;
  let owner1User;
  let owner2Token;
  let owner2User;
  let tenant1Token;
  let tenant1User;
  let tenant2Token;
  let tenant2User;

  let listing1Id;
  let listing2Id;

  let acceptedInterestId;
  let pendingInterestId;
  let declinedInterestId;
  let secondAcceptedInterestId;

  const createdMessageIds = [];
  const createdInterestIds = [];
  const createdListingIds = [];
  const activeSockets = [];

  // Helper to create and track client sockets
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

  // Helper to await socket connection or connect_error
  function waitForConnect(socket) {
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
    });
  }

  before(async () => {
    // 1. Initialize HTTP server + Socket.io server
    const httpServer = http.createServer(app);
    ioServer = initSocket(httpServer);

    await new Promise((resolve) => {
      server = httpServer.listen(0, () => {
        const port = server.address().port;
        socketUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    const baseUrl = `${socketUrl}/api`;

    // 2. Authenticate demo users via REST
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
    adminUser = adminRes.user;
    owner1Token = o1Res.token;
    owner1User = o1Res.user;
    owner2Token = o2Res.token;
    owner2User = o2Res.user;
    tenant1Token = t1Res.token;
    tenant1User = t1Res.user;
    tenant2Token = t2Res.token;
    tenant2User = t2Res.user;

    // 3. Create test listings
    const l1 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Socket Test Luxury Condo',
        description: 'For socket realtime chat tests',
        location: 'Indiranagar, Bangalore',
        rent: 32000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'ENTIRE_FLAT',
        furnishing: 'FULLY_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    listing1Id = l1.id;
    createdListingIds.push(l1.id);

    const l2 = await prisma.listing.create({
      data: {
        ownerId: owner1User.id,
        title: 'Socket Test Declined Studio',
        description: 'Second listing for declined interest tests',
        location: 'HSR Layout, Bangalore',
        rent: 21000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    listing2Id = l2.id;
    createdListingIds.push(l2.id);

    const l3 = await prisma.listing.create({
      data: {
        ownerId: owner2User.id,
        title: 'Socket Test Owner2 Studio',
        description: 'Third listing for room isolation tests',
        location: 'Koramangala, Bangalore',
        rent: 20000,
        availableFrom: new Date('2026-11-01'),
        roomType: 'SINGLE',
        furnishing: 'SEMI_FURNISHED',
        status: 'AVAILABLE',
      },
    });
    const listing3Id = l3.id;
    createdListingIds.push(l3.id);

    // 4. Create test interests
    // Interest 1: ACCEPTED interest between tenant1 and owner1
    const intAccepted = await prisma.interest.create({
      data: {
        tenantId: tenant1User.id,
        listingId: listing1Id,
        status: 'ACCEPTED',
      },
    });
    acceptedInterestId = intAccepted.id;
    createdInterestIds.push(intAccepted.id);

    // Interest 2: PENDING interest between tenant2 and owner1
    const intPending = await prisma.interest.create({
      data: {
        tenantId: tenant2User.id,
        listingId: listing1Id,
        status: 'PENDING',
      },
    });
    pendingInterestId = intPending.id;
    createdInterestIds.push(intPending.id);

    // Interest 3: DECLINED interest between tenant2 and owner1 on listing2
    const intDeclined = await prisma.interest.create({
      data: {
        tenantId: tenant2User.id,
        listingId: listing2Id,
        status: 'DECLINED',
      },
    });
    declinedInterestId = intDeclined.id;
    createdInterestIds.push(intDeclined.id);

    // Interest 4: Second ACCEPTED interest between tenant2 and owner2 on listing3 (for room isolation)
    const intSecondAccepted = await prisma.interest.create({
      data: {
        tenantId: tenant2User.id,
        listingId: listing3Id,
        status: 'ACCEPTED',
      },
    });
    secondAcceptedInterestId = intSecondAccepted.id;
    createdInterestIds.push(intSecondAccepted.id);
  });

  afterEach(() => {
    while (activeSockets.length > 0) {
      const s = activeSockets.pop();
      if (s.connected) s.disconnect();
    }
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
      // Ignore teardown errors
    }

    if (ioServer) {
      ioServer.close();
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
  // SECTION 1: Socket Authentication
  // =========================================================================

  test('1. Unauthenticated socket connection is rejected', async () => {
    const socket = createSocket(null);

    await assert.rejects(waitForConnect(socket), (err) => {
      assert.ok(err.message.includes('Authentication required'));
      return true;
    });
  });

  test('2. Socket connection with invalid JWT is rejected', async () => {
    const socket = createSocket('invalid.fake.jwt.token');

    await assert.rejects(waitForConnect(socket), (err) => {
      assert.ok(err.message.includes('Invalid or expired token'));
      return true;
    });
  });

  test('3. Valid tenant socket connects successfully', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);
    assert.equal(socket.connected, true);
  });

  test('4. Valid owner socket connects successfully', async () => {
    const socket = createSocket(owner1Token);
    await waitForConnect(socket);
    assert.equal(socket.connected, true);
  });

  test('5. Admin connects successfully but does NOT automatically get chat access', async () => {
    const socket = createSocket(adminToken);
    await waitForConnect(socket);
    assert.equal(socket.connected, true);

    // Admin attempts to join an accepted conversation
    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: acceptedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'FORBIDDEN');
  });

  // =========================================================================
  // SECTION 2: Conversation Rooms & Authorization
  // =========================================================================

  test('6. Accepted tenant participant can join conversation room', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: acceptedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.equal(joinRes.success, true);
    assert.equal(joinRes.room, `interest:${acceptedInterestId}`);
  });

  test('7. Accepted listing owner can join conversation room', async () => {
    const socket = createSocket(owner1Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: acceptedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.equal(joinRes.success, true);
    assert.equal(joinRes.room, `interest:${acceptedInterestId}`);
  });

  test('8. PENDING interest is rejected from joining conversation room (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: pendingInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'FORBIDDEN');
  });

  test('9. DECLINED interest is rejected from joining conversation room (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: declinedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'FORBIDDEN');
  });

  test('10. Unrelated tenant is rejected from joining another conversation room (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: acceptedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'FORBIDDEN');
  });

  test('11. Unrelated owner is rejected from joining another conversation room (FORBIDDEN)', async () => {
    const socket = createSocket(owner2Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: acceptedInterestId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'FORBIDDEN');
  });

  test('12. Nonexistent interest ID returns NOT_FOUND', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const fakeId = '00000000-0000-0000-0000-000000000000';
    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: fakeId }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'NOT_FOUND');
  });

  test('13. Empty or invalid interest ID returns VALIDATION_ERROR', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const joinRes = await new Promise((resolve) => {
      socket.emit('conversation:join', { interestId: '' }, (res) => {
        resolve(res);
      });
    });

    assert.ok(joinRes.error);
    assert.equal(joinRes.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // SECTION 3: Realtime Message Sending & Broadcasting
  // =========================================================================

  test('14. Accepted tenant sends message, receives ack, and message is broadcast to room', async () => {
    const tenantSocket = createSocket(tenant1Token);
    const ownerSocket = createSocket(owner1Token);

    await Promise.all([waitForConnect(tenantSocket), waitForConnect(ownerSocket)]);

    // Both join room
    await Promise.all([
      new Promise((resolve) => tenantSocket.emit('conversation:join', { interestId: acceptedInterestId }, resolve)),
      new Promise((resolve) => ownerSocket.emit('conversation:join', { interestId: acceptedInterestId }, resolve)),
    ]);

    // Prepare promise for owner receiving broadcast
    const ownerBroadcastPromise = new Promise((resolve) => {
      ownerSocket.on('message:new', (msg) => resolve(msg));
    });

    // Tenant sends message
    const sendRes = await new Promise((resolve) => {
      tenantSocket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Hello Owner! Is this weekend good for viewing?',
        },
        resolve
      );
    });

    assert.equal(sendRes.success, true);
    assert.ok(sendRes.message);
    assert.equal(sendRes.message.interestId, acceptedInterestId);
    assert.equal(sendRes.message.senderId, tenant1User.id);
    assert.equal(sendRes.message.body, 'Hello Owner! Is this weekend good for viewing?');
    createdMessageIds.push(sendRes.message.id);

    // Verify owner received the broadcast
    const broadcastedMsg = await ownerBroadcastPromise;
    assert.equal(broadcastedMsg.id, sendRes.message.id);
    assert.equal(broadcastedMsg.body, 'Hello Owner! Is this weekend good for viewing?');
    assert.equal(broadcastedMsg.sender.id, tenant1User.id);
  });

  test('15. Emitted message is persisted to PostgreSQL database BEFORE broadcast', async () => {
    const tenantSocket = createSocket(tenant1Token);
    await waitForConnect(tenantSocket);

    await new Promise((resolve) =>
      tenantSocket.emit('conversation:join', { interestId: acceptedInterestId }, resolve)
    );

    const sendRes = await new Promise((resolve) => {
      tenantSocket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Database persistence verification message.',
        },
        resolve
      );
    });

    assert.equal(sendRes.success, true);
    createdMessageIds.push(sendRes.message.id);

    // Direct check in PostgreSQL database
    const inDb = await prisma.message.findUnique({
      where: { id: sendRes.message.id },
    });
    assert.ok(inDb);
    assert.equal(inDb.body, 'Database persistence verification message.');
    assert.equal(inDb.senderId, tenant1User.id);
    assert.equal(inDb.interestId, acceptedInterestId);
  });

  test('16. Emitted message payload never exposes passwordHash, JWT, or private secrets', async () => {
    const ownerSocket = createSocket(owner1Token);
    await waitForConnect(ownerSocket);

    await new Promise((resolve) =>
      ownerSocket.emit('conversation:join', { interestId: acceptedInterestId }, resolve)
    );

    const sendRes = await new Promise((resolve) => {
      ownerSocket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Checking security fields in payload.',
        },
        resolve
      );
    });

    assert.equal(sendRes.success, true);
    createdMessageIds.push(sendRes.message.id);

    const jsonStr = JSON.stringify(sendRes.message);
    assert.equal(jsonStr.includes('passwordHash'), false);
    assert.equal(jsonStr.includes('password'), false);
    assert.equal(jsonStr.includes('JWT'), false);
    assert.equal(jsonStr.includes('token'), false);
    assert.ok(sendRes.message.sender.name);
    assert.ok(sendRes.message.sender.role);
  });

  // =========================================================================
  // SECTION 4: Message Sending Authorization & State Enforcement
  // =========================================================================

  test('17. Unrelated tenant cannot send message to another conversation (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Malicious tenant injection',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'FORBIDDEN');
  });

  test('18. Unrelated owner cannot send message to another conversation (FORBIDDEN)', async () => {
    const socket = createSocket(owner2Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Malicious owner injection',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'FORBIDDEN');
  });

  test('19. Message cannot be sent to PENDING conversation (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: pendingInterestId,
          body: 'Message in pending interest',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'FORBIDDEN');
  });

  test('20. Message cannot be sent to DECLINED conversation (FORBIDDEN)', async () => {
    const socket = createSocket(tenant2Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: declinedInterestId,
          body: 'Message in declined interest',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'FORBIDDEN');
  });

  // =========================================================================
  // SECTION 5: Payload Validation
  // =========================================================================

  test('21. Empty message body is rejected with VALIDATION_ERROR', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: '',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'VALIDATION_ERROR');
  });

  test('22. Whitespace-only message body is rejected with VALIDATION_ERROR', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: '    \t\n   ',
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'VALIDATION_ERROR');
  });

  test('23. Oversized message body (>2000 chars) is rejected with VALIDATION_ERROR', async () => {
    const socket = createSocket(tenant1Token);
    await waitForConnect(socket);

    const sendRes = await new Promise((resolve) => {
      socket.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'x'.repeat(2001),
        },
        resolve
      );
    });

    assert.ok(sendRes.error);
    assert.equal(sendRes.error.code, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // SECTION 6: Room Isolation
  // =========================================================================

  test('24. Conversation A messages are NOT received by Conversation B room', async () => {
    // Client A in Conversation 1 (tenant1)
    const clientA = createSocket(tenant1Token);
    // Client B in Conversation 2 (tenant2 in secondAcceptedInterestId)
    const clientB = createSocket(tenant2Token);

    await Promise.all([waitForConnect(clientA), waitForConnect(clientB)]);

    await Promise.all([
      new Promise((resolve) => clientA.emit('conversation:join', { interestId: acceptedInterestId }, resolve)),
      new Promise((resolve) => clientB.emit('conversation:join', { interestId: secondAcceptedInterestId }, resolve)),
    ]);

    let clientBReceivedUnexpectedMessage = false;
    clientB.on('message:new', () => {
      clientBReceivedUnexpectedMessage = true;
    });

    // Client A sends message in Conversation 1
    const sendRes = await new Promise((resolve) => {
      clientA.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Secret message for Conversation 1 only',
        },
        resolve
      );
    });

    assert.equal(sendRes.success, true);
    createdMessageIds.push(sendRes.message.id);

    // Wait a brief tick to verify clientB did not receive it
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(clientBReceivedUnexpectedMessage, false, 'Client in Conversation B must not receive Conversation A messages');
  });

  test('25. Unauthorized client who failed to join does NOT receive messages broadcast to room', async () => {
    // Malicious client (tenant 2) tries to join Conversation 1 and fails
    const maliciousClient = createSocket(tenant2Token);
    // Legitimate owner in Conversation 1
    const ownerClient = createSocket(owner1Token);
    // Legitimate tenant in Conversation 1
    const tenantClient = createSocket(tenant1Token);

    await Promise.all([
      waitForConnect(maliciousClient),
      waitForConnect(ownerClient),
      waitForConnect(tenantClient),
    ]);

    // Malicious tries to join and is rejected
    const failedJoin = await new Promise((resolve) =>
      maliciousClient.emit('conversation:join', { interestId: acceptedInterestId }, resolve)
    );
    assert.ok(failedJoin.error);

    // Legitimate users join
    await Promise.all([
      new Promise((resolve) => ownerClient.emit('conversation:join', { interestId: acceptedInterestId }, resolve)),
      new Promise((resolve) => tenantClient.emit('conversation:join', { interestId: acceptedInterestId }, resolve)),
    ]);

    let maliciousReceivedMessage = false;
    maliciousClient.on('message:new', () => {
      maliciousReceivedMessage = true;
    });

    // Legitimate tenant sends message
    const sendRes = await new Promise((resolve) => {
      tenantClient.emit(
        'message:send',
        {
          interestId: acceptedInterestId,
          body: 'Confidential message between tenant 1 and owner 1',
        },
        resolve
      );
    });

    assert.equal(sendRes.success, true);
    createdMessageIds.push(sendRes.message.id);

    await new Promise((r) => setTimeout(r, 100));
    assert.equal(maliciousReceivedMessage, false, 'Unauthorized client must never receive room messages');
  });
});
