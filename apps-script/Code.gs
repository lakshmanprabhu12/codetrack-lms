/**
 * CodeTrack API — Google Apps Script + Google Sheets backend.
 * The front end is a static site (docs/ in the GitHub repo, served by GitHub Pages)
 * that calls this web app with fetch().
 *
 *  1. Paste Code.gs and Seed.gs into one Apps Script project.
 *  2. Select the function "setup" in the toolbar and click Run (authorize when asked).
 *  3. Deploy > New deployment > Web app  (Execute as: Me · Who has access: Anyone).
 *  4. Put the /exec URL in docs/config.js, open the GitHub Pages site and sign in as
 *     admin / ChangeMe@123 — then change the password.
 */

const APP = {
  NAME: 'CodeTrack',
  TZ: 'Asia/Kolkata',
  SESSION_DAYS: 7,
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'ChangeMe@123',       // first-login password; change it in the app
  MAX_UPLOAD_CHARS: 500000,              // ~500 KB per submitted file
  HASH_ROUNDS: 50
};

const POINTS = {
  DAY_COMPLETE: 5,     // all 3 checklist items of a day ticked
  SUBMIT_ON_TIME: 10,
  SUBMIT_LATE: 5,
  APPROVED: 10,
  PRESENT: 5,
  LATE: 3,
  REFLECTION: 2,
  DOUBT: 1             // max once per day
};

const CHECK_ITEMS = ['scrum', 'paper', 'code'];

const SCHEMA = {
  Users: ['id', 'name', 'username', 'passwordHash', 'salt', 'role', 'track', 'requestedTrack', 'trackStatus', 'active', 'createdAt', 'lastLogin'],
  Sessions: ['token', 'userId', 'createdAt', 'expiresAt'],
  Settings: ['key', 'value'],
  Tracks: ['id', 'name', 'description', 'icon', 'order'],
  Weeks: ['week', 'title', 'published'],
  Days: ['id', 'day', 'week', 'date', 'track', 'title', 'scrum', 'paper', 'code', 'outcomes'],
  Assignments: ['id', 'dayId', 'track', 'title', 'description', 'due', 'active', 'createdAt', 'mode', 'tests', 'examStart', 'examEnd', 'maxSwitches'],
  Submissions: ['id', 'assignmentId', 'userId', 'type', 'fileName', 'fileId', 'fileUrl', 'code', 'submittedAt', 'late', 'status', 'comment', 'reviewedAt', 'integrity', 'testScore', 'testResults'],
  Progress: ['userId', 'dayId', 'item', 'doneAt'],
  Attendance: ['id', 'date', 'userId', 'status', 'checkInAt', 'verifiedAt'],
  Announcements: ['id', 'title', 'body', 'pinned', 'createdAt'],
  Doubts: ['id', 'userId', 'dayId', 'question', 'answer', 'shared', 'status', 'askedAt', 'answeredAt'],
  Reflections: ['id', 'userId', 'date', 'dayId', 'learned', 'stuck', 'confidence', 'createdAt', 'updatedAt'],
  Points: ['id', 'userId', 'key', 'points', 'reason', 'createdAt'],
  Exams: ['id', 'title', 'description', 'durationMin', 'sections', 'active', 'createdAt', 'updatedAt', 'maxExits'],
  ProctorFlags: ['id', 'attemptId', 'examId', 'userId', 'type', 'label', 'section', 'at', 'fileId', 'fileUrl'],
  ExamAttempts: ['id', 'examId', 'userId', 'startedAt', 'section', 'answers', 'testResults', 'sectionLog', 'submittedAt', 'status', 'autoScore', 'marks', 'total', 'integrity', 'comment']
};

const DEFAULT_SETTINGS = {
  courseTitle: 'Python Basics Internship',
  checkinStart: '08:45',
  checkinEnd: '11:00',
  lateAfter: '09:10',
  trackSelectionOpen: 'FALSE'
};

/* =====================================================================
 * Web entry points (JSON API)
 * ===================================================================*/

/** Health check: open the /exec URL in a browser to confirm the API is live. */
function doGet() {
  let ready = false;
  try { ready = !!PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); } catch (e) { ready = false; }
  return json_({ ok: true, app: APP.NAME, api: 'v1', ready: ready, message: ready ? 'CodeTrack API is running.' : 'Run setup() in the script editor first.' });
}

/**
 * The front end POSTs {action, token, payload} as a text/plain body (a "simple" CORS request,
 * so browsers send no preflight). The JSON response comes back with CORS headers from Google.
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'Bad request.' });
  }
  return ContentService.createTextOutput(api(body.action, body.token, body.payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Single RPC endpoint used by the front end: google.script.run.api(action, token, payload) */
function api(action, token, payload) {
  try {
    const route = ROUTES[action];
    if (!route) throw new Error('Unknown action: ' + action);
    payload = payload || {};
    let user = null;
    if (!route.public) {
      user = authenticate_(token);
      if (route.admin && user.role !== 'admin') throw new Error('Only the instructor can do that.');
      if (route.student && user.role !== 'student') throw new Error('This is only available to students.');
    }
    let data;
    if (route.write) {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      try {
        const msg = route.fn(user, payload);
        if (route.public) {
          data = msg;                                   // login returns its own shape
        } else {
          const fresh = rows_('Users').find(function (u) { return u.id === user.id; }) || user;
          data = { msg: msg || '', state: route.noState ? null : stateFor_(fresh) };
        }
      } finally {
        lock.releaseLock();
      }
    } else {
      data = route.fn(user, payload);
    }
    return JSON.stringify({ ok: true, data: data });
  } catch (err) {
    return JSON.stringify({ ok: false, error: String((err && err.message) || err) });
  }
}

const ROUTES = {
  // public
  login: { fn: login_, public: true, write: true },
  // everyone signed in
  bootstrap: { fn: function (u) { return stateFor_(u); } },
  materials: { fn: materials_ },
  getSubmission: { fn: getSubmission_ },
  logout: { fn: logout_, write: true, noState: true },
  changePassword: { fn: changePassword_, write: true },
  // students
  toggleProgress: { fn: toggleProgress_, write: true, student: true },
  checkIn: { fn: checkIn_, write: true, student: true },
  submitAssignment: { fn: submitAssignment_, write: true, student: true },
  askDoubt: { fn: askDoubt_, write: true, student: true },
  saveReflection: { fn: saveReflection_, write: true, student: true },
  requestTrack: { fn: requestTrack_, write: true, student: true },
  // instructor
  exportSyllabus: { fn: exportSyllabus_, admin: true },
  saveStudent: { fn: saveStudent_, write: true, admin: true },
  bulkAddStudents: { fn: bulkAddStudents_, write: true, admin: true },
  setTrack: { fn: setTrack_, write: true, admin: true },
  awardBonus: { fn: awardBonus_, write: true, admin: true },
  markAttendance: { fn: markAttendance_, write: true, admin: true },
  bulkAttendance: { fn: bulkAttendance_, write: true, admin: true },
  reviewSubmission: { fn: reviewSubmission_, write: true, admin: true },
  saveWeek: { fn: saveWeek_, write: true, admin: true },
  saveDay: { fn: saveDay_, write: true, admin: true },
  deleteDay: { fn: deleteDay_, write: true, admin: true },
  saveAssignment: { fn: saveAssignment_, write: true, admin: true },
  deleteAssignment: { fn: deleteAssignment_, write: true, admin: true },
  importSyllabus: { fn: function (u, p) { return importSyllabus_(p.json); }, write: true, admin: true },
  saveAnnouncement: { fn: saveAnnouncement_, write: true, admin: true },
  deleteAnnouncement: { fn: deleteAnnouncement_, write: true, admin: true },
  answerDoubt: { fn: answerDoubt_, write: true, admin: true },
  deleteDoubt: { fn: deleteDoubt_, write: true, admin: true },
  saveSettings: { fn: saveSettings_, write: true, admin: true },
  // exams
  startExam: { fn: startExam_, write: true, student: true },
  submitExamSection: { fn: submitExamSection_, write: true, student: true },
  getExamAttempt: { fn: getExamAttempt_, admin: true },
  gradeExamAttempt: { fn: gradeExamAttempt_, write: true, admin: true },
  resetExamAttempt: { fn: resetExamAttempt_, write: true, admin: true },
  saveExam: { fn: saveExam_, write: true, admin: true },
  proctorFlag: { fn: proctorFlag_, write: true, student: true, noState: true },
  exportExam: { fn: function (u, p) { const e = byId_('Exams', p.id); if (!e) throw new Error('Exam not found.'); return JSON.stringify(examObj_(e), null, 1); }, admin: true }
};

/* =====================================================================
 * Setup (run once from the script editor)
 * ===================================================================*/

function setup() {
  if (typeof getSeedSyllabus !== 'function') {
    throw new Error('Seed.gs is missing. Click + > Script, name it "Seed", paste the contents of apps-script/Seed.gs, save, then run setup() again.');
  }
  const props = PropertiesService.getScriptProperties();

  // 1. Spreadsheet: use the bound sheet if any, else the stored one, else create a new one
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  const storedId = props.getProperty('SPREADSHEET_ID');
  if (!ss && storedId) { try { ss = SpreadsheetApp.openById(storedId); } catch (e) { ss = null; } }
  if (!ss) ss = SpreadsheetApp.create(APP.NAME + ' Database');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  MEM.ss = ss;

  Object.keys(SCHEMA).forEach(function (name) { ensureSheet_(ss, name, SCHEMA[name]); });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);

  // 2. Drive folders
  const root = getOrCreateFolder_('ROOT_FOLDER_ID', APP.NAME, null);
  const materials = getOrCreateFolder_('MATERIALS_FOLDER_ID', 'Study Materials', root);
  getOrCreateFolder_('SUBMISSIONS_FOLDER_ID', 'Student Submissions', root);
  try {
    materials.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Could not share the Study Materials folder automatically: ' + e.message);
  }
  try { DriveApp.getFileById(ss.getId()).moveTo(root); } catch (e) { /* already there or not allowed */ }

  // 3. Settings
  const current = {};
  rows_('Settings').forEach(function (r) { current[r.key] = r.value; });
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (!(k in current)) insert_('Settings', { key: k, value: DEFAULT_SETTINGS[k] });
  });

  // 4. Syllabus seed (only if empty)
  if (!rows_('Days').length) importSyllabus_(getSeedSyllabus());

  // 5. Material sub-folders for every week and track
  rows_('Weeks').forEach(function (w) { childFolder_(materials, 'Week ' + w.week); });
  rows_('Tracks').forEach(function (t) { childFolder_(materials, 'Track - ' + t.name); });
  childFolder_(materials, 'Common');

  // 6. Instructor account
  if (!rows_('Users').some(function (u) { return u.role === 'admin'; })) {
    createUser_({ name: 'Instructor', username: APP.ADMIN_USERNAME, password: APP.ADMIN_PASSWORD, role: 'admin' });
  }

  Logger.log('CodeTrack is ready.');
  Logger.log('Database: ' + ss.getUrl());
  Logger.log('Drive folder: ' + root.getUrl());
  Logger.log('Next: Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone), then put the /exec URL in docs/config.js.');
  Logger.log('Sign in with  ' + APP.ADMIN_USERNAME + ' / ' + APP.ADMIN_PASSWORD + '  and change the password.');
}

