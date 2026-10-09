import {
  canAccessConversation,
  sendMessage,
} from '../services/message.service.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../utils/errors.js';

/**
 * Format error into structured socket error object
 * @param {Error} error
 * @returns {{ code: string, message: string }}
 */
function formatSocketError(error) {
  if (error instanceof ValidationError || error?.statusCode === 400 || error?.name === 'ValidationError') {
    return {
      code: 'VALIDATION_ERROR',
      message: error.message,
    };
  }
  if (error instanceof ForbiddenError || error?.statusCode === 403 || error?.name === 'ForbiddenError') {
    return {
      code: 'FORBIDDEN',
      message: error.message,
    };
  }
  if (error instanceof NotFoundError || error?.statusCode === 404 || error?.name === 'NotFoundError') {
    return {
      code: 'NOT_FOUND',
      message: error.message,
    };
  }
  if (error instanceof UnauthorizedError || error?.statusCode === 401 || error?.name === 'UnauthorizedError') {
    return {
      code: 'UNAUTHORIZED',
      message: error.message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'An internal server error occurred',
  };
}

/**
 * Register all event handlers for an authenticated socket client
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
export function registerSocketHandlers(io, socket) {
  /**
   * 1. Join Conversation Room
   * Event: conversation:join
   * Payload: { interestId: string }
   */
  socket.on('conversation:join', async (payload, callback) => {
    try {
      const interestId = payload?.interestId;

      if (!interestId || typeof interestId !== 'string' || !interestId.trim()) {
        const error = {
          code: 'VALIDATION_ERROR',
          message: 'Interest ID is required',
        };
        if (typeof callback === 'function') callback({ error });
        socket.emit('error', { error });
        return;
      }

      // Enforce conversation authorization server-side
      await canAccessConversation(socket.user.id, interestId.trim());

      const roomName = `interest:${interestId.trim()}`;
      await socket.join(roomName);

      if (typeof callback === 'function') {
        callback({
          success: true,
          room: roomName,
          interestId: interestId.trim(),
        });
      }
    } catch (err) {
      const error = formatSocketError(err);
      if (typeof callback === 'function') {
        callback({ error });
      }
      socket.emit('error', { error });
      if (err instanceof UnauthorizedError || err?.statusCode === 401) {
        socket.disconnect(true);
      }
    }
  });

  /**
   * 2. Send Message
   * Event: message:send
   * Payload: { interestId: string, body: string }
   */
  socket.on('message:send', async (payload, callback) => {
    try {
      // Always determine sender from authenticated socket.user.id
      // Never trust client-provided senderId
      const message = await sendMessage(socket.user.id, payload);

      // Broadcast saved message to the authorized conversation room
      const roomName = `interest:${message.interestId}`;
      io.to(roomName).emit('message:new', message);

      if (typeof callback === 'function') {
        callback({
          success: true,
          message,
        });
      }
    } catch (err) {
      const error = formatSocketError(err);
      if (typeof callback === 'function') {
        callback({ error });
      }
      socket.emit('error', { error });
      if (err instanceof UnauthorizedError || err?.statusCode === 401) {
        socket.disconnect(true);
      }
    }
  });

  /**
   * 3. Disconnect
   * Cleans up room membership automatically via Socket.io
   */
  socket.on('disconnect', () => {
    // Rooms are automatically cleaned up by Socket.io
  });
}
