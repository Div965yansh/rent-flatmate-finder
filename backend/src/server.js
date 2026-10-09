import 'dotenv/config';
import http from 'http';
import app from './app.js';
import prisma from './config/prisma.js';
import { initSocket } from './socket/socket.js';

const PORT = process.env.PORT || 5000;

const httpServer = http.createServer(app);

// Attach Socket.io to the HTTP server
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

// Graceful shutdown handling for container and cloud orchestrators
function handleShutdown(signal) {
  console.log(`Received ${signal}. Gracefully closing HTTP and database connections...`);
  httpServer.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Database connections closed.');
    } catch (err) {
      console.error('Error disconnecting database:', err);
    }
    process.exit(0);
  });

  // Force shutdown after 10s timeout if connections hang
  setTimeout(() => {
    console.error('Forced shutdown due to timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});
