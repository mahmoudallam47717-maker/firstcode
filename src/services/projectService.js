const db = require('../db');
const { AppError } = require('../middleware/errorHandler');

const PROJECT_TYPES = [
  'research', 'report', 'presentation', 'website', 'landing', 'ecommerce', 'platform', 'webapp',
  'software', 'app', 'mobile', 'tool', 'design', 'logo', 'branding', 'ui', 'ux', 'animation', 'photo',
  'video', 'writing', 'ebook', 'course', 'script', 'marketing', 'seo', 'socialmedia', 'ad',
  'data', 'excel', 'database', 'api', 'dashboard', 'chatbot', 'automation', 'integration',
  'translation', 'voice', 'proof', 'game', 'pos', 'erp', 'crm', 'blockchain', 'other',
];
const PROJECT_TYPE_LABELS = {
  research: 'بحث علمي', report: 'تقرير', presentation: 'عرض تقديمي', website: 'موقع ويب', landing: 'صفحة هبوط', ecommerce: 'متجر إلكتروني', platform: 'منصة إلكترونية', webapp: 'تطبيق ويب', software: 'برنامج كمبيوتر', app: 'تطبيق', mobile: 'تطبيق موبايل', tool: 'أداة / سكريبت', design: 'ديزاين', logo: 'لوجو / هوية بصرية', branding: 'براندينج', ui: 'تصميم واجهات (UI)', ux: 'تجربة مستخدم (UX)', animation: 'موشن جرافيك / أنيميشن', photo: 'مونتاج صور / فوتوشوب', video: 'فيديو / مونتاج', writing: 'كتابة / محتوى', ebook: 'كتاب إلكتروني', course: 'كورس تعليمي', script: 'إعداد / سيناريو / مسودات', marketing: 'تسويق', seo: 'تحسين محركات البحث (SEO)', socialmedia: 'إدارة سوشيال ميديا', ad: 'إعلان / حملة إعلانية', data: 'إدخال بيانات', excel: 'إكسل / جداول بيانات', database: 'قواعد بيانات', api: 'واجهة برمجية (API)', dashboard: 'لوحة تحكم / داشبورد', chatbot: 'شات بوت', automation: 'أتمتة عمليات', integration: 'ربط أنظمة / تكامل', translation: 'ترجمة', voice: 'تعليق صوتي / صوتيات', proof: 'تدقيق لغوي / مراجعة', game: 'ألعاب', pos: 'نظام كاشير / نقاط بيع', erp: 'نظام موارد / إدارة', crm: 'إدارة علاقات عملاء (CRM)', blockchain: 'بلوكتشين / عقود ذكية', other: 'أخرى',
};

const CURRENCIES = ['egp', 'sar', 'usd'];
const CURRENCY_LABELS = { egp: 'جنيه مصري', sar: 'ريال سعودي', usd: 'دولار أمريكي' };
const CURRENCY_SYMBOLS = { egp: 'ج.م', sar: 'ر.س', usd: '$' };
const normalizeSpecialistCode = (value) => String(value || '').trim().toUpperCase();

async function hideIncomeForClient(project, userId) {
  const user = await db.prepare('SELECT persona, role, can_manage FROM users WHERE id = ?').get(userId);
  const visible = !!user && (user.role === 'admin' || user.can_manage || user.persona === 'intermediary' || user.persona === 'specialist');
  if (visible) {
    return user.persona === 'specialist'
      ? { ...project, phone: '', income_visible: true }
      : { ...project, income_visible: true };
  }
  return { ...project, amount: null, currency: null, is_confirmed: null, phone: '', income_visible: false };
}

async function getScoped(userId, projectId, opts = {}) {
  const { admin } = opts;
  const sql = admin
    ? 'SELECT p.*, owner.name AS owner_name, intermediary.name AS intermediary_name, executor.name AS executor_name, executor.specialist_code AS executor_code FROM projects p LEFT JOIN users owner ON owner.id = p.user_id LEFT JOIN users intermediary ON intermediary.id = p.intermediary_id LEFT JOIN users executor ON executor.id = p.executor_id WHERE p.id = ?'
    : 'SELECT p.*, owner.name AS owner_name, intermediary.name AS intermediary_name, executor.name AS executor_name, executor.specialist_code AS executor_code FROM projects p LEFT JOIN users owner ON owner.id = p.user_id LEFT JOIN users intermediary ON intermediary.id = p.intermediary_id LEFT JOIN users executor ON executor.id = p.executor_id WHERE p.id = ? AND (p.user_id = ? OR p.intermediary_id = ? OR p.executor_id = ?)';
  const project = admin
    ? await db.prepare(sql).get(projectId)
    : await db.prepare(sql).get(projectId, userId, userId, userId);
  if (!project) {
    throw new AppError(404, 'المشروع غير موجود', 'PROJECT_NOT_FOUND');
  }
  return await hideIncomeForClient(project, userId);
}

