(function () {
'use strict';

/* ================================================================
 * State, constants, helpers
 * ================================================================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const LS_KEY = 'codetrack_token_v1';
const S = { token: null, data: null, view: null, sub: {}, materials: null, loading: 0, mounted: null,
            openDays: new Set(), draft: {}, file: null, subMode: 'paste' };

const SLOTS = [
  { key: 'scrum', time: '9:00 – 9:30', label: 'Scrum / Refresh', icon: 'groups' },
  { key: 'paper', time: '9:30 – 10:00', label: 'Pen & Paper', icon: 'edit' },
  { key: 'code',  time: '10:00 – 11:00', label: 'Code Lab', icon: 'terminal' }
];
const COLORS = ['blue', 'green', 'violet', 'amber', 'teal', 'red'];
const A_STATUS = {
  todo:      { label: 'To do',        cls: '',      icon: 'radio_button_unchecked' },
  missing:   { label: 'Missing',      cls: 'red',   icon: 'error' },
  submitted: { label: 'Submitted',    cls: 'blue',  icon: 'schedule' },
  rework:    { label: 'Needs rework', cls: 'amber', icon: 'replay' },
  approved:  { label: 'Approved',     cls: 'green', icon: 'check_circle' }
};
const ATT = {
  pending: { label: 'Checked in', cls: 'blue',  icon: 'schedule' },
  present: { label: 'Present',    cls: 'green', icon: 'check_circle' },
  late:    { label: 'Late',       cls: 'amber', icon: 'more_time' },
  absent:  { label: 'Absent',     cls: 'red',   icon: 'cancel' }
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DRIVE_FILE = 'https://drive.google.com/file/d/';

const STUDENT_NAV = [
  { id: 'dashboard',   icon: 'space_dashboard', label: 'Dashboard' },
  { id: 'plan',        icon: 'calendar_month',  label: 'Study plan' },
  { id: 'assignments', icon: 'assignment',      label: 'Assignments', badge: () => pendingAssignments().length },
  { id: 'lab',         icon: 'terminal',        label: 'Python Lab' },
  { id: 'materials',   icon: 'folder_open',     label: 'Study materials' },
  { id: 'doubts',      icon: 'forum',           label: 'Doubts & Q&A' },
  { id: 'reflection',  icon: 'edit_note',       label: 'Daily reflection' },
  { id: 'track',       icon: 'alt_route',       label: 'My track' },
  { id: 'profile',     icon: 'person',          label: 'Profile' }
];
const ADMIN_NAV = [
  { id: 'overview',   icon: 'monitoring',   label: 'Overview' },
  { id: 'attendance', icon: 'how_to_reg',   label: 'Attendance',   badge: () => S.data.counts.pendingCheckins },
  { id: 'review',     icon: 'rate_review',  label: 'Submissions',  badge: () => S.data.counts.toReview },
  { id: 'syllabus',   icon: 'menu_book',    label: 'Syllabus & plans' },
  { id: 'students',   icon: 'group',        label: 'Students',     badge: () => S.data.counts.trackRequests },
  { id: 'announce',   icon: 'campaign',     label: 'Announcements' },
  { id: 'exams',      icon: 'quiz',         label: 'Exams',        badge: () => (S.data.examAttempts || []).filter(x => x.status === 'submitted' && !x.graded).length },
  { id: 'adoubts',    icon: 'forum',        label: 'Doubts',       badge: () => S.data.counts.openDoubts },
  { id: 'areflect',   icon: 'edit_note',    label: 'Reflections' },
  { id: 'materials',  icon: 'folder_open',  label: 'Study materials' },
  { id: 'settings',   icon: 'settings',     label: 'Settings' }
];

const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls) => `<span class="msi ${cls || ''}" aria-hidden="true">${n}</span>`;
function rich(s) {
  if (!s) return '';
  return esc(s)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');
}
function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function parseD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
}
function fmtDate(s, noDow) { const d = parseD(s); return d ? (noDow ? '' : DOW[d.getDay()] + ', ') + d.getDate() + ' ' + MONTHS[d.getMonth()] : '—'; }
function fmtTime(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
  if (!m) return '';
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return h + ':' + m[2] + ' ' + ap;
}
function fmtDT(s) { if (!s) return '—'; return fmtDate(s.slice(0, 10)) + (s.length > 10 ? ', ' + fmtTime(s.slice(11, 16)) : ''); }
function nowStamp() { return S.data.today + 'T' + S.data.now; }
function first(name) { return String(name || '').trim().split(/\s+/)[0]; }
function initials(name) { const p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function hashColor(s) { const pal = ['#0b57d0', '#146c2e', '#5b3fa0', '#b3261e', '#00639b', '#7a4c00', '#8a3a8f']; let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return pal[h % pal.length]; }
function avatar(name, lg) { return `<span class="avatar ${lg ? 'lg' : ''}" style="background:${hashColor(name)}">${esc(initials(name))}</span>`; }
function greet() { const h = +(S.data.now || '12:00').slice(0, 2); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
function logo() { return `<span class="logo-mark">${icon('code')}</span>`; }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function track(id) { return (S.data.tracks || []).find(t => t.id === id); }
function trackColor(id) { const i = (S.data.tracks || []).findIndex(t => t.id === id); return i < 0 ? '' : COLORS[i % COLORS.length]; }
function trackName(id) { if (!id || id === 'common') return 'Common'; const t = track(id); return t ? t.name : id; }
function trackPill(id) { if (!id || id === 'common') return `<span class="pill">Common</span>`; const t = track(id); return `<span class="pill ${trackColor(id)}">${icon(t ? t.icon : 'school')} ${esc(trackName(id))}</span>`; }
function pill(label, cls, ic) { return `<span class="pill ${cls || ''}">${ic ? icon(ic) : ''}${esc(label)}</span>`; }
function statusPill(st) { const m = A_STATUS[st]; return pill(m.label, m.cls, m.icon); }
function attPill(st) { const m = ATT[st]; return m ? pill(m.label, m.cls, m.icon) : pill('Not marked', '', 'remove'); }
function emptyState(ic, text, extra) { return `<div class="empty">${icon(ic)}<div>${text}</div>${extra || ''}</div>`; }
function bar(pct, cls) { return `<div class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, pct || 0))}%"></i></div>`; }
function dueText(a) { return a.due ? 'Due ' + fmtDT(a.due) : 'No due date'; }
function dayLabel(d) { return d ? 'Day ' + d.day + ' · ' + d.title : 'General'; }

/* ================================================================
 * Server
 * ================================================================ */
function setLoading(n) {
  S.loading = Math.max(0, S.loading + n);
  const lb = $('#loadbar'); if (lb) lb.classList.toggle('on', S.loading > 0);
}
const API_URL = (window.CODETRACK_CONFIG || {}).apiUrl || '';
const EXAM_ONLY = !!(window.CODETRACK_CONFIG || {}).examOnly;
async function call(action, payload) {
  if (!API_URL) throw new Error('API URL missing — set apiUrl in config.js.');
  setLoading(1);
  let res;
  try {
    // text/plain body = "simple" CORS request, so Apps Script needs no preflight
    const r = await fetch(API_URL, { method: 'POST', redirect: 'follow', body: JSON.stringify({ action: action, token: S.token, payload: payload || {} }) });
    if (!r.ok) throw new Error('Server error (' + r.status + '). Try again.');
    res = await r.json();
  } catch (e) {
    throw new Error(e instanceof SyntaxError ? 'Unexpected server response.' : (/fetch|network/i.test(e.message) ? 'Network error — check your connection.' : e.message));
  } finally {
    setLoading(-1);
  }
  if (res.ok) return res.data;
  if (res.error === 'SESSION_EXPIRED') { signOut('Your session expired. Please sign in again.'); throw new Error('Session expired.'); }
  throw new Error(res.error);
}
async function act(action, payload, opts) {
  opts = opts || {};
  try {
    const r = await call(action, payload);
    if (r && r.state) S.data = r.state;
    if (!opts.noRender) render();
    const m = (r && r.msg) || opts.ok;
    if (m) toast(m);
    return r || true;
  } catch (e) {
    if (e.message !== 'Session expired.') toast(e.message, true);
    return null;
  }
}
async function refresh(silent) {
  try {
    S.data = await call('bootstrap');
    render();
    if (S.view === 'materials') loadMaterials(false);
    if (!silent) toast('Up to date');
  } catch (e) { if (!silent && e.message !== 'Session expired.') toast(e.message, true); }
}
async function loadMaterials(force) {
  S.materials = 'loading';
  if (S.view === 'materials') renderPage();
  try { S.materials = await call('materials', { refresh: !!force }); }
  catch (e) { S.materials = { error: e.message }; }
  if (S.view === 'materials') renderPage();
}

/* ================================================================
 * Boot, login, shell
 * ================================================================ */
async function boot() {
  S.token = load(LS_KEY);
  if (!S.token) return renderLogin();
  try {
    S.data = await call('bootstrap');
    S.view = defaultView();
    render();
  } catch (e) {
    if (e.message !== 'Session expired.') renderLogin(e.message);
  }
}
function defaultView() { return S.data && S.data.role === 'admin' ? 'overview' : 'dashboard'; }
function signOut(msg) {
  S.token = null; S.data = null; S.materials = null; S.mounted = null; S.sub = {}; S.draft = {}; S.file = null; S.welcome = false;
  destroyLabs(); stopExam();
  if (S.xm && S.xm.timer) clearInterval(S.xm.timer);
  if (window.CTProctor) window.CTProctor.stop();
  S.xm = null;
  const ov = $('#xm-overlay'); if (ov) ov.remove();
  store(LS_KEY, null);
  closeDialog(); closeMenu();
  renderLogin(msg);
}

function renderLogin(msg) {
  $('#app').innerHTML = `
  <div class="login-wrap"><div style="width:100%">
    <div class="login-card" style="margin:0 auto">
      <div>
        ${EXAM_ONLY ? `<div class="brand"><span class="logo-mark">${icon('school')}</span><span>${esc((window.CODETRACK_CONFIG || {}).brandName || 'Online assessment')}</span></div>` : `<div class="brand">${logo()}<span><b>Code</b>Track</span></div>`}
        <h1>Sign in</h1>
        <div class="lead">${EXAM_ONLY ? 'to take your exam' : 'to continue to your learning dashboard'}</div>
      </div>
      <form data-form="login" autocomplete="on" class="login-form" style="padding-top:56px">
        <div class="field"><input name="username" id="lg-user" placeholder=" " autocomplete="username" autocapitalize="none" required><label for="lg-user">Name or username</label></div>
        <div class="field"><input name="password" id="lg-pass" type="password" placeholder=" " autocomplete="current-password" required style="padding-right:52px"><label for="lg-pass">Password</label>
          <button type="button" class="icon-btn suffix" data-act="togglePw" aria-label="Show password">${icon('visibility')}</button></div>
        <div class="err ${msg ? '' : 'hidden'}" id="lg-err">${icon('error', 'sm')}<span>${esc(msg || '')}</span></div>
        <div class="login-actions"><span class="muted small">Forgot your password? Ask your instructor to reset it.</span><button class="btn filled">Next</button></div>
      </form>
    </div>
    <div class="login-foot"><span>${EXAM_ONLY ? 'Online assessment' : 'CodeTrack · Learning tracker'}</span><span>${EXAM_ONLY ? 'Use the name and password your instructor gave you' : 'Your progress is saved automatically'}</span></div>
  </div></div>`;
  setTimeout(() => { const u = $('#lg-user'); if (u) u.focus(); }, 50);
}

function mountShell() {
  $('#app').innerHTML = `
  <header class="topbar">
    <button class="icon-btn only-mobile" data-act="navOpen" aria-label="Menu">${icon('menu')}</button>
    <div class="brand">${logo()}<span><b>Code</b>Track</span></div>
    <div class="top-title" id="top-title"></div>
    <div class="spacer"></div>
    <span id="top-extra"></span>
    <button class="icon-btn" data-act="refresh" title="Refresh">${icon('refresh')}</button>
    <button class="icon-btn" data-act="userMenu" title="Account" id="top-avatar"></button>
    <div class="loadbar" id="loadbar"><i></i></div>
  </header>
  <div class="layout">
    <nav class="sidenav" id="sidenav" aria-label="Main"></nav>
    <div class="scrim-nav" id="scrim-nav" data-act="navClose"></div>
    <main class="main"><div class="page" id="page"></div></main>
  </div>`;
  S.mounted = S.data.role;
}

function renderChrome() {
  const d = S.data, admin = d.role === 'admin';
  const items = admin ? ADMIN_NAV : STUDENT_NAV;
  $('#sidenav').innerHTML =
    `<div class="nav-label">${admin ? 'Instructor' : 'Learning'}</div>` +
    items.map(it => {
      const b = it.badge ? it.badge() : 0;
      return `<button class="nav-item ${S.view === it.id ? 'active' : ''}" data-act="go" data-view="${it.id}">${icon(it.icon)}<span>${esc(it.label)}</span>${b ? `<span class="badge">${b}</span>` : ''}</button>`;
    }).join('') +
    `<div class="nav-sep"></div><button class="nav-item" data-act="signOut">${icon('logout')}<span>Sign out</span></button>`;
  $('#top-title').textContent = d.settings.courseTitle || '';
  $('#top-avatar').innerHTML = avatar(d.user.name);
  $('#top-extra').innerHTML = admin ? '' :
    `<button class="points-chip" data-act="go" data-view="profile" title="Your points">${icon('stars', 'fill sm')} ${d.stats.points}</button>`;
}

function render() {
  if (!S.data) return renderLogin();
  if (S.xm && window.CTApp.exam) return window.CTApp.exam.renderXm();
  if (EXAM_ONLY && S.data.role === 'student' && window.CTApp.exam) return window.CTApp.exam.renderExamHome();
  if (S.exam) return renderExam();
  if (S.welcome) return renderWelcome();
  if (!$('#page') || S.mounted !== S.data.role) mountShell();
  const valid = (S.data.role === 'admin' ? ADMIN_NAV : STUDENT_NAV).some(n => n.id === S.view);
  if (!valid) S.view = defaultView();
  renderChrome();
  renderPage();
}
function renderPage() {
  const page = $('#page'); if (!page) return;
  const fn = V[S.view] || V[defaultView()];
  page.innerHTML = fn();
  afterRender(page);
}
function afterRender(root) {
  mountLabs(root);
  if (window.hljs) {
    $$('pre.code code', root).forEach(el => { if (!el.dataset.hl) { try { hljs.highlightElement(el); } catch (e) { /* ignore */ } el.dataset.hl = '1'; } });
  }
}
function go(view, sub) {
  S.view = view;
  if (sub) Object.assign(S.sub, sub);
  closeNav();
  render();
  window.scrollTo(0, 0);
  if (view === 'materials' && (!S.materials || S.materials.error)) loadMaterials(false);
}
function closeNav() { const n = $('#sidenav'); if (n) n.classList.remove('open'); const s = $('#scrim-nav'); if (s) s.classList.remove('open'); }

/* ================================================================
 * UI primitives: toast, dialog, menu, fields
 * ================================================================ */
function toast(msg, error) {
  const el = document.createElement('div');
  el.className = 'snack' + (error ? ' error' : '');
  el.innerHTML = (error ? icon('error') : '') + `<span>${esc(msg)}</span>`;
  $('#snackbar').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, error ? 6000 : 3200);
}
function openDialog(title, inner, wide) {
  $('#dialog-root').innerHTML = `<div class="scrim" data-act="scrimClose"><div class="dialog ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="dialog-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-act="closeDialog" aria-label="Close">${icon('close')}</button></div>${inner}</div></div>`;
  const root = $('#dialog-root');
  afterRender(root);
  const f = root.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select');
  if (f) setTimeout(() => f.focus(), 60);
}
function formDialog(title, form, fields, submitLabel, attrs, wide) {
  openDialog(title, `<form data-form="${form}" ${attrs || ''}><div class="dialog-body">${fields}</div>
    <div class="dialog-actions"><button type="button" class="btn text" data-act="closeDialog">Cancel</button><button class="btn filled">${esc(submitLabel || 'Save')}</button></div></form>`, wide);
}
function closeDialog() { const r = $('#dialog-root'); if (r) r.innerHTML = ''; }
function confirmDialog(title, text, yes, danger) {
  return new Promise(resolve => {
    S._confirm = resolve;
    openDialog(title, `<div class="dialog-body"><p style="margin:0;color:var(--text-2)">${text}</p></div>
      <div class="dialog-actions"><button class="btn text" data-act="confirmNo">Cancel</button><button class="btn filled ${danger ? 'danger' : ''}" data-act="confirmYes">${esc(yes || 'OK')}</button></div>`);
  });
}
function closeMenu() { const m = $('#menu'); if (m) m.remove(); }
function openUserMenu(anchor) {
  closeMenu();
  const u = S.data.user, r = anchor.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'menu'; m.id = 'menu';
  m.style.top = (r.bottom + 6) + 'px';
  m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
  m.innerHTML = `<div class="menu-head">${avatar(u.name, true)}<div style="min-width:0"><div class="h3">${esc(u.name)}</div><div class="muted small">@${esc(u.username)} · ${u.role === 'admin' ? 'Instructor' : 'Student'}</div></div></div>
    ${u.role === 'student' ? `<button data-act="go" data-view="profile">${icon('person')} Profile</button>` : ''}
    <button data-act="pwDialog">${icon('key')} Change password</button>
    <button data-act="signOut">${icon('logout')} Sign out</button>`;
  document.body.appendChild(m);
}

let FID = 0;
function field(name, label, value, o) {
  o = o || {};
  const id = 'f' + (++FID);
  const v = esc(value === undefined || value === null ? '' : value);
  const req = o.required ? 'required' : '';
  const input = o.textarea
    ? `<textarea id="${id}" name="${name}" placeholder=" " rows="${o.rows || 4}" ${req} ${o.attrs || ''}>${v}</textarea>`
    : `<input id="${id}" name="${name}" type="${o.type || 'text'}" value="${v}" placeholder=" " ${req} ${o.attrs || ''}>`;
  const isStatic = ['date', 'time', 'datetime-local', 'number'].indexOf(o.type) >= 0;
  return `<div class="field ${isStatic ? 'static' : ''} ${o.cls || ''}">${input}<label for="${id}">${esc(label)}</label>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</div>`;
}
function selectField(name, label, options, value, o) {
  o = o || {};
  const id = 'f' + (++FID);
  return `<div class="field static ${o.cls || ''}"><select id="${id}" name="${name}" ${o.attrs || ''}>${options.map(op =>
    `<option value="${esc(op.value)}" ${String(op.value) === String(value) ? 'selected' : ''}>${esc(op.label)}</option>`).join('')}</select><label for="${id}">${esc(label)}</label></div>`;
}
function switchField(name, label, checked, attrs) {
  return `<label class="switch" style="margin:2px 0 16px"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${attrs || ''}><span class="track"></span><span>${esc(label)}</span></label>`;
}
function formData(f) {
  const o = {};
  Array.from(f.elements).forEach(el => {
    if (!el.name) return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  });
  return o;
}
function statCard(ic, label, value, sub, extra) {
  return `<div class="card stat"><div class="label">${icon(ic)} ${esc(label)}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}${extra || ''}</div>`;
}
function pwDialog() {
  closeMenu();
  formDialog('Change password', 'changePassword',
    field('current', 'Current password', '', { type: 'password', required: true, attrs: 'autocomplete="current-password"' }) +
    field('next', 'New password', '', { type: 'password', required: true, attrs: 'autocomplete="new-password" minlength="4"' }) +
    field('again', 'Confirm new password', '', { type: 'password', required: true, attrs: 'autocomplete="new-password"' }),
    'Change password');
}

/* ================================================================
 * Student helpers
 * ================================================================ */
function progSet() { return new Set(S.data.progress || []); }
function doneCount(dayId) { const p = progSet(); return SLOTS.filter(s => p.has(dayId + '|' + s.key)).length; }
function dayById(id) { return (S.data.days || []).find(d => d.id === id); }
function focusDays() {
  const days = S.data.days || [], t = S.data.today;
  let list = days.filter(d => d.date === t), label = 'Today';
  if (!list.length) {
    const next = days.find(d => d.date > t);
    if (next) { list = days.filter(d => d.date === next.date); label = 'Next class · ' + fmtDate(next.date); }
  }
  if (!list.length && days.length) { list = [days[days.length - 1]]; label = 'Latest lesson'; }
  return { list, label };
}
function subsFor(aid) { return (S.data.submissions || []).filter(s => s.assignmentId === aid); }
function aState(a) {
  const s = subsFor(a.id)[0];
  if (s) return s.status === 'approved' ? 'approved' : s.status === 'rework' ? 'rework' : 'submitted';
  return a.due && a.due < nowStamp() ? 'missing' : 'todo';
}
function pendingAssignments() {
  if (!S.data || S.data.role !== 'student') return [];
  return (S.data.assignments || []).filter(a => ['todo', 'missing', 'rework'].indexOf(aState(a)) >= 0);
}
function assignmentRow(a, showDay) {
  const st = aState(a), m = A_STATUS[st], d = dayById(a.dayId), latest = subsFor(a.id)[0];
  return `<div class="list-item click" data-act="openAssignment" data-id="${esc(a.id)}">
    <span class="lead-icon ${m.cls}">${icon(m.icon)}</span>
    <div class="grow"><div class="title">${esc(a.title)}</div><div class="meta">${showDay && d ? 'Day ' + d.day + ' · ' : ''}${dueText(a)}</div></div>
    ${latest && latest.late === 'TRUE' ? pill('Late', 'red') : ''}${statusPill(st)}
  </div>`;
}

/* ================================================================
 * Views
 * ================================================================ */
const V = {};

/* ---------- Student: dashboard ---------- */
V.dashboard = () => {
  const d = S.data, st = d.stats, lb = d.leaderboard;
  const f = focusDays();
  return `
  <div class="page-head"><div><h1 class="h1">${greet()}, ${esc(first(d.user.name))}</h1>
    <p class="muted">${fmtDate(d.today)} · ${esc(d.settings.courseTitle)}${d.user.trackStatus === 'approved' ? ' · ' + esc(trackName(d.user.track)) : ''}</p></div></div>
  ${myReportCards()}
  ${window.CTApp.exam ? window.CTApp.exam.examCards(false) : ''}
  ${trackBanner()}
  <div class="stats">
    ${statCard('trending_up', 'Course progress', st.progressPct + '%', `${st.itemsDone} of ${st.totalItems} sessions done`, bar(st.progressPct))}
    ${statCard('stars', 'Points', st.points, lb.myRank ? `Rank #${lb.myRank} of ${lb.total}` : 'Earn points by learning')}
    ${statCard('event_available', 'Attendance', st.attendancePct === null ? '—' : st.attendancePct + '%', st.classDays ? `${st.attended} of ${plural(st.classDays, 'class')}` : 'No classes yet')}
    ${statCard('local_fire_department', 'Streak', plural(st.streak, 'day'), st.streak ? 'Keep it going!' : 'Check in to start a streak')}
  </div>
  <div class="grid-2">
    <div class="col">${focusCard(f)}</div>
    <div class="col">${announcementsCard(4)}${deadlinesCard()}${leaderboardCard()}</div>
  </div>`;
};

function trackBanner() {
  const d = S.data, u = d.user;
  if (u.trackStatus === 'approved' || !d.settings.trackSelectionOpen) return '';
  if (u.trackStatus === 'requested') return `<div class="banner">${icon('hourglass_top')}<div class="grow">You requested <b>${esc(trackName(u.requestedTrack))}</b>. Your instructor will confirm it soon.</div><button class="btn text" data-act="go" data-view="track">View</button></div>`;
  if (u.trackStatus === 'rejected') return `<div class="banner warn">${icon('info')}<div class="grow">Your instructor asked you to pick a different track.</div><button class="btn tonal" data-act="go" data-view="track">Choose again</button></div>`;
  return `<div class="banner">${icon('alt_route')}<div class="grow"><b>Choose your specialization track.</b> After the common basics, your lessons follow the path you pick.</div><button class="btn filled" data-act="go" data-view="track">Choose track</button></div>`;
}

function checkinBlock() {
  const d = S.data, a = d.todayAttendance, s = d.settings;
  if (a) {
    const m = ATT[a.status] || ATT.pending;
    const text = a.status === 'pending' ? `Checked in at ${fmtTime(a.checkInAt)} · waiting for your instructor to verify`
      : a.status === 'present' ? 'You are marked present today' : a.status === 'late' ? 'You are marked late today' : 'You are marked absent today';
    return `<div class="checkin"><span class="lead-icon ${m.cls}">${icon(m.icon, 'fill')}</span><div class="grow">${text}</div></div>`;
  }
  if (d.checkInOpen) {
    return `<div class="checkin"><span class="lead-icon blue">${icon('how_to_reg')}</span><div class="grow"><b>Are you in class?</b><div class="muted small">Check-in is open until ${fmtTime(s.checkinEnd)}</div></div>
      <button class="btn filled" data-act="checkIn">${icon('front_hand')} I'm here</button></div>`;
  }
  if (d.classToday) {
    const before = d.now < s.checkinStart;
    return `<div class="checkin"><span class="lead-icon">${icon('schedule')}</span><div class="grow muted">${before ? `Check-in opens at ${fmtTime(s.checkinStart)}` : 'Check-in is closed for today'}</div></div>`;
  }
  return '';
}

