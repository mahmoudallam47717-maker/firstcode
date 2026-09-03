const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const shiftRoutes = require('./routes/shifts');
const userRoutes = require('./routes/user');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.set('trust proxy', config.trustProxy || 'loopback');

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin && config.corsOrigin.length > 0 ? config.corsOrigin : '*', // تعديل بسيط لـ Vercel
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.logLevel, { skip: () => config.env === 'test' }));

const globalLimiter = rateLimit({
  windowMs: config.rateLimit ? config.rateLimit.windowMs : 15 * 60 * 1000,
  max: config.rateLimit ? config.rateLimit.max : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
app.use('/api', globalLimiter);

app.get('/health', async (req, res) => { // تحويل الدالة لـ async عشان PostgreSQL
  try {
    const alive = await db.prepare('SELECT 1 AS ok').get();
    res.status(alive ? 200 : 503).json({ status: alive ? 'ok' : 'degraded', uptime: process.uptime() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/users', userRoutes);

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { index: 'index.html', maxAge: config.isProd ? '1h' : 0 }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

// حذفنا دالة start() لأن Vercel هو اللي بيشغل السيرفر بنفسه (Serverless)
module.exports = app;