import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { connectDB } from './config/database';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import appointmentRoutes from './routes/appointments';
import queueRoutes from './routes/queue';
import aiRoutes from './routes/ai';
import adminRoutes from './routes/admin';
import hospitalRoutes from './routes/hospital';
import staffRoutes from './routes/staff';
import teamRoutes from './routes/team';
import inviteRoutes from './routes/invites';
import { cleanupPendingHospitalRegistrations } from './services/hospitalRegistrationCleanup';

const app = express();
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Production requests are accepted only from the configured frontend origin.
const allowedOrigins = config.nodeEnv === 'production'
  ? [config.frontendUrl]
  : [...new Set([
    config.frontendUrl,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ])];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/queue/sse' || req.path === '/health',
});
app.use('/api', limiter);

// Stricter limiter scoped only to login + register — NOT /me, /logout, etc.
// Prevents normal app usage from exhausting the quota and triggering 429s.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/staff/login', authLimiter);
app.use('/api/auth/staff-login', authLimiter);
app.use('/api/invites/accept', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  const hasSessionCookie = Boolean(req.cookies?.staff_token || req.cookies?.token);
  if ((origin && !allowedOrigins.includes(origin)) || (!origin && hasSessionCookie)) {
    res.status(403).json({ success: false, message: 'Request origin not allowed' });
    return;
  }
  next();
});

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Health check — available at both /health and /api/health
const healthHandler = (_req: import('express').Request, res: import('express').Response): void => {
  res.json({ status: 'ok', env: config.nodeEnv, timestamp: new Date().toISOString() });
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', hospitalRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
async function start(): Promise<void> {
  await connectDB();
  await cleanupPendingHospitalRegistrations().catch((error: unknown) => {
    console.error('Pending hospital registration cleanup failed:', error instanceof Error ? error.name : 'Unknown error');
  });
  const cleanupTimer = setInterval(() => {
    void cleanupPendingHospitalRegistrations().catch((error: unknown) => {
      console.error('Pending hospital registration cleanup failed:', error instanceof Error ? error.name : 'Unknown error');
    });
  }, 60 * 60 * 1000);
  cleanupTimer.unref();
  // Bind explicitly to 127.0.0.1 (IPv4) — Node 18+ resolves 'localhost' to ::1
  // (IPv6) first, which causes ECONNREFUSED on Windows when the Next.js rewrite
  // proxy connects to http://localhost:5000.
  app.listen(config.port, config.host, () => {
    console.log(`🚀 MediPriority API running on http://${config.host}:${config.port} [${config.nodeEnv}]`);
    console.log(`   Health: http://${config.host}:${config.port}/api/health`);
  });
}

start().catch((error: unknown) => {
  console.error('Server startup failed:', error instanceof Error ? error.name : 'Unknown error');
});

export default app;