function slotRows(day) {
  const p = progSet();
  return SLOTS.map(s => {
    const done = p.has(day.id + '|' + s.key);
    return `<div class="slot ${done ? 'done' : ''}">
      <label class="check" title="${done ? 'Mark as not done' : 'Mark as done'}"><input type="checkbox" data-change="progress" data-day="${esc(day.id)}" data-item="${s.key}" ${done ? 'checked' : ''}><span></span></label>
      <div class="grow"><div class="slot-time">${icon(s.icon)} ${s.time} · ${s.label}</div><div class="slot-text">${rich(day[s.key]) || '<span class="muted">—</span>'}</div></div>
    </div>`;
  }).join('');
}
function dayAssignments(dayId) {
  const list = (S.data.assignments || []).filter(a => a.dayId === dayId);
  if (!list.length) return '';
  return `<div class="divider"></div><div class="small muted" style="font-weight:500;letter-spacing:.4px">ASSIGNMENT</div><div class="list">${list.map(a => assignmentRow(a)).join('')}</div>`;
}
function focusCard(f) {
  if (!f.list.length) {
    return `<div class="card">${emptyState('event_upcoming', 'Your study plan will appear here once your instructor publishes this week.')}</div>`;
  }
  return f.list.map((day, i) => `
    <div class="card today-card">
      <div class="row between"><span class="pill blue">${icon('today')} ${esc(f.label)}</span>${trackPill(day.track)}</div>
      <div class="day-title">Day ${day.day} · ${esc(day.title)}</div>
      <div class="muted small">${fmtDate(day.date)} · ${doneCount(day.id)} of 3 sessions done</div>
      ${i === 0 && f.label === 'Today' ? checkinBlock() : ''}
      <div style="margin-top:8px">${slotRows(day)}</div>
      ${day.outcomes ? `<div class="outcomes">${icon('flag')}<div><b>By the end you can:</b> ${rich(day.outcomes)}</div></div>` : ''}
      ${dayAssignments(day.id)}
      <div class="row" style="margin-top:14px">
        <button class="btn sm outlined" data-act="askAbout" data-day="${esc(day.id)}">${icon('help')} Ask a doubt</button>
        <button class="btn sm outlined" data-act="reflectAbout" data-day="${esc(day.id)}">${icon('edit_note')} Write reflection</button>
      </div>
    </div>`).join('');
}
/* ---------- Report cards (announcements of kind 'report', addressed to one student) ---------- */
function parseReport(a) { try { return JSON.parse(a.body); } catch (e) { return null; } }
function reportCard(a, opts) {
  const r = parseReport(a);
  if (!r) return '';
  opts = opts || {};
  const pct = Math.max(0, Math.min(100, Math.round(r.total / (r.max || 100) * 100)));
  const C = 2 * Math.PI * 42;
  const sec = (r.sections || []).map(s => {
    const p = Math.round(s.score / s.max * 100);
    return `<div class="rc-sec"><div class="rc-sec-l"><b>${esc(s.id)}</b><span>${esc(s.name)}</span></div>
      <div class="rc-bar"><i style="width:${p}%" class="${p >= 75 ? 'hi' : p >= 50 ? 'mid' : 'lo'}"></i></div><div class="rc-sec-s"><b>${esc(String(s.score))}</b> / ${esc(String(s.max))}</div></div>`;
  }).join('');
  const mist = (r.mistakes || []).map((m, i) => `<div class="rc-mis">
      <div class="rc-mis-h"><span class="rc-num">${i + 1}</span><div class="grow"><div class="rc-mis-t">${rich(m.title)}</div>${m.where ? `<div class="rc-where">${(m.where || '').split(',').map(w => `<span>${esc(w.trim())}</span>`).join('')}</div>` : ''}</div></div>
      <div class="rc-mis-b">${rich(m.text)}</div>
      ${m.wrong || m.right ? `<div class="rc-code">${m.wrong ? `<div class="bad"><div class="lbl">${icon('close', 'sm')} You wrote</div><pre>${esc(m.wrong)}</pre></div>` : ''}${m.right ? `<div class="good"><div class="lbl">${icon('check', 'sm')} Correct</div><pre>${esc(m.right)}</pre></div>` : ''}</div>` : ''}
      ${m.tip ? `<div class="rc-tip">${icon('lightbulb', 'sm')}<span>${rich(m.tip)}</span></div>` : ''}
    </div>`).join('');
  return `<article class="rc" id="rc-${esc(a.id)}">
    <header class="rc-head">
      <div class="grow"><div class="rc-kicker">${icon('workspace_premium', 'sm')} Report card${opts.forName ? ' · ' + esc(opts.forName) : ''}</div>
        <h2>${esc(r.exam || a.title)}</h2><div class="rc-sub">${esc(r.student || '')}${r.date ? ' · ' + esc(r.date) : ''}</div>
        ${r.badge ? `<div class="rc-badge">${esc(r.badge)}</div>` : ''}</div>
      <div class="rc-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" class="tr"/><circle cx="50" cy="50" r="42" class="fg" stroke-dasharray="${(C * pct / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
        <div><b>${esc(String(r.total))}</b><span>/ ${esc(String(r.max || 100))}</span></div></div>
    </header>
    <div class="rc-body">
      <div class="rc-secs">${sec}</div>
      ${r.message ? `<p class="rc-msg">${rich(r.message)}</p>` : ''}
      <details class="rc-more" ${opts.open ? 'open' : ''}><summary>${icon('expand_more')} <span class="o">See what went well, your mistakes and how to fix them</span><span class="c">Hide details</span></summary>
        <div class="rc-two">
          <section class="rc-good"><h3>${icon('verified', 'sm')} What you did well</h3><ul>${(r.strengths || []).map(x => `<li>${rich(x)}</li>`).join('')}</ul></section>
          <section class="rc-todo"><h3>${icon('flag', 'sm')} Before next week</h3><ol>${(r.todo || []).map(x => `<li>${rich(x)}</li>`).join('')}</ol></section>
        </div>
        <h3 class="rc-h">${icon('build', 'sm')} Mistakes &amp; how not to repeat them</h3>
        ${mist}
        ${r.closing ? `<div class="rc-close">${rich(r.closing)}</div>` : ''}
      </details>
    </div></article>`;
}
function myReportCards() {
  return (S.data.announcements || []).filter(a => a.kind === 'report').map(a => reportCard(a)).join('');
}
function announcementsCard(limit) {
  const list = (S.data.announcements || []).filter(a => a.kind !== 'report').slice(0, limit || 99);
  return `<div class="card"><div class="card-head"><div class="h3">${icon('campaign')} Announcements</div></div>
    ${list.length ? list.map(a => `<div class="ann"><div class="t">${a.pinned === 'TRUE' ? icon('push_pin', 'sm fill') : ''}${esc(a.title || 'Announcement')}</div>
      ${a.body ? `<div class="b">${rich(a.body)}</div>` : ''}<div class="small muted" style="margin-top:4px">${fmtDT(a.createdAt)}</div></div>`).join('')
      : `<div class="muted small">No announcements yet.</div>`}
  </div>`;
}
function deadlinesCard() {
  const list = pendingAssignments().sort((a, b) => String(a.due).localeCompare(b.due)).slice(0, 5);
  return `<div class="card"><div class="card-head"><div class="h3">${icon('pending_actions')} Due & pending</div><button class="btn text sm" data-act="go" data-view="assignments">All</button></div>
    ${list.length ? `<div class="list">${list.map(a => assignmentRow(a, true)).join('')}</div>` : `<div class="muted small">You're all caught up.</div>`}</div>`;
}
function leaderboardCard() {
  const lb = S.data.leaderboard;
  if (!lb || !lb.total) return '';
  const inTop = lb.top.some(x => x.me);
  return `<div class="card"><div class="card-head"><div class="h3">${icon('emoji_events')} Leaderboard</div></div>
    ${lb.top.map(x => `<div class="lb-row ${x.me ? 'me' : ''}"><span class="medal r${x.rank}">${x.rank}</span><div class="grow">${esc(x.me ? x.name + ' (you)' : x.name)}</div><b>${x.points}</b></div>`).join('')}
    ${!inTop && lb.myRank ? `<div class="lb-row me"><span class="medal">${lb.myRank}</span><div class="grow">You</div><b>${lb.myPoints}</b></div>` : ''}
  </div>`;
}

/* ---------- Student: study plan ---------- */
V.plan = () => {
  const d = S.data;
  if (!d.weeks.length) return `<div class="page-head"><div><h1 class="h1">Study plan</h1></div></div>${emptyState('event_upcoming', 'No weeks have been published yet. Check back at the start of the week.')}`;
  const f = focusDays();
  const focusWeek = f.list.length ? String(f.list[0].week) : String(d.weeks[d.weeks.length - 1].week);
  const wk = S.sub.week && d.weeks.some(w => String(w.week) === String(S.sub.week)) ? String(S.sub.week) : focusWeek;
  const w = d.weeks.find(x => String(x.week) === wk);
  const days = d.days.filter(x => String(x.week) === wk);
  if (!S.openDays.size) f.list.forEach(x => S.openDays.add(x.id));
  const done = days.reduce((s, x) => s + doneCount(x.id), 0);
  return `
  <div class="page-head"><div><h1 class="h1">Study plan</h1><p class="muted">Tick each session as you finish it. Every completed day earns points.</p></div></div>
  ${d.lockedTrackContent ? `<div class="banner warn">${icon('lock')}<div class="grow">Some lessons are part of a specialization track. They unlock once your track is approved.</div><button class="btn tonal" data-act="go" data-view="track">My track</button></div>` : ''}
  <div class="chips">${d.weeks.map(x => `<button class="chip ${String(x.week) === wk ? 'on' : ''}" data-act="pickWeek" data-week="${esc(x.week)}">Week ${esc(x.week)}</button>`).join('')}</div>
  <div class="row between" style="margin-bottom:14px"><div><div class="h2">${esc(w ? w.title : 'Week ' + wk)}</div><div class="muted small">${plural(days.length, 'day')} · ${done} of ${days.length * 3} sessions done</div></div></div>
  ${days.length ? days.map(day => dayDetails(day, f.list.some(x => x.id === day.id))).join('') : emptyState('lock', 'Lessons for this week unlock with your track.')}`;
};
function dayDetails(day, isFocus) {
  const n = doneCount(day.id);
  const cls = n === 3 ? 'done' : isFocus && day.date === S.data.today ? 'today' : '';
  return `<details class="day" data-id="${esc(day.id)}" ${S.openDays.has(day.id) ? 'open' : ''}>
    <summary>
      <div class="daynum ${cls}"><small>DAY</small><b>${n === 3 ? icon('check', 'sm') : esc(day.day)}</b></div>
      <div class="grow" style="min-width:0"><div class="h3">${esc(day.title)}</div><div class="small muted row" style="gap:8px">${fmtDate(day.date)}${day.track !== 'common' ? ' ' + trackPill(day.track) : ''}${day.date === S.data.today ? ' ' + pill('Today', 'blue') : ''}</div></div>
      <span class="dots hide-sm">${SLOTS.map((s, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</span>
      ${icon('expand_more', 'chev')}
    </summary>
    <div class="day-body">${slotRows(day)}
      ${day.outcomes ? `<div class="outcomes">${icon('flag')}<div><b>By the end you can:</b> ${rich(day.outcomes)}</div></div>` : ''}
      ${dayAssignments(day.id)}
      <div class="row" style="margin-top:12px"><button class="btn sm outlined" data-act="askAbout" data-day="${esc(day.id)}">${icon('help')} Ask a doubt</button></div>
    </div>
  </details>`;
}

