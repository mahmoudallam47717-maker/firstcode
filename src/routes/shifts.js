const express = require('express');
const shiftService = require('../services/shiftService');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ shifts: shiftService.listShifts(req.user.id), active: shiftService.getActiveShift(req.user.id) });
});

router.post('/start', (req, res) => {
  res.status(201).json({ shift: shiftService.startShift(req.user.id) });
});

router.post('/end', (req, res) => {
  res.json(shiftService.endShift(req.user.id));
});

router.get('/admin/all', requireAdmin, (req, res) => {
  const shifts = db
    .prepare(
      `SELECT s.*, u.name AS user_name,
              (SELECT COALESCE(SUM(p.amount), 0) FROM projects p WHERE p.shift_id = s.id AND p.status = 'done' AND p.is_confirmed = 1) AS earned
       FROM shifts s JOIN users u ON u.id = s.user_id
       ORDER BY s.started_at DESC`
    )
    .all();
  res.json({ shifts });
});

module.exports = router;