async function listProjects(userId, query = {}, opts = {}) {
  const { admin } = opts;
  const { status, project_type, confirmed, search, code } = query;

  const conditions = [];
  const params = [];

  if (!admin) {
    conditions.push('(p.user_id = ? OR p.intermediary_id = ? OR p.executor_id = ?)');
    params.push(userId, userId, userId);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (project_type) {
    conditions.push('project_type = ?');
    params.push(project_type);
  }
  if (code) {
    conditions.push('code = ?');
    params.push(code);
  }
  if (confirmed !== undefined && confirmed !== '') {
    conditions.push('is_confirmed = ?');
    params.push(confirmed === 'true' || confirmed === '1' ? 1 : 0);
  }
  if (search) {
    conditions.push('(title LIKE ? OR notes LIKE ? OR code LIKE ? OR client_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const projects = await db
    .prepare(
      `SELECT p.*, owner.name AS owner_name, intermediary.name AS intermediary_name, executor.name AS executor_name, executor.specialist_code AS executor_code FROM projects p
       LEFT JOIN users owner ON owner.id = p.user_id
       LEFT JOIN users intermediary ON intermediary.id = p.intermediary_id
       LEFT JOIN users executor ON executor.id = p.executor_id
       ${where}
       ORDER BY p.created_at DESC`
    )
    .all(...params);
    
  return Promise.all(projects.map((project) => hideIncomeForClient(project, userId)));
}

async function generateProjectCode() {
  const rows = await db.prepare('SELECT code FROM projects').all();
  let max = 0;
  for (const r of rows) {
    const n = Number(String(r.code || '').trim());
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1);
}

async function resolveSpecialistCode(code) {
  const normalized = normalizeSpecialistCode(code);
  if (!normalized) return null;
  return (await db.prepare("SELECT id, name, email, specialist_code FROM users WHERE UPPER(specialist_code) = ? AND persona = 'specialist' AND is_active = 1").get(normalized)) || null;
}

async function createProject(userId, data) {
  const { title, project_type, amount, currency, status, notes, shift_id, phone, client_name, code, due_date, delivery_time, executor_id, executor_code, intermediary_id } = data;
  const creator = await db.prepare('SELECT persona FROM users WHERE id = ?').get(userId);
  if ((status || 'pending') !== 'pending') throw new AppError(400, 'الطلب يبدأ معلّقًا ويحدد المختص حالته', 'INITIAL_STATUS_MUST_BE_PENDING');
  if (creator && creator.persona === 'client' && executor_id) {
    throw new AppError(400, 'العميل يختار الوسيط فقط', 'CLIENT_CANNOT_ASSIGN_SPECIALIST');
  }
  if (creator && creator.persona === 'intermediary' && intermediary_id) {
    throw new AppError(400, 'الوسيط يختار المختص فقط', 'INTERMEDIARY_CANNOT_ASSIGN_INTERMEDIARY');
  }
  if (creator && creator.persona === 'intermediary' && !executor_code) {
    throw new AppError(400, 'اكتب كود المختص لتوجيه المشروع إليه', 'EXECUTOR_CODE_REQUIRED');
  }
  if (creator && creator.persona === 'intermediary' && executor_id) {
    throw new AppError(400, 'استخدم كود المختص فقط', 'EXECUTOR_ID_NOT_ALLOWED');
  }
  const effectiveIntermediaryId = intermediary_id || (creator && creator.persona === 'intermediary' ? userId : null);
  const codeExecutor = executor_code ? await resolveSpecialistCode(executor_code) : null;
  if (executor_code && !codeExecutor) throw new AppError(400, 'كود المختص غير صحيح أو غير متاح', 'INVALID_EXECUTOR_CODE');
  const effectiveExecutorId = codeExecutor ? codeExecutor.id : (creator && creator.persona === 'specialist' ? userId : null);
  if (executor_code && !effectiveExecutorId) throw new AppError(400, 'لم يتم ربط الكود بمختص', 'EXECUTOR_NOT_LINKED');
  if (effectiveIntermediaryId) {
    const intermediary = await db.prepare("SELECT id FROM users WHERE id = ? AND persona = 'intermediary' AND is_active = 1").get(effectiveIntermediaryId);
    if (!intermediary) throw new AppError(400, 'الوسيط المسؤول غير موجود أو غير متاح', 'INVALID_INTERMEDIARY');
  }
  if (effectiveExecutorId) {
    const executor = await db.prepare("SELECT id FROM users WHERE id = ? AND persona = 'specialist' AND is_active = 1").get(effectiveExecutorId);
    if (!executor) throw new AppError(400, 'المختص المنفذ غير موجود أو غير متاح', 'INVALID_EXECUTOR');
  }
  let codeVal = (code || '').trim();
  if (!codeVal) {
    codeVal = await generateProjectCode();
  }
  if (await db.prepare('SELECT id FROM projects WHERE code = ?').get(codeVal)) {
    throw new AppError(409, 'هذا الكود مستخدم في مشروع آخر، اختر كودًا مختلفًا', 'CODE_TAKEN');
  }
  const info = await db
    .prepare(
      `INSERT INTO projects (user_id, intermediary_id, executor_id, shift_id, code, title, project_type, amount, currency, status, notes, phone, client_name, due_date, delivery_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId, effectiveIntermediaryId, effectiveExecutorId, shift_id || null, codeVal, title.trim(),
      project_type || 'other', Math.max(0, Number(amount) || 0), CURRENCIES.includes(currency) ? currency : 'egp',
      'pending', notes || '', phone || '', client_name || '', due_date || null, delivery_time || null
    );
    
  const insertedId = info.lastInsertRowid || (await db.prepare('SELECT id FROM projects WHERE code = ?').get(codeVal)).id;
  return await getScoped(userId, insertedId);
}

async function updateProject(userId, projectId, patch, opts = {}) {
  const { admin } = opts;
  const current = await getScoped(userId, projectId, { admin });
  const creator = await db.prepare('SELECT persona FROM users WHERE id = ?').get(userId);
  if (patch.status !== undefined && patch.status !== current.status) {
    if (creator.persona !== 'specialist' || current.executor_id !== userId) {
      throw new AppError(403, 'تغيير حالة التنفيذ من اختصاص المختص المنفذ فقط', 'SPECIALIST_STATUS_REQUIRED');
    }
    if (patch.status === 'done' && current.request_status !== 'approved') {
      throw new AppError(400, 'اعتمد الطلب أولًا قبل تحويله إلى منجز', 'REQUEST_APPROVAL_REQUIRED');
    }
  }
  if (!admin && creator && creator.persona === 'client' && patch.executor_id) {
    throw new AppError(400, 'العميل يختار الوسيط فقط', 'CLIENT_CANNOT_ASSIGN_SPECIALIST');
  }
  if (!admin && creator && creator.persona === 'intermediary' && patch.intermediary_id) {
    throw new AppError(400, 'الوسيط يختار المختص فقط', 'INTERMEDIARY_CANNOT_ASSIGN_INTERMEDIARY');
  }
  if (!admin && creator && creator.persona === 'intermediary' && patch.executor_id !== undefined) {
    throw new AppError(400, 'استخدم كود المختص فقط', 'EXECUTOR_ID_NOT_ALLOWED');
  }

  const allowed = ['title', 'project_type', 'amount', 'currency', 'status', 'notes', 'shift_id', 'intermediary_id', 'executor_id', 'phone', 'client_name', 'code', 'due_date', 'delivery_time'];
  const nextData = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      nextData[key] = patch[key];
    } else {
      nextData[key] = current[key];
    }
  }
  if (patch.executor_code !== undefined) {
    const executor = patch.executor_code
      ? await db.prepare("SELECT id FROM users WHERE UPPER(specialist_code) = ? AND persona = 'specialist' AND is_active = 1").get(normalizeSpecialistCode(patch.executor_code))
      : null;
    if (patch.executor_code && !executor) throw new AppError(400, 'كود المختص غير صحيح أو غير متاح', 'INVALID_EXECUTOR_CODE');
    nextData.executor_id = executor ? executor.id : null;
  }
  nextData.amount = Math.max(0, Number(nextData.amount) || 0);
  nextData.code = (nextData.code || '').trim();
  nextData.currency = CURRENCIES.includes(nextData.currency) ? nextData.currency : 'egp';
  if (nextData.executor_id) {
    const executor = await db.prepare("SELECT id FROM users WHERE id = ? AND persona = 'specialist' AND is_active = 1").get(nextData.executor_id);
    if (!executor) throw new AppError(400, 'المختص المنفذ غير موجود أو غير متاح', 'INVALID_EXECUTOR');
  }
  if (nextData.intermediary_id) {
    const intermediary = await db.prepare("SELECT id FROM users WHERE id = ? AND persona = 'intermediary' AND is_active = 1").get(nextData.intermediary_id);
    if (!intermediary) throw new AppError(400, 'الوسيط المسؤول غير موجود أو غير متاح', 'INVALID_INTERMEDIARY');
  }
  if (nextData.code) {
    const dup = await db.prepare('SELECT id FROM projects WHERE code = ? AND id != ?').get(nextData.code, projectId);
    if (dup) throw new AppError(409, 'هذا الكود مستخدم في مشروع آخر، اختر كودًا مختلفًا', 'CODE_TAKEN');
  }

  await db.prepare(
    `UPDATE projects
    SET code = ?, title = ?, project_type = ?, amount = ?, currency = ?, status = ?, notes = ?, shift_id = ?, intermediary_id = ?, executor_id = ?, phone = ?, client_name = ?, due_date = ?, delivery_time = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(nextData.code, nextData.title, nextData.project_type, nextData.amount, nextData.currency, nextData.status, nextData.notes, nextData.shift_id || null, nextData.intermediary_id || null, nextData.executor_id || null, nextData.phone || '', nextData.client_name || '', nextData.due_date || null, nextData.delivery_time || null, projectId);

  return await getScoped(userId, projectId, { admin });
}

async function deleteProject(userId, projectId, opts = {}) {
  const { admin } = opts;
  await getScoped(userId, projectId, { admin });
  if (admin) {
    await db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  } else {
    await db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(projectId, userId);
  }
  return { deleted: true };
}

async function deleteProjects(ids) {
  const placeholders = ids.map(() => '?').join(',');
  return await db.prepare(`DELETE FROM projects WHERE id IN (${placeholders})`).run(...ids);
}

async function clearAllProjects() {
  return await db.prepare('DELETE FROM projects').run();
}

async function confirmProject(userId, projectId) {
  const project = await getScoped(userId, projectId);
  const user = await db.prepare('SELECT persona FROM users WHERE id = ?').get(userId);
  if (!user || user.persona !== 'specialist' || project.executor_id !== userId) {
    throw new AppError(403, 'تأكيد الدخل من اختصاص المختص المنفذ فقط', 'SPECIALIST_CONFIRMATION_REQUIRED');
  }
  await db.prepare('UPDATE projects SET is_confirmed = 1 WHERE id = ?').run(projectId);
  return await getScoped(userId, projectId);
}

async function approveProject(userId, projectId) {
  const project = await getScoped(userId, projectId);
  const user = await db.prepare('SELECT persona FROM users WHERE id = ?').get(userId);
  if (!user || user.persona !== 'specialist' || project.executor_id !== userId) {
    throw new AppError(403, 'اعتماد الطلب من اختصاص المختص المنفذ فقط', 'SPECIALIST_APPROVAL_REQUIRED');
  }
  await db.prepare("UPDATE projects SET request_status = 'approved', status = 'in_progress', approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE id = ?").run(userId, projectId);
  return await getScoped(userId, projectId);
}

async function myStats(userId) {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN status = 'done' AND is_confirmed = 1 THEN amount ELSE 0 END) AS earned_confirmed,
         SUM(CASE WHEN status = 'done' THEN amount ELSE 0 END) AS earned_total
       FROM projects WHERE user_id = ? OR intermediary_id = ? OR executor_id = ?`
    )
     .get(userId, userId, userId);
  const shiftRow = await db
    .prepare('SELECT COALESCE(SUM(deficit_minutes), 0) AS deficit_minutes FROM shifts WHERE user_id = ?')
    .get(userId);
  const user = await db.prepare('SELECT hourly_rate, manual_deficit FROM users WHERE id = ?').get(userId);
  const persona = await db.prepare('SELECT persona FROM users WHERE id = ?').get(userId);
  const deficit_minutes = shiftRow.deficit_minutes || 0;
  const rate = Number(user && user.hourly_rate) || 0;
  const deficit_amount = Math.round((deficit_minutes / 60) * rate * 100) / 100;
  return {
    total: row.total || 0,
    pending: row.pending || 0,
    in_progress: row.in_progress || 0,
    done: row.done || 0,
    earned_confirmed: persona && persona.persona === 'client' ? 0 : (row.earned_confirmed || 0),
    earned_total: persona && persona.persona === 'client' ? 0 : (row.earned_total || 0),
    deficit_minutes,
    deficit_amount,
    manual_deficit: Number(user && user.manual_deficit) || 0,
  };
}

function dateClause(from, to, alias = 'p', col = 'created_at') {
  const conds = [];
  if (from) conds.push(`CAST(${alias}.${col} AS DATE) >= CAST(? AS DATE)`);
  if (to) conds.push(`CAST(${alias}.${col} AS DATE) <= CAST(? AS DATE)`);
  return conds.length ? `AND ${conds.join(' AND ')}` : '';
}

async function adminOverview({ from, to } = {}) {
  const dateC = dateClause(from, to);
  const params = [];
  if (from) params.push(from);
  if (to) params.push(to);

  const perUser = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.hourly_rate, u.manual_deficit,
              COUNT(p.id) AS projects,
              COALESCE(SUM(CASE WHEN p.status = 'done' AND p.is_confirmed = 1 THEN p.amount ELSE 0 END), 0) AS earned_confirmed,
              COALESCE(SUM(CASE WHEN p.status = 'done' THEN p.amount ELSE 0 END), 0) AS earned_total,
              COALESCE(SUM(CASE WHEN p.status = 'done' AND p.is_confirmed = 0 THEN p.amount ELSE 0 END), 0) AS pending_confirm_amount,
              SUM(CASE WHEN p.status = 'done' AND p.is_confirmed = 0 THEN 1 ELSE 0 END) AS pending_confirm_count,
              (SELECT COALESCE(SUM(s.deficit_minutes), 0) FROM shifts s WHERE s.user_id = u.id) AS deficit_minutes
       FROM users u
       LEFT JOIN projects p ON p.user_id = u.id ${dateC}
       GROUP BY u.id
       ORDER BY earned_confirmed DESC`
    )
    .all(...params);

  for (const u of perUser) {
    const rate = Number(u.hourly_rate) || 0;
    u.deficit_amount = Math.round((u.deficit_minutes / 60) * rate * 100) / 100;
    u.manual_deficit = Number(u.manual_deficit) || 0;
  }

  const shiftDates = dateClause(from, to, 's', 'started_at');
  const shiftParams = [];
  if (from) shiftParams.push(from);
  if (to) shiftParams.push(to);
  const shiftCounts = await db
    .prepare(
      `SELECT user_id, COUNT(*) AS c FROM shifts s WHERE 1=1 ${shiftDates} GROUP BY user_id`
    )
    .all(...shiftParams);

  const countMap = {};
  for (const s of shiftCounts) countMap[s.user_id] = s.c;
  for (const u of perUser) u.shift_count = countMap[u.id] || 0;

  const totals = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'done' AND is_confirmed = 1 THEN amount ELSE 0 END), 0) AS earned_confirmed,
         COALESCE(SUM(CASE WHEN status = 'done' THEN amount ELSE 0 END), 0) AS earned_total,
         COALESCE(SUM(CASE WHEN status = 'done' AND is_confirmed = 0 THEN amount ELSE 0 END), 0) AS pending_confirm,
         COUNT(*) AS projects
       FROM projects p ${dateC ? 'WHERE 1=1' : ''} ${dateC}`
    )
    .get(...params);

  const unconfirmed = await db
    .prepare(
      `SELECT p.id, p.title, p.project_type, p.amount, p.created_at, u.name AS user_name
       FROM projects p JOIN users u ON u.id = p.user_id
       WHERE p.status = 'done' AND p.is_confirmed = 0 ${dateClause(from, to)}
       ORDER BY p.created_at DESC`
    )
    .all(...params);

  return { perUser, totals, unconfirmed };
}

module.exports = {
  PROJECT_TYPES, PROJECT_TYPE_LABELS, CURRENCIES, CURRENCY_LABELS, CURRENCY_SYMBOLS,
  listProjects, createProject, updateProject, deleteProject, deleteProjects,
  clearAllProjects, confirmProject, approveProject, getScoped, myStats,
  adminOverview, generateProjectCode, resolveSpecialistCode,
};