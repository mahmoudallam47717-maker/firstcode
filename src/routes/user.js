const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  changePasswordSchema,
  adminCreateUserSchema,
  adminUpdateUserSchema,
} = require('../schemas');
const { AppError } = require('../middleware/errorHandler');
const { sanitizeUser } = require('../services/authService');
const config = require('../config');
const projectService = require('../services/projectService');

const router = express.Router();

router.use(requireAuth);

router.get('/me', async (req, res, next) => {
  try {
    res.json({ user: await sanitizeUser(req.user) });
  } catch (err) {
    next(err);
  }
});

router.get('/specialists', async (req, res, next) => {
  try {
    const users = await db.prepare("SELECT id, name, email FROM users WHERE persona = 'specialist' AND is_active = 1 ORDER BY name COLLATE NOCASE").all();
    res.json({ users });
  } catch(err) { next(err); }
});

router.get('/intermediaries', async (req, res, next) => {
  try {
    const users = await db.prepare("SELECT id, name, email FROM users WHERE persona = 'intermediary' AND is_active = 1 ORDER BY name COLLATE NOCASE").all();
    res.json({ users });
  } catch(err) { next(err); }
});

router.post('/projects/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'معرف غير صحيح', 'INVALID_ID');
    res.json({ project: await projectService.approveProject(req.user.id, id) });
  } catch (err) { next(err); }
});

router.patch('/me/password', validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const full = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const ok = await bcrypt.compare(currentPassword, full.password_hash);
    if (!ok) {
      throw new AppError(400, 'كلمة المرور الحالية غير صحيحة', 'WRONG_PASSWORD');
    }
    if (currentPassword === newPassword) {
      throw new AppError(400, 'كلمة المرور الجديدة هي نفسها الحالية', 'SAME_PASSWORD');
    }
    const hash = await bcrypt.hash(newPassword, config.bcryptRounds);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.patch('/me', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      throw new AppError(400, 'الاسم مطلوب', 'NAME_REQUIRED');
    }
    await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80), req.user.id);
    const user = await db.prepare('SELECT id, name, email, role, persona, specialist_code, can_manage, is_active, shift_start, shift_end, hourly_rate, manual_deficit, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: await sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get(['/admin/income', '/admin/cashier'], requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    res.json(await projectService.adminOverview({ from, to }));
  } catch(err) { next(err); }
});

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

router.get(['/admin/income.csv', '/admin/cashier.csv'], requireAdmin, async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const data = await projectService.adminOverview({ from, to });
    const rows = data.perUser.map((u) => ({
      name: u.name, role: u.role, projects: u.projects, shift_count: u.shift_count,
      earned_confirmed: u.earned_confirmed, earned_total: u.earned_total,
    }));
    const csv = toCsv(rows, ['name', 'role', 'projects', 'shift_count', 'earned_confirmed', 'earned_total']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cashier-${from || 'all'}.csv"`);
    res.send(csv);
  } catch(err) { next(err); }
});

router.get('/admin/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await db
      .prepare(
        `SELECT u.id, u.name, u.email, u.role, u.persona, u.specialist_code, u.is_active, u.shift_start, u.shift_end, u.hourly_rate, u.manual_deficit, u.created_at,
                (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS project_count,
                (SELECT COALESCE(SUM(s.deficit_minutes), 0) FROM shifts s WHERE s.user_id = u.id) AS deficit_minutes,
                (SELECT COALESCE(SUM(p.amount), 0) FROM projects p WHERE p.user_id = u.id AND p.status = 'done' AND p.is_confirmed = 1) AS earned_confirmed
         FROM users u ORDER BY u.created_at DESC`
      )
      .all();
    for (const u of users) {
      const rate = Number(u.hourly_rate) || 0;
      u.deficit_amount = Math.round((u.deficit_minutes / 60) * rate * 100) / 100;
      u.manual_deficit = Number(u.manual_deficit) || 0;
    }
    res.json({ users });
  } catch(err) { next(err); }
});

