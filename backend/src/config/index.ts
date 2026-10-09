import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (overrides), then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || (
  nodeEnv === 'development' ? 'medipriority_dev_secret_change_in_production' : ''
);

if (nodeEnv === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/medipriority',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  bcryptRounds: 12,
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 500,
  },
};
