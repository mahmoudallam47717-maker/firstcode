'use strict';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const fmt = (n) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 });
const fmtMoney = (n, cur) => `${fmt(n)} ${({ egp: 'ج.م', sar: 'ر.س', usd: '$' })[cur || 'egp'] || 'ج.م'}`;
const projectMoney = (project) => project.income_visible === false ? '—' : fmtMoney(project.amount, project.currency);
const CUR_SYM = { egp: 'ج.م', sar: 'ر.س', usd: '$' };
const PERSONA_LABELS = { specialist: 'مختص', intermediary: 'وسيط', client: 'عميل' };
const personaLabel = (user) => user && (PERSONA_LABELS[user.persona] || (user.role === 'admin' ? 'مالك المنصة' : 'مستخدم'));

const TYPE_LABELS = {
  research: 'بحث علمي',
  report: 'تقرير',
  presentation: 'عرض تقديمي',
  website: 'موقع ويب',
  landing: 'صفحة هبوط',
  ecommerce: 'متجر إلكتروني',
  platform: 'منصة إلكترونية',
  webapp: 'تطبيق ويب',
  software: 'برنامج كمبيوتر',
  app: 'تطبيق',
  mobile: 'تطبيق موبايل',
  tool: 'أداة / سكريبت',
  design: 'ديزاين',
  logo: 'لوجو / هوية بصرية',
  branding: 'براندينج',
  ui: 'تصميم واجهات (UI)',
  ux: 'تجربة مستخدم (UX)',
  animation: 'موشن جرافيك / أنيميشن',
  photo: 'مونتاج صور / فوتوشوب',
  video: 'فيديو / مونتاج',
  writing: 'كتابة / محتوى',
  ebook: 'كتاب إلكتروني',
  course: 'كورس تعليمي',
  script: 'إعداد / سيناريو / مسودات',
  marketing: 'تسويق',
  seo: 'تحسين محركات البحث (SEO)',
  socialmedia: 'إدارة سوشيال ميديا',
  ad: 'إعلان / حملة إعلانية',
  data: 'إدخال بيانات',
  excel: 'إكسل / جداول بيانات',
  database: 'قواعد بيانات',
  api: 'واجهة برمجية (API)',
  dashboard: 'لوحة تحكم / داشبورد',
  chatbot: 'شات بوت',
  automation: 'أتمتة عمليات',
  integration: 'ربط أنظمة / تكامل',
  translation: 'ترجمة',
  voice: 'تعليق صوتي / صوتيات',
  proof: 'تدقيق لغوي / مراجعة',
  game: 'ألعاب',
  pos: 'نظام كاشير / نقاط بيع',
  erp: 'نظام موارد / إدارة',
  crm: 'إدارة علاقات عملاء (CRM)',
  blockchain: 'بلوكتشين / عقود ذكية',
  other: 'أخرى',
};

const TYPE_COLORS = {
  research: '#6366f1',
  report: '#0a9f6e',
  presentation: '#b83cc5',
  website: '#0891b2',
  landing: '#06b6d4',
  ecommerce: '#f59e0b',
  platform: '#0284c7',
  webapp: '#0ea5e9',
  software: '#7c3aed',
  app: '#2563eb',
  mobile: '#4f46e5',
  tool: '#14b8a6',
  design: '#ea5804',
  logo: '#f43f5e',
  branding: '#e11d48',
  ui: '#8b5cf6',
  ux: '#a855f7',
  animation: '#db2777',
  photo: '#9333ea',
  video: '#dc2626',
  writing: '#4b5563',
  ebook: '#9d2235',
  course: '#059669',
  script: '#6b7280',
  marketing: '#d97706',
  seo: '#16a34a',
  socialmedia: '#ec4899',
  ad: '#b8860b',
  data: '#0d9488',
  excel: '#10b981',
  database: '#0ea5e9',
  api: '#3b82f6',
  dashboard: '#6366f1',
  chatbot: '#7c3aed',
  automation: '#0891b2',
  integration: '#0284c7',
  translation: '#65a30d',
  voice: '#111827',
  proof: '#334155',
  game: '#8b5cf6',
  pos: '#0d9488',
  erp: '#0284c7',
  crm: '#059669',
  blockchain: '#64748b',
  other: '#64748b',
};

let state = {
  user: null,
  token: null,
  activeShift: null,
  shifts: [],
  projects: [],
  recentProjects: [],
  stats: null,
  typesCache: [],
  cashier: null,
  specialists: [],
  intermediaries: [],
  team: [],
  page: 'dashboard',
  authOpen: false,
  projectStatus: '',
  selectMode: false,
  selected: new Set(),
};

/* ==================== API ==================== */
async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const apiErr = (res, fallback) => (res && res.data && res.data.error) || fallback || 'حدث خطأ ما';

/* ==================== Toast ==================== */
let toastTimer;
function toast(msg, type = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.add('hidden'); }, 3000);
}

/* ==================== Auth ==================== */
const authForm = $('#auth-form');
const authTitle = $('#auth-title');
const authSub = $('#auth-sub');
const authBtn = $('#auth-submit');
const authToggleBtn = $('#auth-toggle-btn');
const authToggleText = $('#auth-toggle-text');
let authMode = 'login';

function setAuthMode(mode) {
  authMode = mode;
  const registerAllowed = true;
  const authToggleRow = document.querySelector('.auth-toggle');
  const isLogin = mode === 'login';
  $('#auth-name-field').classList.toggle('hidden', isLogin || !registerAllowed);
  $('#auth-persona-field').classList.toggle('hidden', isLogin || !registerAllowed);
  if (authToggleRow) authToggleRow.style.display = registerAllowed ? '' : 'none';
  authTitle.textContent = isLogin ? 'تسجيل الدخول' : 'إنشاء حساب جديد';
  authSub.textContent = isLogin
    ? 'أهلاً بيك، سجّل دخولك وابدأ شغل'
    : 'أنشئ حسابك وتابع مشاريعك ودخلك من أي مكان';
  authBtn.textContent = isLogin ? 'تسجيل الدخول' : 'إنشاء الحساب';
  authToggleText.textContent = isLogin ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟';
  authToggleBtn.textContent = isLogin ? 'إنشاء حساب' : 'تسجيل الدخول';
  $('#auth-error').classList.add('hidden');
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#auth-error');
  err.classList.add('hidden');
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const name = $('#auth-name').value.trim();
  authBtn.disabled = true;
  authBtn.textContent = '...';
  try {
    let res;
    if (authMode === 'login') {
      res = await api('POST', '/api/auth/login', { email, password });
    } else {
      res = await api('POST', '/api/auth/register', { name, email, password, persona: $('#auth-persona').value });
    }
    if (!res.status.toString().startsWith('2')) {
      err.textContent = apiErr(res, 'حدث خطأ');
      err.classList.remove('hidden');
      return;
    }
    state.user = res.data.user;
    state.token = res.data.token;
    sessionStorage.setItem('taskflow_token', state.token);
    $('#auth-password').value = '';
    enterApp();
  } catch (ex) {
    err.textContent = 'تعذر الاتصال بالتطبيق';
    err.classList.remove('hidden');
  } finally {
    authBtn.disabled = false;
    authBtn.textContent = authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب';
  }
});

