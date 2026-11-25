/* Builds trial/index.html: a stand-alone exam portal for a practice run.
   Runs the real Code.gs in the browser (mock Google services). Logins use the hashes from the Users sheet,
   so no plain passwords are shipped. Progress is kept in this browser (localStorage) so a refresh resumes. */
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'trial-users.json'), 'utf8'));
const PROCTOR = process.argv.includes('--proctor');
const OUTDIR = PROCTOR ? 'trial-proctor' : 'trial';
const paper = R('tools/trial-exam.json');
const boot = `
<script>${R('tools/gas-mock.js')}</script>
<script>${R('apps-script/Seed.gs')}</script>
<script>${R('apps-script/Code.gs')}</script>
<script>
(function(){
  const KEY = '${PROCTOR ? 'ct_trialp_db_v1' : 'ct_trial_db_v1'}';
  const clear = () => Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; });
  setup();
  clear();
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  rows_('Users').forEach(u => { if (u.role === 'admin') update_('Users', u, { active: 'FALSE' }); });
  insertMany_('Users', ${JSON.stringify(users)});
  clear();
  insert_('Exams', (function () { const d = ${paper}; return { id: d.id, title: d.title, description: d.description, durationMin: d.durationMin,
    maxExits: d.maxExits, sections: JSON.stringify(d.sections), active: 'TRUE', createdAt: now_(), updatedAt: now_() }; })());
  clear();
  const KEEP = ['ExamAttempts', 'Sessions', 'Points'];
  try {
    const snap = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (snap) KEEP.forEach(n => { if (snap[n]) { const s = ss.getSheetByName(n); s._data = snap[n].data; s._maxRows = snap[n].maxRows; } });
  } catch (e) { /* storage blocked: the trial still works, it just restarts on reload */ }
  const persist = () => { try { const o = {}; KEEP.forEach(n => { const s = ss.getSheetByName(n); o[n] = { data: s._data, maxRows: s._maxRows }; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  window.CODETRACK_CONFIG = { apiUrl: 'https://script.google.com/macros/s/LOCAL/exec', examOnly: true, brandName: 'Python Internship · Assessment'${PROCTOR ? ", proctor: true, reviewPinHash: '57ea7ff1c0378324f7cfd76e80ac451f6b06d97ae831714d8d1fcf196c084f41'" : ''} };
  window.fetch = (function (realFetch) { return (url, opts) => {
    if (String(url).indexOf('script.google.com') < 0) return realFetch(url, opts);
    return new Promise(res => setTimeout(() => { clear(); const out = doPost({ postData: { contents: opts.body } }).getContent(); persist();
      res({ ok: true, status: 200, json: async () => JSON.parse(out) }); }, 80));
  }; })(window.fetch.bind(window));
})();
</script>`;
let html = R('docs/index.html')
  .replace('<title>CodeTrack</title>', '<title>Python Exam · Trial</title>')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + R('docs/styles.css') + '</style>')
  .replace('<script src="config.js"></script>', () => boot)
  .replace('<script src="lab.js"></script>', () => '<script>' + R('docs/lab.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + R('docs/app.js') + '</script>')
  .replace('<script src="exam.js"></script>', () => '<script>' + R('docs/exam.js') + '</script>' + (PROCTOR ? '<script>' + R('docs/proctor.js') + '</script>' : ''))
  .replace('<title>Python Exam · Trial</title>', () => PROCTOR ? '<title>Python Exam · Trial (proctored)</title>' : '<title>Python Exam · Trial</title>');
fs.mkdirSync(path.join(__dirname, '..', OUTDIR), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', OUTDIR, 'index.html'), html);
console.log(OUTDIR + '/index.html', html.length);