/** Run from the editor if you ever lock yourself out of the admin account. */
function resetAdminPassword() {
  const admin = rows_('Users').find(function (u) { return u.role === 'admin'; });
  if (!admin) throw new Error('No admin found. Run setup() first.');
  const salt = Utilities.getUuid();
  update_('Users', admin, { passwordHash: hash_(APP.ADMIN_PASSWORD, salt), salt: salt, active: 'TRUE' });
  Logger.log('Admin "' + admin.username + '" password reset to: ' + APP.ADMIN_PASSWORD);
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastCol = sh.getLastColumn();
  const existing = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  if (!existing.filter(String).length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const missing = headers.filter(function (h) { return existing.indexOf(h) < 0; });
    if (missing.length) sh.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
  }
  const cols = Math.max(sh.getLastColumn(), headers.length);
  sh.getRange(1, 1, sh.getMaxRows(), cols).setNumberFormat('@');
  sh.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#e8f0fe');
  sh.setFrozenRows(1);
  return sh;
}

function getOrCreateFolder_(prop, name, parent) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(prop);
  if (id) {
    try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { /* recreate */ }
  }
  const folder = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
  props.setProperty(prop, folder.getId());
  return folder;
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function folderById_(prop) {
  const id = PropertiesService.getScriptProperties().getProperty(prop);
  if (!id) throw new Error('Drive folders are missing. Run setup() again from the script editor.');
  return DriveApp.getFolderById(id);
}

/* =====================================================================
 * Tiny sheet "database"
 * ===================================================================*/

const MEM = {};

function ss_() {
  if (MEM.ss) return MEM.ss;
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('CodeTrack is not set up yet. Open the script editor and run setup().');
  MEM.ss = SpreadsheetApp.openById(id);
  return MEM.ss;
}

function sh_(name) {
  let s = ss_().getSheetByName(name);
  if (!s && SCHEMA[name]) s = ensureSheet_(ss_(), name, SCHEMA[name]);   // tables added in later versions
  if (!s) throw new Error('Missing sheet "' + name + '". Run setup() again.');
  return s;
}

function headers_(name) {
  const key = 'h_' + name;
  if (MEM[key]) return MEM[key];
  const s = sh_(name);
  const lastCol = s.getLastColumn();
  let hs = lastCol ? s.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : SCHEMA[name].slice();
  while (hs.length && !hs[hs.length - 1]) hs.pop();
  // Columns added in newer versions are appended to the sheet automatically (no need to re-run setup).
  const missing = lastCol ? (SCHEMA[name] || []).filter(function (h) { return hs.indexOf(h) < 0; }) : [];
  if (missing.length) {
    s.getRange(1, hs.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    s.getRange(1, hs.length + 1, s.getMaxRows(), missing.length).setNumberFormat('@');
    hs = hs.concat(missing);
  }
  MEM[key] = hs;
  return MEM[key];
}

function rows_(name) {
  const key = 't_' + name;
  if (MEM[key]) return MEM[key];
  const s = sh_(name);
  const hs = headers_(name);
  const lastRow = s.getLastRow();
  const out = [];
  if (lastRow > 1) {
    const values = s.getRange(2, 1, lastRow - 1, hs.length).getValues();
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      if (!r.some(function (c) { return c !== '' && c !== null; })) continue;
      const o = { _row: i + 2 };
      for (let j = 0; j < hs.length; j++) if (hs[j]) o[hs[j]] = norm_(r[j]);
      out.push(o);
    }
  }
  MEM[key] = out;
  return out;
}

function dirty_(name) { delete MEM['t_' + name]; }

function insert_(name, obj) { insertMany_(name, [obj]); return obj; }

function insertMany_(name, objs) {
  if (!objs.length) return;
  const s = sh_(name);
  const hs = headers_(name);
  const start = s.getLastRow() + 1;
  const need = start + objs.length - 1;
  if (need > s.getMaxRows()) s.insertRowsAfter(s.getMaxRows(), need - s.getMaxRows() + 50);
  const range = s.getRange(start, 1, objs.length, hs.length);
  range.setNumberFormat('@');
  range.setValues(objs.map(function (o) { return hs.map(function (h) { return cell_(o[h]); }); }));
  dirty_(name);
}

function update_(name, row, patch) {
  const hs = headers_(name);
  const merged = Object.assign({}, row, patch);
  const range = sh_(name).getRange(row._row, 1, 1, hs.length);
  range.setNumberFormat('@');
  range.setValues([hs.map(function (h) { return cell_(merged[h]); })]);
  dirty_(name);
  return merged;
}

function remove_(name, predicate) {
  const s = sh_(name);
  const victims = rows_(name).filter(predicate).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; });
  if (!victims.length) return 0;
  if (s.getMaxRows() - victims.length < 2) s.insertRowsAfter(s.getMaxRows(), 20);
  victims.forEach(function (r) { s.deleteRow(r); });
  dirty_(name);
  return victims.length;
}

function clearTable_(name) {
  const s = sh_(name);
  const last = s.getLastRow();
  if (last > 1) s.getRange(2, 1, last - 1, s.getMaxColumns()).clearContent();
  dirty_(name);
}

function cell_(v) {
  if (v === null || v === undefined) return '';
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  let s = String(v);
  if (s.length > 49000) s = s.slice(0, 49000) + '\n# … truncated (full file is in Drive)';
  if (/^[=+\-@]/.test(s)) s = "'" + s;          // never let user text become a formula
  return s;
}

function norm_(v) {
  if (v instanceof Date) {
    const hasTime = v.getHours() || v.getMinutes() || v.getSeconds();
    return Utilities.formatDate(v, APP.TZ, hasTime ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
  }
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

/* =====================================================================
 * Small helpers
 * ===================================================================*/

function uid_(prefix) { return (prefix || '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12); }
function now_() { return Utilities.formatDate(new Date(), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function today_() { return Utilities.formatDate(new Date(), APP.TZ, 'yyyy-MM-dd'); }
function hhmm_() { return Utilities.formatDate(new Date(), APP.TZ, 'HH:mm'); }
function bool_(v) { return v === true || /^(true|yes|1)$/i.test(String(v).trim()); }
function num_(v) { const n = Number(v); return isNaN(n) ? 0 : n; }
function clean_(v, max) { return String(v === null || v === undefined ? '' : v).trim().slice(0, max || 5000); }
function pad2_(n) { return ('0' + n).slice(-2); }
function isDate_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s)); }
function isTime_(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s)); }
function byId_(name, id) { return rows_(name).find(function (r) { return r.id === id; }); }
function strip_(o) { const c = Object.assign({}, o); delete c._row; return c; }

function settings_() {
  const o = Object.assign({}, DEFAULT_SETTINGS);
  rows_('Settings').forEach(function (r) { o[r.key] = r.value; });
  return o;
}

function setSetting_(key, value) {
  const r = rows_('Settings').find(function (x) { return x.key === key; });
  if (r) update_('Settings', r, { value: value });
  else insert_('Settings', { key: key, value: value });
}

function normDue_(s) {
  s = clean_(s, 30);
  if (!s) return '';
  if (isDate_(s)) return s + 'T23:59';
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(s);
  if (!m) throw new Error('Due date must look like 2026-11-20T23:59');
  return m[1] + 'T' + m[2];
}

/* =====================================================================
 * Auth
 * ===================================================================*/

function hash_(password, salt) {
  let h = salt + '|' + password;
  for (let i = 0; i < APP.HASH_ROUNDS; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + '|' + salt, Utilities.Charset.UTF_8);
    h = bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  }
  return h;
}

function validatePassword_(p) {
  if (!p || String(p).length < 4) throw new Error('Password must be at least 4 characters.');
}

function slugUser_(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'student';
}

function createUser_(u) {
  let username = String(u.username || '').trim().toLowerCase();
  const users = rows_('Users');
  if (!username) {                                   // auto-generate from the name
    const base = slugUser_(u.name);
    username = base;
    let i = 2;
    while (users.some(function (x) { return x.username === username; })) username = base + i++;
  }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username "' + username + '" must be 3-30 characters: letters, numbers, dot, dash or underscore.');
  if (users.some(function (x) { return x.username === username; })) throw new Error('Username "' + username + '" is already taken.');
  validatePassword_(u.password);
  const salt = Utilities.getUuid();
  const row = {
    id: uid_('u'), name: clean_(u.name, 80) || username, username: username,
    passwordHash: hash_(String(u.password), salt), salt: salt, role: u.role || 'student',
    track: u.track || '', requestedTrack: '', trackStatus: u.track ? 'approved' : '',
    active: 'TRUE', createdAt: now_(), lastLogin: ''
  };
  insert_('Users', row);
  return row;
}

function publicUser_(u) {
  return {
    id: u.id, name: u.name, username: u.username, role: u.role, track: u.track,
    requestedTrack: u.requestedTrack, trackStatus: u.trackStatus, active: bool_(u.active),
    createdAt: u.createdAt, lastLogin: u.lastLogin
  };
}

