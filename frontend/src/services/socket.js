import { io } from 'socket.io-client';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_BASE.replace(/\/api\/?$/, '');

let activeSocket = null;
let currentToken = null;

/**
 * Creates or retrieves an authenticated Socket.io client instance
 *
 * @param {string} token - JWT authentication token from AuthContext
 * @returns {import('socket.io-client').Socket | null}
 */
export function createChatSocket(token) {
  if (!token) return null;

  // If active socket already exists with the same token and is not permanently closed, return it
  if (activeSocket && currentToken === token) {
    return activeSocket;
  }

  // If a stale instance exists with different credentials, clean it up before reconnecting
  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
    activeSocket = null;
  }

  currentToken = token;
  activeSocket = io(SOCKET_URL, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  return activeSocket;
}

/**
 * Disconnects the active socket and resets the instance
 */
export function disconnectChatSocket() {
  if (activeSocket) {
    activeSocket.removeAllListeners();
    activeSocket.disconnect();
    activeSocket = null;
    currentToken = null;
  }
}
