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
    origin: config.corsOrigin.length > 0 ? config.corsOrigin : false,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(morgan(config.logLevel, { skip: () => config.env === 'test' }));

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', code: 'RATE_LIMITED' },
});
app.use('/api', globalLimiter);

app.get('/health', (req, res) => {
  const alive = db.prepare('SELECT 1 AS ok').get();
  res.status(alive ? 200 : 503).json({ status: alive ? 'ok' : 'degraded', uptime: process.uptime() });
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

function start() {
  const server = app.listen(config.port, config.host, () => {
    console.log(`[TaskFlow] listening on http://${config.host}:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`[TaskFlow] ${signal} received, shutting down gracefully...`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
module.exports = app;