function login_(_, p) {
  const id = String(p.username || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const pw = String(p.password || '');
  if (!id || !pw) throw new Error('Enter your name and password.');
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + id.replace(/[^a-z0-9]/g, '_').slice(0, 100);
  const fails = num_(cache.get(failKey));
  if (fails >= 8) throw new Error('Too many wrong attempts. Wait 10 minutes and try again.');

  const users = rows_('Users').filter(function (u) { return bool_(u.active); });
  let matches = users.filter(function (u) { return u.username === id; });
  if (!matches.length) {
    matches = users.filter(function (u) { return String(u.name).trim().toLowerCase().replace(/\s+/g, ' ') === id; });
  }
  const user = matches.find(function (u) { return hash_(pw, u.salt) === u.passwordHash; });
  if (!user) {
    cache.put(failKey, String(fails + 1), 600);
    throw new Error('Wrong name or password.');
  }
  cache.remove(failKey);

  const now = now_();
  remove_('Sessions', function (s) { return s.expiresAt < now; });
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Utilities.formatDate(new Date(Date.now() + APP.SESSION_DAYS * 864e5), APP.TZ, "yyyy-MM-dd'T'HH:mm:ss");
  insert_('Sessions', { token: token, userId: user.id, createdAt: now, expiresAt: exp });
  const fresh = update_('Users', user, { lastLogin: now });
  return { token: token, state: stateFor_(fresh) };
}

function authenticate_(token) {
  if (!token) throw new Error('SESSION_EXPIRED');
  const cache = CacheService.getScriptCache();
  let userId = cache.get('s_' + token);
  if (!userId) {
    const s = rows_('Sessions').find(function (x) { return x.token === token; });
    if (!s || s.expiresAt < now_()) throw new Error('SESSION_EXPIRED');
    userId = s.userId;
    cache.put('s_' + token, userId, 600);
  }
  const user = rows_('Users').find(function (u) { return u.id === userId; });
  if (!user || !bool_(user.active)) throw new Error('SESSION_EXPIRED');
  user._token = token;
  return user;
}

function logout_(u) {
  CacheService.getScriptCache().remove('s_' + u._token);
  remove_('Sessions', function (s) { return s.token === u._token; });
  return 'Signed out.';
}

function changePassword_(u, p) {
  if (hash_(String(p.current || ''), u.salt) !== u.passwordHash) throw new Error('Your current password is not correct.');
  validatePassword_(p.next);
  const salt = Utilities.getUuid();
  update_('Users', u, { passwordHash: hash_(String(p.next), salt), salt: salt });
  remove_('Sessions', function (s) { return s.userId === u.id && s.token !== u._token; });
  return 'Password changed.';
}

/* =====================================================================
 * Points
 * ===================================================================*/

function award_(userId, key, pts, reason) {
  if (rows_('Points').some(function (p) { return p.userId === userId && p.key === key; })) return false;
  insert_('Points', { id: uid_('p'), userId: userId, key: key, points: pts, reason: reason, createdAt: now_() });
  return true;
}

function revoke_(userId, key) {
  return remove_('Points', function (p) { return p.userId === userId && p.key === key; });
}

function pointsOf_(userId) {
  return rows_('Points').filter(function (p) { return p.userId === userId; })
    .reduce(function (s, p) { return s + num_(p.points); }, 0);
}

/* =====================================================================
 * Visibility + stats
 * ===================================================================*/

function myTrack_(u) { return u.trackStatus === 'approved' ? u.track : ''; }

function sortDays_(a, b) {
  return num_(a.day) - num_(b.day) || (a.track === 'common' ? -1 : b.track === 'common' ? 1 : String(a.track).localeCompare(b.track));
}

function publishedWeeks_() {
  const set = {};
  rows_('Weeks').forEach(function (w) { if (bool_(w.published)) set[String(num_(w.week))] = true; });
  return set;
}

function visibleDays_(u) {
  const pub = publishedWeeks_();
  const t = myTrack_(u);
  return rows_('Days').filter(function (d) {
    return pub[String(num_(d.week))] && (d.track === 'common' || (t && d.track === t));
  }).sort(sortDays_);
}

function visibleAssignments_(u, dayIds) {
  const t = myTrack_(u);
  return rows_('Assignments').filter(function (a) {
    if (!bool_(a.active)) return false;
    if (a.dayId) return !!dayIds[a.dayId];
    return a.track === 'common' || (t && a.track === t);
  });
}

function classDates_() {
  const set = {};
  rows_('Days').forEach(function (d) { if (isDate_(d.date)) set[d.date] = true; });
  return Object.keys(set).sort();
}

function statsFor_(u) {
  const t = myTrack_(u);
  const days = rows_('Days');
  const common = days.filter(function (d) { return d.track === 'common'; }).length;
  const perTrack = {};
  days.forEach(function (d) { if (d.track !== 'common') perTrack[d.track] = (perTrack[d.track] || 0) + 1; });
  const trackDays = t ? (perTrack[t] || 0) : Object.keys(perTrack).reduce(function (m, k) { return Math.max(m, perTrack[k]); }, 0);
  const totalDays = common + trackDays;

  const pathIds = {};
  days.forEach(function (d) { if (d.track === 'common' || (t && d.track === t)) pathIds[d.id] = true; });
  const done = rows_('Progress').filter(function (p) { return p.userId === u.id && pathIds[p.dayId]; }).length;
  const progressPct = totalDays ? Math.min(100, Math.round(done / (totalDays * CHECK_ITEMS.length) * 100)) : 0;

  const today = today_();
  const att = rows_('Attendance').filter(function (a) { return a.userId === u.id; });
  const byDate = {};
  att.forEach(function (a) { byDate[a.date] = a.status; });
  const past = classDates_().filter(function (d) { return d < today || (d === today && byDate[d] && byDate[d] !== 'pending'); });
  const attended = past.filter(function (d) { return byDate[d] === 'present' || byDate[d] === 'late'; }).length;
  const attendancePct = past.length ? Math.round(attended / past.length * 100) : null;

  // streak: consecutive class days attended (pending check-ins count), today optional
  let streak = 0;
  const upto = classDates_().filter(function (d) { return d <= today; }).reverse();
  for (let i = 0; i < upto.length; i++) {
    const st = byDate[upto[i]];
    if (st === 'present' || st === 'late' || st === 'pending') streak++;
    else if (upto[i] === today && !st) continue;
    else break;
  }

  const pub = publishedWeeks_();
  const visIds = {};
  days.forEach(function (d) { if (pathIds[d.id] && pub[String(num_(d.week))]) visIds[d.id] = true; });
  const assigned = visibleAssignments_(u, visIds);
  const subs = rows_('Submissions').filter(function (s) { return s.userId === u.id; });
  const approved = assigned.filter(function (a) { return subs.some(function (s) { return s.assignmentId === a.id && s.status === 'approved'; }); }).length;
  const submitted = assigned.filter(function (a) { return subs.some(function (s) { return s.assignmentId === a.id; }); }).length;

  return {
    progressPct: progressPct, itemsDone: done, totalItems: totalDays * CHECK_ITEMS.length,
    attendancePct: attendancePct, attended: attended, classDays: past.length, streak: streak,
    points: pointsOf_(u.id), assigned: assigned.length, submitted: submitted, approved: approved
  };
}

function leaderboard_(meId) {
  const list = rows_('Users').filter(function (u) { return u.role === 'student' && bool_(u.active); })
    .map(function (u) { return { id: u.id, name: u.name, points: pointsOf_(u.id) }; })
    .sort(function (a, b) { return b.points - a.points || String(a.name).localeCompare(b.name); });
  let rank = 0, last = null;
  list.forEach(function (x, i) { if (x.points !== last) { rank = i + 1; last = x.points; } x.rank = rank; });
  const me = list.find(function (x) { return x.id === meId; });
  return {
    top: list.slice(0, 3).map(function (x) { return { name: x.name, points: x.points, rank: x.rank, me: x.id === meId }; }),
    myRank: me ? me.rank : null, myPoints: me ? me.points : 0, total: list.length,
    full: list
  };
}

/* =====================================================================
 * State sent to the browser
 * ===================================================================*/

function stateFor_(u) { return u.role === 'admin' ? adminState_(u) : studentState_(u); }

function baseState_() {
  const s = settings_();
  return {
    today: today_(), now: hhmm_(), serverNow: now_(),
    settings: {
      courseTitle: s.courseTitle, checkinStart: s.checkinStart, checkinEnd: s.checkinEnd,
      lateAfter: s.lateAfter, trackSelectionOpen: bool_(s.trackSelectionOpen)
    },
    tracks: rows_('Tracks').map(strip_).sort(function (a, b) { return num_(a.order) - num_(b.order); }),
    announcements: rows_('Announcements').map(strip_).sort(function (a, b) {
      return (bool_(b.pinned) - bool_(a.pinned)) || String(b.createdAt).localeCompare(a.createdAt);
    })
  };
}

function studentState_(u) {
  const st = baseState_();
  const today = st.today;
  const pub = publishedWeeks_();
  const t = myTrack_(u);
  const days = visibleDays_(u).map(strip_);
  const dayIds = {};
  days.forEach(function (d) { dayIds[d.id] = true; });

  const subs = rows_('Submissions').filter(function (s) { return s.userId === u.id; })
    .map(function (s) { const c = strip_(s); delete c.code; delete c.fileUrl; delete c.fileId; return studentSubView_(c); })
    .sort(function (a, b) { return String(b.submittedAt).localeCompare(a.submittedAt); });

  const att = rows_('Attendance').filter(function (a) { return a.userId === u.id; }).map(strip_)
    .sort(function (a, b) { return String(b.date).localeCompare(a.date); });
  const todayAtt = att.find(function (a) { return a.date === today; }) || null;
  const classToday = rows_('Days').some(function (d) { return d.date === today; });
  const s = st.settings;

  const users = {};
  rows_('Users').forEach(function (x) { users[x.id] = x.name; });
  const doubts = rows_('Doubts').filter(function (d) { return d.userId === u.id || (bool_(d.shared) && d.answer); })
    .map(function (d) {
      const c = strip_(d);
      c.mine = d.userId === u.id;
      c.askedBy = c.mine ? 'You' : 'A classmate';
      delete c.userId;
      return c;
    })
    .sort(function (a, b) { return String(b.askedAt).localeCompare(a.askedAt); });

  const lb = leaderboard_(u.id);
  delete lb.full;

  return Object.assign(st, {
    role: 'student',
    user: publicUser_(u),
    weeks: rows_('Weeks').filter(function (w) { return pub[String(num_(w.week))]; }).map(strip_)
      .sort(function (a, b) { return num_(a.week) - num_(b.week); }),
    days: days,
    lockedTrackContent: !t && rows_('Days').some(function (d) { return pub[String(num_(d.week))] && d.track !== 'common'; }),
    progress: rows_('Progress').filter(function (p) { return p.userId === u.id; }).map(function (p) { return p.dayId + '|' + p.item; }),
    assignments: visibleAssignments_(u, dayIds).map(studentAssignment_).sort(function (a, b) { return String(a.due).localeCompare(b.due); }),
    submissions: subs,
    attendance: att,
    todayAttendance: todayAtt,
    classToday: classToday,
    checkInOpen: classToday && !todayAtt && st.now >= s.checkinStart && st.now <= s.checkinEnd,
    doubts: doubts,
    reflections: rows_('Reflections').filter(function (r) { return r.userId === u.id; }).map(strip_)
      .sort(function (a, b) { return String(b.date).localeCompare(a.date); }),
    pointsLog: rows_('Points').filter(function (p) { return p.userId === u.id; }).map(strip_)
      .sort(function (a, b) { return String(b.createdAt).localeCompare(a.createdAt); }),
    stats: statsFor_(u),
    leaderboard: lb,
    exams: studentExams_(u)
  });
}

function adminState_(u) {
  const st = baseState_();
  const users = rows_('Users');
  const nameOf = {};
  users.forEach(function (x) { nameOf[x.id] = x.name; });
  const lb = leaderboard_(null);
  const rankOf = {};
  lb.full.forEach(function (x) { rankOf[x.id] = x.rank; });

  const students = users.filter(function (x) { return x.role === 'student'; }).map(function (x) {
    const p = publicUser_(x);
    p.stats = statsFor_(x);
    p.rank = rankOf[x.id] || null;
    return p;
  }).sort(function (a, b) { return String(a.name).localeCompare(b.name); });

  const assignments = rows_('Assignments').map(strip_);
  const titleOf = {};
  assignments.forEach(function (a) { titleOf[a.id] = a.title; });

  const subs = rows_('Submissions').map(function (s) {
    const c = strip_(s);
    c.preview = String(s.code || '').slice(0, 160);
    delete c.code;
    const integ = parseJson_(s.integrity, null);
    c.flags = integ && integ.flags ? integ.flags : [];
    delete c.integrity; delete c.testResults;
    c.studentName = nameOf[s.userId] || '(removed)';
    c.assignmentTitle = titleOf[s.assignmentId] || '(deleted assignment)';
    return c;
  }).sort(function (a, b) { return String(b.submittedAt).localeCompare(a.submittedAt); });

  const withName = function (r) { const c = strip_(r); c.studentName = nameOf[r.userId] || '(removed)'; return c; };
  const props = PropertiesService.getScriptProperties();
  const folderUrl = function (k) { const id = props.getProperty(k); return id ? 'https://drive.google.com/drive/folders/' + id : ''; };
  const today = st.today;
  const attendance = rows_('Attendance').map(strip_);

  return Object.assign(st, {
    role: 'admin',
    user: publicUser_(u),
    usingDefaultPassword: hash_(APP.ADMIN_PASSWORD, u.salt) === u.passwordHash,
    students: students,
    weeks: rows_('Weeks').map(strip_).sort(function (a, b) { return num_(a.week) - num_(b.week); }),
    days: rows_('Days').map(strip_).sort(sortDays_),
    assignments: assignments.sort(function (a, b) { return String(a.due).localeCompare(b.due); }),
    submissions: subs,
    attendance: attendance,
    doubts: rows_('Doubts').map(withName).sort(function (a, b) { return String(b.askedAt).localeCompare(a.askedAt); }),
    reflections: rows_('Reflections').map(withName).sort(function (a, b) { return String(b.date).localeCompare(a.date) || String(a.studentName).localeCompare(b.studentName); }),
    classDates: classDates_(),
    exams: rows_('Exams').map(examObj_),
    examAttempts: rows_('ExamAttempts').map(function (x) { return attemptSummary_(x, nameOf); })
      .sort(function (a, b) { return String(b.startedAt).localeCompare(a.startedAt); }),
    counts: {
      pendingCheckins: attendance.filter(function (a) { return a.date === today && a.status === 'pending'; }).length,
      toReview: subs.filter(function (s) { return s.status === 'submitted'; }).length,
      openDoubts: rows_('Doubts').filter(function (d) { return !d.answer; }).length,
      trackRequests: students.filter(function (s) { return s.trackStatus === 'requested' && s.active; }).length
    },
    links: {
      root: folderUrl('ROOT_FOLDER_ID'),
      materials: folderUrl('MATERIALS_FOLDER_ID'),
      submissions: folderUrl('SUBMISSIONS_FOLDER_ID'),
      spreadsheet: ss_().getUrl()
    }
  });
}

/* =====================================================================
 * Student actions
 * ===================================================================*/

function toggleProgress_(u, p) {
  if (CHECK_ITEMS.indexOf(p.item) < 0) throw new Error('Unknown checklist item.');
  const day = visibleDays_(u).find(function (d) { return d.id === p.dayId; });
  if (!day) throw new Error('That day is not available.');
  const match = function (x) { return x.userId === u.id && x.dayId === p.dayId && x.item === p.item; };
  const has = rows_('Progress').some(match);
  if (p.done && !has) insert_('Progress', { userId: u.id, dayId: p.dayId, item: p.item, doneAt: now_() });
  if (!p.done && has) remove_('Progress', match);
  const count = rows_('Progress').filter(function (x) { return x.userId === u.id && x.dayId === p.dayId; }).length;
  if (count >= CHECK_ITEMS.length) {
    if (award_(u.id, 'day:' + p.dayId, POINTS.DAY_COMPLETE, 'Completed Day ' + day.day + ' checklist')) {
      return 'Day ' + day.day + ' complete! +' + POINTS.DAY_COMPLETE + ' points';
    }
  } else {
    revoke_(u.id, 'day:' + p.dayId);
  }
  return '';
}

function checkIn_(u) {
  const s = settings_();
  const today = today_();
  const t = hhmm_();
  if (!rows_('Days').some(function (d) { return d.date === today; })) throw new Error('There is no class scheduled today.');
  if (t < s.checkinStart || t > s.checkinEnd) throw new Error('Check-in is open from ' + s.checkinStart + ' to ' + s.checkinEnd + '.');
  if (rows_('Attendance').some(function (a) { return a.userId === u.id && a.date === today; })) throw new Error('You have already checked in today.');
  insert_('Attendance', { id: uid_('t'), date: today, userId: u.id, status: 'pending', checkInAt: t, verifiedAt: '' });
  return 'Checked in at ' + t + '. Your instructor will verify it.';
}


/* =====================================================================
 * Sectioned exams (MCQ, written answers, coding) taken one section at a time
 * ===================================================================*/

const EXAM = { GRACE_MIN: 3, TYPES: ['mcq', 'text', 'code'] };

function examObj_(e) {
  return {
    id: e.id, title: e.title, description: e.description, durationMin: num_(e.durationMin) || 120,
    maxExits: e.maxExits === '' || e.maxExits === undefined ? 5 : num_(e.maxExits), active: bool_(e.active), sections: parseJson_(e.sections, []), createdAt: e.createdAt, updatedAt: e.updatedAt
  };
}
function examQuestions_(ex) {
  const out = [];
  ex.sections.forEach(function (s) { (s.questions || []).forEach(function (q) { q._section = s.id; out.push(q); }); });
  return out;
}
function examTotal_(ex) {
  return ex.sections.reduce(function (t, s) {
    const ms = (s.questions || []).map(function (q) { return num_(q.marks); }).sort(function (a, b) { return b - a; });
    return t + (s.pick ? ms.slice(0, s.pick) : ms).reduce(function (a, b) { return a + b; }, 0);
  }, 0);
}
function myAttempt_(u, examId) {
  return rows_('ExamAttempts').find(function (x) { return x.userId === u.id && x.examId === examId; });
}
function examDeadline_(ex, at) { return addMin_(String(at.startedAt).slice(0, 16), ex.durationMin); }

/* What a student may see: no answers, keys or expected outputs. */
function studentExams_(u) {
  return rows_('Exams').filter(function (e) { return bool_(e.active); }).map(function (e) {
    const ex = examObj_(e);
    const at = myAttempt_(u, ex.id);
    return {
      id: ex.id, title: ex.title, description: ex.description, durationMin: ex.durationMin, maxExits: ex.maxExits, total: examTotal_(ex),
      sections: ex.sections.map(function (s) {
        return {
          id: s.id, title: s.title, instructions: s.instructions, pick: s.pick || 0,
          marks: (s.questions || []).reduce(function (t, q) { return t + num_(q.marks); }, 0),
          questions: (s.questions || []).map(function (q) {
            const c = { id: q.id, type: q.type, text: q.text, marks: num_(q.marks) };
            if (q.title) c.title = q.title;
            if (q.code) c.code = q.code;
            if (q.mono) c.mono = true;
            if (q.type === 'mcq') c.options = q.options;
            if (q.type === 'code') { c.starter = q.starter || ''; c.tests = (q.tests || []).map(function (t) { return { input: t.input, hidden: true }; }); }
            return c;
          })
        };
      }),
      attempt: at ? {
        id: at.id, status: at.status, section: num_(at.section), startedAt: at.startedAt, submittedAt: at.submittedAt,
        deadline: examDeadline_(ex, at), sectionLog: parseJson_(at.sectionLog, {})
      } : null
    };
  });
}

function attemptSummary_(x, nameOf) {
  const integ = parseJson_(x.integrity, null);
  const marks = parseJson_(x.marks, {});
  return {
    id: x.id, examId: x.examId, userId: x.userId, studentName: nameOf[x.userId] || '(removed)', status: x.status,
    section: num_(x.section), startedAt: x.startedAt, submittedAt: x.submittedAt, autoScore: num_(x.autoScore),
    total: x.total === '' ? null : num_(x.total), graded: Object.keys(marks).length > 0, flags: integ && integ.flags ? integ.flags : []
  };
}

function startExam_(u, p) {
  const e = byId_('Exams', p.examId);
  if (!e || !bool_(e.active)) throw new Error('This exam is not available.');
  if (myAttempt_(u, e.id)) return '';
  insert_('ExamAttempts', {
    id: uid_('x'), examId: e.id, userId: u.id, startedAt: now_(), section: 0, answers: '{}', testResults: '{}',
    sectionLog: '{}', submittedAt: '', status: 'in_progress', autoScore: 0, marks: '{}', total: '', integrity: '', comment: ''
  });
  return 'Exam started. All the best!';
}

function gradeAllLines_(tests, outputs) {
  outputs = Array.isArray(outputs) ? outputs : [];
  let passed = 0;
  const results = tests.map(function (t, i) {
    const raw = String(outputs[i] === undefined || outputs[i] === null ? '' : outputs[i]).slice(0, 4000);
    const got = normOut_(raw);
    const want = normOut_(t.expect).split('\n').filter(String);
    const ok = want.length > 0 && want.every(function (w) { return got.indexOf(w) >= 0; });
    if (ok) passed++;
    return { ok: ok, output: raw.slice(0, 800) };
  });
  return { score: passed + '/' + tests.length, results: results };
}

function submitExamSection_(u, p) {
  const e = byId_('Exams', p.examId);
  if (!e) throw new Error('This exam is not available.');
  const ex = examObj_(e);
  const at = myAttempt_(u, ex.id);
  if (!at) throw new Error('Start the exam first.');
  if (at.status === 'submitted') throw new Error('You have already submitted this exam.');
  const idx = num_(at.section);
  const sec = ex.sections[idx];
  if (!sec || sec.id !== p.sectionId) throw new Error('This section is already submitted. Refresh the page.');

  const nowS = now_();
  const late = nowS.slice(0, 16) > addMin_(examDeadline_(ex, at), EXAM.GRACE_MIN);
  const answers = parseJson_(at.answers, {});
  const results = parseJson_(at.testResults, {});
  const given = p.answers && typeof p.answers === 'object' ? p.answers : {};
  const outs = p.testOutputs && typeof p.testOutputs === 'object' ? p.testOutputs : {};
  (sec.questions || []).forEach(function (q) {
    const v = given[q.id];
    if (q.type === 'mcq') {
      const n = v === '' || v === null || v === undefined ? null : Math.round(num_(v));
      answers[q.id] = n !== null && n >= 0 && n < (q.options || []).length ? n : null;
    } else {
      answers[q.id] = String(v === undefined || v === null ? '' : v).slice(0, q.type === 'code' ? 4000 : 1500);
    }
    if (q.type === 'code' && (q.tests || []).length && String(answers[q.id]).trim()) results[q.id] = gradeAllLines_(q.tests, outs[q.id]);
  });
  let auto = 0;
  examQuestions_(ex).forEach(function (q) { if (q.type === 'mcq' && answers[q.id] !== null && answers[q.id] === q.answer) auto += num_(q.marks); });

  const log = parseJson_(at.sectionLog, {});
  log[sec.id] = nowS;
  const integ = cleanIntegrity_(p.integrity, 0);
  if (late) integ.flags.push('Submitted after the time limit');
  const prev = parseJson_(at.integrity, null);
  if (prev && prev.flags && prev.flags.indexOf('Submitted after the time limit') >= 0 && integ.flags.indexOf('Submitted after the time limit') < 0) integ.flags.push('Submitted after the time limit');

  const last = idx >= ex.sections.length - 1 || p.final === true || late;
  const patch = {
    answers: JSON.stringify(answers), testResults: JSON.stringify(results), sectionLog: JSON.stringify(log),
    integrity: JSON.stringify(integ), autoScore: auto, section: last ? ex.sections.length : idx + 1
  };
  if (last) { patch.status = 'submitted'; patch.submittedAt = nowS; }
  update_('ExamAttempts', at, patch);
  if (last) {
    award_(u.id, 'exam:' + ex.id, POINTS.SUBMIT_ON_TIME, 'Completed exam: ' + ex.title);
    return 'Exam submitted. Well done!';
  }
  return 'Section ' + sec.id + ' submitted.';
}

/* Camera/microphone flag from the exam page: snapshot goes to Drive, a row to ProctorFlags. */
const PROCTOR = { MAX_PER_ATTEMPT: 120, MAX_IMG: 400000, TYPES: ['noFace', 'multi', 'away', 'talking', 'voice', 'dark', 'camOff'] };
function proctorFlag_(u, p) {
  const at = myAttempt_(u, clean_(p.examId, 40));
  if (!at || at.status === 'submitted') return '';
  if (PROCTOR.TYPES.indexOf(p.type) < 0) throw new Error('Unknown flag.');
  if (rows_('ProctorFlags').filter(function (f) { return f.attemptId === at.id; }).length >= PROCTOR.MAX_PER_ATTEMPT) return '';
  let file = null;
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(String(p.img || ''));
  if (m && m[1].length <= PROCTOR.MAX_IMG) {
    try {
      const folder = childFolder_(studentFolder_(u), 'Exam camera flags');
      const name = clean_(p.at, 30).replace(/[:.]/g, '-') + '_' + p.type + '.jpg';
      file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[1]), 'image/jpeg', name));
    } catch (e) { Logger.log('Proctor image save failed: ' + e.message); }
  }
  insert_('ProctorFlags', {
    id: uid_('f'), attemptId: at.id, examId: at.examId, userId: u.id, type: p.type, label: clean_(p.label, 80),
    section: clean_(p.section, 10), at: clean_(p.at, 30), fileId: file ? file.getId() : '', fileUrl: file ? file.getUrl() : ''
  });
  return '';
}
function proctorThumb_(fileId) { return fileId ? 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400' : ''; }

function getExamAttempt_(_, p) {
  const at = byId_('ExamAttempts', p.id);
  if (!at) throw new Error('Attempt not found.');
  const e = byId_('Exams', at.examId);
  const u = byId_('Users', at.userId);
  return {
    attempt: {
      id: at.id, examId: at.examId, studentName: u ? u.name : '(removed)', status: at.status, section: num_(at.section),
      startedAt: at.startedAt, submittedAt: at.submittedAt, answers: parseJson_(at.answers, {}), testResults: parseJson_(at.testResults, {}),
      sectionLog: parseJson_(at.sectionLog, {}), autoScore: num_(at.autoScore), marks: parseJson_(at.marks, {}),
      total: at.total === '' ? null : num_(at.total), integrity: parseJson_(at.integrity, null), comment: at.comment,
      camera: rows_('ProctorFlags').filter(function (f) { return f.attemptId === at.id; })
        .sort(function (a, b) { return String(a.at).localeCompare(b.at); })
        .map(function (f) { return { type: f.type, label: f.label, section: f.section, at: f.at, fileUrl: f.fileUrl, thumb: proctorThumb_(f.fileId) }; })
    },
    exam: e ? examObj_(e) : null
  };
}

function gradeExamAttempt_(_, p) {
  const at = byId_('ExamAttempts', p.id);
  if (!at) throw new Error('Attempt not found.');
  const ex = examObj_(byId_('Exams', at.examId));
  const given = p.marks && typeof p.marks === 'object' ? p.marks : {};
  const marks = {};
  let total = num_(at.autoScore);
  ex.sections.forEach(function (s) {
    const got = [];
    (s.questions || []).forEach(function (q) {
      if (q.type === 'mcq') return;
      const v = given[q.id];
      if (v === '' || v === null || v === undefined) return;
      const n = Math.round(num_(v) * 2) / 2;
      if (n < 0 || n > num_(q.marks)) throw new Error(q.id + ': marks must be between 0 and ' + q.marks + '.');
      marks[q.id] = n;
      got.push(n);
    });
    got.sort(function (a, b) { return b - a; });
    total += (s.pick ? got.slice(0, s.pick) : got).reduce(function (a, b) { return a + b; }, 0);
  });
  update_('ExamAttempts', at, { marks: JSON.stringify(marks), total: total, comment: clean_(p.comment, 2000) });
  return 'Marks saved · total ' + total + ' / ' + examTotal_(ex);
}

function resetExamAttempt_(_, p) {
  const at = byId_('ExamAttempts', p.id);
  if (!at) throw new Error('Attempt not found.');
  remove_('ExamAttempts', function (x) { return x.id === p.id; });
  revoke_(at.userId, 'exam:' + at.examId);
  return 'Attempt deleted. The student can take the exam again.';
}

function saveExam_(_, p) {
  if (p.json === undefined && p.id) {                       // quick toggle
    const row = byId_('Exams', p.id);
    if (!row) throw new Error('Exam not found.');
    update_('Exams', row, { active: p.active ? 'TRUE' : 'FALSE', updatedAt: now_() });
    return p.active ? 'Exam is open to students.' : 'Exam hidden from students.';
  }
  let d = p.json;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { throw new Error('That is not valid JSON: ' + err.message); } }
  if (!d || typeof d !== 'object') throw new Error('Paste the exam JSON.');
  const title = clean_(d.title, 150);
  if (!title) throw new Error('The exam needs a "title".');
  if (!Array.isArray(d.sections) || !d.sections.length) throw new Error('The exam needs a non-empty "sections" list.');
  const ids = {};
  const sections = d.sections.map(function (s, i) {
    const sid = clean_(s.id, 10) || String.fromCharCode(65 + i);
    if (!Array.isArray(s.questions) || !s.questions.length) throw new Error('Section ' + sid + ' has no questions.');
    return {
      id: sid, title: clean_(s.title, 120) || 'Section ' + sid, instructions: clean_(s.instructions, 2000), pick: Math.max(0, Math.round(num_(s.pick))),
      questions: s.questions.map(function (q, j) {
        const qid = clean_(q.id, 20) || sid + (j + 1);
        if (ids[qid]) throw new Error('Duplicate question id ' + qid + '.');
        ids[qid] = true;
        if (EXAM.TYPES.indexOf(q.type) < 0) throw new Error(qid + ': type must be mcq, text or code.');
        const o = { id: qid, type: q.type, text: clean_(q.text, 4000), marks: num_(q.marks) || 1 };
        if (q.title) o.title = clean_(q.title, 150);
        if (q.code) o.code = String(q.code).slice(0, 4000);
        if (q.mono) o.mono = true;
        if (q.key) o.key = clean_(q.key, 2000);
        if (q.type === 'mcq') {
          if (!Array.isArray(q.options) || q.options.length < 2) throw new Error(qid + ': needs at least 2 options.');
          o.options = q.options.map(function (x) { return clean_(x, 300); });
          o.answer = Math.round(num_(q.answer));
          if (o.answer < 0 || o.answer >= o.options.length) throw new Error(qid + ': "answer" must be the option number, starting at 0.');
        }
        if (q.type === 'code') {
          o.starter = String(q.starter || '').slice(0, 4000);
          o.tests = (Array.isArray(q.tests) ? q.tests : []).slice(0, 20).map(function (t) { return { input: String(t.input || '').slice(0, 2000), expect: clean_(t.expect, 2000) }; })
            .filter(function (t) { return t.expect; });
        }
        return o;
      })
    };
  });
  const obj = {
    title: title, description: clean_(d.description, 2000), durationMin: Math.max(5, Math.min(600, Math.round(num_(d.durationMin) || 120))),
    sections: JSON.stringify(sections), active: d.active === false || d.active === 'false' ? 'FALSE' : 'TRUE', updatedAt: now_(),
    maxExits: d.maxExits === undefined || d.maxExits === '' ? 5 : Math.max(0, Math.min(50, Math.round(num_(d.maxExits))))
  };
  const id = clean_(d.id, 40);
  const row = id ? byId_('Exams', id) : null;
  if (row) { update_('Exams', row, obj); return 'Exam updated.'; }
  obj.id = id || uid_('e'); obj.createdAt = now_();
  insert_('Exams', obj);
  return 'Exam created.';
}

