const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, issuer: 'taskflow', algorithm: 'HS256' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { issuer: 'taskflow', algorithms: ['HS256'] });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = db.prepare('SELECT id, name, email, role, persona, specialist_code, can_manage, is_active, shift_start, shift_end, hourly_rate, manual_deficit, created_at FROM users WHERE id = ?').get(payload.sub);
  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }
  if (!user.is_active) {
    return res.status(403).json({ error: 'الحساب معطّل، تواصل مع المدير' });
  }

  req.user = user;
  req.tokenPayload = payload;
  return next();
}

function isAdmin(user) {
  return !!user && (user.role === 'admin' || !!user.can_manage);
}

function requireAdmin(req, res, next) {
  if (!req.user || !isAdmin(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin, isAdmin };
