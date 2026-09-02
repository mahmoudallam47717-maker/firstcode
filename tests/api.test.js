const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = './data/test.db';
process.env.PORT = '0';
process.env.JWT_SECRET = 'test-secret-for-suite';
process.env.RATE_LIMIT_MAX = '300';
process.env.AUTH_RATE_LIMIT_MAX = '1000';

const { start } = require('../src/server');
const db = require('../src/db');

let server;
let base;

before(async () => {
  db.exec('DELETE FROM shifts; DELETE FROM projects; DELETE FROM users;');
  server = start();
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  db.close();
});

async function req(method, path, body, token) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

// ---- First user becomes admin ----
let adminToken;
test('first register becomes admin (no users)', async () => {
  const { status, data } = await req('POST', '/api/auth/register', {
    name: 'Owner', email: 'boss@office.com', password: '1234' });
  assert.equal(status, 201);
  assert.equal(data.user.role, 'admin');
  adminToken = data.token;
});

test('anyone can self-register after the owner', async () => {
  const { status, data } = await req('POST', '/api/auth/register', {
    name: 'Intruder', email: 'x@x.com', password: '1234', persona: 'intermediary' });
  assert.equal(status, 201);
  assert.equal(data.user.role, 'user');
  assert.equal(data.user.persona, 'intermediary');
});

test('specialist receives an automatic unique code', async () => {
  const registered = await req('POST', '/api/auth/register', {
    name: 'Auto Specialist', email: 'auto-specialist@office.com', password: '1234', persona: 'specialist' });
  assert.equal(registered.status, 201);
  assert.match(registered.data.user.specialist_code, /^SPEC-\d+$/);
  assert.ok(registered.data.user.specialist_code);
});

// ---- Admin adds an employee ----
let empToken;
test('admin can create employee', async () => {
  const { status, data } = await req('POST', '/api/users/admin/users',
    { name: 'كريم', email: 'karim@office.com', password: '1234', persona: 'specialist', specialist_code: 'KARIM-001' }, adminToken);
  assert.equal(status, 201);
  assert.equal(data.user.role, 'user');
});

test('login as employee returns token', async () => {
  const { status, data } = await req('POST', '/api/auth/login',
    { email: 'karim@office.com', password: '1234' });
  assert.equal(status, 200);
  assert.ok(data.user.specialist_code);
  empToken = data.token;
});

test('specialist code remains available from the current-user endpoint', async () => {
  const { status, data } = await req('GET', '/api/users/me', undefined, empToken);
  assert.equal(status, 200);
  assert.ok(data.user.specialist_code);
});

test('user can change their own password', async () => {
  const changed = await req('PATCH', '/api/users/me/password', {
    currentPassword: '1234', newPassword: '5678',
  }, empToken);
  assert.equal(changed.status, 200);
  const loggedIn = await req('POST', '/api/auth/login', {
    email: 'karim@office.com', password: '5678',
  });
  assert.equal(loggedIn.status, 200);
  empToken = loggedIn.data.token;
});

test('role-specific assignment lists return specialists and intermediaries', async () => {
  const specialists = await req('GET', '/api/users/specialists', undefined, empToken);
  assert.ok(specialists.data.users.some((user) => user.email === 'karim@office.com'));
  const intermediaries = await req('GET', '/api/users/intermediaries', undefined, empToken);
  assert.ok(intermediaries.data.users.some((user) => user.email === 'x@x.com'));
});

test('employee cannot access admin cashier (403)', async () => {
  const { status } = await req('GET', '/api/users/admin/cashier', undefined, empToken);
  assert.equal(status, 403);
});

// ---- Shift ----
test('employee starts a shift', async () => {
  const { status, data } = await req('POST', '/api/shifts/start', {}, empToken);
  assert.equal(status, 201);
  assert.ok(data.shift && !data.shift.ended_at);
});

test('cannot start second active shift (400)', async () => {
  const { status } = await req('POST', '/api/shifts/start', {}, empToken);
  assert.equal(status, 400);
});