/* =====================================================================
 * CodeTrack Lab: type-only editor, auto-checked tests, timed exams
 * ===================================================================*/

const LAB = { MODES: ['submit', 'lab', 'exam'], GRACE_MIN: 2, BURST_FLAG: 40, MAX_TESTS: 20, DEFAULT_SWITCHES: 3 };

function parseJson_(v, dflt) {
  if (v === null || v === undefined || v === '') return dflt;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return dflt; }
}

function modeOf_(a) { return LAB.MODES.indexOf(a.mode) >= 0 ? a.mode : 'submit'; }
function testsOf_(a) {
  const t = parseJson_(a.tests, []);
  return Array.isArray(t) ? t : [];
}

/* 'yyyy-MM-ddTHH:mm' (IST wall clock) + n minutes, staying in the same wall-clock format. */
function addMin_(s, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + n * 60000);
  return d.toISOString().slice(0, 16);
}

function normDateTime_(v) {
  const s = clean_(v, 25).replace(' ', 'T');
  if (!s) return '';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) throw new Error('Exam times must look like 2026-11-26T09:30.');
  return s.slice(0, 16);
}

function normTests_(v) {
  let t = v;
  if (typeof t === 'string') {
    if (!t.trim()) return '';
    try { t = JSON.parse(t); } catch (e) { throw new Error('Test cases are not valid JSON: ' + e.message); }
  }
  if (!Array.isArray(t)) throw new Error('Test cases must be a list.');
  if (t.length > LAB.MAX_TESTS) throw new Error('At most ' + LAB.MAX_TESTS + ' test cases.');
  const out = t.map(function (x, i) {
    const expect = clean_(x && x.expect, 2000);
    if (!expect) throw new Error('Test ' + (i + 1) + ' needs an expected output.');
    return { input: String((x && x.input) || '').slice(0, 2000), expect: expect, hidden: bool_(x && x.hidden) };
  });
  return out.length ? JSON.stringify(out) : '';
}