/* ---------- Student: assignments ---------- */
V.assignments = () => {
  if (S.sub.assignment) {
    const a = (S.data.assignments || []).find(x => x.id === S.sub.assignment);
    if (a) return assignmentDetail(a);
    S.sub.assignment = null;
  }
  const all = (S.data.assignments || []).slice().sort((a, b) => String(a.due).localeCompare(b.due));
  const groups = {
    pending: all.filter(a => ['todo', 'missing', 'rework'].indexOf(aState(a)) >= 0),
    submitted: all.filter(a => aState(a) === 'submitted'),
    approved: all.filter(a => aState(a) === 'approved'),
    all: all
  };
  const fsel = S.sub.afilter || 'pending';
  const list = groups[fsel];
  const chip = (k, label) => `<button class="chip ${fsel === k ? 'on' : ''}" data-act="afilter" data-f="${k}">${label} <span class="count">${groups[k].length}</span></button>`;
  return `<div class="page-head"><div><h1 class="h1">Assignments</h1><p class="muted">Submit by pasting code or uploading a .py file. Approved work earns bonus points.</p></div></div>
    <div class="chips">${chip('pending', 'To do')}${chip('submitted', 'Submitted')}${chip('approved', 'Approved')}${chip('all', 'All')}</div>
    ${list.length ? `<div class="card" style="padding:6px 10px"><div class="list">${list.map(a => assignmentRow(a, true)).join('')}</div></div>`
      : emptyState(fsel === 'pending' ? 'task_alt' : 'inbox', fsel === 'pending' ? "Nothing pending — nice work!" : 'Nothing here yet.')}`;
};
function assignmentDetail(a) {
  if (a.mode === 'lab' || a.mode === 'exam') return labAssignmentDetail(a);
  const st = aState(a), subs = subsFor(a.id), d = dayById(a.dayId);
  const canSubmit = st !== 'approved';
  return `
  <button class="btn text" data-act="backToAssignments" style="margin:-6px 0 8px -12px">${icon('arrow_back')} All assignments</button>
  <div class="page-head"><div><div class="row" style="margin-bottom:6px">${statusPill(st)}${d && d.track !== 'common' ? trackPill(d.track) : ''}</div>
    <h1 class="h1">${esc(a.title)}</h1><p class="muted">${d ? esc(dayLabel(d)) + ' · ' : ''}${dueText(a)}</p></div></div>
  <div class="grid-2">
    <div class="col">
      <div class="card"><div class="card-head"><div class="h3">${icon('description')} Instructions</div></div><div>${rich(a.description) || '<span class="muted">No extra instructions.</span>'}</div></div>
      ${canSubmit ? submitCard(a, subs.length) : `<div class="banner ok">${icon('verified')}<div class="grow">Approved — great job! This assignment is complete.</div></div>`}
    </div>
    <div class="col">${mySubmissionsCard(subs)}</div>
  </div>`;
}
function mySubmissionsCard(subs) {
  return `<div class="card"><div class="card-head"><div class="h3">${icon('history')} Your submissions</div></div>
      ${subs.length ? subs.map(s => `<div class="list-item" style="align-items:flex-start">
        <span class="lead-icon ${A_STATUS[s.status] ? A_STATUS[s.status].cls : ''}">${icon(s.type === 'file' ? 'upload_file' : s.type === 'lab' ? 'terminal' : 'code')}</span>
        <div class="grow"><div class="row" style="gap:6px">${statusPill(s.status)}${s.late === 'TRUE' ? pill('Late', 'red') : ''}${s.testScore ? scorePill(s.testScore) : ''}</div>
          <div class="meta" style="margin-top:4px">${fmtDT(s.submittedAt)} · ${s.type === 'lab' ? 'written in Lab' : esc(s.fileName)}</div>
          ${s.comment ? `<div class="outcomes" style="background:${s.status === 'rework' ? 'var(--amber-soft)' : 'var(--green-soft)'}">${icon('comment')}<div><b>Instructor:</b> ${rich(s.comment)}</div></div>` : ''}
          <button class="btn text sm" style="margin:6px 0 0 -14px" data-act="viewSub" data-id="${esc(s.id)}">${icon('visibility')} View code</button></div>
      </div>`).join('') : `<div class="muted small">No submissions yet.</div>`}
    </div>`;
}
function scorePill(sc) {
  const m = /^(\d+)\/(\d+)$/.exec(sc || '');
  if (!m) return '';
  return pill('Tests ' + sc, +m[1] === +m[2] ? 'green' : +m[1] === 0 ? 'red' : 'amber', 'fact_check');
}
function submitCard(a, prevCount) {
  const mode = S.subMode;
  return `<div class="card"><div class="card-head"><div class="h3">${icon('upload')} ${prevCount ? 'Submit a new version' : 'Submit your work'}</div></div>
    <div class="tabs" role="tablist">
      <button type="button" class="tab ${mode === 'paste' ? 'on' : ''}" data-act="subMode" data-mode="paste">${icon('code')} Paste code</button>
      <button type="button" class="tab ${mode === 'file' ? 'on' : ''}" data-act="subMode" data-mode="file">${icon('upload_file')} Upload file</button>
    </div>
    <form data-form="submit" data-id="${esc(a.id)}">
      <div class="${mode === 'paste' ? '' : 'hidden'}"><textarea class="code-input" name="code" data-input="draft" data-id="${esc(a.id)}" spellcheck="false" autocapitalize="off" placeholder="# Paste or type your Python code here">${esc(S.draft[a.id] || '')}</textarea></div>
      <div class="${mode === 'file' ? '' : 'hidden'}">
        <label class="drop">${icon('upload_file')}<div><b>Choose a file</b> or drag it here</div><div class="small muted">.py · .ipynb · .txt — up to 500 KB</div><input type="file" accept=".py,.ipynb,.txt" data-change="pickFile"></label>
        <div id="file-preview" style="margin-top:12px">${filePreview()}</div>
      </div>
      <div class="row end" style="margin-top:14px"><button class="btn filled">${icon('send')} Submit</button></div>
    </form></div>`;
}
function filePreview() {
  const f = S.file;
  if (!f) return '';
  const lines = f.content.split('\n');
  return `<div class="row between" style="margin-bottom:8px"><div class="row">${icon('description')} <b>${esc(f.name)}</b> <span class="muted small">${(f.size / 1024).toFixed(1)} KB · ${plural(lines.length, 'line')}</span></div>
    <button type="button" class="btn text sm danger" data-act="clearFile">${icon('close')} Remove</button></div>
    <pre class="code" style="max-height:260px"><code class="language-python">${esc(lines.slice(0, 60).join('\n'))}${lines.length > 60 ? '\n…' : ''}</code></pre>`;
}


/* ================================================================
 * CodeTrack Lab: practice labs, playground and timed exams
 * ================================================================ */
S.labs = {};
function labKey(kind, id) { return (S.data && S.data.user ? S.data.user.id : 'x') + ':' + kind + ':' + id; }
function getLab(key, opts) {
  if (S.labs[key]) return S.labs[key];
  if (!window.CTLab) return null;
  S.labs[key] = window.CTLab.create(Object.assign({ key: key, toast: toast }, opts));
  return S.labs[key];
}
function destroyLab(key) { const l = S.labs[key]; if (l) { l.destroy(); delete S.labs[key]; } }
function destroyLabs() { Object.keys(S.labs || {}).forEach(destroyLab); }
function mountLabs(root) {
  $$('[data-lab]', root).forEach(ph => {
    const lab = S.labs[ph.dataset.lab];
    if (!lab) { ph.innerHTML = emptyState('error', 'The Lab could not load in this browser.'); return; }
    ph.appendChild(lab.el);
    requestAnimationFrame(() => lab.paint());
  });
}
function labMount(key) { return `<div class="lab-mount" data-lab="${esc(key)}"></div>`; }
function practiceLab(a) {
  return getLab(labKey('a', a.id), {
    title: 'main.py', tests: a.tests || [], submitLabel: 'Submit',
    starter: '# ' + a.title + '\n# Type your solution below. Paste is turned off.\n\n',
    onSubmit: async p => {
      if (!(await confirmDialog('Submit your code?', 'Your code and test results will be sent to your instructor.', 'Submit'))) return;
      const r = await act('submitAssignment', { assignmentId: a.id, type: 'lab', code: p.code, testOutputs: p.testOutputs, integrity: p.integrity });
      if (r) window.scrollTo(0, 0);
    }
  });
}

/* IST wall-clock string <-> epoch ms (IST has no daylight saving) */
function istMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - 330 * 60000 : NaN;
}
function examPhase(a) {
  const sub = subsFor(a.id)[0];
  if (sub && sub.status !== 'rework') return 'done';
  const now = (S.data.serverNow || nowStamp()).slice(0, 16);
  if (a.examStart && now < a.examStart) return 'soon';
  if (a.examEnd && now >= a.examEnd) return 'closed';
  return 'open';
}
function labAssignmentDetail(a) {
  const st = aState(a), subs = subsFor(a.id), d = dayById(a.dayId);
  const exam = a.mode === 'exam';
  const head = `<button class="btn text" data-act="backToAssignments" style="margin:-6px 0 8px -12px">${icon('arrow_back')} All assignments</button>
  <div class="page-head"><div><div class="row" style="margin-bottom:6px">${statusPill(st)}${pill(exam ? 'Lab exam' : 'CodeTrack Lab', exam ? 'violet' : 'teal', exam ? 'timer' : 'terminal')}${d && d.track !== 'common' ? trackPill(d.track) : ''}</div>
    <h1 class="h1">${esc(a.title)}</h1><p class="muted">${d ? esc(dayLabel(d)) + ' · ' : ''}${exam ? 'Exam window ' + fmtDT(a.examStart) + ' – ' + fmtTime((a.examEnd || '').slice(11, 16)) : dueText(a)}</p></div></div>`;
  if (exam) return head + examGate(a, subs);
  const lab = st === 'approved' ? null : practiceLab(a);
  return head + `
  <div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('description')} Instructions</div>${a.testCount ? pill(plural(a.testCount, 'test case'), 'blue', 'fact_check') : ''}</div><div>${rich(a.description) || '<span class="muted">No extra instructions.</span>'}</div></div>
    ${lab ? labMount(labKey('a', a.id)) : `<div class="banner ok">${icon('verified')}<div class="grow">Approved — great job! This assignment is complete.</div></div>`}
    ${mySubmissionsCard(subs)}
  </div>`;
}
function examGate(a, subs) {
  const ph = examPhase(a), sub = subs[0];
  const rules = `<ul class="exam-rules">
      <li>The exam opens in <b>full screen</b>. Stay in this window until you submit.</li>
      <li>Paste, copy and right-click are turned off. Type everything yourself.</li>
      <li>Leaving the window is recorded${a.maxSwitches > 0 ? `; after <b>${plural(a.maxSwitches, 'switch')}</b> your exam is submitted automatically` : ''}.</li>
      <li>When the timer reaches zero your code is submitted automatically.</li>
      <li>Your work is saved in this browser as you type, so a refresh won't lose it.</li></ul>`;
  let body;
  if (ph === 'done') body = `<div class="banner ok">${icon('task_alt')}<div class="grow"><b>Submitted</b> at ${fmtDT(sub.submittedAt)}. ${sub.status === 'approved' ? 'Your instructor has reviewed it.' : 'Your instructor will review it — scores appear after review.'}</div></div>`;
  else if (ph === 'soon') body = `<div class="banner">${icon('schedule')}<div class="grow">The exam opens at <b>${fmtTime(a.examStart.slice(11, 16))}</b> on ${fmtDate(a.examStart.slice(0, 10))}. Refresh this page when it is time.</div><button class="btn tonal" data-act="refresh">${icon('refresh')} Refresh</button></div>${rules}`;
  else if (ph === 'closed') body = `<div class="banner warn">${icon('lock_clock')}<div class="grow">This exam closed at ${fmtTime(a.examEnd.slice(11, 16))}.</div></div>`;
  else body = `${sub && sub.status === 'rework' ? `<div class="banner warn">${icon('replay')}<div class="grow">Your instructor reopened this exam for you: ${rich(sub.comment)}</div></div>` : ''}
    <div class="h3">Before you start</div>${rules}
    <div class="row end" style="margin-top:16px"><button class="btn filled" data-act="startExam" data-id="${esc(a.id)}">${icon('play_arrow')} Start exam</button></div>`;
  return `<div class="col"><div class="card exam-gate">${body}</div>${subs.length ? mySubmissionsCard(subs) : ''}</div>`;
}

/* ---------- exam takeover ---------- */
function stopExam() {
  if (!S.exam) return;
  clearInterval(S.exam.timer);
  document.removeEventListener('fullscreenchange', S.exam.onFs);
  S.exam = null;
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignore */ }
}
async function startExam(id) {
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
  let fresh;
  try { fresh = await call('bootstrap'); } catch (e) { return toast(e.message, true); }
  S.data = fresh;
  const a = (S.data.assignments || []).find(x => x.id === id);
  if (!a || examPhase(a) !== 'open') { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignore */ } render(); return toast('This exam is not open right now.', true); }
  const skew = istMs(S.data.serverNow) - Date.now();
  const key = labKey('x', a.id);
  const ex = S.exam = { id: a.id, key, end: istMs(a.examEnd), skew, submitting: false, overlay: null };
  const lab = getLab(key, {
    exam: true, title: 'exam.py', tests: a.tests || [], submitLabel: 'Submit exam',
    starter: '# ' + a.title + '\n# Type your answer below.\n\n',
    onSubmit: p => submitExam(p),
    onAway: n => {
      if (!S.exam) return;
      const max = +a.maxSwitches || 0;
      if (max > 0 && n > max) { submitExam(null, 'left the exam window ' + n + ' times'); return; }
      showExamOverlay('away', n, max);
    }
  });
  ex.onFs = () => {
    if (!S.exam || S.exam.submitting) return;
    if (!document.fullscreenElement) { lab.noteFullscreenExit(); showExamOverlay('fs'); }
  };
  document.addEventListener('fullscreenchange', ex.onFs);
  ex.timer = setInterval(examTick, 1000);
  render();
  examTick();
  setTimeout(() => lab.focus(), 100);
}
function examLeft() { return S.exam ? S.exam.end - (Date.now() + S.exam.skew) : 0; }
function fmtLeft(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(sec).padStart(2, '0');
}
function examTick() {
  if (!S.exam) return;
  const left = examLeft(), el = $('#exam-timer');
  if (el) {
    el.querySelector('span:last-child').textContent = fmtLeft(left);
    el.className = 'exam-timer' + (left < 60000 ? ' danger' : left < 300000 ? ' warn' : '');
  }
  const sw = $('#exam-switches'), lab = S.labs[S.exam.key];
  if (sw && lab) sw.textContent = lab.integ.tabSwitches;
  if (left <= 0 && !S.exam.submitting) submitExam(null, 'time up');
}
function renderExam() {
  const ex = S.exam, a = (S.data.assignments || []).find(x => x.id === ex.id);
  S.mounted = null;
  if (!a) { stopExam(); return render(); }
  const max = +a.maxSwitches || 0;
  $('#app').innerHTML = `<div class="exam-wrap">
    <div class="exam-top">${logo()}<div class="grow"><div class="exam-title">${esc(a.title)}</div><div class="small muted">${esc(S.data.user.name)} · ends ${fmtTime(a.examEnd.slice(11, 16))}</div></div>
      <span class="pill ${max ? 'amber' : ''}" title="Times you left the exam window">${icon('tab_unselected')} Left window: <b id="exam-switches" style="margin-left:4px">0</b>${max ? ' / ' + max : ''}</span>
      <span class="exam-timer" id="exam-timer">${icon('timer')}<span>${fmtLeft(examLeft())}</span></span>
    </div>
    <div class="exam-main">
      <div class="exam-q"><div class="h3" style="margin-bottom:8px">${icon('quiz')} Question</div><div>${rich(a.description) || '<span class="muted">Write the program described by your instructor.</span>'}</div>
        ${a.tests && a.tests.length ? `<div class="outcomes" style="margin-top:14px">${icon('fact_check')}<div>Your program is checked against <b>${plural(a.tests.length, 'test')}</b> when you submit. Use <b>Check</b> to run them (results are hidden).</div></div>` : ''}
      </div>
      ${labMount(ex.key)}
    </div></div>`;
  afterRender($('#app'));
  if (ex.overlay) showExamOverlay(ex.overlay.kind, ex.overlay.n, ex.overlay.max);
}
function showExamOverlay(kind, n, max) {
  if (!S.exam) return;
  S.exam.overlay = { kind, n, max };
  let o = $('#exam-overlay');
  if (!o) { o = document.createElement('div'); o.id = 'exam-overlay'; o.className = 'exam-overlay'; document.body.appendChild(o); }
  o.innerHTML = `<div class="box">${icon(kind === 'fs' ? 'fullscreen_exit' : 'warning')}
    <h2>${kind === 'fs' ? 'You left full screen' : 'You left the exam window'}</h2>
    <p class="muted">${kind === 'fs' ? 'This has been recorded. Go back to full screen to continue.' : 'This has been recorded (' + n + (max ? ' of ' + max + ' allowed' : '') + ').' + (max && n >= max ? ' <b>One more time and your exam is submitted automatically.</b>' : '')}</p>
    <button class="btn filled" data-act="examResume">${icon('fullscreen')} Return to the exam</button></div>`;
}
function hideExamOverlay() { const o = $('#exam-overlay'); if (o) o.remove(); if (S.exam) S.exam.overlay = null; }
async function submitExam(p, auto) {
  const ex = S.exam;
  if (!ex || ex.submitting) return;
  const lab = S.labs[ex.key];
  if (!p) {
    if (ex.autoPending) return;
    ex.autoPending = true;
    hideExamOverlay();
    toast(auto === 'time up' ? "Time's up — submitting your exam…" : 'You left the exam window too many times — submitting…', auto !== 'time up');
    return lab.submit(auto);
  }
  if (!p.auto && !(await confirmDialog('Submit your exam?', 'You cannot change your answer after submitting.', 'Submit exam'))) return;
  ex.submitting = true;
  const r = await act('submitAssignment', { assignmentId: ex.id, type: 'lab', code: p.code, testOutputs: p.testOutputs, integrity: p.integrity }, { noRender: true });
  if (!r) {
    ex.submitting = false;
    if (p.auto) toast('Could not submit — check your connection. Your code is saved; press Submit exam to try again.', true);
    return;
  }
  lab.clearSaved();
  const key = ex.key;
  hideExamOverlay();
  stopExam();
  destroyLab(key);
  S.view = 'assignments'; S.sub.assignment = ex.id;
  render();
}