// ---- Project ----
let projId;
test('employee creates a project linked to shift', async () => {
  const shifts = await req('GET', '/api/shifts', undefined, empToken);
  const shiftId = shifts.data.active.id;
  const { status, data } = await req('POST', '/api/projects',
    { title: 'بحث علمي', project_type: 'research', amount: 500, shift_id: shiftId }, empToken);
  assert.equal(status, 201);
  assert.equal(data.project.project_type, 'research');
  projId = data.project.id;
});

test('employee marks project done -> income total', async () => {
  const approved = await req('POST', `/api/users/projects/${projId}/approve`, {}, empToken);
  assert.equal(approved.status, 200);
  assert.equal(approved.data.project.status, 'in_progress');
  const { data } = await req('PATCH', `/api/projects/${projId}`, { status: 'done' }, empToken);
  assert.equal(data.project.status, 'done');
  const stats = await req('GET', '/api/projects/stats', undefined, empToken);
  assert.equal(stats.data.stats.earned_total, 500);
  assert.equal(stats.data.stats.earned_confirmed, 0);
});

test('assigned specialist confirms project -> income confirmed', async () => {
  const { status } = await req('POST', `/api/users/projects/${projId}/confirm`, {}, empToken);
  assert.equal(status, 200);
  const cash = await req('GET', '/api/users/admin/cashier', undefined, adminToken);
  assert.equal(cash.data.totals.earned_confirmed, 500);
});

test('intermediary cannot confirm a project assigned to a specialist', async () => {
  const intermediaryLogin = await req('POST', '/api/auth/login',
    { email: 'x@x.com', password: '1234' });
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const specialist = users.data.users.find((user) => user.email === 'karim@office.com');
  const { status, data } = await req('POST', '/api/projects',
    { title: 'مشروع وسيط', project_type: 'report', amount: 90, executor_code: 'KARIM-001' }, intermediaryLogin.data.token);
  const denied = await req('POST', `/api/users/projects/${data.project.id}/confirm`, {}, intermediaryLogin.data.token);
  assert.equal(denied.status, 403);
});

test('intermediary project is assigned only by an exact specialist code', async () => {
  const intermediaryLogin = await req('POST', '/api/auth/login', { email: 'x@x.com', password: '1234' });
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const specialist = users.data.users.find((user) => user.email === 'karim@office.com');
  await req('PATCH', `/api/users/admin/users/${specialist.id}`, { specialist_code: 'KARIM-001' }, adminToken);
  const created = await req('POST', '/api/projects', { title: 'كود مختص', amount: 40, executor_code: 'KARIM-001' }, intermediaryLogin.data.token);
  assert.equal(created.status, 201);
  assert.equal(created.data.project.executor_id, specialist.id);
  const wrong = await req('POST', '/api/projects', { title: 'كود خاطئ', executor_code: 'NO-SUCH-CODE' }, intermediaryLogin.data.token);
  assert.equal(wrong.status, 400);
});

test('client can see the request but not private income details', async () => {
  const client = await req('POST', '/api/auth/register',
    { name: 'Client', email: 'client@office.com', password: '1234', persona: 'client' });
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const intermediary = users.data.users.find((user) => user.email === 'x@x.com');
  const specialist = users.data.users.find((user) => user.email === 'karim@office.com');
  const created = await req('POST', '/api/projects', {
    title: 'طلب عميل', project_type: 'report', amount: 750,
    intermediary_id: intermediary.id, phone: '01012345678',
  }, client.data.token);
  assert.equal(created.status, 201);
  assert.equal(created.data.project.income_visible, false);
  assert.equal(created.data.project.amount, null);
  const intermediaryToken = (await req('POST', '/api/auth/login', { email: 'x@x.com', password: '1234' })).data.token;
  const assigned = await req('PATCH', `/api/projects/${created.data.project.id}`, { executor_code: 'KARIM-001' }, intermediaryToken);
  assert.equal(assigned.status, 200);
  const intermediaryProjects = await req('GET', '/api/projects', undefined, intermediaryToken);
  const shared = intermediaryProjects.data.projects.find((project) => project.id === created.data.project.id);
  assert.equal(shared.amount, 750);
  assert.equal(shared.income_visible, true);
  const specialistProjects = await req('GET', '/api/projects', undefined, empToken);
  const specialistView = specialistProjects.data.projects.find((project) => project.id === created.data.project.id);
  assert.equal(specialistView.phone, '');
});

