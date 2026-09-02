const db = require('../db');
const { AppError } = require('../middleware/errorHandler');

function getActiveShift(userId) {
  return db
    .prepare('SELECT * FROM shifts WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(userId);
}

function listShifts(userId) {
  return db
    .prepare(
      `SELECT s.*,
              (SELECT COALESCE(SUM(p.amount), 0) FROM projects p WHERE p.shift_id = s.id AND p.status = 'done' AND p.is_confirmed = 1) AS earned
       FROM shifts s
       WHERE s.user_id = ?
       ORDER BY s.started_at DESC`
    )
    .all(userId);
}

function toMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtMinutes(min) {
  if (min == null || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return `${h} ساعة`;
  return `${h} ساعة و ${m} دقيقة`;
}

function startShift(userId) {
  if (getActiveShift(userId)) {
    throw new AppError(400, 'لديك شيفت مفتوح بالفعل', 'SHIFT_ALREADY_ACTIVE');
  }
  const user = db.prepare('SELECT shift_start, shift_end FROM users WHERE id = ?').get(userId);
  const info = db
    .prepare(
      'INSERT INTO shifts (user_id, scheduled_start, scheduled_end) VALUES (?, ?, ?)'
    )
    .run(userId, user && user.shift_start || null, user && user.shift_end || null);
  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(info.lastInsertRowid);
}

function endShift(userId) {
  const shift = getActiveShift(userId);
  if (!shift) {
    throw new AppError(400, 'لا يوجد شيفت مفتوح لإنهائه', 'NO_ACTIVE_SHIFT');
  }
  db.prepare('UPDATE shifts SET ended_at = datetime(\'now\') WHERE id = ?').run(shift.id);
  const ended = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);

  const earned = db
    .prepare(
      "SELECT COALESCE(SUM(amount), 0) AS earned FROM projects WHERE shift_id = ? AND status = 'done' AND is_confirmed = 1"
    )
    .get(shift.id).earned;

  // Calculate deficit: if the employee ends the shift before the scheduled end time
  // (or works fewer minutes than scheduled), compute the shortfall in minutes.
  const deficit = computeDeficit(ended);
  if (deficit && deficit.minutes > 0) {
    db.prepare('UPDATE shifts SET deficit_minutes = ? WHERE id = ?').run(deficit.minutes, shift.id);
  }
  const withDeficit = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);

  return { shift: withDeficit, summary: { earned, deficit: deficit && deficit.minutes > 0 ? deficit : null } };
}

function computeDeficit(shift) {
  const start = toMinutes(shift.scheduled_start);
  const end = toMinutes(shift.scheduled_end);
  if (start == null || end == null) return null;

  const sStart = toMinutes(shift.started_at && String(shift.started_at).slice(11, 16));
  const sEnd = toMinutes(shift.ended_at && String(shift.ended_at).slice(11, 16));
  if (sStart == null || sEnd == null) return null;

  const scheduled = end - start; // scheduled minutes in the shift window
  const worked = sEnd - sStart;  // minutes actually worked
  const minutes = Math.max(0, scheduled - worked);

  if (minutes <= 0) return null;
  return { minutes, scheduled, worked, label: fmtMinutes(minutes) };
}

module.exports = { listShifts, startShift, endShift, getActiveShift, computeDeficit, fmtMinutes };