import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler } from './middleware/error.middleware.js';
import { globalLimiter } from './middleware/rate-limit.middleware.js';

const app = express();

// Disable X-Powered-By to prevent technology fingerprinting
app.disable('x-powered-by');

// Add standard security headers with cross-origin asset support
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
  : ['http://localhost:5173'];

const corsOrigin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve local uploaded media if local fallback is used
app.use('/uploads', express.static(path.resolve('uploads')));

// Root health check for platform load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'rent-flatmate-finder-backend',
  });
});

// Root API router with global rate limiting
app.use('/api', globalLimiter, routes);

// Central error handling middleware
app.use(errorHandler);

export default app;