test('assigned specialist approves request and other specialist is denied', async () => {
  const intermediaryLogin = await req('POST', '/api/auth/login',
    { email: 'x@x.com', password: '1234' });
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const specialist = users.data.users.find((user) => user.email === 'karim@office.com');
  const created = await req('POST', '/api/projects',
    { title: 'اعتماد طلب', project_type: 'design', amount: 120, executor_code: 'KARIM-001' }, intermediaryLogin.data.token);
  const approved = await req('POST', `/api/users/projects/${created.data.project.id}/approve`, {}, empToken);
  assert.equal(approved.status, 200);
  assert.equal(approved.data.project.request_status, 'approved');
  assert.equal(approved.data.project.status, 'in_progress');
  const visible = await req('GET', '/api/projects', undefined, intermediaryLogin.data.token);
  assert.equal(visible.data.projects.find((project) => project.id === created.data.project.id).request_status, 'approved');
});

test('admin can edit another employee project amount', async () => {
  const { data } = await req('PATCH', `/api/projects/${projId}`, { amount: 600 }, adminToken);
  assert.equal(data.project.amount, 600);
});

// ---- End shift ----
test('employee ends shift', async () => {
  const { status, data } = await req('POST', '/api/shifts/end', {}, empToken);
  assert.equal(status, 200);
  assert.ok(data.shift.ended_at);
});

test('cannot end shift without active one (400)', async () => {
  const { status } = await req('POST', '/api/shifts/end', {}, empToken);
  assert.equal(status, 400);
});

// ---- Admin edits employee name ----
test('admin edits employee name', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const emp = users.data.users.find((u) => u.email === 'karim@office.com');
  const { data } = await req('PATCH', `/api/users/admin/users/${emp.id}`,
    { name: 'كريم محمد' }, adminToken);
  assert.equal(data.user.name, 'كريم محمد');
});

test('admin sets employee shift times', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const emp = users.data.users.find((u) => u.email === 'karim@office.com');
  const { status, data } = await req('PATCH', `/api/users/admin/users/${emp.id}`,
    { shift_start: '10:00', shift_end: '18:00' }, adminToken);
  assert.equal(status, 200);
  assert.equal(data.user.shift_start, '10:00');
  assert.equal(data.user.shift_end, '18:00');
  const again = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const updated = again.data.users.find((u) => u.email === 'karim@office.com');
  assert.equal(updated.shift_start, '10:00');
});

test('admin can save intermediary and client roles without specialist code', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const specialist = users.data.users.find((u) => u.email === 'karim@office.com');
  const intermediaryUser = await req('POST', '/api/users/admin/users', { name: 'Role Intermediary', email: 'role-intermediary@office.com', password: '1234', persona: 'specialist', specialist_code: 'ROLE-001' }, adminToken);
  const intermediary = await req('PATCH', `/api/users/admin/users/${intermediaryUser.data.user.id}`, { persona: 'intermediary' }, adminToken);
  assert.equal(intermediary.status, 200);
  assert.equal(intermediary.data.user.persona, 'intermediary');
  assert.equal(intermediary.data.user.specialist_code, null);
  const client = await req('POST', '/api/users/admin/users', { name: 'عميل', email: 'role-client@office.com', password: '1234', persona: 'client' }, adminToken);
  assert.equal(client.status, 201);
  assert.equal(client.data.user.specialist_code, null);
});

test('invalid shift time format is rejected (400)', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const emp = users.data.users.find((u) => u.email === 'karim@office.com');
  const { status } = await req('PATCH', `/api/users/admin/users/${emp.id}`,
    { shift_start: '25:99' }, adminToken);
  assert.equal(status, 400);
});

test('admin sets employee hourly rate for money deficit', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const emp = users.data.users.find((u) => u.email === 'karim@office.com');
  const { status, data } = await req('PATCH', `/api/users/admin/users/${emp.id}`,
    { hourly_rate: 50 }, adminToken);
  assert.equal(status, 200);
  assert.equal(data.user.hourly_rate, 50);
  const again = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const updated = again.data.users.find((u) => u.email === 'karim@office.com');
  assert.equal(updated.hourly_rate, 50);
  assert.ok(updated.deficit_minutes >= 0);
  assert.equal(updated.deficit_amount, Math.round((updated.deficit_minutes / 60) * 50 * 100) / 100);
});

