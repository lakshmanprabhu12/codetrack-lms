/* Builds preview-full/index.html: the complete CodeTrack front end on the in-browser mock backend,
   with the real exam paper, a Lab practice assignment and proctoring. Never publish this unencrypted (it contains the answer key). */
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const users = JSON.parse(R('tools/trial-users.json'));
const paper = R('tools/revision-test.json');
const cfg = R('docs/config.js').match(/reviewPinHash: '([0-9a-f]+)'/)[1];
const boot = `
<script>${R('tools/gas-mock.js')}</script>
<script>${R('apps-script/Seed.gs')}</script>
<script>${R('apps-script/Code.gs')}</script>
<script>
(function(){
  const KEY = 'ct_preview_full_v1';
  const clear = () => Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; });
  const call = (a, t, p) => { clear(); const r = JSON.parse(api(a, t, p || {})); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
  setup(); clear();
  insertMany_('Users', ${JSON.stringify(users)}); clear();
  const T = call('login', null, { username: 'admin', password: 'ChangeMe@123' }).token;
  call('saveExam', T, { json: ${JSON.stringify(paper)} });
  call('saveAssignment', T, { title: 'Pass or Fail checker (Lab practice)', dayId: 'd01', due: '2026-11-30T23:59', mode: 'lab', maxSwitches: 3,
    description: 'Ask for a mark (0-100) with input().\\nPrint **Pass** if the mark is 35 or more, otherwise print **Fail**.',
    tests: JSON.stringify([{ input: '75', expect: 'Pass' }, { input: '20', expect: 'Fail' }, { input: '35', expect: 'Pass', hidden: true }]) });
  call('saveAnnouncement', T, { title: 'Master Revision Test today', body: 'Open the exam card on your home page at 9:00. Laptop charged, camera on.', pinned: true });
  clear();
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  const KEEP = ['ExamAttempts', 'Sessions', 'Points', 'ProctorFlags', 'Submissions', 'Attendance', 'Progress'];
  try { const snap = JSON.parse(localStorage.getItem(KEY) || 'null'); if (snap) KEEP.forEach(n => { if (snap[n]) { const s = ss.getSheetByName(n); s._data = snap[n].data; s._maxRows = snap[n].maxRows; } }); } catch (e) { /* ignore */ }
  const persist = () => { try { const o = {}; KEEP.forEach(n => { const s = ss.getSheetByName(n); o[n] = { data: s._data, maxRows: s._maxRows }; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* ignore */ } };
  window.CODETRACK_CONFIG = { apiUrl: 'https://script.google.com/macros/s/PREVIEW/exec', proctor: true, reviewPinHash: '${cfg}' };
  window.fetch = (function (realFetch) { return (url, opts) => {
    if (String(url).indexOf('script.google.com') < 0) return realFetch(url, opts);
    return new Promise(res => setTimeout(() => { clear(); const out = doPost({ postData: { contents: opts.body } }).getContent(); persist();
      res({ ok: true, status: 200, json: async () => JSON.parse(out) }); }, 80));
  }; })(window.fetch.bind(window));
  window.__resetPreview = () => { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
})();
</script>`;
const bar = `<div id="pv-bar">Preview · test data only <button onclick="__resetPreview()">Reset</button></div>
<style>#pv-bar{position:fixed;right:12px;bottom:12px;z-index:300;background:#1f1f1f;color:#fff;border-radius:999px;padding:5px 6px 5px 14px;font:12.5px Roboto,Arial,sans-serif;display:flex;gap:8px;align-items:center;opacity:.85}
#pv-bar button{border:0;border-radius:999px;padding:4px 10px;background:#a8c7fa;color:#041e49;font:500 12px Roboto,Arial,sans-serif;cursor:pointer}body:has(.xm-take) #pv-bar{display:none}</style>`;
let html = R('docs/index.html')
  .replace('<title>CodeTrack</title>', '<title>CodeTrack · Preview</title>')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + R('docs/styles.css') + '</style>')
  .replace('<script src="config.js"></script>', () => boot)
  .replace('<script src="lab.js"></script>', () => '<script>' + R('docs/lab.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + R('docs/app.js') + '</script>')
  .replace('<script src="exam.js"></script>', () => '<script>' + R('docs/exam.js') + '</script>')
  .replace('<script src="proctor.js"></script>', () => '<script>' + R('docs/proctor.js') + '</script>' + bar);
fs.mkdirSync(path.join(__dirname, '..', 'preview-full'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'preview-full', 'index.html'), html);
console.log('preview-full/index.html', html.length);
