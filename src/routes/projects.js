const express = require('express');
const projectService = require('../services/projectService');
const { createProjectSchema, updateProjectSchema, projectQuerySchema } = require('../schemas');
const { validate } = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { AppError } = require('../middleware/errorHandler');

const router = express.Router();

router.use(requireAuth);

const adminOpts = (req) => ({ admin: req.user.role === 'admin' || !!req.user.can_manage });

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

router.get('/export.csv', (req, res) => {
  const projects = projectService.listProjects(req.user.id, req.query, adminOpts(req));
  const rows = projects.map((p) => ({
    id: p.id, code: p.code, title: p.title, type: projectService.PROJECT_TYPE_LABELS[p.project_type] || p.project_type,
    amount: p.amount, status: p.status, confirmed: p.is_confirmed ? 'مؤكد' : 'لا',
    executor: p.executor_name || '', client_name: p.client_name || '', currency: p.currency || 'egp', due_date: p.due_date || '', delivery_time: p.delivery_time || '', notes: p.notes, created_at: p.created_at,
  }));
  const csv = toCsv(rows, ['id', 'code', 'title', 'type', 'amount', 'currency', 'status', 'confirmed', 'executor', 'client_name', 'due_date', 'delivery_time', 'notes', 'created_at']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
  res.send(csv);
});

router.get('/types', (req, res) => {
  res.json({ types: projectService.PROJECT_TYPES, labels: projectService.PROJECT_TYPE_LABELS });
});

router.get('/currencies', (req, res) => {
  res.json({ currencies: projectService.CURRENCIES, labels: projectService.CURRENCY_LABELS, symbols: projectService.CURRENCY_SYMBOLS });
});

router.get('/next-code', (req, res) => {
  res.json({ code: projectService.generateProjectCode() });
});

router.get('/resolve-specialist', (req, res) => {
  res.json({ specialist: projectService.resolveSpecialistCode(req.query.code) });
});

router.get('/lookup', validate(projectQuerySchema, 'query'), (req, res) => {
  const { code } = req.query;
  const projects = projectService.listProjects(req.user.id, { code: code || '' }, adminOpts(req));
  res.json({ projects });
});

router.get('/stats', (req, res) => {
  res.json({ stats: projectService.myStats(req.user.id) });
});

router.post('/admin/clear', requireAdmin, (req, res) => {
  const info = projectService.clearAllProjects();
  res.json({ deleted: info.changes });
});

router.post('/admin/bulk-delete', requireAdmin, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'اختر مشاريع على الأقل', 'NO_IDS');
  const clean = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!clean.length) throw new AppError(400, 'معرفات غير صحيحة', 'BAD_IDS');
  const info = projectService.deleteProjects(clean);
  res.json({ deleted: info.changes });
});

router.get('/', validate(projectQuerySchema, 'query'), (req, res) => {
  res.json({ projects: projectService.listProjects(req.user.id, req.query, adminOpts(req)) });
});

router.post('/', validate(createProjectSchema), (req, res) => {
  res.status(201).json({ project: projectService.createProject(req.user.id, req.body) });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'معرف غير صحيح', 'INVALID_ID');
  res.json({ project: projectService.getScoped(req.user.id, id, adminOpts(req)) });
});

router.patch('/:id', validate(updateProjectSchema), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'معرف غير صحيح', 'INVALID_ID');
  res.json({ project: projectService.updateProject(req.user.id, id, req.body, adminOpts(req)) });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'معرف غير صحيح', 'INVALID_ID');
  res.json(projectService.deleteProject(req.user.id, id, adminOpts(req)));
});

module.exports = router;