/* ---------- Student: Python Lab playground ---------- */
V.lab = () => {
  getLab(labKey('play', 'main'), { title: 'playground.py', preload: true,
    starter: '# Python Lab — try anything here. Nothing is submitted.\nname = input("Your name: ")\nprint(f"Hello, {name}!")\n' });
  return `<div class="page-head"><div><h1 class="h1">Python Lab</h1><p class="muted">Write and run Python right in your browser. Practice here — nothing is submitted or graded.</p></div></div>
    ${labMount(labKey('play', 'main'))}`;
};

/* ---------- Instructor: Lab results in a submission ---------- */
function integrityPanel(x) {
  if (!x) return '';
  const mins = s => s >= 60 ? Math.round(s / 60) + ' min' : s + ' s';
  const stat = (v, l, bad) => `<div class="integ-stat ${bad ? 'bad' : ''}"><b>${v}</b><span>${l}</span></div>`;
  const tl = x.timeline || [];
  const peak = Math.max(1, ...tl);
  return `<div class="card" style="margin-top:14px;padding:14px 16px"><div class="h3">${icon('shield')} Integrity</div>
    ${x.flags && x.flags.length ? `<div class="flag-list">${x.flags.map(f => `<div class="flag-item">${icon('flag')} ${esc(f)}</div>`).join('')}</div>` : `<div class="banner ok" style="margin:8px 0">${icon('verified_user')}<div class="grow">No integrity flags. Typed normally.</div></div>`}
    <div class="integ-grid">
      ${stat(x.typed, 'characters typed')}${stat(x.deleted, 'characters deleted')}
      ${stat(x.maxBurst, 'largest single insert', x.maxBurst >= 40)}${stat(x.pasteBlocked, 'paste attempts', x.pasteBlocked > 0)}
      ${stat(x.tabSwitches, 'left the window', x.tabSwitches > 3)}${stat(x.fsExits || 0, 'full-screen exits', x.fsExits > 0)}
      ${stat(x.runs, 'runs')}${stat(x.errors, 'runs with errors')}
      ${stat(mins(x.activeSec), 'active typing time')}${stat(mins(x.totalSec), 'time in the Lab')}
    </div>
    ${tl.length > 1 ? `<div class="small muted" style="margin-top:8px">Typing activity (characters per 30 s)</div><div class="spark">${tl.map(v => `<i class="${v >= 200 ? 'hi' : ''}" style="height:${Math.max(2, Math.round(v / peak * 100))}%" title="${v}"></i>`).join('')}</div>` : ''}
  </div>`;
}
function testsTable(tests, results) {
  if (!tests || !tests.length) return '';
  return `<div class="table-wrap" style="margin-top:14px"><table class="table tests-table"><thead><tr><th style="width:40px"></th><th>Input</th><th>Expected (contains)</th><th>Student output</th></tr></thead><tbody>
    ${tests.map((t, i) => { const r = (results || [])[i] || {}; return `<tr><td>${icon(r.ok ? 'check_circle' : 'cancel', r.ok ? 'fill' : '')}</td>
      <td><pre>${esc(t.input || '—')}</pre>${t.hidden ? pill('hidden') : ''}</td><td><pre>${esc(t.expect)}</pre></td><td><pre>${esc(r.output || '(nothing)')}</pre></td></tr>`; }).join('')}
  </tbody></table></div>`;
}

/* ---------- Materials (student + admin) ---------- */
const FILE_TYPES = [
  [/pdf/, 'picture_as_pdf', 'red'], [/document|msword|wordprocessing/, 'description', 'blue'],
  [/spreadsheet|excel|csv/, 'table_chart', 'green'], [/presentation|powerpoint/, 'slideshow', 'amber'],
  [/image/, 'image', 'violet'], [/video/, 'movie', 'red'], [/python|x-script|ipynb|text\/x/, 'code', 'teal'],
  [/text/, 'article', ''], [/zip|compressed/, 'folder_zip', '']
];
function fileIcon(f) {
  if (/\.(py|ipynb)$/i.test(f.name)) return ['code', 'teal'];
  for (const t of FILE_TYPES) if (t[0].test(f.mime || '')) return [t[1], t[2]];
  return ['draft', ''];
}
V.materials = () => {
  const admin = S.data.role === 'admin', m = S.materials;
  const head = `<div class="page-head"><div><h1 class="h1">Study materials</h1><p class="muted">${admin
    ? 'Files from your Drive. Put files in "Week N" folders (visible once that week is published), "Track - Name" folders (visible to that track) or any other folder (visible to everyone).'
    : 'Notes, slides and datasets shared by your instructor.'}</p></div>
    <div class="row">${admin ? `<a class="btn outlined" href="${esc(S.data.links.materials)}" target="_blank" rel="noopener">${icon('add_to_drive')} Open Drive folder</a><button class="btn tonal" data-act="materialsRefresh">${icon('sync')} Refresh</button>` : ''}</div></div>`;
  if (!m || m === 'loading') return head + `<div class="card">${emptyState('hourglass_top', 'Loading files from Drive…')}</div>`;
  if (m.error) return head + `<div class="banner warn">${icon('error')}<div class="grow">${esc(m.error)}</div><button class="btn tonal" data-act="materialsRefresh">Try again</button></div>`;
  const folders = (m.folders || []).filter(f => admin || f.files.length);
  if (!folders.length) return head + emptyState('folder_off', admin ? 'No folders yet. Run setup() or add folders in Drive.' : 'No study materials have been shared yet.');
  return head + `<div class="search" style="margin-bottom:18px">${icon('search')}<input placeholder="Search files" data-input="mq" aria-label="Search files"></div>` +
    folders.map(f => `<div class="card" style="margin-bottom:12px" data-folder>
      <div class="card-head"><div class="h3">${icon('folder', 'fill')} ${esc(f.name)}</div><span class="muted small">${plural(f.files.length, 'file')}</span></div>
      ${f.files.length ? `<div class="list">${f.files.map(x => { const fi = fileIcon(x); return `<div class="list-item" data-fname="${esc(x.name.toLowerCase())}">
        <span class="lead-icon ${fi[1]}">${icon(fi[0])}</span>
        <div class="grow"><div class="title">${esc(x.name)}</div><div class="meta">Updated ${fmtDate(x.updated, true)}${x.size ? ' · ' + (x.size > 1048576 ? (x.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(x.size / 1024)) + ' KB') : ''}</div></div>
        <button class="btn text sm" data-act="previewFile" data-id="${esc(x.id)}" data-name="${esc(x.name)}">${icon('visibility')}<span class="hide-sm">Preview</span></button>
        <a class="icon-btn sm" href="${esc(x.url)}" target="_blank" rel="noopener" title="Open in Drive">${icon('open_in_new')}</a>
      </div>`; }).join('')}</div>` : `<div class="muted small">Empty folder.</div>`}
    </div>`).join('');
};

/* ---------- Student: doubts ---------- */
V.doubts = () => {
  const d = S.data;
  const mine = d.doubts.filter(x => x.mine), shared = d.doubts.filter(x => !x.mine);
  const sel = S.sub.doubtDay || '';
  const dayOpts = [{ value: '', label: 'General question' }].concat(d.days.slice().reverse().map(x => ({ value: x.id, label: dayLabel(x) })));
  return `<div class="page-head"><div><h1 class="h1">Doubts & Q&A</h1><p class="muted">Stuck? Ask here — your instructor will reply. Useful answers get shared with the class.</p></div></div>
  <div class="grid-2"><div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('help')} Ask a doubt</div></div>
      <form data-form="askDoubt">
        ${selectField('dayId', 'About', dayOpts, sel)}
        ${field('question', 'Your question', '', { textarea: true, rows: 5, required: true, hint: 'Paste the error message or code if you have one.' })}
        <div class="row end"><button class="btn filled">${icon('send')} Send</button></div>
      </form></div>
    <div class="section-title"><div class="h3">My questions</div></div>
    ${mine.length ? mine.map(qaCard).join('') : `<div class="muted small">You haven't asked anything yet.</div>`}
  </div><div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('school')} Class Q&A</div></div>
      ${shared.length ? shared.map(qaCard).join('') : `<div class="muted small">Answers your instructor shares with everyone appear here.</div>`}</div>
  </div></div>`;
};
function qaCard(q) {
  const d = dayById(q.dayId);
  return `<div class="qa"><div class="small muted" style="margin-bottom:4px">${esc(q.askedBy || q.studentName || '')} · ${esc(d ? 'Day ' + d.day : 'General')} · ${fmtDT(q.askedAt)}</div>
    <div class="q">${rich(q.question)}</div>
    ${q.answer ? `<div class="a"><b>Answer:</b> ${rich(q.answer)}</div>` : `<div class="a waiting">${icon('hourglass_top', 'sm')} Waiting for an answer</div>`}</div>`;
}

/* ---------- Student: reflection ---------- */
V.reflection = () => {
  const d = S.data;
  const todayR = d.reflections.find(r => r.date === d.today);
  const f = focusDays();
  const sel = S.sub.reflectDay || (todayR && todayR.dayId) || (f.list[0] ? f.list[0].id : '');
  const dayOpts = [{ value: '', label: 'General' }].concat(d.days.slice().reverse().map(x => ({ value: x.id, label: dayLabel(x) })));
  const conf = todayR ? +todayR.confidence : 3;
  const labels = ['', 'Lost', 'Shaky', 'Okay', 'Good', 'Confident'];
  return `<div class="page-head"><div><h1 class="h1">Daily reflection</h1><p class="muted">Two minutes at the end of each day. It helps you remember — and helps your instructor help you.</p></div></div>
  <div class="grid-2"><div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('edit_note')} ${todayR ? "Today's reflection (saved)" : "Today's reflection"}</div><span class="muted small">${fmtDate(d.today)}</span></div>
      <form data-form="reflect">
        ${selectField('dayId', 'Lesson', dayOpts, sel)}
        ${field('learned', 'What did I learn today?', todayR ? todayR.learned : '', { textarea: true, rows: 4, required: true })}
        ${field('stuck', 'Where am I stuck? (optional)', todayR ? todayR.stuck : '', { textarea: true, rows: 3 })}
        <div class="small muted" style="margin:-4px 0 8px">How confident do you feel?</div>
        <div class="radio-chips" style="margin-bottom:18px">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="confidence" value="${n}" ${n === conf ? 'checked' : ''}><span>${n} · ${labels[n]}</span></label>`).join('')}</div>
        <div class="row end"><button class="btn filled">${icon('save')} ${todayR ? 'Update' : 'Save'}</button></div>
      </form></div>
  </div><div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('history')} Past reflections</div></div>
      ${d.reflections.length ? d.reflections.map(r => reflectionItem(r)).join('') : `<div class="muted small">Your reflections will appear here.</div>`}</div>
  </div></div>`;
};
function reflectionItem(r, who) {
  const d = (S.data.days || []).find(x => x.id === r.dayId);
  return `<div class="ann"><div class="row between"><div class="t">${who ? esc(who) + ' · ' : ''}${fmtDate(r.date)}${d ? ' · Day ' + d.day : ''}</div>${pill('Confidence ' + r.confidence + '/5', +r.confidence <= 2 ? 'red' : +r.confidence >= 4 ? 'green' : '')}</div>
    <div class="b"><b>Learned:</b> ${rich(r.learned)}</div>${r.stuck ? `<div class="b" style="margin-top:4px"><b>Stuck on:</b> ${rich(r.stuck)}</div>` : ''}</div>`;
}

/* ---------- Student: track ---------- */
V.track = () => {
  const d = S.data, u = d.user, open = d.settings.trackSelectionOpen;
  let top = '';
  if (u.trackStatus === 'approved') top = `<div class="banner ok">${icon('verified')}<div class="grow">Your track is <b>${esc(trackName(u.track))}</b>. Its lessons appear in your study plan.</div></div>`;
  else if (u.trackStatus === 'requested') top = `<div class="banner">${icon('hourglass_top')}<div class="grow">You requested <b>${esc(trackName(u.requestedTrack))}</b>. Waiting for your instructor to confirm. You can still change your request.</div></div>`;
  else if (u.trackStatus === 'rejected') top = `<div class="banner warn">${icon('info')}<div class="grow">Your instructor asked you to choose a different track.</div></div>`;
  else if (!open) top = `<div class="banner">${icon('schedule')}<div class="grow">Track selection opens after the common basics (around Day 10–12). Have a look at the options in the meantime.</div></div>`;
  return `<div class="page-head"><div><h1 class="h1">My track</h1><p class="muted">After the common basics, everyone specializes. Pick the path that excites you most.</p></div></div>
  ${top}
  <div class="grid-cards" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
    ${d.tracks.map(t => {
      const mine = u.trackStatus === 'approved' && u.track === t.id;
      const req = u.trackStatus === 'requested' && u.requestedTrack === t.id;
      const c = trackColor(t.id);
      let action = '';
      if (mine) action = pill('Your track', 'green', 'check_circle');
      else if (req) action = pill('Requested', 'blue', 'hourglass_top');
      else if (open && u.trackStatus !== 'approved') action = `<button class="btn tonal" data-act="requestTrack" data-id="${esc(t.id)}">Choose this track</button>`;
      return `<div class="track-card ${mine || req ? 'selected' : ''}">
        <div class="ti lead-icon ${c}">${icon(t.icon || 'school')}</div>
        <div class="h3" style="font-size:18px">${esc(t.name)}</div><p>${esc(t.description)}</p><div>${action}</div></div>`;
    }).join('')}
  </div>`;
};