authToggleBtn.addEventListener('click', () => setAuthMode(authMode === 'login' ? 'register' : 'login'));

/* ==================== Session ==================== */
function logout() {
  state.token = null;
  state.user = null;
  sessionStorage.removeItem('taskflow_token');
  showAuth();
}

$('#logout-btn').addEventListener('click', logout);
$('#account-btn').addEventListener('click', () => {
  $('#account-email').textContent = state.user ? state.user.email : '';
  $('#account-form').reset();
  $('#account-error').classList.add('hidden');
  $('#account-modal').classList.remove('hidden');
});
$$('#account-modal [data-close]').forEach((el) => el.addEventListener('click', () => $('#account-modal').classList.add('hidden')));
$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const error = $('#account-error');
  const res = await api('PATCH', '/api/users/me/password', {
    currentPassword: $('#account-current-password').value,
    newPassword: $('#account-new-password').value,
  });
  if (!res.status.toString().startsWith('2')) { error.textContent = apiErr(res); error.classList.remove('hidden'); return; }
  $('#account-modal').classList.add('hidden');
  toast('تم تغيير كلمة المرور بنجاح', 'success');
});

function isAdmin() {
  return state.user && (state.user.role === 'admin' || state.user.can_manage);
}

/* ==================== Navigation ==================== */
const NAV_MAP = { dashboard: 'dashboard', projects: 'projects', calculator: 'calculator', income: 'income', team: 'team' };

function setupNav() {
  $$('#topnav .nav-item, #bottom-nav .bn-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.page = btn.dataset.nav;
      showPage(state.page);
    });
  });
  $$('[data-goto]').forEach((b) => {
    b.addEventListener('click', () => { state.page = b.dataset.goto; showPage(state.page); });
  });
}

function showPage(page) {
  state.page = page;
  $$('.page').forEach((p) => p.classList.add('hidden'));
  $$('#topnav .nav-item, #bottom-nav .bn-item').forEach((b) => b.classList.toggle('active', b.dataset.nav === page));
  const target = $(`#page-${page}`);
  if (target) target.classList.remove('hidden');
  loadPage(page);
}

function loadPage(page) {
  if (page === 'dashboard') loadDashboard();
  else if (page === 'projects') loadProjects();
  else if (page === 'calculator') loadCalculator();
  else if (page === 'income') loadIncome();
  else if (page === 'team') loadTeam();
}

/* ==================== Common ==================== */
function applyShiftButton(container, shift) {
  if (shift) {
    container.innerHTML = `<span class="shift-status">● شيفت مفتوح من ${fmtTime(shift.started_at)}</span>
      <button class="btn btn-primary" id="end-shift-btn">إنهاء الشيفت</button>`;
  } else {
    container.innerHTML = `<span class="shift-status off">لا يوجد شيفت نشط</span>
      <button class="btn btn-green" id="start-shift-btn">▶ ابدأ الشيفت</button>`;
  }
  const endBtn = $('#end-shift-btn');
  if (endBtn) endBtn.addEventListener('click', endShift);
  const startBtn = $('#start-shift-btn');
  if (startBtn) startBtn.addEventListener('click', startShift);
}

async function startShift() {
  const res = await api('POST', '/api/shifts/start');
  if (!res.status.toString().startsWith('2')) { toast(apiErr(res), 'error'); return; }
  state.activeShift = res.data.shift;
  toast('تم فتح الشيفت ✨', 'success');
  refreshAll();
}

async function endShift() {
  const res = await api('POST', '/api/shifts/end');
  if (!res.status.toString().startsWith('2')) { toast(apiErr(res), 'error'); return; }
  state.activeShift = null;
  const summary = res.data && res.data.summary
    ? ` — إجمالي الشيفت: ${fmtMoney(res.data.summary.earned)}`
    : '';
  toast(`تم إغلاق الشيفت بنجاح${summary}`, 'success');
  refreshAll();
}