router.post('/admin/users', requireAdmin, validate(adminCreateUserSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, persona, specialist_code, can_manage, shift_start, shift_end, hourly_rate, manual_deficit } = req.body;
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      throw new AppError(409, 'هذا البريد موجود بالفعل', 'EMAIL_TAKEN');
    }
    const cleanSpecialistCode = specialist_code ? specialist_code.trim().toUpperCase() : null;
    if (cleanSpecialistCode && (persona || 'specialist') !== 'specialist') throw new AppError(400, 'كود المختص مخصص للمختصين فقط', 'SPECIALIST_CODE_ROLE_MISMATCH');
    if (cleanSpecialistCode && await db.prepare('SELECT id FROM users WHERE UPPER(specialist_code) = ?').get(cleanSpecialistCode)) throw new AppError(409, 'كود المختص مستخدم بالفعل', 'SPECIALIST_CODE_TAKEN');
    
    let nextSpecCode = cleanSpecialistCode;
    if (!nextSpecCode && (persona || 'specialist') === 'specialist') {
       const userCountRes = await db.prepare('SELECT COUNT(*) as c FROM users').get();
       nextSpecCode = `SPEC-${(userCountRes?.c || 0) + 1}`;
    }

    const hash = await bcrypt.hash(password, config.bcryptRounds);
    const info = await db
      .prepare('INSERT INTO users (name, email, password_hash, role, persona, specialist_code, can_manage, shift_start, shift_end, hourly_rate, manual_deficit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(name.trim(), email.toLowerCase(), hash, role || 'user', persona || 'specialist', nextSpecCode, can_manage ? 1 : 0, shift_start || null, shift_end || null, Number(hourly_rate) || 0, Number(manual_deficit) || 0);
    
    const insertedId = info.lastInsertRowid || (await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())).id;
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(insertedId);
    res.status(201).json({ user: await sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.patch('/admin/users/:id', requireAdmin, validate(adminUpdateUserSchema), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) throw new AppError(404, 'المستخدم غير موجود', 'USER_NOT_FOUND');

    const updateData = {
      name: req.body.name !== undefined ? req.body.name.trim() : user.name,
      email: req.body.email !== undefined ? req.body.email.toLowerCase() : user.email,
      role: req.body.role !== undefined ? req.body.role : user.role,
      persona: req.body.persona !== undefined ? req.body.persona : (user.persona || 'specialist'),
      specialist_code: req.body.persona !== undefined && req.body.persona !== 'specialist'
        ? null
        : (req.body.specialist_code !== undefined ? (req.body.specialist_code ? req.body.specialist_code.trim().toUpperCase() : null) : user.specialist_code),
      can_manage: req.body.can_manage !== undefined ? (req.body.can_manage ? 1 : 0) : user.can_manage,
      is_active: req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : user.is_active,
      shift_start: req.body.shift_start !== undefined ? req.body.shift_start : user.shift_start,
      shift_end: req.body.shift_end !== undefined ? req.body.shift_end : user.shift_end,
      hourly_rate: req.body.hourly_rate !== undefined ? (Number(req.body.hourly_rate) || 0) : user.hourly_rate,
      manual_deficit: req.body.manual_deficit !== undefined ? (Number(req.body.manual_deficit) || 0) : user.manual_deficit,
    };

    if (req.body.email && req.body.email.toLowerCase() !== user.email) {
      const dup = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(updateData.email, id);
      if (dup) throw new AppError(409, 'هذا البريد موجود بالفعل', 'EMAIL_TAKEN');
    }
    if (updateData.specialist_code && updateData.persona !== 'specialist') updateData.specialist_code = null;
    if (updateData.specialist_code && updateData.specialist_code !== user.specialist_code && await db.prepare('SELECT id FROM users WHERE UPPER(specialist_code) = ? AND id != ?').get(updateData.specialist_code, id)) throw new AppError(409, 'كود المختص مستخدم بالفعل', 'SPECIALIST_CODE_TAKEN');

    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, config.bcryptRounds);
      await db.prepare(
        'UPDATE users SET name = ?, email = ?, role = ?, persona = ?, specialist_code = ?, can_manage = ?, is_active = ?, shift_start = ?, shift_end = ?, hourly_rate = ?, manual_deficit = ?, password_hash = ? WHERE id = ?'
      ).run(updateData.name, updateData.email, updateData.role, updateData.persona, updateData.specialist_code, updateData.can_manage, updateData.is_active, updateData.shift_start, updateData.shift_end, updateData.hourly_rate, updateData.manual_deficit, hash, id);
    } else {
      await db.prepare(
        'UPDATE users SET name = ?, email = ?, role = ?, persona = ?, specialist_code = ?, can_manage = ?, is_active = ?, shift_start = ?, shift_end = ?, hourly_rate = ?, manual_deficit = ? WHERE id = ?'
      ).run(updateData.name, updateData.email, updateData.role, updateData.persona, updateData.specialist_code, updateData.can_manage, updateData.is_active, updateData.shift_start, updateData.shift_end, updateData.hourly_rate, updateData.manual_deficit, id);
    }

    const updated = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json({ user: await sanitizeUser(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user.id) {
      throw new AppError(400, 'لا يمكنك حذف حسابك أنت', 'CANNOT_DELETE_SELF');
    }
    const info = await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (info.changes === 0) throw new AppError(404, 'المستخدم غير موجود', 'USER_NOT_FOUND');
    res.json({ deleted: true });
  } catch(err) { next(err); }
});

router.post('/projects/:id/confirm', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'معرف غير صحيح', 'INVALID_ID');
    res.json({ project: await projectService.confirmProject(req.user.id, id) });
  } catch(err) { next(err); }
});

module.exports = router;