/* Student view of an assignment: no expected output for hidden or exam tests. */
function studentAssignment_(a) {
  const c = strip_(a);
  const mode = modeOf_(a);
  c.mode = mode;
  const tests = testsOf_(a);
  delete c.tests;
  if (mode !== 'submit') {
    c.testCount = tests.length;
    c.tests = tests.map(function (t) {
      const o = { input: t.input, hidden: !!t.hidden || mode === 'exam' };
      if (!o.hidden) o.expect = t.expect;
      return o;
    });
  }
  c.maxSwitches = c.maxSwitches === '' || c.maxSwitches === undefined ? LAB.DEFAULT_SWITCHES : num_(c.maxSwitches);
  return c;
}

/* Students never see integrity data; exam scores stay hidden until the instructor reviews. */
function studentSubView_(c) {
  delete c.integrity;
  const a = byId_('Assignments', c.assignmentId);
  if (a && modeOf_(a) === 'exam' && c.status === 'submitted') { delete c.testScore; delete c.testResults; }
  return c;
}

function normOut_(s) {
  return String(s || '').replace(/\r/g, '').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); })
    .filter(function (l) { return l; }).join('\n').toLowerCase();
}

function gradeTests_(tests, outputs) {
  outputs = Array.isArray(outputs) ? outputs : [];
  let passed = 0;
  const results = tests.map(function (t, i) {
    const raw = String(outputs[i] === undefined || outputs[i] === null ? '' : outputs[i]).slice(0, 4000);
    const got = normOut_(raw), want = normOut_(t.expect);
    const ok = !!want && got.indexOf(want) >= 0;
    if (ok) passed++;
    return { ok: ok, output: raw.slice(0, 600) };
  });
  return { score: passed + '/' + tests.length, passed: passed, results: results };
}