const dt = (s) => (s ? new Date(s.replace(' ', 'T')) : null);
function fmtTime(s) {
  if (!s) return '';
  const d = dt(s);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(s) {
  if (!s) return '';
  const d = dt(s);
  return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}
function dur(start, end) {
  const a = dt(start); const b = end ? dt(end) : new Date();
  const ms = b - a;
  if (ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m} د`;
  return `${h} س ${m} د`;
}

/* ==================== Dashboard ==================== */
async function loadDashboard() {
  $('#dash-name').textContent = state.user.name;
  $('#dash-role').textContent = personaLabel(state.user);
  const specialistCode = $('#dash-specialist-code');
  const isSpecialist = state.user.persona === 'specialist';
  specialistCode.classList.toggle('hidden', !isSpecialist);
  specialistCode.querySelector('strong').textContent = isSpecialist
    ? (state.user.specialist_code || `SPEC-${state.user.id}`)
    : '';
  $('#dash-date').textContent = new Date().toLocaleDateString('ar-EG', { weekday: 'long', dateStyle: 'full' });
  const res = await api('GET', '/api/projects/stats');
  if (res.status.toString().startsWith('2')) state.stats = res.data.stats;
  renderStats();
  renderRecent();
  renderTypeBars();
}

function setupShiftControls() {
  const box = $('#shift-quick');
  if (state.activeShift) {
    box.innerHTML = `<span class="shift-status">● شيفت نشط</span>
      <button class="btn btn-sm btn-primary" id="qs-end">إنهاء</button>`;
  } else {
    box.innerHTML = `<button class="btn btn-sm btn-green" id="qs-start">▶ ابدأ الشيفت</button>`;
  }
  const st = $('#qs-start'); if (st) st.addEventListener('click', startShift);
  const en = $('#qs-end'); if (en) en.addEventListener('click', endShift);
}

function renderStats() {
  const s = state.stats || {};
  const cards = [
    { v: s.total || 0, l: 'إجمالي المشاريع' },
    { v: s.in_progress || 0, l: 'قيد التنفيذ', c: 'accent' },
    { v: s.pending || 0, l: 'معلّق' },
    { v: s.done || 0, l: 'مُنجز' },
    { v: fmt(s.earned_confirmed || 0), l: 'الدخل المؤكد', c: 'green-t' },
  ];
  $('#stats-bar').innerHTML = cards.map((c) =>
    `<div class="stat-card"><span class="stat-value ${c.c || ''}">${c.v}</span><span class="stat-label">${c.l}</span></div>`
  ).join('');
}

function renderRecentProjects() {
  const list = $('#recent-projects');
  const projects = state.projects.slice(0, 6);
  if (!projects.length) { list.innerHTML = '<div class="li li-empty">لا مشاريع حتى الآن</div>'; return; }
  list.innerHTML = projects.map((p) => `
    <div class="li">
      <div class="main">
        <span class="li-title">${esc(p.title)}</span>
        <span class="li-sub"><span class="tp ${p.project_type}">${TYPE_LABELS[p.project_type] || p.project_type}</span></span>
      </div>
      <span class="li-title amount-sm">${projectMoney(p)}</span>
    </div>`).join('');
}

function renderType() {
  const box = $('#type-bars');
  const counts = {};
  state.projects.forEach((p) => { counts[p.project_type] = (counts[p.project_type] || 0) + 1; });
  const total = state.projects.length || 1;
  const keys = Object.keys(TYPE_LABELS).filter((k) => counts[k]);
  if (!keys.length) { box.innerHTML = '<div class="li-sub">أضف مشاريع لترى التوزيع</div>'; return; }
  box.innerHTML = keys.map((k) => {
    const n = counts[k];
    const pct = Math.round((n / total) * 100);
    return `<div class="tb-row">
      <div class="tb-head"><span>${TYPE_LABELS[k]}</span><span>${n}</span></div>
      <div class="tb-track"><div class="tb-fill" style="width:${pct}%;background:${TYPE_COLORS[k]}"></div></div>
    </div>`;
  }).join('');
}

/* ==================== Projects ==================== */
async function loadProjects() {
  const res = await api('GET', '/api/projects');
  if (res.status === 200) state.projects = res.data.projects;
  renderProjectList();
}

function renderProjectList() {
  const list = $('#project-list');
  const q = $('#search-input').value.trim().toLowerCase();
  const fs = state.projectStatus || '';
  const fc = $('#filter-confirmed').value;
  let projects = state.projects;
  if (q) projects = projects.filter((p) => (p.title + ' ' + (p.notes || '') + ' ' + (p.client_name || '') + ' ' + (p.code || '')).toLowerCase().includes(q));
  if (fs === 'paid') projects = projects.filter((p) => p.is_confirmed);
  else if (fs) projects = projects.filter((p) => p.status === fs);
  if (fc) projects = projects.filter((p) => String(p.is_confirmed) === fc);
  const emptyState = $('#empty-state');
  if (!projects.length) { list.innerHTML = ''; emptyState.classList.remove('hidden'); return; }
  emptyState.classList.add('hidden');
  list.innerHTML = projects.map((p) => {
    const badge = p.income_visible === false ? '' : (p.is_confirmed
      ? '<span class="badge confirmed">مدفوع</span>'
      : (p.status === 'done'
          ? '<span class="badge unconfirmed">غير مدفوع</span>'
          : `<span class="badge ${p.status}">${p.status === 'pending' ? 'معلّق' : 'قيد التنفيذ'}</span>`));
    const actions = `
      <button class="btn btn-sm btn-primary" data-act="status" data-id="${p.id}">🔎 استعلام عن الحالة</button>
      <button class="btn btn-sm btn-ghost" data-act="${isAdmin() ? 'vew' : 'edit'}" data-id="${p.id}">${isAdmin() ? 'عرض' : 'تعديل'}</button>
      ${(p.executor_id === state.user.id && state.user.persona === 'specialist' && !p.is_confirmed) ? `<button class="btn btn-sm btn-green" data-act="confirm" data-id="${p.id}">تأكيد استلام الدخل</button>` : ''}
      ${isAdmin() ? `<button class="btn btn-sm btn-red" data-act="del" data-id="${p.id}">حذف</button>` : ''}`;
    const checked = state.selected.has(p.id);
    return `<div class="project-card ${state.selectMode ? 'selectable' : ''} ${checked ? 'card-checked' : ''}">
      ${state.selectMode ? `<input type="checkbox" class="select-box" data-sel="${p.id}" ${checked ? 'checked' : ''} />` : ''}
      <div class="pc-top">
        <div class="pc-wrap"><span class="title">${esc(p.title)}</span>
          <span class="tp ${p.project_type}">${TYPE_LABELS[p.project_type] || p.project_type}</span></div>
      </div>
      <div class="pc-info">
        <span class="amount">${projectMoney(p)}</span>${badge}
      </div>
      ${p.code ? `<div class="pc-info"><span class="phone">🏷️ كود: <b>${esc(p.code)}</b></span></div>` : ''}
      ${p.client_name ? `<div class="pc-info"><span class="phone">👤 العميل: <b>${esc(p.client_name)}</b></span></div>` : ''}
      ${p.due_date ? `<div class="pc-info"><span class="phone due">📅 موعد التسليم: <b>${esc(p.due_date)}${p.delivery_time ? ` الساعة ${esc(p.delivery_time)}` : ''}</b></span></div>` : ''}
      <span class="time">${fmtDateTime(p.created_at)}</span>
      ${p.notes ? `<div class="notes">${esc(p.notes)}</div>` : ''}
      <div class="pc-info">${actions}</div>
    </div>`;
  }).join('');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ==================== Project modal ==================== */
const projectModal = $('#project-modal');
$('#new-project-btn').addEventListener('click', () => openProjectModal());
$$('#project-modal [data-close]').forEach((el) => el.addEventListener('click', () => closeProjectModal()));

function openProjectModal(id) {
  fillTypes($('#project-type'));
  const form = $('#project-form');
  form.reset();
  $('#project-error').classList.add('hidden');
  $('#project-modal-title').textContent = id ? 'تعديل المشروع' : 'مشروع جديد';
  const project = id ? state.projects.find((p) => p.id === id) : null;
  $('#project-status-field').classList.toggle('hidden', state.user.persona !== 'specialist' && !isAdmin());
  $('#project-executor-code-field').classList.remove('hidden');
  $('#project-executor-code').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase(); }, { once: true });
  $('#project-executor-code').oninput = async (event) => {
    const code = event.target.value.trim();
    const match = $('#project-executor-match');
    if (!code) { match.textContent = ''; return; }
    const result = await api('GET', `/api/projects/resolve-specialist?code=${encodeURIComponent(code)}`);
    match.textContent = result.status === 200 && result.data.specialist
      ? `سيصل الطلب إلى: ${result.data.specialist.name}`
      : 'الكود غير مرتبط بمختص نشط';
    match.className = `field-hint ${result.data && result.data.specialist ? 'valid' : 'invalid'}`;
  };
  if (project) {
    $('#project-id').value = project.id;
    $('#project-title').value = project.title;
    $('#project-type').value = project.project_type;
    $('#project-currency').value = project.currency || 'egp';
    $('#project-amount').value = project.amount;
    $('#project-paid-amount').value = project.paid_amount || '';
    $('#project-code').value = project.code || '';
    $('#project-code').readOnly = true;
    $('#project-client').value = project.client_name || '';
    $('#project-status').value = project.status;
    $('#project-executor-code').value = project.executor_code || '';
    $('#project-notes').value = project.notes || '';
    $('#project-due').value = project.due_date || '';
    $('#project-due-time').value = project.delivery_time || '';
  } else {
    $('#project-id').value = '';
    $('#project-title').value = '';
    $('#project-client').value = '';
    $('#project-due').value = '';
    $('#project-due-time').value = '';
    $('#project-code').readOnly = true;
    $('#project-code').value = '';
    $('#project-code').placeholder = 'بيتولّد تلقائيًا...';
    api('GET', '/api/projects/next-code').then((res) => {
      if (res.status === 200 && res.data.code) {
        $('#project-code').value = res.data.code;
        $('#project-code').placeholder = '';
      }
    });
    const active = state.activeShift || (state.shifts.find((s) => !s.ended_at));
    $('#project-amount').value = '';
    $('#project-paid-amount').value = '';
    $('#project-executor-code').value = '';
  }
  projectModal.classList.remove('hidden');
  $('#project-title').focus();
}

function closeProjectModal() {
  $('#project-modal').classList.add('hidden');
}

$('#project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#project-id').value;
  const err = $('#project-error');
  err.classList.add('hidden');
  const body = {
    title: $('#project-title').value.trim(),
    project_type: $('#project-type').value,
    amount: Number($('#project-amount').value) || 0,
    paid_amount: Number($('#project-paid-amount').value) || 0,
    currency: $('#project-currency').value,
    status: $('#project-status').value,
    executor_code: $('#project-executor-code').value.trim(),
    code: $('#project-code').value.trim(),
    client_name: $('#project-client').value.trim(),
    due_date: $('#project-due').value || null,
    delivery_time: $('#project-due-time').value || null,
    notes: $('#project-notes').value.trim(),
  };
  if (!body.title) { err.textContent = 'اكتب اسم المشروع'; err.classList.remove('hidden'); return; }
  const res = id
    ? await api('PATCH', `/api/projects/${id}`, body)
    : await api('POST', '/api/projects', body);
  if (!res.status.toString().startsWith('2')) { err.textContent = apiErr(res); err.classList.remove('hidden'); return; }
  closeProjectModal();
  toast(id ? 'تم تحديث المشروع' : 'تم إضافة المشروع ✨', 'success');
  refreshAll();
});

/* ==================== Project events (delegation) ==================== */
$('#project-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const id = Number(btn.dataset.id);
  if (act === 'status') {
    openStatusModal(id);
  } else if (act === 'vew' || act === 'edit') {
    openProjectModal(id);
  } else if (act === 'del') {
    if (!confirm('هل تريد حذف هذا المشروع؟')) return;
    const res = await api('DELETE', `/api/projects/${id}`);
    if (res.status.toString().startsWith('2')) { toast('تم الحذف', 'success'); refreshAll(); }
    else toast(apiErr(res), 'error');
  } else if (act === 'confirm') {
    const res = await api('POST', `/api/users/projects/${id}/confirm`);
    if (res.status.toString().startsWith('2')) { toast('تم تأكيد الدخل ✅', 'success'); refreshAll(); }
    else toast(apiErr(res), 'error');
  }
});

/* ==================== Order status modal ==================== */
const STATUS_LABELS = { pending: 'معلّق', in_progress: 'قيد التنفيذ', done: 'منجز' };

function openStatusModal(id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  $('#status-modal-title').textContent = 'حالة الطلب';
  renderStatusBody(p);
  $('#status-modal').classList.remove('hidden');
  $('#status-modal').dataset.pid = id;
}

function renderStatusBody(p) {
  $('#download-approval-card-btn').classList.toggle('hidden', p.request_status !== 'approved');
  const approvalBadge = p.request_status === 'approved'
    ? `<span class="badge confirmed">معتمد من المختص${p.approved_at ? ` • ${fmtDateTime(p.approved_at)}` : ''}</span>`
    : '<span class="badge unconfirmed">في انتظار اعتماد المختص</span>';
  const statusBadge = p.income_visible === false ? '<span class="badge unconfirmed">حالة الدفع خاصة</span>' : (p.is_confirmed
    ? '<span class="badge confirmed">مدفوع</span>'
    : (p.status === 'done'
        ? '<span class="badge unconfirmed">غير مدفوع</span>'
        : `<span class="badge ${p.status}">${STATUS_LABELS[p.status] || p.status}</span>`));
  const canChangeStatus = state.user && (state.user.persona === 'specialist' || isAdmin());
  $('#status-body').innerHTML = `
    <div class="status-meta">
      <div class="s-row"><span>كود الطلب</span><b>${esc(p.code) || '—'}</b></div>
      <div class="s-row"><span>اسم المشروع</span><b>${esc(p.title)}</b></div>
      <div class="s-row"><span>اسم العميل</span><b>👤 ${esc(p.client_name || '—')}</b></div>
      <div class="s-row"><span>النوع</span><b>${TYPE_LABELS[p.project_type] || p.project_type}</b></div>
      ${p.income_visible === false ? '' : `<div class="s-row"><span>قيمة الدخل</span><b>${projectMoney(p)}</b></div>`}
      ${p.income_visible === false ? '' : `<div class="s-row"><span>المدفوع مقدماً (عربون)</span><b>${fmtMoney(p.paid_amount, p.currency)}</b></div>`}
      ${p.due_date ? `<div class="s-row"><span>موعد التسليم</span><b>📅 ${esc(p.due_date)} ${p.delivery_time ? `الساعة ${esc(p.delivery_time)}` : ''}</b></div>` : ''}
      <div class="s-row"><span>الحالة</span>${statusBadge}</div>
      <div class="s-row"><span>اعتماد الطلب</span>${approvalBadge}</div>
      <div class="s-row"><span>تاريخ الإضافة</span><b>${fmtDateTime(p.created_at)}</b></div>
      ${p.notes ? `<div class="s-row"><span>ملاحظات</span><b>${esc(p.notes)}</b></div>` : ''}
    </div>
    <div class="status-actions">
      ${canChangeStatus ? `<button class="btn btn-sm ${p.status === 'pending' ? 'btn-primary' : ''}" data-sact="pending">معلّق</button>
      <button class="btn btn-sm ${p.status === 'in_progress' ? 'btn-primary' : ''}" data-sact="in_progress">قيد التنفيذ</button>
      <button class="btn btn-sm ${p.status === 'done' ? 'btn-primary' : ''}" data-sact="done">منجز</button>` : ''}
      ${p.request_status !== 'approved' && p.executor_id === state.user.id && state.user.persona === 'specialist' ? '<button class="btn btn-sm btn-green" data-sact="approve">اعتماد الطلب (Ctrl)</button>' : ''}
      ${!p.is_confirmed && p.executor_id === state.user.id && state.user.persona === 'specialist' ? `<button class="btn btn-sm btn-green" data-sact="confirm">تأكيد استلام الدخل</button>` : ''}
    </div>
    <p class="shift-hint">اعتماد الطلب ينقل الحالة إلى قيد التنفيذ، وتأكيد استلام الدخل إجراء مستقل.</p>
  `;
}

async function statusAction(act, id) {
  const p = state.projects.find((x) => x.id === id);
  if (!p) return;
  if (act === 'confirm') {
    if (p.executor_id !== state.user.id || state.user.persona !== 'specialist') { toast('التأكيد من اختصاص المختص المنفذ فقط', 'error'); return; }
    const res = await api('POST', `/api/users/projects/${id}/confirm`);
    if (res.status.toString().startsWith('2')) { toast('تم تأكيد الدخل ✅', 'success'); }
    else { toast(apiErr(res), 'error'); return; }
  } else if (act === 'approve') {
    const res = await api('POST', `/api/users/projects/${id}/approve`);
    if (!res.status.toString().startsWith('2')) { toast(apiErr(res), 'error'); return; }
    toast('تم اعتماد الطلب وإرسال التأكيد داخل المنصة', 'success');
  } else {
    const res = await api('PATCH', `/api/projects/${id}`, { status: act });
    if (!res.status.toString().startsWith('2')) { toast(apiErr(res), 'error'); return; }
    toast(`تم التحويل إلى ${STATUS_LABELS[act]}`, 'success');
  }
  await refreshAll();
  const updated = state.projects.find((x) => x.id === id);
  if (updated) renderStatusBody(updated);
}

$('#status-body').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-sact]');
  if (!btn) return;
  const id = Number($('#status-modal').dataset.pid);
  statusAction(btn.dataset.sact, id);
});

$$('#status-modal [data-close]').forEach((el) => el.addEventListener('click', () => {
  $('#status-modal').classList.add('hidden');
}));

let ctrlConfirmPressed = false;
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control' && !$('#status-modal').classList.contains('hidden') && state.user && state.user.persona === 'specialist' && !ctrlConfirmPressed) {
    e.preventDefault();
    ctrlConfirmPressed = true;
    const id = Number($('#status-modal').dataset.pid);
    statusAction('approve', id);
  }
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') ctrlConfirmPressed = false;
});

/* ==================== Order card image (Alt) ==================== */
function statusProject() {
  return state.projects.find((x) => x.id === Number($('#status-modal').dataset.pid)) || null;
}

function downloadStatusCard() {
  const p = statusProject();
  if (!p) return;
  downloadCardImage(p);
}

function downloadApprovalCard() {
  const p = statusProject();
  if (p && p.request_status === 'approved') downloadCardImage(p, true);
}

if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = typeof r === 'number' ? r : (r[0] || 0);
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr);
    this.lineTo(x + w, y + h - rr);
    this.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    this.lineTo(x + rr, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr);
    this.lineTo(x, y + rr);
    this.quadraticCurveTo(x, y, x + rr, y);
    return this;
  };
}

$('#download-card-btn').addEventListener('click', downloadStatusCard);
$('#download-approval-card-btn').addEventListener('click', downloadApprovalCard);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && !$('#status-modal').classList.contains('hidden')) {
    e.preventDefault();
    downloadCardImage(statusProject(), true);
  }
});

function downloadCardImage(p, approval = false) {
  try {
    if (!p) { toast('لا توجد بيانات لإنشاء الصورة', 'error'); return; }
    const W = 900;
    const PAD = 46;
    const W2 = W - PAD * 2;
    let h = 240;

    const lines = [];
    const push = (label, val, color) => lines.push({ label, val: val == null || val === '' ? '—' : val, color });

    const payText = p.is_confirmed ? 'مدفوع ✓' : 'لم يتم الدفع';
    const payColor = p.is_confirmed ? '#059669' : '#e11d48';
    const typeLabel = TYPE_LABELS[p.project_type] || p.project_type;
    const created = p.created_at ? new Date(p.created_at.replace(' ', 'T')) : null;
    const createdStr = created ? created.toLocaleDateString('ar-EG', { dateStyle: 'long' }) : '—';
    const dueStr = p.due_date
      ? (() => {
          try {
            const d = new Date(p.due_date + 'T00:00:00');
            return `التسليم يوم ${d.toLocaleDateString('ar-EG', { dateStyle: 'long' })}${p.delivery_time ? ` الساعة ${p.delivery_time}` : ''}`;
          } catch { return p.due_date + (p.delivery_time ? ` الساعة ${p.delivery_time}` : ''); }
        })()
      : (p.delivery_time ? `التسليم الساعة ${p.delivery_time}` : '—');

    push('اسم المشروع', p.title);
    push('اسم العميل', p.client_name || '—');
    push('كود الطلب', p.code || '—');
    push('نوع المشروع', typeLabel);
    push('قيمة الطلب', fmtMoney(p.amount, p.currency));
    push('المدفوع مقدماً (عربون)', fmtMoney(p.paid_amount, p.currency));
    push('موعد التسليم', dueStr);
    push('حالة الدفع', payText, payColor);
    push('تاريخ الإضافة', createdStr);

    h += lines.length * 42;
    let noteLineCount = 0;
    if (p.notes) {
      const c = document.createElement('canvas');
      c.width = W2;
      c.height = 60;
      const cc = c.getContext('2d');
      cc.font = '24px "Segoe UI", Tahoma, Arial';
      noteLineCount = wrapRtl(cc, p.notes, W2).length;
      h += noteLineCount * 32 + 26;
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const bg = ctx.createLinearGradient(0, 0, W, h);
    bg.addColorStop(0, approval ? '#064e3b' : '#0f172a');
    bg.addColorStop(1, approval ? '#0f766e' : '#1e293b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, h);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(W - 90, 90, 140, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 34px "Segoe UI", Tahoma, Arial';
    ctx.fillText('مكتبنا', W - PAD, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '20px "Segoe UI", Tahoma, Arial';
    ctx.fillText(approval ? 'بطاقة اعتماد الطلب للمختص' : 'بطاقة إرسال الطلب للوسيط', W - PAD, 84);

    ctx.fillStyle = '#059669';
    ctx.font = 'bold 22px "Segoe UI", Tahoma, Arial';
    const seal = approval ? 'اعتماد المختص ✓' : 'تم إرسال الطلب';
    const sw = ctx.measureText(seal).width;
    ctx.beginPath();
    ctx.roundRect(PAD, 40, sw + 40, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(seal, PAD + (sw + 40) / 2, 50);
    ctx.textAlign = 'right';

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(PAD, 150);
    ctx.lineTo(W - PAD, 150);
    ctx.stroke();

    let y = 190;
    for (const row of lines) {
      ctx.font = '28px "Segoe UI", Tahoma, Arial';
      const labelW = ctx.measureText(row.label + ':').width;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(row.label + ':', W - PAD, y);
      ctx.fillStyle = row.color || '#f8fafc';
      ctx.font = 'bold 28px "Segoe UI", Tahoma, Arial';
      ctx.fillText(row.val, W - PAD - labelW - 14, y);
      y += 42;
    }

    if (p.notes) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText('ملاحظات:', W - PAD, y);
      y += 34;
      ctx.fillStyle = '#f8fafc';
      ctx.font = '24px "Segoe UI", Tahoma, Arial';
      const wrapped = wrapRtl(ctx, p.notes, W2);
      for (const l of wrapped) {
        ctx.fillText(l, W - PAD, y);
        y += 32;
      }
    }

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '18px "Segoe UI", Tahoma, Arial';
    ctx.fillText(`تم إصدار البطاقة ${new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}`, W - PAD, h - 40);

    const saveImage = (blob) => {
      if (!blob) { toast('تعذّر توليد الصورة', 'error'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${approval ? 'approval' : 'order'}-${(p.code || p.id)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast(approval ? 'تم تنزيل بطاقة الاعتماد ✓' : 'تم تنزيل بطاقة الطلب ✓', 'success');
    };
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob(saveImage, 'image/png');
    } else {
      const dataUrl = canvas.toDataURL('image/png');
      const response = fetch(dataUrl).then((res) => res.blob()).then(saveImage).catch(() => toast('تعذّر فتح صورة البطاقة', 'error'));
      void response;
    }
  } catch (err) {
    toast('خطأ في توليد الصورة', 'error');
    console.error(err);
  }
}

function wrapRtl(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const out = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) out.push(line);
  return out;
}

function fillTypes(select) {
  select.innerHTML = Object.keys(TYPE_LABELS)
    .map((t) => `<option value="${t}">${TYPE_LABELS[t]}</option>`).join('');
}

/* ==================== Filters ==================== */
$('#search-input').addEventListener('input', () => renderProjectList());
$('#filter-confirmed').addEventListener('change', () => renderProjectList());
$('#project-tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.ptab');
  if (!btn) return;
  state.projectStatus = btn.dataset.pstatus;
  $$('#project-tabs .ptab').forEach((b) => b.classList.toggle('active', b === btn));
  renderProjectList();
});
$('#projects-export').addEventListener('click', () => {
  downloadCsv('/api/projects/export.csv', `projects-${new Date().toISOString().slice(0, 10)}.csv`);
});

/* ==================== Admin bulk actions ==================== */
function updateBulkUI() {
  const tools = $('#admin-bulk-tools');
  if (!tools) return;
  tools.classList.toggle('hidden', !isAdmin());
  const inSelect = state.selectMode;
  $('#select-all-btn').classList.toggle('hidden', !inSelect);
  $('#delete-selected-btn').classList.toggle('hidden', !inSelect);
}

function refreshAdminTools() {
  updateBulkUI();
  if ($('#project-list')) renderProjectList();
}

$('#select-toggle').addEventListener('click', () => {
  state.selectMode = !state.selectMode;
  if (!state.selectMode) state.selected.clear();
  $('#select-toggle').textContent = state.selectMode ? 'إلغاء' : '☑️ تحديد';
  updateBulkUI();
  renderProjectList();
});

$('#select-all-btn').addEventListener('click', () => {
  const q = $('#search-input').value.trim().toLowerCase();
  const fs = state.projectStatus || '';
  let visible = state.projects;
  if (q) visible = visible.filter((p) => (p.title + ' ' + (p.notes || '') + ' ' + (p.client_name || '') + ' ' + (p.code || '')).toLowerCase().includes(q));
  if (fs === 'paid') visible = visible.filter((p) => p.is_confirmed);
  else if (fs) visible = visible.filter((p) => p.status === fs);
  visible.forEach((p) => state.selected.add(p.id));
  renderProjectList();
});

$('#project-list').addEventListener('change', (e) => {
  if (!state.selectMode) return;
  const box = e.target.closest('[data-sel]');
  if (!box) return;
  const id = Number(box.dataset.sel);
  if (box.checked) state.selected.add(id); else state.selected.delete(id);
});

$('#delete-selected-btn').addEventListener('click', async () => {
  const ids = [...state.selected];
  if (!ids.length) { toast('اختر مشاريع أولًا', 'error'); return; }
  if (!confirm(`حذف ${ids.length} مشروع محدد؟ لا يمكن التراجع.`)) return;
  const res = await api('POST', '/api/projects/admin/bulk-delete', { ids });
  if (res.status.toString().startsWith('2')) {
    toast(`تم حذف ${res.data.deleted} مشروع`, 'success');
    state.selected.clear();
    refreshAll();
    renderProjectList();
  } else toast(apiErr(res), 'error');
});

$('#delete-all-btn').addEventListener('click', async () => {
  if (!confirm('تحذير: سيتم حذف كل المشاريع نهائيًا ولا يمكن التراجع. تصفية الدخل والبدء من جديد؟')) return;
  const res = await api('POST', '/api/projects/admin/clear');
  if (res.status.toString().startsWith('2')) {
    toast('تم تصفية كل المشاريع', 'success');
    state.selected.clear();
    refreshAll();
    renderProjectList();
  } else toast(apiErr(res), 'error');
});

/* ==================== Shifts page ==================== */
async function loadShifts() {
  const res = await api('GET', '/api/shifts');
  if (res.status === 200) {
    state.shifts = res.data.shifts;
    state.activeShift = res.data.active;
  }
  applyShiftButton($('#shift-controls'), state.activeShift);
  const list = $('#shift-list');
  if (!state.shifts.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-ico">🕐</span><div class="empty-msg">لم تسجّل أي شيفت بعد. اضغط "ابدأ الشيفت"</div></div>`;
    return;
  }
  list.innerHTML = state.shifts.map((s) => `
    <div class="li">
      <div class="main">
        <span class="li-title">${s.ended_at ? 'شيفت مكتمل' : 'شيفت نشط'} • ${dur(s.started_at, s.ended_at)}</span>
        <span class="li-sub">بداية ${fmtDateTime(s.started_at)}${s.ended_at ? ` • نهاية ${fmtDateTime(s.ended_at)}` : ''}</span>
        ${s.scheduled_start ? `<span class="li-sub">الميعاد المجدول ${fmtTime(s.scheduled_start)} — ${fmtTime(s.scheduled_end)}</span>` : ''}
      </div>
      <span class="li-muted">دخل: ${fmtMoney(s.earned || 0)}</span>
    </div>`).join('');
}