/* ---------- Student: profile ---------- */
V.profile = () => {
  const d = S.data, u = d.user, st = d.stats;
  return `<div class="page-head"><div class="row" style="gap:16px">${avatar(u.name, true)}<div><h1 class="h1">${esc(u.name)}</h1><p class="muted">@${esc(u.username)}${u.trackStatus === 'approved' ? ' · ' + esc(trackName(u.track)) : ''}</p></div></div>
    <button class="btn outlined" data-act="pwDialog">${icon('key')} Change password</button></div>
  <div class="stats">
    ${statCard('stars', 'Points', st.points, d.leaderboard.myRank ? 'Rank #' + d.leaderboard.myRank : '')}
    ${statCard('trending_up', 'Progress', st.progressPct + '%', '', bar(st.progressPct))}
    ${statCard('assignment_turned_in', 'Assignments', st.approved + '/' + st.assigned, `${st.submitted} submitted · ${st.approved} approved`)}
    ${statCard('event_available', 'Attendance', st.attendancePct === null ? '—' : st.attendancePct + '%', `${st.attended} of ${plural(st.classDays, 'class')}`)}
  </div>
  <div class="grid-2"><div class="col">
    <div class="card"><div class="card-head"><div class="h3">${icon('event_available')} Attendance</div></div>
      ${d.attendance.length ? `<div class="list">${d.attendance.map(a => `<div class="list-item"><div class="grow"><div class="title">${fmtDate(a.date)}</div>${a.checkInAt ? `<div class="meta">Checked in at ${fmtTime(a.checkInAt)}</div>` : ''}</div>${attPill(a.status)}</div>`).join('')}</div>` : `<div class="muted small">No attendance yet.</div>`}
    </div></div>
    <div class="col"><div class="card"><div class="card-head"><div class="h3">${icon('stars')} Points history</div><span class="muted small">How points work: day complete +5 · on-time submission +10 · approved +10 · present +5 · reflection +2</span></div>
      ${d.pointsLog.length ? `<div class="list">${d.pointsLog.map(p => `<div class="list-item"><div class="grow"><div class="title" style="font-weight:400">${esc(p.reason)}</div><div class="meta">${fmtDT(p.createdAt)}</div></div><b style="color:${+p.points >= 0 ? 'var(--green)' : 'var(--red)'}">${+p.points > 0 ? '+' : ''}${esc(p.points)}</b></div>`).join('')}</div>` : `<div class="muted small">Complete a day's checklist to earn your first points.</div>`}
    </div></div>
  </div>`;
};

/* ================================================================
 * Admin views
 * ================================================================ */
function studentById(id) { return (S.data.students || []).find(s => s.id === id); }
function adminDay(id) { return (S.data.days || []).find(d => d.id === id); }
function adminDayLabel(d) { return d ? `Day ${d.day} · ${d.track === 'common' ? '' : trackName(d.track) + ' · '}${d.title}` : 'General'; }
function weekOfDate(date) { const d = (S.data.days || []).find(x => x.date === date); return d ? String(d.week) : null; }

V.overview = () => {
  const d = S.data, c = d.counts;
  const active = d.students.filter(s => s.active);
  const today = d.days.filter(x => x.date === d.today);
  const nextDate = (d.classDates || []).find(x => x >= d.today);
  const wk = nextDate ? weekOfDate(nextDate) : null;
  const wkRow = wk ? d.weeks.find(w => String(w.week) === wk) : null;
  const avg = k => active.length ? Math.round(active.reduce((s, x) => s + (x.stats[k] || 0), 0) / active.length) : 0;
  return `<div class="page-head"><div><h1 class="h1">Overview</h1><p class="muted">${fmtDate(d.today)} · ${esc(d.settings.courseTitle)}</p></div>
    <div class="row"><button class="btn tonal" data-act="go" data-view="students">${icon('person_add')} Students</button></div></div>
  ${d.usingDefaultPassword ? `<div class="banner warn">${icon('warning')}<div class="grow">You're still using the default admin password. Change it before sharing the app.</div><button class="btn tonal" data-act="pwDialog">Change password</button></div>` : ''}
  ${wkRow && wkRow.published !== 'TRUE' ? `<div class="banner">${icon('visibility_off')}<div class="grow"><b>Week ${esc(wkRow.week)} · ${esc(wkRow.title)}</b> is not published. Students can't see the ${nextDate === d.today ? "today's" : 'next'} lessons yet.</div><button class="btn filled" data-act="publishWeek" data-week="${esc(wkRow.week)}" data-on="1">Publish week ${esc(wkRow.week)}</button></div>` : ''}
  <div class="stats">
    ${statCard('group', 'Active students', active.length, `Avg progress ${avg('progressPct')}% · avg ${avg('points')} pts`)}
    ${statCard('how_to_reg', 'Check-ins to verify', c.pendingCheckins, `<a href="#" data-act="go" data-view="attendance">Open attendance</a>`)}
    ${statCard('rate_review', 'Submissions to review', c.toReview, `<a href="#" data-act="go" data-view="review">Review now</a>`)}
    ${statCard('forum', 'Open doubts', c.openDoubts, c.trackRequests ? `${plural(c.trackRequests, 'track request')} waiting` : 'No track requests')}
  </div>
  ${today.length ? `<div class="card" style="margin-bottom:16px"><div class="card-head"><div class="h3">${icon('today')} Today's lessons</div></div>
    <div class="list">${today.map(x => `<div class="list-item"><span class="lead-icon blue">${icon('menu_book')}</span><div class="grow"><div class="title">${esc(adminDayLabel(x))}</div><div class="meta">Week ${esc(x.week)}</div></div>${trackPill(x.track)}</div>`).join('')}</div></div>` : ''}
  <div class="section-title"><div class="h3">Students</div><span class="muted small">Click a student for details</span></div>
  ${d.students.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Track</th><th>Progress</th><th class="hide-sm">Attendance</th><th class="hide-sm">Assignments</th><th>Points</th><th class="hide-sm">Last seen</th></tr></thead><tbody>
    ${d.students.map(s => `<tr class="click" data-act="studentDetail" data-id="${esc(s.id)}" style="${s.active ? '' : 'opacity:.5'}">
      <td><div class="row" style="flex-wrap:nowrap">${avatar(s.name)}<div><div style="font-weight:500">${esc(s.name)}</div><div class="small muted">@${esc(s.username)}</div></div></div></td>
      <td>${s.trackStatus === 'approved' ? trackPill(s.track) : s.trackStatus === 'requested' ? pill('Requested', 'blue', 'hourglass_top') : '<span class="muted small">—</span>'}</td>
      <td><div class="mini-bar">${bar(s.stats.progressPct)}<span class="small">${s.stats.progressPct}%</span></div></td>
      <td class="hide-sm">${s.stats.attendancePct === null ? '—' : s.stats.attendancePct + '%'}</td>
      <td class="hide-sm">${s.stats.approved}/${s.stats.assigned}</td>
      <td><b>${s.stats.points}</b>${s.rank ? ` <span class="muted small">#${s.rank}</span>` : ''}</td>
      <td class="hide-sm small muted">${s.lastLogin ? fmtDT(s.lastLogin) : 'Never'}</td></tr>`).join('')}
  </tbody></table></div>` : emptyState('group_add', 'No students yet.', `<button class="btn filled" style="margin-top:12px" data-act="addStudent">${icon('person_add')} Add students</button>`)}`;
};

function studentDetailDialog(id) {
  const s = studentById(id); if (!s) return;
  const d = S.data, st = s.stats;
  const subs = d.submissions.filter(x => x.userId === id).slice(0, 8);
  const att = d.attendance.filter(x => x.userId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const refl = d.reflections.filter(x => x.userId === id).slice(0, 3);
  openDialog(s.name, `<div class="dialog-body">
    <div class="row" style="margin-bottom:14px">${avatar(s.name, true)}<div><div class="h3">${esc(s.name)}</div><div class="muted small">@${esc(s.username)} · ${s.active ? 'Active' : 'Inactive'} · joined ${fmtDate((s.createdAt || '').slice(0, 10))}</div></div></div>
    <div class="stats" style="grid-template-columns:repeat(4,1fr)">
      ${statCard('trending_up', 'Progress', st.progressPct + '%')}${statCard('stars', 'Points', st.points)}
      ${statCard('event_available', 'Attendance', st.attendancePct === null ? '—' : st.attendancePct + '%')}${statCard('assignment_turned_in', 'Approved', st.approved + '/' + st.assigned)}
    </div>
    <div class="h3" style="margin:8px 0">Recent submissions</div>
    ${subs.length ? `<div class="list">${subs.map(x => `<div class="list-item click" data-act="reviewSub" data-id="${esc(x.id)}"><div class="grow"><div class="title">${esc(x.assignmentTitle)}</div><div class="meta">${fmtDT(x.submittedAt)}</div></div>${x.late === 'TRUE' ? pill('Late', 'red') : ''}${statusPill(x.status)}</div>`).join('')}</div>` : `<div class="muted small">None yet.</div>`}
    <div class="h3" style="margin:16px 0 8px">Recent attendance</div>
    ${att.length ? `<div class="row">${att.map(a => `<span title="${fmtDate(a.date)}">${attPill(a.status)}</span>`).join('')}</div>` : `<div class="muted small">None yet.</div>`}
    ${refl.length ? `<div class="h3" style="margin:16px 0 8px">Latest reflections</div>${refl.map(r => reflectionItem(r)).join('')}` : ''}
  </div>
  <div class="dialog-actions"><button class="btn text" data-act="bonusDialog" data-id="${esc(id)}">${icon('stars')} Award points</button><button class="btn text" data-act="editStudent" data-id="${esc(id)}">${icon('edit')} Edit / reset password</button><button class="btn filled" data-act="closeDialog">Close</button></div>`, true);
}

/* ---------- Admin: attendance ---------- */
V.attendance = () => {
  const d = S.data;
  const date = S.sub.attDate || d.today;
  const isClass = (d.classDates || []).indexOf(date) >= 0;
  const rows = d.students.filter(s => s.active);
  const byUser = {};
  d.attendance.filter(a => a.date === date).forEach(a => { byUser[a.userId] = a; });
  const counts = { present: 0, late: 0, absent: 0, pending: 0, none: 0 };
  rows.forEach(s => { const a = byUser[s.id]; counts[a ? a.status : 'none']++; });
  const seg = (s, st, label, ic) => {
    const cur = byUser[s.id] ? byUser[s.id].status : '';
    return `<button class="btn sm ${cur === st ? 'tonal' : 'text'}" data-act="att" data-user="${esc(s.id)}" data-status="${st}" title="${label}">${icon(ic)}<span class="hide-sm">${label}</span></button>`;
  };
  return `<div class="page-head"><div><h1 class="h1">Attendance</h1><p class="muted">Students tap "I'm here" between ${fmtTime(d.settings.checkinStart)} and ${fmtTime(d.settings.checkinEnd)}. Verify check-ins or mark attendance yourself.</p></div></div>
  <div class="row" style="margin-bottom:16px">
    <input type="date" class="input-inline" value="${esc(date)}" data-change="attDate" aria-label="Date">
    ${date !== d.today ? `<button class="btn text" data-act="attToday">Today</button>` : ''}
    <div class="spacer" style="flex:1"></div>
    <button class="btn tonal" data-act="bulkAtt" data-mode="verify" ${counts.pending ? '' : 'disabled'}>${icon('done_all')} Verify ${counts.pending || ''} check-ins</button>
    <button class="btn outlined" data-act="bulkAtt" data-mode="absentRest" ${counts.none ? '' : 'disabled'}>Mark rest absent</button>
  </div>
  ${!isClass ? `<div class="banner warn">${icon('event_busy')}<div class="grow">${fmtDate(date)} is not a scheduled class day in the syllabus.</div></div>` : ''}
  <div class="chips">${pill(counts.present + ' present', 'green')} ${pill(counts.late + ' late', 'amber')} ${pill(counts.absent + ' absent', 'red')} ${pill(counts.pending + ' to verify', 'blue')} ${pill(counts.none + ' not marked')}</div>
  ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Check-in</th><th>Status</th><th style="text-align:right">Mark</th></tr></thead><tbody>
    ${rows.map(s => { const a = byUser[s.id]; return `<tr>
      <td><div class="row" style="flex-wrap:nowrap">${avatar(s.name)}<span style="font-weight:500">${esc(s.name)}</span></div></td>
      <td>${a && a.checkInAt ? fmtTime(a.checkInAt) + (a.checkInAt > d.settings.lateAfter ? ' ' + pill('after ' + fmtTime(d.settings.lateAfter), 'amber') : '') : '<span class="muted">—</span>'}</td>
      <td>${attPill(a ? a.status : '')}</td>
      <td style="text-align:right;white-space:nowrap">${seg(s, 'present', 'Present', 'check')}${seg(s, 'late', 'Late', 'more_time')}${seg(s, 'absent', 'Absent', 'close')}${a ? `<button class="icon-btn sm" data-act="att" data-user="${esc(s.id)}" data-status="" title="Clear">${icon('backspace')}</button>` : ''}</td>
    </tr>`; }).join('')}
  </tbody></table></div>` : emptyState('group', 'No active students.')}`;
};

/* ---------- Admin: submissions review ---------- */
V.review = () => {
  const d = S.data;
  const f = S.sub.rfilter || 'submitted';
  const byA = S.sub.rassign || '', byS = S.sub.rstudent || '';
  let list = d.submissions.filter(s => f === 'all' || s.status === f);
  if (byA) list = list.filter(s => s.assignmentId === byA);
  if (byS) list = list.filter(s => s.userId === byS);
  const n = st => d.submissions.filter(s => st === 'all' || s.status === st).length;
  const chip = (k, label) => `<button class="chip ${f === k ? 'on' : ''}" data-act="rfilter" data-f="${k}">${label} <span class="count">${n(k)}</span></button>`;
  return `<div class="page-head"><div><h1 class="h1">Submissions</h1><p class="muted">Open a submission to read the code, then approve it or send it back with a comment.</p></div></div>
  <div class="chips">${chip('submitted', 'To review')}${chip('rework', 'Needs rework')}${chip('approved', 'Approved')}${chip('all', 'All')}</div>
  <div class="row" style="margin-bottom:14px">
    <select class="input-inline" data-change="rassign" aria-label="Assignment"><option value="">All assignments</option>${d.assignments.map(a => `<option value="${esc(a.id)}" ${a.id === byA ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}</select>
    <select class="input-inline" data-change="rstudent" aria-label="Student"><option value="">All students</option>${d.students.map(s => `<option value="${esc(s.id)}" ${s.id === byS ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
  </div>
  ${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Assignment</th><th class="hide-sm">Submitted</th><th>Status</th></tr></thead><tbody>
    ${list.map(s => `<tr class="click" data-act="reviewSub" data-id="${esc(s.id)}">
      <td><div class="row" style="flex-wrap:nowrap">${avatar(s.studentName)}<span style="font-weight:500">${esc(s.studentName)}</span></div></td>
      <td><div>${esc(s.assignmentTitle)}</div><div class="small muted mono" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((s.preview || '').split('\n')[0])}</div></td>
      <td class="hide-sm small">${fmtDT(s.submittedAt)} ${s.late === 'TRUE' ? pill('Late', 'red') : ''}</td>
      <td><div class="row" style="gap:4px">${statusPill(s.status)}${s.testScore ? scorePill(s.testScore) : ''}${s.flags && s.flags.length ? `<span title="${esc(s.flags.join('\n'))}">${pill('Flagged', 'red', 'flag')}</span>` : ''}</div></td></tr>`).join('')}
  </tbody></table></div>` : emptyState('inbox', f === 'submitted' ? 'Nothing waiting for review.' : 'No submissions match.')}`;
};
async function reviewDialog(id) {
  let s;
  try { s = await call('getSubmission', { id }); } catch (e) { return toast(e.message, true); }
  const meta = S.data.submissions.find(x => x.id === id) || {};
  const a = S.data.assignments.find(x => x.id === s.assignmentId);
  openDialog(meta.studentName + ' · ' + (meta.assignmentTitle || 'Submission'), `<form data-form="review" data-id="${esc(id)}"><div class="dialog-body">
    <div class="row" style="margin-bottom:10px">${statusPill(s.status)}${s.late === 'TRUE' ? pill('Late', 'red') : ''}<span class="muted small">${fmtDT(s.submittedAt)} · ${esc(s.fileName)} · ${s.type === 'file' ? 'uploaded file' : s.type === 'lab' ? 'typed in CodeTrack Lab' : 'pasted code'}</span>${s.testScore ? scorePill(s.testScore) : ''}
      ${s.fileUrl ? `<a class="btn text sm" href="${esc(s.fileUrl)}" target="_blank" rel="noopener">${icon('open_in_new')} Open in Drive</a>` : ''}</div>
    ${a && a.description ? `<details style="margin-bottom:10px"><summary class="small muted" style="cursor:pointer">Assignment instructions</summary><div class="small" style="padding:8px 0">${rich(a.description)}</div></details>` : ''}
    <pre class="code"><code class="language-python">${esc(s.code)}</code></pre>
    ${s.type === 'lab' ? testsTable(s.tests, s.testResults) + integrityPanel(s.integrity) : ''}
    <div style="margin-top:16px">${field('comment', 'Comment for the student', s.comment, { textarea: true, rows: 3, hint: 'Required when sending back for rework.' })}</div>
  </div><div class="dialog-actions">
    <button type="button" class="btn text" data-act="closeDialog">Close</button>
    <button class="btn outlined" name="status" value="rework">${icon('replay')} Needs rework</button>
    <button class="btn filled" name="status" value="approved">${icon('check')} Approve</button>
  </div></form>`, true);
}

/* ---------- Admin: syllabus ---------- */
V.syllabus = () => {
  const tab = S.sub.syl || 'weeks';
  const t = (k, ic, label) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="sylTab" data-tab="${k}">${icon(ic)} ${label}</button>`;
  return `<div class="page-head"><div><h1 class="h1">Syllabus & plans</h1><p class="muted">Publish each week when it starts — students only see published weeks.</p></div></div>
  <div class="tabs">${t('weeks', 'calendar_view_week', 'Weeks & days')}${t('assign', 'assignment', 'Assignments')}${t('json', 'data_object', 'Import / export JSON')}</div>
  ${tab === 'weeks' ? sylWeeks() : tab === 'assign' ? sylAssignments() : sylJson()}`;
};
function sylWeeks() {
  const d = S.data;
  const wf = S.sub.sylWeek || 'all', tf = S.sub.sylTrack || 'all';
  const days = d.days.filter(x => (wf === 'all' || String(x.week) === wf) && (tf === 'all' || x.track === tf));
  return `<div class="grid-cards" style="margin-bottom:22px">
    ${d.weeks.map(w => { const n = d.days.filter(x => String(x.week) === String(w.week)); const dates = n.map(x => x.date).filter(Boolean).sort();
      return `<div class="card" style="display:flex;flex-direction:column;gap:6px">
        <div class="row between"><span class="pill ${w.published === 'TRUE' ? 'green' : ''}">${icon(w.published === 'TRUE' ? 'visibility' : 'visibility_off')} ${w.published === 'TRUE' ? 'Published' : 'Hidden'}</span>
          <button class="icon-btn sm" data-act="editWeek" data-week="${esc(w.week)}" title="Rename">${icon('edit')}</button></div>
        <div class="h3">Week ${esc(w.week)} · ${esc(w.title)}</div>
        <div class="muted small">${plural(n.length, 'lesson')}${dates.length ? ' · ' + fmtDate(dates[0], true) + ' – ' + fmtDate(dates[dates.length - 1], true) : ''}</div>
        <label class="switch" style="margin-top:6px"><input type="checkbox" data-change="publishWeek" data-week="${esc(w.week)}" ${w.published === 'TRUE' ? 'checked' : ''}><span class="track"></span><span>Visible to students</span></label>
      </div>`; }).join('')}
  </div>
  <div class="row between" style="margin-bottom:12px">
    <div class="row">
      <select class="input-inline" data-change="sylWeek" aria-label="Week"><option value="all">All weeks</option>${d.weeks.map(w => `<option value="${esc(w.week)}" ${String(w.week) === wf ? 'selected' : ''}>Week ${esc(w.week)}</option>`).join('')}</select>
      <select class="input-inline" data-change="sylTrack" aria-label="Track"><option value="all">All tracks</option><option value="common" ${tf === 'common' ? 'selected' : ''}>Common</option>${d.tracks.map(x => `<option value="${esc(x.id)}" ${x.id === tf ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    </div>
    <button class="btn filled" data-act="editDay">${icon('add')} Add day</button>
  </div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Day</th><th class="hide-sm">Date</th><th>Track</th><th>Title</th><th></th></tr></thead><tbody>
    ${days.map(x => `<tr><td><b>${esc(x.day)}</b> <span class="muted small">W${esc(x.week)}</span></td><td class="hide-sm">${fmtDate(x.date)}</td><td>${trackPill(x.track)}</td><td>${esc(x.title)}</td>
      <td style="text-align:right;white-space:nowrap"><button class="icon-btn sm" data-act="editDay" data-id="${esc(x.id)}" title="Edit">${icon('edit')}</button><button class="icon-btn sm" data-act="deleteDay" data-id="${esc(x.id)}" title="Delete">${icon('delete')}</button></td></tr>`).join('')}
  </tbody></table></div>`;
}
function sylAssignments() {
  const d = S.data;
  const tf = S.sub.saTrack || 'all';
  const list = d.assignments.filter(a => tf === 'all' || a.track === tf);
  const cnt = id => d.submissions.filter(s => s.assignmentId === id).length;
  return `<div class="row between" style="margin-bottom:12px">
    <select class="input-inline" data-change="saTrack" aria-label="Track"><option value="all">All tracks</option><option value="common" ${tf === 'common' ? 'selected' : ''}>Common</option>${d.tracks.map(x => `<option value="${esc(x.id)}" ${x.id === tf ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    <button class="btn filled" data-act="editAssignment">${icon('add')} New assignment</button></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Assignment</th><th class="hide-sm">Lesson</th><th>Due</th><th class="hide-sm">Submissions</th><th></th></tr></thead><tbody>
    ${list.map(a => { const day = adminDay(a.dayId); return `<tr style="${a.active === 'TRUE' ? '' : 'opacity:.5'}"><td><div style="font-weight:500">${esc(a.title)}</div><div>${trackPill(a.track)}${a.mode === 'lab' ? ' ' + pill('Lab', 'teal', 'terminal') : a.mode === 'exam' ? ' ' + pill('Exam', 'violet', 'timer') : ''}${a.active === 'TRUE' ? '' : ' ' + pill('Inactive')}</div></td>
      <td class="hide-sm small">${day ? 'Day ' + day.day + ' · ' + esc(day.title) : '—'}</td><td class="small">${a.due ? fmtDT(a.due) : '—'}</td><td class="hide-sm">${cnt(a.id)}</td>
      <td style="text-align:right;white-space:nowrap"><button class="icon-btn sm" data-act="editAssignment" data-id="${esc(a.id)}" title="Edit">${icon('edit')}</button><button class="icon-btn sm" data-act="deleteAssignment" data-id="${esc(a.id)}" title="Delete">${icon('delete')}</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
}
function sylJson() {
  return `<div class="card flat" style="margin-bottom:14px"><div class="small" style="color:var(--text-2)">
    Paste a full <code>syllabus.json</code> and click <b>Import</b>. It replaces <b>tracks</b> (if included), <b>weeks</b> and <b>days</b>; assignments are added or updated by <code>id</code>.
    Student progress, submissions and attendance are kept. Keep day <code>id</code>s the same (e.g. <code>d05</code>, <code>d14-web</code>) so ticked sessions stay linked.</div></div>
  <textarea class="code-input" id="json-box" spellcheck="false" style="min-height:420px" placeholder='{ "tracks": [...], "weeks": [...], "days": [...], "assignments": [...] }'>${esc(S.sub.jsonText || '')}</textarea>
  <div class="row" style="margin-top:12px">
    <button class="btn outlined" data-act="jsonLoad">${icon('download')} Load current syllabus</button>
    <button class="btn text" data-act="jsonCopy">${icon('content_copy')} Copy</button>
    <button class="btn text" data-act="jsonDownload">${icon('file_download')} Download</button>
    <div style="flex:1"></div>
    <button class="btn filled" data-act="jsonImport">${icon('upload')} Import</button>
  </div>`;
}
function dayDialog(id) {
  const d = S.data, x = id ? adminDay(id) : null;
  const trackOpts = [{ value: 'common', label: 'Common (everyone)' }].concat(d.tracks.map(t => ({ value: t.id, label: t.name })));
  formDialog(x ? 'Edit Day ' + x.day : 'Add a day', 'saveDay', `<div class="form-grid">
    ${field('day', 'Day number', x ? x.day : '', { type: 'number', required: true, attrs: 'min="1"' })}
    ${field('week', 'Week', x ? x.week : (S.sub.sylWeek && S.sub.sylWeek !== 'all' ? S.sub.sylWeek : ''), { type: 'number', required: true, attrs: 'min="1"' })}
    ${field('date', 'Date', x ? x.date : '', { type: 'date' })}
    ${selectField('track', 'Track', trackOpts, x ? x.track : 'common', { attrs: x ? 'disabled' : '' })}
    ${field('title', 'Title', x ? x.title : '', { required: true, cls: 'full' })}
    ${field('scrum', 'Scrum / Refresh (9:00–9:30)', x ? x.scrum : '', { textarea: true, rows: 3, cls: 'full' })}
    ${field('paper', 'Pen & Paper (9:30–10:00)', x ? x.paper : '', { textarea: true, rows: 3, cls: 'full' })}
    ${field('code', 'Code Lab (10:00–11:00)', x ? x.code : '', { textarea: true, rows: 3, cls: 'full' })}
    ${field('outcomes', 'Outcomes', x ? x.outcomes : '', { textarea: true, rows: 2, cls: 'full', hint: 'Tip: wrap code in `backticks`.' })}
  </div>`, 'Save', `data-id="${x ? esc(x.id) : ''}" data-track="${x ? esc(x.track) : ''}"`, true);
}
function assignmentDialog(id) {
  const d = S.data, a = id ? d.assignments.find(x => x.id === id) : null;
  const dayOpts = [{ value: '', label: '— No specific day (always visible to its track) —' }].concat(d.days.map(x => ({ value: x.id, label: adminDayLabel(x) })));
  const trackOpts = [{ value: 'common', label: 'Common' }].concat(d.tracks.map(t => ({ value: t.id, label: t.name })));
  formDialog(a ? 'Edit assignment' : 'New assignment', 'saveAssignment', `
    ${selectField('dayId', 'Lesson', dayOpts, a ? a.dayId : '')}
    ${selectField('track', 'Track (used only when no lesson is picked)', trackOpts, a ? a.track : 'common')}
    ${field('title', 'Title', a ? a.title : '', { required: true })}
    ${field('description', 'Instructions', a ? a.description : '', { textarea: true, rows: 6 })}
    ${field('due', 'Due', a ? a.due : '', { type: 'datetime-local' })}
    ${labFieldsHtml(a)}
    ${switchField('active', 'Active (visible to students)', a ? a.active === 'TRUE' : true)}`,
    'Save', `data-id="${a ? esc(a.id) : ''}"`, true);
}

function labFieldsHtml(a) {
  const mode = (a && a.mode) || 'submit';
  let tests = [];
  try { tests = a && a.tests ? JSON.parse(a.tests) : []; } catch (e) { tests = []; }
  if (!tests.length) tests = [{ input: '', expect: '', hidden: false }];
  return `${selectField('mode', 'How students submit', [
      { value: 'submit', label: 'Paste code or upload a file' },
      { value: 'lab', label: 'CodeTrack Lab — type only, auto-checked tests' },
      { value: 'exam', label: 'Lab exam — timed, full screen, one attempt' }], mode, { attrs: 'data-change="amode"' })}
    <div class="lab-section ${mode === 'submit' ? 'hidden' : ''}" data-sec="lab">
      <div class="h3" style="font-size:15px">Test cases</div>
      <p class="small muted" style="margin:4px 0 10px">Each test sends the input lines to <code>input()</code> and passes when the output contains the expected text (case and spacing ignored). Hidden tests never show their expected output to students.</p>
      <div id="tests-box">${tests.map(testRowHtml).join('')}</div>
      <button type="button" class="btn text sm" data-act="addTest" style="margin:0 0 10px -10px">${icon('add')} Add test</button>
      ${field('maxSwitches', 'Allowed tab switches', a && a.maxSwitches !== undefined && a.maxSwitches !== '' ? a.maxSwitches : 3, { type: 'number', attrs: 'min="0" max="20"', hint: 'More than this is flagged. In exams, going over submits automatically. 0 = flag every switch, never auto-submit.' })}
      <div class="row ${mode === 'exam' ? '' : 'hidden'}" data-sec="exam" style="gap:12px;align-items:flex-start">
        ${field('examStart', 'Exam opens', a ? a.examStart : '', { type: 'datetime-local', cls: 'grow' })}
        ${field('examEnd', 'Exam closes (auto-submit)', a ? a.examEnd : '', { type: 'datetime-local', cls: 'grow' })}
      </div>
    </div>`;
}
function testRowHtml(t) {
  t = t || {};
  return `<div class="test-row"><textarea class="t-in" placeholder="Input (one value per line)" spellcheck="false">${esc(t.input || '')}</textarea>
    <textarea class="t-exp" placeholder="Expected output contains…" spellcheck="false">${esc(t.expect || '')}</textarea>
    <label><input type="checkbox" class="t-hid" ${t.hidden ? 'checked' : ''}> Hidden</label>
    <button type="button" class="icon-btn sm" data-act="delTest" title="Remove test">${icon('delete')}</button></div>`;
}


/* ---------- Admin: exams (marking) ---------- */
V.exams = () => {
  const d = S.data, ex = d.exams || [];
  const att = d.examAttempts || [];
  const fx = S.sub.xmFilter || '';
  const list = att.filter(a => !fx || a.examId === fx);
  const exTitle = id => { const e = ex.find(x => x.id === id); return e ? e.title : '(deleted exam)'; };
  const totalOf = id => { const e = ex.find(x => x.id === id); if (!e) return 0; return e.sections.reduce((t, s) => { const m = s.questions.map(q => +q.marks).sort((a, b) => b - a); return t + (s.pick ? m.slice(0, s.pick) : m).reduce((a, b) => a + b, 0); }, 0); };
  return `<div class="page-head"><div><h1 class="h1">Exams</h1><p class="muted">Students take exams one section at a time from their home page. MCQs are marked automatically; you mark the rest here.</p></div>
    <div class="row"><button class="btn outlined" data-act="xmJson">${icon('data_object')} New / import exam</button></div></div>
  ${ex.length ? `<div class="list card" style="padding:6px 10px;margin-bottom:16px">${ex.map(e => `<div class="list-item">
      <span class="lead-icon ${e.active ? 'green' : ''}">${icon('quiz')}</span>
      <div class="grow"><div class="title">${esc(e.title)}</div><div class="meta">${totalOf(e.id)} marks · ${e.durationMin} min${e.opensAt ? ' · opens ' + fmtDT(e.opensAt) : ''} · ${e.sections.map(s => s.id).join(' · ')} · ${plural(att.filter(a => a.examId === e.id).length, 'attempt')}</div></div>
      <label class="switch"><input type="checkbox" data-change="xmActive" data-id="${esc(e.id)}" ${e.active ? 'checked' : ''}><span class="track"></span><span class="small">${e.active ? 'Open' : 'Hidden'}</span></label>
      <button class="icon-btn sm" data-act="xmJson" data-id="${esc(e.id)}" title="Edit JSON">${icon('edit')}</button></div>`).join('')}</div>`
    : emptyState('quiz', 'No exams yet. Use "New / import exam" and paste the exam JSON.')}
  ${att.length ? `<div class="row" style="margin-bottom:12px"><select class="input-inline" data-change="xmFilter"><option value="">All exams</option>${ex.map(e => `<option value="${esc(e.id)}" ${fx === e.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select></div>
  <div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Status</th><th class="hide-sm">Started</th><th>MCQ</th><th>Total</th><th></th></tr></thead><tbody>
    ${list.map(a => `<tr class="click" data-act="xmMark" data-id="${esc(a.id)}">
      <td><div class="row" style="flex-wrap:nowrap">${avatar(a.studentName)}<div><div style="font-weight:500">${esc(a.studentName)}</div><div class="small muted">${esc(exTitle(a.examId))}</div></div></div></td>
      <td><div class="row" style="gap:4px">${a.status === 'submitted' ? pill(a.graded ? 'Marked' : 'To mark', a.graded ? 'green' : 'amber', a.graded ? 'check_circle' : 'rate_review') : pill('In progress · section ' + (a.section + 1), 'blue', 'timer')}${a.flags.length ? `<span title="${esc(a.flags.join('\n'))}">${pill('Flagged', 'red', 'flag')}</span>` : ''}</div></td>
      <td class="hide-sm small">${fmtDT(a.startedAt)}${a.submittedAt ? '<br><span class="muted">done ' + fmtTime(a.submittedAt.slice(11, 16)) + '</span>' : ''}</td>
      <td><b>${a.autoScore}</b></td><td>${a.total === null ? '<span class="muted">—</span>' : `<b>${a.total}</b> <span class="muted small">/ ${totalOf(a.examId)}</span>`}</td>
      <td style="text-align:right"><button class="icon-btn sm" data-act="xmReset" data-id="${esc(a.id)}" title="Delete attempt (lets the student retake)">${icon('restart_alt')}</button></td></tr>`).join('')}
  </tbody></table></div>` : ''}`;
};
function cameraPanel(list) {
  if (!list) return '';
  const tally = {};
  list.forEach(f => { tally[f.label] = (tally[f.label] || 0) + 1; });
  return `<div class="card" style="margin-top:14px;padding:14px 16px"><div class="h3">${icon('photo_camera')} Camera &amp; microphone</div>
    ${list.length ? `<div class="row" style="gap:6px;margin:8px 0">${Object.keys(tally).map(k => pill(k + ': ' + tally[k], 'amber')).join('')}</div>
      <div class="cam-grid">${list.map(f => `<a class="cam-item" ${f.fileUrl ? `href="${esc(f.fileUrl)}" target="_blank" rel="noopener"` : ''}>${f.thumb ? (/^data:image\/jpeg;base64,/.test(f.thumb) ? `<img src="${esc(f.thumb)}" alt="">` : `<img alt="" data-proctor="${esc(String(f.thumb).replace(/^proctor:/, ''))}">`) : `<span class="cam-noimg">${icon('no_photography')}</span>`}
        <span><b>${esc(f.label)}</b><br>${f.at ? esc(new Date(f.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : ''}${f.section ? ' · Section ' + esc(f.section) : ''}</span></a>`).join('')}</div>`
    : `<div class="banner ok" style="margin:8px 0">${icon('videocam')}<div class="grow">No camera or microphone flags.</div></div>`}
  </div>`;
}
async function xmMarkDialog(id) {
  let r;
  try { r = await call('getExamAttempt', { id }); } catch (e) { return toast(e.message, true); }
  const at = r.attempt, ex = r.exam;
  if (!ex) return toast('The exam for this attempt was deleted.', true);
  const mk = q => `<div class="field static" style="max-width:130px;margin:8px 0 0"><input type="number" name="m_${esc(q.id)}" min="0" max="${q.marks}" step="0.5" value="${at.marks[q.id] === undefined ? '' : at.marks[q.id]}" placeholder=" "><label>Marks / ${q.marks}</label></div>`;
  const body = ex.sections.map(s => {
    const qs = s.questions.map(q => {
      const a = at.answers[q.id];
      if (q.type === 'mcq') {
        const ok = a === q.answer;
        return `<div class="xm-mcq-row ${a === null || a === undefined ? 'skip' : ok ? 'ok' : 'bad'}"><b>${esc(q.id)}</b> ${a === null || a === undefined ? 'not answered' : esc(q.options[a])} ${ok ? icon('check', 'sm') : a === null || a === undefined ? '' : icon('close', 'sm') + ' <span class="muted">→ ' + esc(q.options[q.answer]) + '</span>'}</div>`;
      }
      const tr = at.testResults[q.id];
      return `<div class="xm-ans"><div class="row between"><b>${esc(q.id)}${q.title ? ' · ' + esc(q.title) : ''}</b><span class="muted small">${q.marks} marks</span></div>
        <div class="small muted" style="margin:2px 0 6px">${rich(q.text)}</div>
        ${q.type === 'code' || q.mono ? `<pre class="code"><code class="language-python">${esc(a || '(no answer)')}</code></pre>` : `<div class="xm-ans-text">${a ? rich(a) : '<span class="muted">(no answer)</span>'}</div>`}
        ${tr ? `<div class="row" style="gap:6px;margin-top:8px">${scorePill(tr.score)}${tr.results.map((t, i) => `<span class="pill ${t.ok ? 'green' : 'red'}" title="${esc(t.output)}">Test ${i + 1}: ${esc((q.tests[i] || {}).input || '').replace(/\n/g, ' / ')}</span>`).join('')}</div>` : ''}
        ${q.key ? `<div class="outcomes" style="margin-top:8px">${icon('key')}<div><b>Key:</b> ${rich(q.key)}</div></div>` : ''}
        ${mk(q)}</div>`;
    }).join('');
    const mcqs = s.questions.filter(q => q.type === 'mcq');
    return `<div class="xm-mark-sec"><div class="h3">Section ${esc(s.id)} · ${esc(s.title)}${s.pick ? ' <span class="muted small">(best ' + s.pick + ' count)</span>' : ''}${mcqs.length ? ' · ' + pill(mcqs.filter(q => at.answers[q.id] === q.answer).length + '/' + mcqs.length + ' correct', 'blue') : ''}</div>
      <div class="small muted" style="margin-bottom:8px">${at.sectionLog[s.id] ? 'Submitted ' + fmtTime(at.sectionLog[s.id].slice(11, 16)) : 'Not submitted'}</div>${qs}</div>`;
  }).join('');
  openDialog(at.studentName + ' · ' + ex.title, `<form data-form="xmMark" data-id="${esc(at.id)}"><div class="dialog-body">
    <div class="row" style="margin-bottom:10px">${at.status === 'submitted' ? pill('Submitted', 'green', 'task_alt') : pill('In progress', 'blue', 'timer')}<span class="muted small">Started ${fmtDT(at.startedAt)}${at.submittedAt ? ' · submitted ' + fmtTime(at.submittedAt.slice(11, 16)) : ''} · MCQ auto-score <b>${at.autoScore}</b>${at.total !== null ? ' · total <b>' + at.total + '</b>' : ''}</span></div>
    ${body}
    ${cameraPanel(at.camera)}
    ${integrityPanel(at.integrity)}
    <div style="margin-top:16px">${field('comment', 'Comment (private note)', at.comment, { textarea: true, rows: 2 })}</div>
  </div><div class="dialog-actions"><button type="button" class="btn text" data-act="closeDialog">Close</button><button class="btn filled">${icon('save')} Save marks</button></div></form>`, true);
  loadProctorImages();
}
async function loadProctorImages() {
  const queue = $$('img[data-proctor]', $('#dialog-root'));
  const worker = async () => {
    while (queue.length) {
      const img = queue.shift();
      if (!document.body.contains(img)) return;                   // dialog closed
      try { img.src = await call('proctorImage', { fileId: img.dataset.proctor }); }
      catch (e) { img.replaceWith(Object.assign(document.createElement('span'), { className: 'cam-noimg', textContent: 'Photo unavailable' })); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);   // a few at a time: each Apps Script call takes ~1 s
}

/* ---------- Admin: students ---------- */
V.students = () => {
  const d = S.data;
  const reqs = d.students.filter(s => s.trackStatus === 'requested' && s.active);
  const trackSel = s => `<select class="input-inline" data-change="assignTrack" data-id="${esc(s.id)}" style="height:34px" aria-label="Track">
    <option value="">No track</option>${d.tracks.map(t => `<option value="${esc(t.id)}" ${s.trackStatus === 'approved' && s.track === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  return `<div class="page-head"><div><h1 class="h1">Students</h1><p class="muted">Students sign in with their <b>name</b> (or username) and the password you set.</p></div>
    <div class="row"><button class="btn outlined" data-act="bulkStudents">${icon('group_add')} Bulk add</button><button class="btn filled" data-act="addStudent">${icon('person_add')} Add student</button></div></div>
  ${!d.settings.trackSelectionOpen ? `<div class="banner">${icon('alt_route')}<div class="grow">Track selection is closed. Open it around Day 10 so students can request their path.</div><button class="btn tonal" data-act="openTracks">Open track selection</button></div>` : ''}
  ${reqs.length ? `<div class="card tonal" style="margin-bottom:16px"><div class="card-head"><div class="h3">${icon('alt_route')} Track requests</div></div>
    <div class="list">${reqs.map(s => `<div class="list-item">${avatar(s.name)}<div class="grow"><div class="title">${esc(s.name)}</div><div class="meta">wants ${esc(trackName(s.requestedTrack))}</div></div>
      <button class="btn text sm" data-act="trackDecision" data-id="${esc(s.id)}" data-action="reject">Reject</button><button class="btn filled sm" data-act="trackDecision" data-id="${esc(s.id)}" data-action="approve">Approve</button></div>`).join('')}</div></div>` : ''}
  ${d.students.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Student</th><th>Track</th><th class="hide-sm">Status</th><th>Points</th><th class="hide-sm">Last seen</th><th></th></tr></thead><tbody>
    ${d.students.map(s => `<tr style="${s.active ? '' : 'opacity:.55'}">
      <td><div class="row" style="flex-wrap:nowrap">${avatar(s.name)}<div><div style="font-weight:500">${esc(s.name)}</div><div class="small muted">@${esc(s.username)}</div></div></div></td>
      <td>${trackSel(s)}${s.trackStatus === 'requested' ? '<div class="small muted">requested ' + esc(trackName(s.requestedTrack)) + '</div>' : ''}</td>
      <td class="hide-sm">${s.active ? pill('Active', 'green') : pill('Inactive')}</td>
      <td><b>${s.stats.points}</b></td>
      <td class="hide-sm small muted">${s.lastLogin ? fmtDT(s.lastLogin) : 'Never'}</td>
      <td style="text-align:right;white-space:nowrap"><button class="icon-btn sm" data-act="bonusDialog" data-id="${esc(s.id)}" title="Award points">${icon('stars')}</button><button class="icon-btn sm" data-act="editStudent" data-id="${esc(s.id)}" title="Edit / reset password">${icon('edit')}</button><button class="icon-btn sm" data-act="studentDetail" data-id="${esc(s.id)}" title="Details">${icon('open_in_full')}</button></td>
    </tr>`).join('')}
  </tbody></table></div>` : emptyState('group_add', 'No students yet. Add them one by one or paste a list.')}`;
};
function studentDialog(id) {
  const s = id ? studentById(id) : null;
  formDialog(s ? 'Edit ' + s.name : 'Add student', 'saveStudent', `
    ${field('name', 'Full name', s ? s.name : '', { required: true, hint: 'Students can sign in with this name.' })}
    ${field('username', 'Username (optional)', s ? s.username : '', { hint: s ? 'Lowercase letters, numbers, dot, dash, underscore.' : 'Leave blank to create one from the name.' })}
    ${field('password', s ? 'New password (leave blank to keep)' : 'Password', '', { type: 'text', required: !s, attrs: 'autocomplete="off" minlength="4"' })}
    ${s ? switchField('active', 'Active (can sign in)', s.active) : ''}`, s ? 'Save' : 'Add student', `data-id="${s ? esc(s.id) : ''}"`);
}

/* ---------- Admin: announcements ---------- */
V.announce = () => {
  const list = S.data.announcements;
  return `<div class="page-head"><div><h1 class="h1">Announcements</h1><p class="muted">Shown on every student's dashboard. Pinned ones stay on top.</p></div></div>
  <div class="grid-2"><div class="col"><div class="card"><div class="card-head"><div class="h3">${icon('campaign')} New announcement</div></div>
    <form data-form="announce">${field('title', 'Title', '', {})}${field('body', 'Message', '', { textarea: true, rows: 5 })}${switchField('pinned', 'Pin to top', false)}
    <div class="row end"><button class="btn filled">${icon('send')} Post</button></div></form></div></div>
  <div class="col"><div class="card"><div class="card-head"><div class="h3">${icon('history')} Posted</div></div>
    ${list.length ? list.map(a => `<div class="ann"><div class="row between" style="flex-wrap:nowrap"><div class="t">${a.pinned === 'TRUE' ? icon('push_pin', 'sm fill') : ''}${esc(a.title || 'Announcement')}${a.userId ? ' ' + pill('Only for ' + ((S.data.students || []).find(x => x.id === a.userId) || {}).name, 'violet', 'lock') : ''}</div>
      <div class="row" style="flex-wrap:nowrap"><button class="icon-btn sm" data-act="pinAnn" data-id="${esc(a.id)}" data-on="${a.pinned === 'TRUE' ? '' : '1'}" title="${a.pinned === 'TRUE' ? 'Unpin' : 'Pin'}">${icon('push_pin')}</button><button class="icon-btn sm" data-act="delAnn" data-id="${esc(a.id)}" title="Delete">${icon('delete')}</button></div></div>
      ${a.kind === 'report' ? `<details><summary class="small" style="cursor:pointer;color:var(--primary)">Preview report card</summary>${reportCard(a, { open: true })}</details>` : a.body ? `<div class="b">${rich(a.body)}</div>` : ''}<div class="small muted">${fmtDT(a.createdAt)}</div></div>`).join('') : `<div class="muted small">Nothing posted yet.</div>`}
  </div></div></div>`;
};

/* ---------- Admin: doubts ---------- */
V.adoubts = () => {
  const d = S.data, f = S.sub.dfilter || 'open';
  const list = d.doubts.filter(q => f === 'all' || (f === 'open' ? !q.answer : !!q.answer));
  const n = k => d.doubts.filter(q => k === 'all' || (k === 'open' ? !q.answer : !!q.answer)).length;
  const chip = (k, label) => `<button class="chip ${f === k ? 'on' : ''}" data-act="dfilter" data-f="${k}">${label} <span class="count">${n(k)}</span></button>`;
  return `<div class="page-head"><div><h1 class="h1">Doubts</h1><p class="muted">Answer questions. Turn on "Share with class" for answers everyone should see.</p></div></div>
  <div class="chips">${chip('open', 'Waiting')}${chip('answered', 'Answered')}${chip('all', 'All')}</div>
  ${list.length ? list.map(q => { const day = adminDay(q.dayId); return `<div class="qa">
    <div class="row between"><div class="small muted">${esc(q.studentName)} · ${esc(day ? 'Day ' + day.day + ' · ' + day.title : 'General')} · ${fmtDT(q.askedAt)}</div><button class="icon-btn sm" data-act="delDoubt" data-id="${esc(q.id)}" title="Delete">${icon('delete')}</button></div>
    <div class="q" style="margin:4px 0 12px">${rich(q.question)}</div>
    <form data-form="answer" data-id="${esc(q.id)}">${field('answer', 'Your answer', q.answer, { textarea: true, rows: 3, required: true })}
      <div class="row between">${switchField('shared', 'Share with class', q.shared === 'TRUE')}<button class="btn ${q.answer ? 'tonal' : 'filled'}">${q.answer ? 'Update answer' : 'Send answer'}</button></div></form>
  </div>`; }).join('') : emptyState('forum', f === 'open' ? 'No doubts waiting.' : 'Nothing here.')}`;
};

/* ---------- Admin: reflections ---------- */
V.areflect = () => {
  const d = S.data;
  const dates = Array.from(new Set(d.reflections.map(r => r.date))).sort().reverse();
  const df = S.sub.rdate || (dates[0] || ''), sf = S.sub.rstu || '';
  let list = d.reflections;
  if (df) list = list.filter(r => r.date === df);
  if (sf) list = list.filter(r => r.userId === sf);
  const lows = list.filter(r => +r.confidence <= 2).length;
  return `<div class="page-head"><div><h1 class="h1">Reflections</h1><p class="muted">What students learned and where they're stuck. Low-confidence entries are highlighted.</p></div></div>
  <div class="row" style="margin-bottom:14px">
    <select class="input-inline" data-change="rdate" aria-label="Date"><option value="">All dates</option>${dates.map(x => `<option value="${x}" ${x === df ? 'selected' : ''}>${fmtDate(x)}</option>`).join('')}</select>
    <select class="input-inline" data-change="rstu" aria-label="Student"><option value="">All students</option>${d.students.map(s => `<option value="${esc(s.id)}" ${s.id === sf ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
    ${lows ? pill(lows + ' need help', 'red', 'priority_high') : ''}
  </div>
  ${list.length ? `<div class="card">${list.map(r => reflectionItem(r, r.studentName)).join('')}</div>` : emptyState('edit_note', 'No reflections for this filter.')}`;
};

/* ---------- Admin: settings ---------- */
V.settings = () => {
  const d = S.data, s = d.settings, l = d.links;
  return `<div class="page-head"><div><h1 class="h1">Settings</h1></div></div>
  <div class="grid-2"><div class="col"><div class="card"><div class="card-head"><div class="h3">${icon('tune')} Course</div></div>
    <form data-form="settings">
      ${field('courseTitle', 'Course title', s.courseTitle, { required: true })}
      <div class="form-grid">${field('checkinStart', 'Check-in opens', s.checkinStart, { type: 'time', required: true })}${field('checkinEnd', 'Check-in closes', s.checkinEnd, { type: 'time', required: true })}
      ${field('lateAfter', 'Late after', s.lateAfter, { type: 'time', required: true, hint: 'Used when verifying check-ins.' })}</div>
      ${switchField('trackSelectionOpen', 'Students can request a track', s.trackSelectionOpen)}
      <div class="row end"><button class="btn filled">${icon('save')} Save settings</button></div>
    </form></div></div>
  <div class="col"><div class="card"><div class="card-head"><div class="h3">${icon('link')} Google Drive & Sheets</div></div>
    <div class="list">
      ${[['table_view', 'Database (Google Sheet)', l.spreadsheet, 'green'], ['folder', 'CodeTrack folder', l.root, 'blue'], ['folder_shared', 'Study Materials folder', l.materials, 'amber'], ['inventory_2', 'Student Submissions folder', l.submissions, 'violet']]
        .map(x => `<a class="list-item click" href="${esc(x[2])}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="lead-icon ${x[3]}">${icon(x[0])}</span><div class="grow title">${x[1]}</div>${icon('open_in_new')}</a>`).join('')}
    </div></div>
    <div class="card"><div class="card-head"><div class="h3">${icon('key')} Your account</div></div><div class="row between"><div class="muted">Signed in as <b>@${esc(d.user.username)}</b></div><button class="btn outlined" data-act="pwDialog">Change password</button></div></div>
  </div></div>`;
};

/* ================================================================
 * Welcome screen (shown once right after signing in)
 * ================================================================ */
const SEEN_KEY = 'codetrack_seen_';
function renderWelcome() {
  const d = S.data, u = d.user, admin = d.role === 'admin';
  const firstTime = !load(SEEN_KEY + u.id);
  S.mounted = null;
  $('#app').innerHTML = `<div class="welcome-wrap"><div class="welcome">
    <div class="welcome-head rise" style="--i:0">
      ${avatar(u.name, true)}
      <div><div class="muted">${fmtDate(d.today)} · ${esc(d.settings.courseTitle)}</div>
        <h1 class="welcome-title">${firstTime ? 'Welcome to CodeTrack' : greet()}, ${esc(first(u.name))}</h1>
        <div class="welcome-sub">${admin ? "Here's what needs your attention today." : (firstTime ? "Glad you're here. Here's your day at a glance." : "Welcome back! Here's your day at a glance.")}</div></div>
    </div>
    ${admin ? welcomeAdmin() : welcomeStudent(firstTime)}
    <div class="welcome-actions rise" style="--i:6">
      ${admin ? '' : `<button class="btn outlined" data-act="welcomeGo" data-view="assignments">${icon('checklist')} Today's to-dos</button>`}
      <button class="btn filled" data-act="welcomeGo" data-view="${admin ? 'overview' : 'dashboard'}" id="welcome-go">${admin ? 'Open overview' : 'Go to my dashboard'} ${icon('arrow_forward')}</button>
    </div>
  </div></div>`;
  setTimeout(() => { const b = $('#welcome-go'); if (b) b.focus(); }, 80);
}
function welcomeCard(i, ic, cls, label, value, sub, act) {
  return `<button class="welcome-card rise" style="--i:${i}" ${act ? `data-act="welcomeGo" data-view="${act}"` : 'disabled'}>
    <span class="lead-icon ${cls}">${icon(ic)}</span>
    <span class="wc-label">${esc(label)}</span><span class="wc-value">${value}</span><span class="wc-sub">${sub || ''}</span></button>`;
}
function welcomeStudent(firstTime) {
  const d = S.data, st = d.stats, lb = d.leaderboard;
  const f = focusDays(), day = f.list[0];
  const dueToday = (d.assignments || []).filter(a => (a.due || '').slice(0, 10) === d.today);
  const pendingToday = dueToday.filter(a => ['todo', 'missing', 'rework'].indexOf(aState(a)) >= 0);
  const allPending = pendingAssignments().length;
  let checkin = '';
  if (d.todayAttendance) {
    const m = ATT[d.todayAttendance.status] || ATT.pending;
    checkin = `<div class="welcome-note rise" style="--i:4">${icon(m.icon, 'fill')}<span>${d.todayAttendance.status === 'pending' ? 'Checked in at ' + fmtTime(d.todayAttendance.checkInAt) + ' · waiting for verification' : 'Attendance today: ' + m.label}</span></div>`;
  } else if (d.checkInOpen) {
    checkin = `<div class="welcome-note strong rise" style="--i:4">${icon('how_to_reg')}<span class="grow"><b>Class is on.</b> Check in before ${fmtTime(d.settings.checkinEnd)}.</span><button class="btn filled sm" data-act="checkIn">${icon('front_hand')} I'm here</button></div>`;
  }
  const todoList = pendingToday.length
    ? `<div class="welcome-list rise" style="--i:5"><div class="small muted" style="font-weight:500;letter-spacing:.4px;margin-bottom:6px">DUE TODAY</div>${pendingToday.slice(0, 5).map(a =>
        `<button class="welcome-todo" data-act="openAssignmentW" data-id="${esc(a.id)}">${icon('radio_button_unchecked')}<span class="grow">${esc(a.title)}</span>${icon('chevron_right')}</button>`).join('')}
        ${pendingToday.length > 5 ? `<div class="small muted" style="padding:6px 4px 0">+${pendingToday.length - 5} more</div>` : ''}</div>`
    : '';
  const tour = firstTime ? `<div class="welcome-tour rise" style="--i:5">
      <div class="h3" style="margin-bottom:10px">How CodeTrack works</div>
      <div class="tour-steps">
        <div class="tour-step"><span class="tour-n">1</span><div><b>Follow the plan</b><div class="small muted">Each day has Scrum, Pen & Paper and Code Lab. Tick each one in your study plan when you're done.</div></div></div>
        <div class="tour-step"><span class="tour-n">2</span><div><b>Submit your work</b><div class="small muted">Open an assignment, paste your code or upload a .py file. Your instructor approves it or leaves a comment.</div></div></div>
        <div class="tour-step"><span class="tour-n">3</span><div><b>Show up & earn points</b><div class="small muted">Tap "I'm here" between ${fmtTime(d.settings.checkinStart)} and ${fmtTime(d.settings.checkinEnd)}. Points for every day, submission and reflection.</div></div></div>
      </div></div>` : '';
  const xmc = window.CTApp.exam ? window.CTApp.exam.examCards(true) : '';
  return `${xmc ? `<div class="rise" style="--i:1;margin-bottom:14px">${xmc}</div>` : ''}<div class="welcome-grid">
      ${welcomeCard(1, 'menu_book', 'blue', f.label === 'Today' ? "Today's lesson" : f.label || 'Lesson', day ? 'Day ' + esc(day.day) : '—', day ? esc(day.title) : 'No lesson published yet', 'plan')}
      ${welcomeCard(2, 'checklist', pendingToday.length ? 'amber' : 'green', 'Due today', pendingToday.length ? pendingToday.length + ' to do' : (dueToday.length ? 'All done' : 'Nothing'), allPending ? plural(allPending, 'pending task') + ' overall' : "You're all caught up", 'assignments')}
      ${welcomeCard(3, 'stars', 'violet', 'Points', st.points, (lb.myRank ? 'Rank #' + lb.myRank + ' of ' + lb.total : '') + (st.streak ? ' · ' + plural(st.streak, 'day') + ' streak' : ''), 'profile')}
    </div>
    ${checkin}${todoList}${tour}`;
}
function welcomeAdmin() {
  const d = S.data, c = d.counts;
  const active = (d.students || []).filter(s => s.active).length;
  const nextDate = (d.classDates || []).find(x => x >= d.today);
  const wk = nextDate ? weekOfDate(nextDate) : null;
  const wkRow = wk ? d.weeks.find(w => String(w.week) === wk) : null;
  const todayLesson = d.days.find(x => x.date === d.today && x.track === 'common') || d.days.find(x => x.date === d.today);
  const notes = [];
  if (d.usingDefaultPassword) notes.push(`<div class="welcome-note warn rise" style="--i:5">${icon('warning')}<span class="grow">You're still using the default password.</span><button class="btn tonal sm" data-act="pwDialog">Change it</button></div>`);
  if (wkRow && wkRow.published !== 'TRUE') notes.push(`<div class="welcome-note rise" style="--i:5">${icon('visibility_off')}<span class="grow">Week ${esc(wkRow.week)} · ${esc(wkRow.title)} isn't published yet.</span><button class="btn tonal sm" data-act="publishWeek" data-week="${esc(wkRow.week)}" data-on="1">Publish</button></div>`);
  if (!active) notes.push(`<div class="welcome-note rise" style="--i:5">${icon('group_add')}<span class="grow">No students yet. Add them to get started.</span><button class="btn tonal sm" data-act="welcomeGo" data-view="students">Add students</button></div>`);
  return `<div class="welcome-grid four">
      ${welcomeCard(1, 'how_to_reg', c.pendingCheckins ? 'amber' : 'green', 'Check-ins', c.pendingCheckins, 'to verify', 'attendance')}
      ${welcomeCard(2, 'rate_review', c.toReview ? 'amber' : 'green', 'Submissions', c.toReview, 'to review', 'review')}
      ${welcomeCard(3, 'forum', c.openDoubts ? 'amber' : 'green', 'Doubts', c.openDoubts, 'waiting for an answer', 'adoubts')}
      ${welcomeCard(4, 'alt_route', c.trackRequests ? 'amber' : 'green', 'Track requests', c.trackRequests, plural(active, 'active student'), 'students')}
    </div>
    ${todayLesson ? `<div class="welcome-note rise" style="--i:4">${icon('today')}<span class="grow">Today: <b>Day ${esc(todayLesson.day)} · ${esc(todayLesson.title)}</b></span></div>` : ''}
    ${notes.join('')}`;
}
function leaveWelcome(view) {
  if (S.data && S.data.user) store(SEEN_KEY + S.data.user.id, '1');
  S.welcome = false;
  S.mounted = null;
  go(view || defaultView());
}

/* ================================================================
 * Actions (click), changes, inputs, forms
 * ================================================================ */
const ACTIONS = {
  go: el => { if (S.welcome) return leaveWelcome(el.dataset.view); go(el.dataset.view); },
  welcomeGo: el => leaveWelcome(el.dataset.view),
  openAssignmentW: el => { leaveWelcome('assignments'); S.sub.assignment = el.dataset.id; S.file = null; renderPage(); },
  navOpen: () => { $('#sidenav').classList.add('open'); $('#scrim-nav').classList.add('open'); },
  navClose: closeNav,
  refresh: () => refresh(false),
  signOut: async () => { closeMenu(); const t = S.token; signOut(); if (t) { S.token = t; try { await call('logout'); } catch (e) { /* ignore */ } S.token = null; } },
  userMenu: el => { if ($('#menu')) closeMenu(); else openUserMenu(el); },
  pwDialog: pwDialog,
  togglePw: el => { const i = $('#lg-pass'); i.type = i.type === 'password' ? 'text' : 'password'; el.innerHTML = icon(i.type === 'password' ? 'visibility' : 'visibility_off'); },
  closeDialog: closeDialog,
  scrimClose: (el, e) => { if (e.target === el) closeDialog(); },
  confirmYes: () => { closeDialog(); if (S._confirm) S._confirm(true); S._confirm = null; },
  confirmNo: () => { closeDialog(); if (S._confirm) S._confirm(false); S._confirm = null; },

  // student
  checkIn: () => act('checkIn'),
  pickWeek: el => { S.sub.week = el.dataset.week; renderPage(); },
  askAbout: el => go('doubts', { doubtDay: el.dataset.day }),
  reflectAbout: el => go('reflection', { reflectDay: el.dataset.day }),
  openAssignment: el => { closeDialog(); S.view = 'assignments'; S.sub.assignment = el.dataset.id; S.file = null; render(); window.scrollTo(0, 0); },
  backToAssignments: () => { S.sub.assignment = null; S.file = null; renderPage(); },
  afilter: el => { S.sub.afilter = el.dataset.f; renderPage(); },
  subMode: el => { S.subMode = el.dataset.mode; renderPage(); },
  clearFile: () => { S.file = null; const p = $('#file-preview'); if (p) p.innerHTML = ''; },
  viewSub: async el => {
    try {
      const s = await call('getSubmission', { id: el.dataset.id });
      openDialog(s.fileName || 'Submission', `<div class="dialog-body"><div class="row" style="margin-bottom:10px">${statusPill(s.status)}<span class="muted small">${fmtDT(s.submittedAt)}</span></div>
        <pre class="code"><code class="language-python">${esc(s.code)}</code></pre>
        ${s.testResults && s.testResults.length ? `<div class="row" style="margin-top:12px;gap:6px">${s.testResults.map((r, i) => pill('Test ' + (i + 1) + (r.hidden ? ' (hidden)' : ''), r.ok ? 'green' : 'red', r.ok ? 'check' : 'close')).join('')}</div>` : ''}
        ${s.comment ? `<div class="outcomes">${icon('comment')}<div><b>Instructor:</b> ${rich(s.comment)}</div></div>` : ''}</div>
        <div class="dialog-actions"><button class="btn filled" data-act="closeDialog">Close</button></div>`, true);
    } catch (e) { toast(e.message, true); }
  },
  requestTrack: async el => {
    const t = track(el.dataset.id);
    if (await confirmDialog('Choose ' + t.name + '?', esc(t.description) + '<br><br>Your instructor will confirm your choice.', 'Request track')) act('requestTrack', { trackId: t.id });
  },
  previewFile: el => openDialog(el.dataset.name, `<div class="dialog-body" style="padding-bottom:20px"><iframe src="${DRIVE_FILE}${encodeURIComponent(el.dataset.id)}/preview" style="width:100%;height:70vh;border:0;border-radius:12px;background:var(--surface-2)" allow="autoplay"></iframe></div>`, true),
  materialsRefresh: () => loadMaterials(true),

  startExam: el => startExam(el.dataset.id),
  examResume: () => {
    hideExamOverlay();
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    if (S.exam && S.labs[S.exam.key]) S.labs[S.exam.key].focus();
  },

  // admin: exams
  xmMark: (el, e) => { if (e.target.closest('[data-act="xmReset"]')) return; xmMarkDialog(el.dataset.id); },
  xmReset: async el => {
    const a = (S.data.examAttempts || []).find(x => x.id === el.dataset.id);
    if (a && await confirmDialog('Delete ' + esc(a.studentName) + "'s attempt?", 'All their answers for this exam are removed and they can take it again.', 'Delete attempt', true)) act('resetExamAttempt', { id: a.id });
  },
  xmJson: async el => {
    let text = '';
    if (el.dataset.id) { try { text = await call('exportExam', { id: el.dataset.id }); } catch (e) { return toast(e.message, true); } }
    formDialog(el.dataset.id ? 'Edit exam JSON' : 'New exam from JSON', 'xmSave',
      `<p class="small muted" style="margin-top:0">Sections hold questions of type <code>mcq</code> (options + answer index), <code>text</code> (written, with an optional <code>key</code>) or <code>code</code> (tests: input → expected lines). Keep the same <code>id</code> to update an exam.</p>` +
      field('json', 'Exam JSON', text, { textarea: true, rows: 16, required: true, attrs: 'spellcheck="false" style="font-family:var(--mono);font-size:12px"' }), 'Save exam', '', true);
  },

  // admin
  addTest: () => { const b = $('#tests-box'); if (b) { b.insertAdjacentHTML('beforeend', testRowHtml()); $$('.t-in', b).pop().focus(); } },
  delTest: el => { const r = el.closest('.test-row'); if (r) r.remove(); },
  studentDetail: el => studentDetailDialog(el.dataset.id),
  publishWeek: el => act('saveWeek', { week: el.dataset.week, published: el.dataset.on === '1' }),
  att: el => act('markAttendance', { date: S.sub.attDate || S.data.today, userId: el.dataset.user, status: el.dataset.status }),
  attToday: () => { S.sub.attDate = S.data.today; renderPage(); },
  bulkAtt: async el => {
    const mode = el.dataset.mode;
    if (mode === 'absentRest' && !(await confirmDialog('Mark the rest absent?', 'Every active student without an attendance entry for this date will be marked absent.', 'Mark absent', true))) return;
    act('bulkAttendance', { date: S.sub.attDate || S.data.today, mode });
  },
  rfilter: el => { S.sub.rfilter = el.dataset.f; renderPage(); },
  reviewSub: el => reviewDialog(el.dataset.id),
  sylTab: el => { S.sub.syl = el.dataset.tab; renderPage(); },
  editWeek: el => {
    const w = S.data.weeks.find(x => String(x.week) === el.dataset.week);
    formDialog('Rename week ' + w.week, 'saveWeek', field('title', 'Week title', w.title, { required: true }), 'Save', `data-week="${esc(w.week)}"`);
  },
  editDay: el => dayDialog(el.dataset.id),
  deleteDay: async el => {
    const x = adminDay(el.dataset.id);
    if (await confirmDialog('Delete Day ' + x.day + '?', `"${esc(x.title)}" will be removed from the plan. Its assignments stay but become hidden.`, 'Delete', true)) act('deleteDay', { id: x.id });
  },
  editAssignment: el => assignmentDialog(el.dataset.id),
  deleteAssignment: async el => {
    const a = S.data.assignments.find(x => x.id === el.dataset.id);
    if (await confirmDialog('Delete assignment?', `"${esc(a.title)}" will be removed. Existing submissions are kept in the sheet.`, 'Delete', true)) act('deleteAssignment', { id: a.id });
  },
  jsonLoad: async () => {
    try { S.sub.jsonText = await call('exportSyllabus'); renderPage(); toast('Loaded the current syllabus'); } catch (e) { toast(e.message, true); }
  },
  jsonCopy: async () => {
    const box = $('#json-box');
    try { await navigator.clipboard.writeText(box.value); toast('Copied'); } catch (e) { box.select(); document.execCommand('copy'); toast('Copied'); }
  },
  jsonDownload: () => {
    const text = $('#json-box').value;
    if (!text.trim()) return toast('Load or paste JSON first', true);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = 'syllabus.json'; document.body.appendChild(a); a.click(); a.remove();
  },
  jsonImport: async () => {
    const text = $('#json-box').value;
    S.sub.jsonText = text;
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { return toast('Invalid JSON: ' + e.message, true); }
    const n = Array.isArray(parsed.days) ? parsed.days.length : 0;
    if (!n) return toast('The JSON needs a "days" array.', true);
    if (await confirmDialog('Import syllabus?', `This replaces the current weeks and days with <b>${n} days</b> from the JSON${Array.isArray(parsed.tracks) ? ' and updates the tracks' : ''}. Student progress and submissions are kept.`, 'Import')) {
      const r = await act('importSyllabus', { json: text });
      if (r) S.sub.jsonText = '';
    }
  },
  addStudent: () => studentDialog(null),
  editStudent: el => studentDialog(el.dataset.id),
  bulkStudents: () => formDialog('Bulk add students', 'bulkStudents',
    `<p class="muted small" style="margin-top:0">One student per line: <code>Name, password</code> or <code>Name, username, password</code></p>` +
    field('text', 'Students', '', { textarea: true, rows: 8, required: true, attrs: 'placeholder="Priya Sharma, pass123\nArun Kumar, arun.k, arun2026"' }), 'Add all'),
  bonusDialog: el => {
    const s = studentById(el.dataset.id);
    formDialog('Award points to ' + s.name, 'bonus', field('points', 'Points (use a negative number to deduct)', 5, { type: 'number', required: true }) + field('reason', 'Reason', '', { required: true, attrs: 'placeholder=" "' }), 'Award', `data-id="${esc(s.id)}"`);
  },
  trackDecision: el => act('setTrack', { userId: el.dataset.id, action: el.dataset.action }),
  openTracks: () => act('saveSettings', { trackSelectionOpen: true }, { ok: 'Track selection is open.' }),
  pinAnn: el => act('saveAnnouncement', { id: el.dataset.id, pinned: el.dataset.on === '1' }),
  delAnn: async el => { if (await confirmDialog('Delete announcement?', 'Students will no longer see it.', 'Delete', true)) act('deleteAnnouncement', { id: el.dataset.id }); },
  dfilter: el => { S.sub.dfilter = el.dataset.f; renderPage(); },
  delDoubt: async el => { if (await confirmDialog('Delete this doubt?', 'This cannot be undone.', 'Delete', true)) act('deleteDoubt', { id: el.dataset.id }); }
};

const CHANGES = {
  progress: el => {
    const key = el.dataset.day + '|' + el.dataset.item;
    const set = progSet();
    if (el.checked) set.add(key); else set.delete(key);
    S.data.progress = Array.from(set);          // optimistic
    renderPage();
    act('toggleProgress', { dayId: el.dataset.day, item: el.dataset.item, done: el.checked });
  },
  pickFile: el => {
    const f = el.files && el.files[0];
    el.value = '';
    if (!f) return;
    if (!/\.(py|ipynb|txt)$/i.test(f.name)) return toast('Choose a .py, .ipynb or .txt file.', true);
    if (f.size > 500 * 1024) return toast('That file is larger than 500 KB.', true);
    const r = new FileReader();
    r.onload = () => { S.file = { name: f.name, size: f.size, content: String(r.result) }; const p = $('#file-preview'); if (p) { p.innerHTML = filePreview(); afterRender(p); } };
    r.onerror = () => toast('Could not read that file.', true);
    r.readAsText(f);
  },
  xmActive: el => act('saveExam', { id: el.dataset.id, active: el.checked }),
  xmFilter: el => { S.sub.xmFilter = el.value; renderPage(); },
  amode: el => {
    const f = el.closest('form');
    $('[data-sec="lab"]', f).classList.toggle('hidden', el.value === 'submit');
    $('[data-sec="exam"]', f).classList.toggle('hidden', el.value !== 'exam');
  },
  attDate: el => { S.sub.attDate = el.value || S.data.today; renderPage(); },
  rassign: el => { S.sub.rassign = el.value; renderPage(); },
  rstudent: el => { S.sub.rstudent = el.value; renderPage(); },
  sylWeek: el => { S.sub.sylWeek = el.value; renderPage(); },
  sylTrack: el => { S.sub.sylTrack = el.value; renderPage(); },
  saTrack: el => { S.sub.saTrack = el.value; renderPage(); },
  rdate: el => { S.sub.rdate = el.value; renderPage(); },
  rstu: el => { S.sub.rstu = el.value; renderPage(); },
  publishWeek: el => act('saveWeek', { week: el.dataset.week, published: el.checked }),
  assignTrack: el => act('setTrack', { userId: el.dataset.id, action: 'assign', trackId: el.value })
};

const INPUTS = {
  draft: el => { S.draft[el.dataset.id] = el.value; },
  mq: el => {
    const q = el.value.trim().toLowerCase();
    $$('[data-fname]').forEach(r => r.classList.toggle('hidden', !!q && r.dataset.fname.indexOf(q) < 0));
    $$('[data-folder]').forEach(c => { const rows = $$('[data-fname]', c); c.classList.toggle('hidden', !!q && rows.length > 0 && rows.every(r => r.classList.contains('hidden'))); });
  }
};

const FORMS = {
  login: async (v, f) => {
    const err = $('#lg-err');
    err.classList.add('hidden');
    try {
      const r = await call('login', { username: v.username, password: v.password });
      S.token = r.token; store(LS_KEY, r.token);
      S.data = r.state; S.view = defaultView(); S.mounted = null;
      S.welcome = !(EXAM_ONLY && r.state.role === 'student');
      render();
    } catch (e) {
      err.querySelector('span:not(.msi)').textContent = /^Wrong name or password/.test(e.message) ? e.message + ' Passwords are case-sensitive (e.g. capital first letter).' : e.message;
      err.classList.remove('hidden');
    }
  },
  changePassword: async v => {
    if (v.next !== v.again) return toast("New passwords don't match.", true);
    if (await act('changePassword', { current: v.current, next: v.next })) closeDialog();
  },
  submit: async (v, f) => {
    const id = f.dataset.id;
    let payload;
    if (S.subMode === 'file') {
      if (!S.file) return toast('Choose a file first.', true);
      payload = { assignmentId: id, type: 'file', fileName: S.file.name, code: S.file.content };
    } else {
      if (!String(v.code || '').trim()) return toast('Paste your code first.', true);
      payload = { assignmentId: id, type: 'paste', code: v.code };
    }
    const r = await act('submitAssignment', payload, { noRender: true });
    if (r) { delete S.draft[id]; S.file = null; render(); }
  },
  askDoubt: async (v, f) => { if (await act('askDoubt', v)) { S.sub.doubtDay = ''; } },
  reflect: async v => { await act('saveReflection', v); },
  review: async (v, f, submitter) => {
    const status = submitter && submitter.value;
    if (!status) return;
    if (await act('reviewSubmission', { id: f.dataset.id, status, comment: v.comment })) closeDialog();
  },
  saveWeek: async (v, f) => { if (await act('saveWeek', { week: f.dataset.week, title: v.title })) closeDialog(); },
  saveDay: async (v, f) => {
    v.id = f.dataset.id || '';
    if (v.id) v.track = f.dataset.track;
    if (await act('saveDay', v)) closeDialog();
  },
  saveAssignment: async (v, f) => {
    v.id = f.dataset.id || '';
    if (v.mode && v.mode !== 'submit') {
      v.tests = JSON.stringify($$('.test-row', f).map(r => ({ input: $('.t-in', r).value, expect: $('.t-exp', r).value.trim(), hidden: $('.t-hid', r).checked }))
        .filter(t => t.input.trim() || t.expect));
    }
    if (await act('saveAssignment', v)) closeDialog();
  },
  xmSave: async v => { if (await act('saveExam', { json: v.json })) closeDialog(); },
  xmMark: async (v, f) => {
    const marks = {};
    Object.keys(v).forEach(k => { if (k.indexOf('m_') === 0 && String(v[k]).trim() !== '') marks[k.slice(2)] = +v[k]; });
    if (await act('gradeExamAttempt', { id: f.dataset.id, marks, comment: v.comment })) closeDialog();
  },
  saveStudent: async (v, f) => { v.id = f.dataset.id || ''; if (await act('saveStudent', v)) closeDialog(); },
  bulkStudents: async v => { if (await act('bulkAddStudents', v)) closeDialog(); },
  bonus: async (v, f) => { if (await act('awardBonus', { userId: f.dataset.id, points: v.points, reason: v.reason })) closeDialog(); },
  announce: async (v, f) => { if (await act('saveAnnouncement', v)) f.reset(); },
  answer: async (v, f) => { await act('answerDoubt', { id: f.dataset.id, answer: v.answer, shared: v.shared }); },
  settings: async v => { await act('saveSettings', v); }
};

/* ================================================================
 * Global listeners
 * ================================================================ */
document.addEventListener('click', e => {
  const m = $('#menu');
  if (m && !m.contains(e.target) && !e.target.closest('[data-act="userMenu"]')) closeMenu();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') e.preventDefault();
  if (m && m.contains(el)) closeMenu();
  fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && CHANGES[el.dataset.change]) CHANGES[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && INPUTS[el.dataset.input]) INPUTS[el.dataset.input](el, e);
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form];
  if (!fn) return;
  const btns = $$('button', f);
  btns.forEach(b => { b.disabled = true; });
  try { await fn(formData(f), f, e.submitter); }
  finally { btns.forEach(b => { b.disabled = false; }); }
});
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.matches && d.matches('details.day')) { if (d.open) S.openDays.add(d.dataset.id); else S.openDays.delete(d.dataset.id); }
}, true);
document.addEventListener('keydown', e => {
  if (S.exam && e.key === 'Escape') return;
  if (S.welcome && (e.key === 'Escape') && !$('#dialog-root').innerHTML) { leaveWelcome(); return; }
  if (e.key === 'Escape') { if ($('#menu')) closeMenu(); else if ($('#dialog-root').innerHTML) { if (S._confirm) ACTIONS.confirmNo(); else closeDialog(); } closeNav(); }
  if (e.key === 'Tab' && e.target.matches && e.target.matches('textarea.code-input')) {
    e.preventDefault();
    const t = e.target, s = t.selectionStart, en = t.selectionEnd;
    t.value = t.value.slice(0, s) + '    ' + t.value.slice(en);
    t.selectionStart = t.selectionEnd = s + 4;
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }
});
window.addEventListener('resize', closeMenu);

// Gentle auto-refresh every 2 minutes (skipped while typing or a dialog is open)
setInterval(() => {
  if (!S.data || document.hidden || S.loading) return;
  const a = document.activeElement;
  if ($('#dialog-root').innerHTML || (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) return;
  if (S.exam || S.xm || S.view === 'lab' || S.view === 'exams' || (S.view === 'assignments' && S.sub.assignment)) return;
  refresh(true);
}, 120000);

if (window.hljs) { try { hljs.configure({ ignoreUnescapedHTML: true }); } catch (e) { /* ignore */ } }
window.CTApp = { S, $, $$, esc, icon, rich, pill, toast, call, act, render, confirmDialog, store, load, plural, first, fmtDT, fmtTime, fmtDate,
  emptyState, avatar, ACTIONS, CHANGES, INPUTS, labKey, getLab, destroyLab, labMount, afterRender };
boot();
})();