function cleanIntegrity_(x, maxSwitches) {
  x = x && typeof x === 'object' ? x : {};
  const n = function (k) { const v = Math.round(num_(x[k])); return v < 0 ? 0 : Math.min(v, 1e7); };
  const out = {};
  ['typed', 'deleted', 'pasteBlocked', 'copyBlocked', 'maxBurst', 'tabSwitches', 'fsExits', 'strikes', 'camFlags', 'runs', 'errors', 'activeSec', 'totalSec', 'reloads', 'idleSec']
    .forEach(function (k) { out[k] = n(k); });
  out.bursts = (Array.isArray(x.bursts) ? x.bursts : []).slice(0, 30).map(function (b) {
    return { t: Math.round(num_(b && b.t)), n: Math.round(num_(b && b.n)) };
  });
  out.timeline = (Array.isArray(x.timeline) ? x.timeline : []).slice(0, 400).map(function (v) { return Math.round(num_(v)); });
  out.autoSubmitted = clean_(x.autoSubmitted, 40);
  out.startedAt = clean_(x.startedAt, 25);
  const flags = [];
  if (out.maxBurst >= LAB.BURST_FLAG) flags.push('Large text insert (' + out.maxBurst + ' chars at once)');
  if (out.pasteBlocked) flags.push(out.pasteBlocked + ' paste attempt' + (out.pasteBlocked > 1 ? 's' : ''));
  if (out.tabSwitches > maxSwitches) flags.push('Left the page ' + out.tabSwitches + ' time' + (out.tabSwitches > 1 ? 's' : '') + (maxSwitches ? ' (limit ' + maxSwitches + ')' : ''));
  if (out.fsExits) flags.push('Exited full screen ' + out.fsExits + 'x');
  if (out.camFlags) flags.push(out.camFlags + ' camera/microphone alert' + (out.camFlags > 1 ? 's' : ''));
  if (out.autoSubmitted) flags.push('Auto-submitted: ' + out.autoSubmitted);
  out.flags = flags;
  return out;
}

/* Lab / exam submission: code typed in CodeTrack Lab, outputs checked on the server. */
function submitLab_(u, a, p, prev) {
  const mode = modeOf_(a);
  const nowS = now_();
  if (mode === 'exam') {
    if (a.examStart && nowS.slice(0, 16) < a.examStart) throw new Error('This exam has not started yet.');
    if (a.examEnd && nowS.slice(0, 16) > addMin_(a.examEnd, LAB.GRACE_MIN)) throw new Error('This exam closed at ' + a.examEnd.slice(11) + '.');
    if (prev.length && prev[0].status !== 'rework') throw new Error('You have already submitted this exam.');
  }
  const code = String(p.code || '');
  if (!code.trim()) throw new Error('Write some code before submitting.');
  if (code.length > 100000) throw new Error('That program is too long.');
  const tests = testsOf_(a);
  const g = tests.length ? gradeTests_(tests, p.testOutputs) : null;
  const maxSw = a.maxSwitches === '' || a.maxSwitches === undefined ? LAB.DEFAULT_SWITCHES : num_(a.maxSwitches);
  const integ = cleanIntegrity_(p.integrity, maxSw);

  let file = null;
  try {
    const stamp = Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd-HHmm');
    file = studentFolder_(u).createFile(a.id + '__' + stamp + '__lab.py', code, MimeType.PLAIN_TEXT);
  } catch (e) { Logger.log('Drive save failed: ' + e.message); }
  const late = mode !== 'exam' && !!(a.due && nowS.slice(0, 16) > a.due);
  insert_('Submissions', {
    id: uid_('s'), assignmentId: a.id, userId: u.id, type: 'lab', fileName: a.id + '.py',
    fileId: file ? file.getId() : '', fileUrl: file ? file.getUrl() : '', code: code,
    submittedAt: nowS, late: late, status: 'submitted', comment: '', reviewedAt: '',
    integrity: JSON.stringify(integ), testScore: g ? g.score : '', testResults: g ? JSON.stringify(g.results) : ''
  });
  const pts = late ? POINTS.SUBMIT_LATE : POINTS.SUBMIT_ON_TIME;
  const got = award_(u.id, 'submit:' + a.id, pts, (late ? 'Late submission: ' : 'Submitted: ') + a.title);
  let msg = (mode === 'exam' ? 'Exam submitted: "' : 'Submitted "') + a.title + '"';
  if (g && mode !== 'exam') msg += ' · tests passed ' + g.score;
  if (got) msg += ' · +' + pts + ' points';
  if (late) msg += ' (late)';
  return msg;
}

function submitAssignment_(u, p) {
  const days = visibleDays_(u);
  const dayIds = {};
  days.forEach(function (d) { dayIds[d.id] = true; });
  const a = visibleAssignments_(u, dayIds).find(function (x) { return x.id === p.assignmentId; });
  if (!a) throw new Error('This assignment is not available.');

  const prev = rows_('Submissions').filter(function (s) { return s.userId === u.id && s.assignmentId === a.id; })
    .sort(function (x, y) { return String(y.submittedAt).localeCompare(x.submittedAt); });
  if (prev.length && prev[0].status === 'approved') throw new Error('This assignment is already approved.');
  if (modeOf_(a) !== 'submit') {
    if (p.type !== 'lab') throw new Error('This assignment must be written in CodeTrack Lab.');
    return submitLab_(u, a, p, prev);
  }

  const type = p.type === 'file' ? 'file' : 'paste';
  const code = String(p.code || '');
  if (!code.trim()) throw new Error(type === 'file' ? 'The selected file is empty.' : 'Paste your code before submitting.');
  if (code.length > APP.MAX_UPLOAD_CHARS) throw new Error('That file is too large (max ~500 KB).');
  let fileName = clean_(p.fileName, 120);
  if (type === 'file' && !/\.(py|txt|ipynb)$/i.test(fileName)) throw new Error('Upload a .py, .ipynb or .txt file.');
  if (type === 'paste') fileName = a.id + '.py';

  const submittedAt = now_();
  const stamp = Utilities.formatDate(new Date(), APP.TZ, 'yyyyMMdd-HHmm');
  let file = null;
  try {
    const folder = studentFolder_(u);
    file = folder.createFile(a.id + '__' + stamp + '__' + fileName.replace(/[\\/:*?"<>|]/g, '_'), code, MimeType.PLAIN_TEXT);
  } catch (e) {
    Logger.log('Drive save failed: ' + e.message);
  }
  const late = !!(a.due && submittedAt.slice(0, 16) > a.due);
  insert_('Submissions', {
    id: uid_('s'), assignmentId: a.id, userId: u.id, type: type, fileName: fileName,
    fileId: file ? file.getId() : '', fileUrl: file ? file.getUrl() : '', code: code,
    submittedAt: submittedAt, late: late, status: 'submitted', comment: '', reviewedAt: ''
  });
  const pts = late ? POINTS.SUBMIT_LATE : POINTS.SUBMIT_ON_TIME;
  const got = award_(u.id, 'submit:' + a.id, pts, (late ? 'Late submission: ' : 'Submitted: ') + a.title);
  return 'Submitted "' + a.title + '"' + (got ? ' · +' + pts + ' points' : '') + (late ? ' (late)' : '');
}

function studentFolder_(u) {
  const parent = folderById_('SUBMISSIONS_FOLDER_ID');
  return childFolder_(parent, u.name + ' (' + u.username + ')');
}

function getSubmission_(u, p) {
  const s = byId_('Submissions', p.id);
  if (!s) throw new Error('Submission not found.');
  if (u.role !== 'admin' && s.userId !== u.id) throw new Error('Not allowed.');
  const out = strip_(s);
  if (u.role !== 'admin') { delete out.fileUrl; delete out.fileId; studentSubView_(out); }
  else {
    out.integrity = parseJson_(s.integrity, null);
    out.testResults = parseJson_(s.testResults, null);
    const a = byId_('Assignments', s.assignmentId);
    if (a) out.tests = testsOf_(a);
  }
  if (u.role !== 'admin' && out.testResults) {
    const a = byId_('Assignments', s.assignmentId);
    const tests = a ? testsOf_(a) : [];
    out.testResults = (parseJson_(out.testResults, []) || []).map(function (r, i) {
      return { ok: r.ok, output: tests[i] && tests[i].hidden ? '' : r.output, hidden: !!(tests[i] && tests[i].hidden) };
    });
  }
  return out;
}

function askDoubt_(u, p) {
  const q = clean_(p.question, 3000);
  if (q.length < 5) throw new Error('Please describe your doubt in a little more detail.');
  let dayId = clean_(p.dayId, 40);
  if (dayId && !visibleDays_(u).some(function (d) { return d.id === dayId; })) dayId = '';
  insert_('Doubts', { id: uid_('q'), userId: u.id, dayId: dayId, question: q, answer: '', shared: 'FALSE', status: 'open', askedAt: now_(), answeredAt: '' });
  award_(u.id, 'doubt:' + today_(), POINTS.DOUBT, 'Asked a doubt');
  return 'Doubt sent to your instructor.';
}

function saveReflection_(u, p) {
  const learned = clean_(p.learned, 3000);
  if (learned.length < 3) throw new Error('Write at least a line about what you learned.');
  const stuck = clean_(p.stuck, 3000);
  const confidence = Math.max(1, Math.min(5, Math.round(num_(p.confidence) || 3)));
  let dayId = clean_(p.dayId, 40);
  if (dayId && !visibleDays_(u).some(function (d) { return d.id === dayId; })) dayId = '';
  const today = today_();
  const existing = rows_('Reflections').find(function (r) { return r.userId === u.id && r.date === today; });
  if (existing) {
    update_('Reflections', existing, { dayId: dayId, learned: learned, stuck: stuck, confidence: confidence, updatedAt: now_() });
    return 'Reflection updated.';
  }
  insert_('Reflections', { id: uid_('r'), userId: u.id, date: today, dayId: dayId, learned: learned, stuck: stuck, confidence: confidence, createdAt: now_(), updatedAt: '' });
  award_(u.id, 'reflect:' + today, POINTS.REFLECTION, 'Daily reflection');
  return 'Reflection saved · +' + POINTS.REFLECTION + ' points';
}

function requestTrack_(u, p) {
  if (!bool_(settings_().trackSelectionOpen)) throw new Error('Track selection is not open yet.');
  if (u.trackStatus === 'approved') throw new Error('Your track is already approved. Ask your instructor if you want to switch.');
  const t = byId_('Tracks', p.trackId);
  if (!t) throw new Error('Unknown track.');
  update_('Users', u, { requestedTrack: t.id, trackStatus: 'requested' });
  return 'Requested "' + t.name + '". Your instructor will confirm it.';
}

/* =====================================================================
 * Materials (Drive)
 * ===================================================================*/

function materials_(u, p) {
  const cache = CacheService.getScriptCache();
  const KEY = 'materials_v1';
  if (p && p.refresh && u.role === 'admin') cache.remove(KEY);
  let tree = null;
  const hit = cache.get(KEY);
  if (hit) { try { tree = JSON.parse(hit); } catch (e) { tree = null; } }
  if (!tree) {
    tree = buildMaterialsTree_();
    try { cache.put(KEY, JSON.stringify(tree), 300); } catch (e) { /* too big to cache */ }
  }
  if (u.role === 'admin') return { folders: tree };
  const pub = publishedWeeks_();
  const track = byId_('Tracks', myTrack_(u));
  return { folders: tree.filter(function (f) { return canSeeFolder_(f.name, pub, track); }) };
}

function canSeeFolder_(name, pub, track) {
  const w = /^week\s*0*(\d+)\b/i.exec(name);
  if (w) return !!pub[String(Number(w[1]))];
  const tr = /^track\s*[-–:]\s*(.+)$/i.exec(name);
  if (tr) {
    if (!track) return false;
    const k = tr[1].trim().toLowerCase();
    return k === String(track.name).toLowerCase() || k === String(track.id).toLowerCase();
  }
  return true;
}

function buildMaterialsTree_() {
  const root = folderById_('MATERIALS_FOLDER_ID');
  const out = [];
  const loose = listFiles_(root, '', 99);
  if (loose.length) out.push({ name: 'General', id: root.getId(), files: loose });
  const it = root.getFolders();
  const subs = [];
  while (it.hasNext()) subs.push(it.next());
  subs.sort(function (a, b) { return a.getName().localeCompare(b.getName(), undefined, { numeric: true }); });
  subs.forEach(function (f) { out.push({ name: f.getName(), id: f.getId(), files: listFiles_(f, '', 0) }); });
  return out;
}

function listFiles_(folder, prefix, depth) {
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    files.push({
      id: f.getId(), name: prefix + f.getName(), mime: f.getMimeType(), size: f.getSize(),
      updated: Utilities.formatDate(f.getLastUpdated(), APP.TZ, 'yyyy-MM-dd'), url: f.getUrl()
    });
  }
  if (depth < 3) {
    const sub = folder.getFolders();
    while (sub.hasNext()) {
      const s = sub.next();
      Array.prototype.push.apply(files, listFiles_(s, prefix + s.getName() + ' / ', depth + 1));
    }
  }
  files.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });
  return files;
}