/* ==================== Cashier ==================== */
function cashierDateRange() {
  const val = $('#income-range') ? $('#income-range').value : 'month';
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (val === 'today') return { from: iso(now), to: iso(now) };
  if (val === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); return { from: iso(d), to: iso(now) }; }
  if (val === 'month') { const d = new Date(now.getFullYear(), now.getMonth(), 1); return { from: iso(d), to: iso(now) }; }
  return {};
}

function cashierQuery() {
  const r = cashierDateRange();
  const q = new URLSearchParams();
  if (r.from) q.set('from', r.from);
  if (r.to) q.set('to', r.to);
  return q.toString();
}

async function loadIncome() {
  const res = await api('GET', `/api/users/admin/income?${cashierQuery()}`);
  if (res.status !== 200) { toast(apiErr(res), 'error'); return; }
  state.cashier = res.data;
  const t = state.cashier.totals;
  $('#income-totals').innerHTML = [
    `<div class="stat-card"><span class="stat-value green-t">${fmtMoney(t.earned_confirmed)}</span><span class="stat-label">الدخل المؤكد</span></div>`,
    `<div class="stat-card"><span class="stat-value accent">${fmtMoney(t.earned_total)}</span><span class="stat-label">الدخل الإجمالي</span></div>`,
    `<div class="stat-card"><span class="stat-value amber-t">${fmtMoney(t.pending_confirm)}</span><span class="stat-label">بانتظار التأكيد</span></div>`,
    `<div class="stat-card"><span class="stat-value">${t.projects}</span><span class="stat-label">المشاريع</span></div>`,
  ].join('');
  $('#income-body').innerHTML = state.cashier.perUser.map((u) => `
    <tr>
      <td>${esc(u.name)}</td>
      <td>${u.role === 'admin' || u.can_manage ? 'مشرف' : 'موظف'}</td>
      <td>${u.projects}</td>
      <td class="green-t">${fmtMoney(u.earned_confirmed)}</td>
      <td>${fmtMoney(u.earned_total)}</td>
    </tr>`).join('');
  renderPendingCashier();
}

