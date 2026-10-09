import { Server } from 'socket.io';
import { socketAuthMiddleware } from './socket.auth.js';
import { registerSocketHandlers } from './socket.handlers.js';

let io = null;

/**
 * Initializes Socket.io attached to an HTTP server
 *
 * @param {import('http').Server} httpServer
 * @param {object} [options]
 * @returns {import('socket.io').Server}
 */
export function initSocket(httpServer, options = {}) {
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
    : ['http://localhost:5173'];

  const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    ...options,
  });

  // Enforce JWT authentication on connection
  io.use(socketAuthMiddleware);

  // Register event handlers
  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket);
  });

  return io;
}

/**
 * Get active Socket.io instance
 * @returns {import('socket.io').Server}
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
}