/* =====================================================================
 * Instructor: students, tracks, points
 * ===================================================================*/

function saveStudent_(_, p) {
  const name = clean_(p.name, 80);
  if (!name) throw new Error('Name is required.');
  if (!p.id) {
    const u = createUser_({ name: name, username: p.username, password: p.password, role: 'student' });
    return 'Added ' + u.name + ' (username: ' + u.username + ').';
  }
  const u = byId_('Users', p.id);
  if (!u || u.role !== 'student') throw new Error('Student not found.');
  const patch = { name: name, active: p.active === false || p.active === 'false' ? 'FALSE' : 'TRUE' };
  const username = String(p.username || '').trim().toLowerCase();
  if (username && username !== u.username) {
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Username must be 3-30 characters: letters, numbers, dot, dash or underscore.');
    if (rows_('Users').some(function (x) { return x.username === username; })) throw new Error('Username "' + username + '" is already taken.');
    patch.username = username;
  }
  if (p.password) {
    validatePassword_(p.password);
    patch.salt = Utilities.getUuid();
    patch.passwordHash = hash_(String(p.password), patch.salt);
    remove_('Sessions', function (s) { return s.userId === u.id; });
  }
  if (patch.active === 'FALSE') remove_('Sessions', function (s) { return s.userId === u.id; });
  update_('Users', u, patch);
  return 'Saved ' + name + (p.password ? ' · password reset' : '') + '.';
}

function bulkAddStudents_(_, p) {
  const lines = String(p.text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(String);
  if (!lines.length) throw new Error('Add one student per line.');
  const added = [], errors = [];
  lines.forEach(function (line, i) {
    const parts = line.split(',').map(function (x) { return x.trim(); });
    try {
      if (parts.length === 2) added.push(createUser_({ name: parts[0], password: parts[1] }));
      else if (parts.length >= 3) added.push(createUser_({ name: parts[0], username: parts[1], password: parts[2] }));
      else throw new Error('use "Name, password"');
    } catch (e) {
      errors.push('Line ' + (i + 1) + ': ' + e.message);
    }
  });
  if (!added.length) throw new Error(errors.join(' · '));
  return 'Added ' + added.length + ' student(s): ' + added.map(function (u) { return u.username; }).join(', ') +
    (errors.length ? ' · Skipped: ' + errors.join(' · ') : '');
}

function setTrack_(_, p) {
  const u = byId_('Users', p.userId);
  if (!u || u.role !== 'student') throw new Error('Student not found.');
  if (p.action === 'approve') {
    if (!u.requestedTrack) throw new Error('No track request to approve.');
    update_('Users', u, { track: u.requestedTrack, trackStatus: 'approved' });
    return u.name + ' → ' + trackName_(u.requestedTrack) + ' approved.';
  }
  if (p.action === 'reject') {
    update_('Users', u, { trackStatus: 'rejected' });
    return 'Request rejected. ' + u.name + ' can pick again.';
  }
  if (p.action === 'assign') {
    if (!p.trackId) {
      update_('Users', u, { track: '', requestedTrack: '', trackStatus: '' });
      return 'Track cleared for ' + u.name + '.';
    }
    if (!byId_('Tracks', p.trackId)) throw new Error('Unknown track.');
    update_('Users', u, { track: p.trackId, requestedTrack: p.trackId, trackStatus: 'approved' });
    return u.name + ' assigned to ' + trackName_(p.trackId) + '.';
  }
  throw new Error('Unknown action.');
}

function trackName_(id) { const t = byId_('Tracks', id); return t ? t.name : id; }

function awardBonus_(_, p) {
  const u = byId_('Users', p.userId);
  if (!u) throw new Error('Student not found.');
  const pts = Math.round(num_(p.points));
  if (!pts) throw new Error('Enter a non-zero number of points.');
  const reason = clean_(p.reason, 200) || 'Bonus';
  insert_('Points', { id: uid_('p'), userId: u.id, key: 'bonus:' + uid_(), points: pts, reason: reason, createdAt: now_() });
  return (pts > 0 ? '+' : '') + pts + ' points for ' + u.name + '.';
}

/* =====================================================================
 * Instructor: attendance
 * ===================================================================*/

function applyAttendancePoints_(userId, date, status) {
  revoke_(userId, 'att:' + date);
  if (status === 'present') award_(userId, 'att:' + date, POINTS.PRESENT, 'Present on ' + date);
  if (status === 'late') award_(userId, 'att:' + date, POINTS.LATE, 'Late on ' + date);
}

function markAttendance_(_, p) {
  const date = clean_(p.date, 10);
  if (!isDate_(date)) throw new Error('Pick a valid date.');
  const status = clean_(p.status, 10);
  if (['present', 'late', 'absent', ''].indexOf(status) < 0) throw new Error('Unknown status.');
  const u = byId_('Users', p.userId);
  if (!u) throw new Error('Student not found.');
  setAttendance_(u.id, date, status);
  return '';
}

function setAttendance_(userId, date, status) {
  const row = rows_('Attendance').find(function (a) { return a.userId === userId && a.date === date; });
  if (!status) {
    if (row) remove_('Attendance', function (a) { return a.userId === userId && a.date === date; });
  } else if (row) {
    update_('Attendance', row, { status: status, verifiedAt: now_() });
  } else {
    insert_('Attendance', { id: uid_('t'), date: date, userId: userId, status: status, checkInAt: '', verifiedAt: now_() });
  }
  applyAttendancePoints_(userId, date, status);
}

function bulkAttendance_(_, p) {
  const date = clean_(p.date, 10);
  if (!isDate_(date)) throw new Error('Pick a valid date.');
  const lateAfter = settings_().lateAfter;
  const students = rows_('Users').filter(function (u) { return u.role === 'student' && bool_(u.active); });
  let n = 0;
  students.forEach(function (u) {
    const row = rows_('Attendance').find(function (a) { return a.userId === u.id && a.date === date; });
    if (p.mode === 'verify' && row && row.status === 'pending') {
      setAttendance_(u.id, date, row.checkInAt && row.checkInAt > lateAfter ? 'late' : 'present'); n++;
    } else if (p.mode === 'absentRest' && !row) {
      setAttendance_(u.id, date, 'absent'); n++;
    } else if (p.mode === 'allPresent' && (!row || row.status === 'pending' || row.status === 'absent')) {
      setAttendance_(u.id, date, 'present'); n++;
    }
  });
  return n ? 'Updated ' + n + ' student(s).' : 'Nothing to update.';
}

/* =====================================================================
 * Instructor: submissions
 * ===================================================================*/

function reviewSubmission_(_, p) {
  const s = byId_('Submissions', p.id);
  if (!s) throw new Error('Submission not found.');
  if (['approved', 'rework'].indexOf(p.status) < 0) throw new Error('Choose Approve or Needs rework.');
  const comment = clean_(p.comment, 3000);
  if (p.status === 'rework' && !comment) throw new Error('Add a comment so the student knows what to fix.');
  update_('Submissions', s, { status: p.status, comment: comment, reviewedAt: now_() });
  const a = byId_('Assignments', s.assignmentId);
  if (p.status === 'approved') award_(s.userId, 'approved:' + s.assignmentId, POINTS.APPROVED, 'Approved: ' + (a ? a.title : s.assignmentId));
  else revoke_(s.userId, 'approved:' + s.assignmentId);
  return p.status === 'approved' ? 'Approved.' : 'Sent back for rework.';
}

/* =====================================================================
 * Instructor: syllabus
 * ===================================================================*/

function saveWeek_(_, p) {
  const week = Math.round(num_(p.week));
  if (week < 1) throw new Error('Week number must be 1 or more.');
  const row = rows_('Weeks').find(function (w) { return num_(w.week) === week; });
  const patch = { week: week };
  if (p.title !== undefined) patch.title = clean_(p.title, 120);
  if (p.published !== undefined) patch.published = bool_(p.published) ? 'TRUE' : 'FALSE';
  if (row) update_('Weeks', row, patch);
  else insert_('Weeks', { week: week, title: patch.title || 'Week ' + week, published: patch.published || 'FALSE' });
  if (p.published !== undefined) {
    try { CacheService.getScriptCache().remove('materials_v1'); } catch (e) { /* ignore */ }
    return 'Week ' + week + (bool_(p.published) ? ' published — students can see it now.' : ' hidden from students.');
  }
  return 'Week ' + week + ' saved.';
}

function saveDay_(_, p) {
  const day = Math.round(num_(p.day));
  const week = Math.round(num_(p.week));
  if (day < 1) throw new Error('Day number must be 1 or more.');
  if (week < 1) throw new Error('Week number must be 1 or more.');
  const date = clean_(p.date, 10);
  if (date && !isDate_(date)) throw new Error('Date must look like 2026-11-20.');
  const track = clean_(p.track, 30) || 'common';
  if (track !== 'common' && !byId_('Tracks', track)) throw new Error('Unknown track.');
  const title = clean_(p.title, 150);
  if (!title) throw new Error('Title is required.');
  const obj = {
    day: day, week: week, date: date, track: track, title: title,
    scrum: clean_(p.scrum, 4000), paper: clean_(p.paper, 4000), code: clean_(p.code, 4000), outcomes: clean_(p.outcomes, 2000)
  };
  if (p.id) {
    const row = byId_('Days', p.id);
    if (!row) throw new Error('Day not found.');
    update_('Days', row, obj);
  } else {
    obj.id = track === 'common' ? 'd' + pad2_(day) : 'd' + pad2_(day) + '-' + track;
    if (byId_('Days', obj.id)) throw new Error('Day ' + day + ' (' + track + ') already exists — edit it instead.');
    insert_('Days', obj);
  }
  if (!rows_('Weeks').some(function (w) { return num_(w.week) === week; })) {
    insert_('Weeks', { week: week, title: 'Week ' + week, published: 'FALSE' });
  }
  return 'Day ' + day + ' saved.';
}

function deleteDay_(_, p) {
  const n = remove_('Days', function (d) { return d.id === p.id; });
  if (!n) throw new Error('Day not found.');
  return 'Day deleted.';
}

function saveAssignment_(_, p) {
  const title = clean_(p.title, 150);
  if (!title) throw new Error('Title is required.');
  const dayId = clean_(p.dayId, 40);
  let track = clean_(p.track, 30) || 'common';
  if (dayId) {
    const d = byId_('Days', dayId);
    if (!d) throw new Error('Pick a valid day.');
    track = d.track;
  }
  const obj = {
    dayId: dayId, track: track, title: title, description: clean_(p.description, 8000),
    due: normDue_(p.due), active: p.active === false || p.active === 'false' ? 'FALSE' : 'TRUE'
  };
  Object.assign(obj, labFields_(p));
  if (p.id) {
    const row = byId_('Assignments', p.id);
    if (!row) throw new Error('Assignment not found.');
    update_('Assignments', row, obj);
    return 'Assignment saved.';
  }
  obj.id = uid_('a');
  obj.createdAt = now_();
  insert_('Assignments', obj);
  return 'Assignment created.';
}

function labFields_(p) {
  const mode = LAB.MODES.indexOf(p.mode) >= 0 ? p.mode : 'submit';
  const o = { mode: mode, tests: '', examStart: '', examEnd: '', maxSwitches: '' };
  if (mode === 'submit') return o;
  o.tests = normTests_(p.tests === undefined ? '' : p.tests);
  if (p.maxSwitches !== undefined && p.maxSwitches !== '') {
    const n = Math.round(num_(p.maxSwitches));
    if (n < 0 || n > 20) throw new Error('Allowed tab switches must be between 0 and 20.');
    o.maxSwitches = n;
  }
  if (mode === 'exam') {
    o.examStart = normDateTime_(p.examStart);
    o.examEnd = normDateTime_(p.examEnd);
    if (!o.examStart || !o.examEnd) throw new Error('An exam needs a start and an end time.');
    if (o.examEnd <= o.examStart) throw new Error('The exam must end after it starts.');
  }
  return o;
}

function deleteAssignment_(_, p) {
  const n = remove_('Assignments', function (a) { return a.id === p.id; });
  if (!n) throw new Error('Assignment not found.');
  return 'Assignment deleted.';
}

function importSyllabus_(data) {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { throw new Error('That is not valid JSON: ' + e.message); }
  }
  if (!data || !Array.isArray(data.days) || !data.days.length) throw new Error('The JSON needs a non-empty "days" array.');

  let tracks = null;
  if (Array.isArray(data.tracks)) {
    tracks = data.tracks.map(function (t, i) {
      return { id: clean_(t.id, 30), name: clean_(t.name, 60), description: clean_(t.description, 600), icon: clean_(t.icon || 'school', 40), order: t.order !== undefined ? t.order : i + 1 };
    }).filter(function (t) { return t.id && t.name; });
  }
  const trackIds = { common: true };
  (tracks || rows_('Tracks')).forEach(function (t) { trackIds[t.id] = true; });

  const seen = {};
  const days = data.days.map(function (d, i) {
    const day = Math.round(num_(d.day));
    const week = Math.round(num_(d.week));
    const track = clean_(d.track, 30) || 'common';
    const label = 'days[' + i + ']';
    if (day < 1) throw new Error(label + ': "day" must be a number ≥ 1.');
    if (week < 1) throw new Error(label + ': "week" must be a number ≥ 1.');
    if (!trackIds[track]) throw new Error(label + ': unknown track "' + track + '".');
    if (d.date && !isDate_(d.date)) throw new Error(label + ': date must look like 2026-11-20.');
    if (!clean_(d.title)) throw new Error(label + ': "title" is required.');
    const id = clean_(d.id, 40) || (track === 'common' ? 'd' + pad2_(day) : 'd' + pad2_(day) + '-' + track);
    if (seen[id]) throw new Error('Duplicate day id "' + id + '".');
    seen[id] = true;
    return {
      id: id, day: day, week: week, date: clean_(d.date, 10), track: track, title: clean_(d.title, 150),
      scrum: clean_(d.scrum, 4000), paper: clean_(d.paper, 4000), code: clean_(d.code, 4000), outcomes: clean_(d.outcomes, 2000)
    };
  });

  const weekNums = {};
  days.forEach(function (d) { weekNums[d.week] = true; });
  const givenWeeks = {};
  (Array.isArray(data.weeks) ? data.weeks : []).forEach(function (w) { givenWeeks[Math.round(num_(w.week))] = w; });
  Object.keys(givenWeeks).forEach(function (k) { if (num_(k) > 0) weekNums[k] = true; });
  const oldWeeks = {};
  rows_('Weeks').forEach(function (w) { oldWeeks[num_(w.week)] = w; });
  const weeks = Object.keys(weekNums).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
    const g = givenWeeks[n] || {}, o = oldWeeks[n] || {};
    const published = g.published !== undefined ? bool_(g.published) : bool_(o.published);
    return { week: n, title: clean_(g.title || o.title || 'Week ' + n, 120), published: published ? 'TRUE' : 'FALSE' };
  });

  if (tracks) { clearTable_('Tracks'); insertMany_('Tracks', tracks); }
  clearTable_('Weeks'); insertMany_('Weeks', weeks);
  clearTable_('Days'); insertMany_('Days', days);

  let aCount = 0;
  if (Array.isArray(data.assignments)) {
    const existing = {};
    rows_('Assignments').forEach(function (a) { existing[a.id] = a; });
    const fresh = [];
    data.assignments.forEach(function (a, i) {
      const title = clean_(a.title, 150);
      if (!title) throw new Error('assignments[' + i + ']: "title" is required.');
      const dayId = clean_(a.dayId, 40);
      if (dayId && !seen[dayId]) throw new Error('assignments[' + i + ']: dayId "' + dayId + '" does not match any day.');
      const dayRow = days.find(function (d) { return d.id === dayId; });
      const obj = {
        id: clean_(a.id, 40) || uid_('a'), dayId: dayId, track: dayRow ? dayRow.track : (clean_(a.track, 30) || 'common'),
        title: title, description: clean_(a.description, 8000), due: normDue_(a.due),
        active: a.active === false || a.active === 'false' ? 'FALSE' : 'TRUE'
      };
      try { Object.assign(obj, labFields_(a)); } catch (e) { throw new Error('assignments[' + i + ']: ' + e.message); }
      if (existing[obj.id]) update_('Assignments', existing[obj.id], obj);
      else { obj.createdAt = now_(); fresh.push(obj); }
      aCount++;
    });
    insertMany_('Assignments', fresh);
  }
  try { CacheService.getScriptCache().remove('materials_v1'); } catch (e) { /* ignore */ }
  return 'Imported ' + days.length + ' days, ' + weeks.length + ' weeks' + (tracks ? ', ' + tracks.length + ' tracks' : '') + (aCount ? ', ' + aCount + ' assignments' : '') + '.';
}

