const express = require('express');
const rateLimit = require('express-rate-limit');
const authService = require('../services/authService');
const { registerSchema, loginSchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const config = require('../config');
const db = require('../db');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: config.authRateLimit.windowMs,
  max: config.authRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later', code: 'RATE_LIMITED' },
});

router.get('/status', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  res.json({ hasUsers: count > 0, registrationOpen: true, firstAccountIsOwner: count === 0 });
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
