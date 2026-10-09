import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first (overrides), then fall back to .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || '';

if (
  jwtSecret.length < 32 ||
  (nodeEnv === 'production' && jwtSecret === 'your_super_secret_change_in_production')
) {
  throw new Error('Configure SESSION_SECRET with at least 32 random characters; do not use placeholder values');
}

if (nodeEnv === 'production' && (!process.env.SMTP_HOST || !process.env.SMTP_FROM)) {
  throw new Error('Configure SMTP_HOST and SMTP_FROM to enable owner email verification');
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1'),
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
