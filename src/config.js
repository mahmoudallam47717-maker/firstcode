require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

const requiredInProd = ['JWT_SECRET', 'DB_PATH'];
  if (isProd) {
    for (const key of requiredInProd) {
      if (!process.env[key] || process.env[key].length === 0) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.trim().length === 0) {
      throw new Error('Missing required environment variable: CORS_ORIGIN');
    }
  }

const config = {
  env,
  isProd,
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || './data/taskflow.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: 12,
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  },
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  },
  corsOrigin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean) : [],
  trustProxy: process.env.TRUST_PROXY === 'true',
  logLevel: process.env.LOG_LEVEL || (isProd ? 'combined' : 'dev'),
};

module.exports = config;