test('admin sets manual money deficit per employee (admin-only, not auto)', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const emp = users.data.users.find((u) => u.email === 'karim@office.com');
  const { status, data } = await req('PATCH', `/api/users/admin/users/${emp.id}`,
    { manual_deficit: 150 }, adminToken);
  assert.equal(status, 200);
  assert.equal(data.user.manual_deficit, 150);
  const again = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const updated = again.data.users.find((u) => u.email === 'karim@office.com');
  assert.equal(updated.manual_deficit, 150);
  const me = await req('GET', '/api/users/me', undefined, empToken);
  assert.equal(me.data.user.manual_deficit, 150);
});

test('project does not expose customer phone or support phone search', async () => {
  const { status, data } = await req('POST', '/api/projects',
    { title: 'ديزاين', project_type: 'design', amount: 200, phone: '01001234567' }, empToken);
  assert.equal(status, 201);
  assert.equal(data.project.phone, '');
  const search = await req('GET', '/api/projects?search=0100123456', undefined, empToken);
  assert.equal(search.data.projects.length, 0);
});

test('project supports order code and lookup by code', async () => {
  const { status, data } = await req('POST', '/api/projects',
    { title: 'منصة', project_type: 'platform', amount: 1000, code: '11111' }, empToken);
  assert.equal(status, 201);
  assert.equal(data.project.code, '11111');
  const dup = await req('POST', '/api/projects',
    { title: 'مشروع آخر', project_type: 'other', amount: 5, code: '11111' }, empToken);
  assert.equal(dup.status, 409);
  const lookup = await req('GET', '/api/projects/lookup?code=11111', undefined, empToken);
  assert.equal(lookup.data.projects.length, 1);
  assert.equal(lookup.data.projects[0].code, '11111');
});

test('project stores due date', async () => {
  const { status, data } = await req('POST', '/api/projects',
    { title: 'تقرير مع موعد', project_type: 'report', amount: 300, code: '22222', due_date: '2026-12-31' }, empToken);
  assert.equal(status, 201);
  assert.equal(data.project.due_date, '2026-12-31');
});

test('project stores delivery time and executor name', async () => {
  const { status, data } = await req('POST', '/api/projects',
    { title: 'تسليم بوقت', project_type: 'design', amount: 150, code: '33333', due_date: '2026-11-20', delivery_time: '17:30', client_name: 'سارة', currency: 'sar' }, empToken);
  assert.equal(status, 201);
  assert.equal(data.project.delivery_time, '17:30');
  assert.equal(data.project.client_name, 'سارة');
  assert.equal(data.project.currency, 'sar');
  assert.ok(data.project.executor_name && data.project.executor_name.length > 0);
  const list = await req('GET', '/api/projects', undefined, adminToken);
  const found = list.data.projects.find((p) => p.code === '33333');
  assert.equal(found.delivery_time, '17:30');
  assert.equal(found.client_name, 'سارة');
  assert.equal(found.currency, 'sar');
  assert.equal(found.executor_name, 'كريم محمد');
});

test('project defaults to EGP and rejects invalid currency', async () => {
  const { data } = await req('POST', '/api/projects',
    { title: 'بلا عملة', project_type: 'other', amount: 5, code: '44444' }, empToken);
  assert.equal(data.project.currency, 'egp');
  const bad = await req('POST', '/api/projects',
    { title: 'عملة خاطئة', project_type: 'other', amount: 5, currency: 'eur' }, empToken);
  assert.equal(bad.status, 400);
});

test('system auto-generates unique sequential code when none provided', async () => {
  const { data: a } = await req('POST', '/api/projects',
    { title: 'كود تلقائي 1', project_type: 'other', amount: 10 }, empToken);
  const { data: b } = await req('POST', '/api/projects',
    { title: 'كود تلقائي 2', project_type: 'other', amount: 20 }, empToken);
  assert.ok(String(a.project.code).length > 0);
  assert.ok(Number(a.project.code) !== Number(b.project.code));
  assert.ok(Number(b.project.code) > Number(a.project.code));
  const next = await req('GET', '/api/projects/next-code', undefined, empToken);
  assert.ok(Number(next.data.code) > Number(b.project.code));
});