function exportSyllabus_() {
  const out = {
    version: 1,
    course: settings_().courseTitle,
    tracks: rows_('Tracks').map(function (t) { return { id: t.id, name: t.name, icon: t.icon, description: t.description }; }),
    weeks: rows_('Weeks').map(function (w) { return { week: num_(w.week), title: w.title, published: bool_(w.published) }; })
      .sort(function (a, b) { return a.week - b.week; }),
    days: rows_('Days').slice().sort(sortDays_).map(function (d) {
      return { id: d.id, day: num_(d.day), week: num_(d.week), date: d.date, track: d.track, title: d.title, scrum: d.scrum, paper: d.paper, code: d.code, outcomes: d.outcomes };
    }),
    assignments: rows_('Assignments').map(function (a) {
      const o = { id: a.id, dayId: a.dayId, track: a.track, title: a.title, description: a.description, due: a.due, active: bool_(a.active) };
      const mode = modeOf_(a);
      if (mode !== 'submit') {
        o.mode = mode; o.tests = testsOf_(a);
        if (a.maxSwitches !== '') o.maxSwitches = num_(a.maxSwitches);
        if (mode === 'exam') { o.examStart = a.examStart; o.examEnd = a.examEnd; }
      }
      return o;
    })
  };
  return JSON.stringify(out, null, 2);
}

/* =====================================================================
 * Instructor: announcements, doubts, settings
 * ===================================================================*/

function saveAnnouncement_(_, p) {
  const title = clean_(p.title, 150);
  const body = clean_(p.body, 5000);
  if (!title && !body) throw new Error('Write a title or a message.');
  if (p.id) {
    const row = byId_('Announcements', p.id);
    if (!row) throw new Error('Announcement not found.');
    const patch = {};
    if (p.title !== undefined) patch.title = title;
    if (p.body !== undefined) patch.body = body;
    if (p.pinned !== undefined) patch.pinned = bool_(p.pinned) ? 'TRUE' : 'FALSE';
    update_('Announcements', row, patch);
    return 'Announcement updated.';
  }
  insert_('Announcements', { id: uid_('n'), title: title, body: body, pinned: bool_(p.pinned) ? 'TRUE' : 'FALSE', createdAt: now_() });
  return 'Announcement posted.';
}

function deleteAnnouncement_(_, p) {
  remove_('Announcements', function (a) { return a.id === p.id; });
  return 'Announcement deleted.';
}

function answerDoubt_(_, p) {
  const d = byId_('Doubts', p.id);
  if (!d) throw new Error('Doubt not found.');
  const answer = clean_(p.answer, 5000);
  if (!answer) throw new Error('Write an answer first.');
  update_('Doubts', d, { answer: answer, shared: bool_(p.shared) ? 'TRUE' : 'FALSE', status: 'answered', answeredAt: now_() });
  return 'Answer sent' + (bool_(p.shared) ? ' and shared with the class.' : '.');
}

function deleteDoubt_(_, p) {
  remove_('Doubts', function (d) { return d.id === p.id; });
  return 'Doubt deleted.';
}

function saveSettings_(_, p) {
  ['checkinStart', 'checkinEnd', 'lateAfter'].forEach(function (k) {
    if (p[k] !== undefined && !isTime_(p[k])) throw new Error('Times must look like 09:00.');
  });
  if (p.checkinStart && p.checkinEnd && p.checkinStart >= p.checkinEnd) throw new Error('Check-in must close after it opens.');
  if (p.courseTitle !== undefined) setSetting_('courseTitle', clean_(p.courseTitle, 120) || DEFAULT_SETTINGS.courseTitle);
  ['checkinStart', 'checkinEnd', 'lateAfter'].forEach(function (k) { if (p[k] !== undefined) setSetting_(k, p[k]); });
  if (p.trackSelectionOpen !== undefined) setSetting_('trackSelectionOpen', bool_(p.trackSelectionOpen) ? 'TRUE' : 'FALSE');
  return 'Settings saved.';
}
