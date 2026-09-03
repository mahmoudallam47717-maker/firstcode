const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');
const config = require('../config');

// ضفنا async عشان لو احتاج يعدل كود المختص يستنى قاعدة البيانات
async function sanitizeUser(user) {
  if (!user) return null;
  if (user.persona === 'specialist' && !user.specialist_code) {
    user.specialist_code = `SPEC-${user.id}`;
    await db.prepare('UPDATE users SET specialist_code = ? WHERE id = ?').run(user.specialist_code, user.id);
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    persona: user.persona || 'specialist',
    specialist_code: user.specialist_code || null,
    can_manage: !!user.can_manage,
    is_active: !!user.is_active,
    shift_start: user.shift_start || null,
    shift_end: user.shift_end || null,
    hourly_rate: Number(user.hourly_rate) || 0,
    deficit_minutes: Number(user.deficit_minutes) || 0,
    manual_deficit: Number(user.manual_deficit) || 0,
    created_at: user.created_at,
  };
}

async function register({ name, email, password, persona }) {
  // ضفنا await في كل تعاملات قاعدة البيانات
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_TAKEN');
  }

  const hash = await bcrypt.hash(password, config.bcryptRounds);
  const rowCount = await db.prepare('SELECT COUNT(*) AS c FROM users').get();
  const count = parseInt(rowCount.c, 10);
  
  await db
    .prepare('INSERT INTO users (name, email, password_hash, role, persona) VALUES (?, ?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase(), hash, count === 0 ? 'admin' : 'user', persona || 'specialist');
  
  // نجيب بيانات المستخدم اللي لسه متسجل حالا عشان نعرف الـ ID بتاعه
  const insertedUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  const newUserId = insertedUser.id;

  if ((persona || 'specialist') === 'specialist') {
    await db.prepare('UPDATE users SET specialist_code = ? WHERE id = ?').run(`SPEC-${newUserId}`, newUserId);
  }

  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId);
  return { user: await sanitizeUser(user), token: signToken(user) };
}

async function login({ email, password }) {
  // ضفنا await عشان يستنى يجيب بيانات المستخدم
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return { user: await sanitizeUser(user), token: signToken(user) };
}

module.exports = { register, login, sanitizeUser };