test('new project types available in /types', async () => {
  const { data } = await req('GET', '/api/projects/types', undefined, empToken);
  for (const t of ['platform', 'software', 'website', 'app', 'video']) assert.ok(data.types.includes(t));
});

test('shift with scheduled times computes deficit when ended early', async () => {
  await req('POST', '/api/shifts/start', {}, empToken);
  const { status, data } = await req('POST', '/api/shifts/end', {}, empToken);
  assert.equal(status, 200);
  // scheduled 10:00-18:00 = 480 min; the auto-closed test shift ran ~0 min -> deficit > 0
  assert.ok(data.shift.scheduled_start === '10:00');
  assert.ok(data.shift.deficit_minutes > 0);
  assert.ok(data.summary && data.summary.deficit && data.summary.deficit.minutes > 0);
});

test('employee cannot delete admin (guard)', async () => {
  const users = await req('GET', '/api/users/admin/users', undefined, adminToken);
  const boss = users.data.users.find((u) => u.email === 'boss@office.com');
  const { status } = await req('DELETE', `/api/users/admin/users/${boss.id}`, undefined, empToken);
  assert.equal(status, 403);
});

// ---- Cashier with date filter + export ----
test('cashier date filter returns confirmed income', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10);
  const { status, data } = await req('GET', `/api/users/admin/cashier?from=${monthAgo}&to=${today}`, undefined, adminToken);
  assert.equal(status, 200);
  assert.equal(data.totals.earned_confirmed, 600);
  assert.equal(data.unconfirmed.length, 0);
});

test('cashier CSV export returns file', async () => {
  const res = await fetch(`${base}/api/users/admin/cashier.csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.ok(csv.replace('\uFEFF', '').includes('name,role'));
});

test('projects CSV export returns file', async () => {
  const res = await fetch(`${base}/api/projects/export.csv`, {
    headers: { Authorization: `Bearer ${empToken}` },
  });
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.ok(csv.includes('id,code'));
});

test('protected route without token → 401', async () => {
  const { status } = await req('GET', '/api/projects');
  assert.equal(status, 401);
});

test('admin bulk-deletes selected projects', async () => {
  const a = await req('POST', '/api/projects', { title: 'سيحذف', project_type: 'other', amount: 1, code: 'bulk1' }, empToken);
  const b = await req('POST', '/api/projects', { title: 'سيبقى', project_type: 'other', amount: 2, code: 'bulk2' }, empToken);
  const { status, data } = await req('POST', '/api/projects/admin/bulk-delete', { ids: [a.data.project.id] }, adminToken);
  assert.equal(status, 200);
  assert.equal(data.deleted, 1);
  const gone = await req('GET', `/api/projects/${a.data.project.id}`, undefined, empToken);
  assert.equal(gone.status, 404);
  const kept = await req('GET', `/api/projects/${b.data.project.id}`, undefined, empToken);
  assert.equal(kept.status, 200);
});

test('admin cannot bulk-delete with empty ids (400)', async () => {
  const { status } = await req('POST', '/api/projects/admin/bulk-delete', { ids: [] }, adminToken);
  assert.equal(status, 400);
});

test('employee cannot bulk-delete (403)', async () => {
  const { status } = await req('POST', '/api/projects/admin/clear', {}, empToken);
  assert.equal(status, 403);
});

test('employee cannot delete a project (admin only)', async () => {
  const { data } = await req('POST', '/api/projects',
    { title: 'مشروع محمي', project_type: 'other', amount: 7, code: 'deleteguard' }, empToken);
  const id = data.project.id;
  const empDel = await req('DELETE', `/api/projects/${id}`, undefined, empToken);
  assert.equal(empDel.status, 403);
  const stillThere = await req('GET', `/api/projects/${id}`, undefined, empToken);
  assert.equal(stillThere.status, 200);
  const adminDel = await req('DELETE', `/api/projects/${id}`, undefined, adminToken);
  assert.equal(adminDel.status, 200);
});