function renderPendingCashier() {
  const box = $('#income-pending');
  const list = $('#income-pending-list');
  const unconf = (state.cashier && state.cashier.unconfirmed) || [];
  if (!unconf.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  list.innerHTML = unconf.map((p) => `
    <div class="li">
      <div class="main">
        <span class="li-title">${esc(p.title)}</span>
        <span class="li-sub">${esc(p.user_name)} • ${TYPE_LABELS[p.project_type] || p.project_type}</span>
      </div>
      <div class="li-actions">
        <span class="li-muted">${fmtMoney(p.amount, p.currency)}</span>
      </div>
    </div>`).join('');
}

async function downloadCsv(url, filename) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${state.token}` },
  });
  if (!res.ok) { toast('فشل التصدير: ' + ((res.status) === 401 ? 'سجّل الدخول مجددًا' : ` (${res.status})`), 'error'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objUrl);
  toast('تم تنزيل الملف ✓', 'success');
}

/* cashier events */
$('#income-range').addEventListener('change', () => loadIncome());
$('#income-export').addEventListener('click', () => {
  downloadCsv(`/api/users/admin/income.csv?${cashierQuery()}`, `income-${new Date().toISOString().slice(0, 10)}.csv`);
});
$('#income-pending-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-confirm-id]');
  if (!btn) return;
  const id = Number(btn.dataset.confirmId);
  const res = await api('POST', `/api/users/projects/${id}/confirm`);
  if (res.status.toString().startsWith('2')) { toast('تم تأكيد الدخل ✅', 'success'); refreshAll(); }
  else toast(apiErr(res), 'error');
});

/* ==================== Team ==================== */
async function loadTeam() {
  const res = await api('GET', '/api/users/admin/users');
  if (res.status !== 200) { toast(apiErr(res), 'error'); return; }
  state.team = res.data.users;
  const list = $('#team-list');
  if (!state.team.length) { list.innerHTML = '<div class="li-sub">لا يوجد أعضاء</div>'; return; }
  list.innerHTML = state.team.map((u) => `
    <div class="li">
      <div class="main">
        <span class="li-title">${esc(u.name)} ${!u.is_active ? '<span class="badge unconfirmed">معطّل</span>' : ''}</span>
        <span class="li-sub">${esc(u.email)} • ${personaLabel(u)}${u.specialist_code ? ` • كود المختص: ${esc(u.specialist_code)}` : ''}${u.role === 'admin' ? ' • مالك المنصة' : ''} • ${u.project_count} مشروع</span>
      </div>
      <div class="li-actions">
        <span class="li-muted">${fmtMoney(u.earned_confirmed)}</span>
        <button class="btn btn-sm btn-ghost" data-uteam="edit" data-id="${u.id}">تعديل</button>
        <button class="btn btn-sm btn-red" data-uteam="del" data-id="${u.id}">حذف</button>
      </div>
    </div>`).join('');
}

/* ==================== User modal ==================== */
$('#new-user-btn').addEventListener('click', () => openUserModal());
$$('#user-modal [data-close]').forEach((el) => el.addEventListener('click', () => closeUserModal()));
$('#user-persona').addEventListener('change', () => {
  $('#user-specialist-code-field').classList.toggle('hidden', $('#user-persona').value !== 'specialist');
  $('#user-specialist-code').readOnly = !id;
});

function openUserModal(id) {
  const form = $('#user-form');
  form.reset();
  $('#user-error').classList.add('hidden');
  $('#user-modal-title').textContent = id ? 'تعديل العضو' : 'عضو جديد';
  const user = id ? state.team.find((u) => u.id === id) : null;
  if (user) {
    $('#user-id').value = user.id;
    $('#user-name').value = user.name;
    $('#user-email').value = user.email;
    $('#user-manage').checked = !!(user.can_manage || user.role === 'admin');
    $('#user-persona').value = user.persona || 'specialist';
    $('#user-specialist-code').value = user.specialist_code || '';
    $('#user-password').placeholder = 'اتركها فارغة لعدم التغيير';
  } else {
    $('#user-id').value = '';
    $('#user-persona').value = 'specialist';
    $('#user-specialist-code').value = '';
    $('#user-password').placeholder = 'كلمة المرور';
  }
  $('#user-specialist-code-field').classList.toggle('hidden', $('#user-persona').value !== 'specialist');
  $('#user-modal').classList.remove('hidden');
  $('#user-name').focus();
}
function closeUserModal() { $('#user-modal').classList.add('hidden'); }

$('#user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#user-id').value;
  const err = $('#user-error');
  err.classList.add('hidden');
  const manage = $('#user-manage').checked;
  const body = {
    name: $('#user-name').value.trim(),
    email: $('#user-email').value.trim(),
    persona: $('#user-persona').value,
    specialist_code: $('#user-persona').value === 'specialist' ? $('#user-specialist-code').value.trim() : undefined,
  };
  if (id) {
    body.role = manage ? 'admin' : 'user';
    body.can_manage = manage;
    const pw = $('#user-password').value.trim();
    if (pw) body.password = pw;
  } else {
    body.password = $('#user-password').value.trim();
    if (!body.password) { err.textContent = 'كلمة المرور مطلوبة للعضو الجديد'; err.classList.remove('hidden'); return; }
    body.role = manage ? 'admin' : 'user';
    body.can_manage = manage;
  }
  if (!body.name) { err.textContent = 'اكتب الاسم'; err.classList.remove('hidden'); return; }
  const res = id
    ? await api('PATCH', `/api/users/admin/users/${id}`, body)
    : await api('POST', '/api/users/admin/users', body);
  if (!res.status.toString().startsWith('2')) { err.textContent = apiErr(res); err.classList.remove('hidden'); return; }
  closeUserModal();
  toast(id ? 'تم تحديث العضو' : 'تمت إضافة العضو ✨', 'success');
  loadTeam();
});

/* team list delegation */
$('#team-list').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-uteam]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  if (btn.dataset.uteam === 'edit') openUserModal(id);
  else if (btn.dataset.uteam === 'del') {
    if (id === state.user.id) { toast('لا يمكنك حذف حسابك', 'error'); return; }
    if (!confirm('حذف هذا العضو وكل بياناته؟')) return;
    const res = await api('DELETE', `/api/users/admin/users/${id}`);
    if (res.status.toString().startsWith('2')) { toast('تم الحذف', 'success'); loadTeam(); }
    else toast(apiErr(res), 'error');
  }
});

/* ==================== Calculator ==================== */
const CALC_DENOMS = [200, 100, 50, 20, 10, 5, 1];
const CALC_COLORS = ['#059669', '#0284c7', '#7c3aed', '#ea5804', '#b83cc5', '#b8860b', '#64748b'];

function renderCalculatorRows() {
  const rows = $('#calc-rows');
  rows.innerHTML = CALC_DENOMS.map((d, i) => `
    <div class="calc-row">
      <span class="calc-ico" style="background:${CALC_COLORS[i]}">${d}</span>
      <span class="calc-val">${d} جنيه</span>
      <input class="calc-count" type="number" min="0" step="1" inputmode="numeric" placeholder="العدد" data-denom="${d}" />
      <span class="calc-row-total" data-total="${d}">0</span>
    </div>`).join('');
  rows.addEventListener('input', recalcCalculator);
}

function recalcCalculator() {
  let total = 0;
  $$('#calc-rows .calc-row').forEach((row) => {
    const denom = Number(row.querySelector('[data-denom]').dataset.denom);
    const count = Number(row.querySelector('.calc-count').value) || 0;
    const sum = denom * count;
    row.querySelector('[data-total]').textContent = fmt(sum);
    total += sum;
  });
  $('#calc-total').textContent = `${fmt(total)} ج.م`;
}

function loadCalculator() {
  renderCalculatorRows();
}

/* ==================== Boot ==================== */
let hasLoadedModules = false;
async function refreshAll() {
  const me = await api('GET', '/api/users/me');
  if (me.status === 200 && me.data.user) state.user = { ...state.user, name: me.data.user.name };
  if ($('#user-chip')) $('#user-chip').textContent = state.user ? `${state.user.name} • ${personaLabel(state.user)}` : '';
  const p = await api('GET', '/api/projects');
  if (p.status === 200) state.projects = p.data.projects;
  const specialists = await api('GET', '/api/users/specialists');
  if (specialists.status === 200) state.specialists = specialists.data.users;
  const intermediaries = await api('GET', '/api/users/intermediaries');
  if (intermediaries.status === 200) state.intermediaries = intermediaries.data.users;
  const s = await api('GET', '/api/projects/stats');
  if (s.status === 200) state.stats = s.data.stats;
  renderStats();
  renderRecent();
  renderType();
  loadProjectListIfVisible();
}

function loadProjectListIfVisible() { if (state.page === 'projects') renderProjectList(); }

function renderRecent() { renderRecentProjects(); }
function renderTypeBars() { renderType(); }

function showAuth() {
  $('#view-auth').classList.remove('hidden');
  $('#view-app').classList.add('hidden');
  setAuthMode('login');
  $('#auth-error').classList.add('hidden');
  $('#auth-form').reset();
}

async function enterApp() {
  $('#view-auth').classList.add('hidden');
  $('#view-app').classList.remove('hidden');
  $('#user-chip').textContent = `${state.user.name} • ${personaLabel(state.user)}`;
  // admin-only nav
  const adminOnlyNav = ['income', 'team'];
  $$('#topnav .nav-item, #bottom-nav .bn-item').forEach((b) => {
    b.classList.toggle('hidden', adminOnlyNav.includes(b.dataset.nav) && !isAdmin());
  });
  refreshAdminTools();
  await refreshAll();
  showPage('dashboard');
  void renderRecent;
}

/* ==================== Init ==================== */
function init() {
  setupNav();

  // التسجيل العام متاح، وأول حساب يحصل على صلاحية المالك.
  api('GET', '/api/auth/status').then((res) => {
    if (res.status === 200) state.authOpen = res.data.registrationOpen;
    bootFromToken();
  });
}

function bootFromToken() {
  const token = sessionStorage.getItem('taskflow_token');
  if (token) {
    state.token = token;
    api('GET', '/api/users/me').then((res) => {
      if (res.status === 200) {
        state.user = res.data.user;
        enterApp();
      } else {
        showAuth();
      }
    });
  } else {
    showAuth();
  }
}

init();
// cleanup: avoid ref fn duplicates
Object.assign(globalThis, { refreshAll, startShift, endShift, showPage, showAuth });