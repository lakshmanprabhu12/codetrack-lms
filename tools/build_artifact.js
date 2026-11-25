/* Builds tools/lab-preview.html: the real front end + Lab wired to the in-browser mock backend,
   with demo data and a demo bar. Self-contained except CDN fonts / highlight.js / Pyodide. */
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const pyUrl = process.argv[2] || '';   // optional override (local testing)

const demo = `
<script>${R('tools/gas-mock.js')}</script>
<script>${R('apps-script/Seed.gs')}</script>
<script>${R('apps-script/Code.gs')}</script>
<script>
(function(){
  __setNow('2026-11-26T03:45:00Z');            // Thu 26 Nov, 09:15 IST (demo clock)
  const clear = () => Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; });
  const call = (a, t, p) => { clear(); const r = JSON.parse(api(a, t, p || {})); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
  setup();
  const T = call('login', null, { username: 'admin', password: 'ChangeMe@123' }).token;
  call('bulkAddStudents', T, { text: 'Priya Sharma, pass\\nArun Kumar, pass\\nMeena Raj, pass' });
  call('saveAnnouncement', T, { title: 'Revision test today', body: 'The coding part runs in **CodeTrack Lab**. Open Assignments at 9:15.', pinned: true });
  const desc1 = 'Ask for a mark (0-100) with input().\\nPrint **Pass** if the mark is 35 or more, otherwise print **Fail**.\\n\\nExample: input 75 → Pass';
  call('saveAssignment', T, { title: 'Pass or Fail checker', dayId: 'd01', due: '2026-11-30T23:59', description: desc1, mode: 'lab', maxSwitches: 3,
    tests: JSON.stringify([{ input: '75', expect: 'Pass' }, { input: '20', expect: 'Fail' }, { input: '35', expect: 'Pass', hidden: true }]) });
  call('saveAssignment', T, { title: 'Revision test — Coding Q1 (Even or Odd)', dayId: 'd01', mode: 'exam', maxSwitches: 3,
    examStart: '2026-11-26T09:00', examEnd: '2026-11-26T09:45',
    description: 'Read a whole number with input().\\nPrint **Even** if it is divisible by 2, otherwise print **Odd**.\\n\\nYou have until the timer runs out.',
    tests: [{ input: '4', expect: 'Even' }, { input: '7', expect: 'Odd' }, { input: '0', expect: 'Even' }] });
  const st = call('bootstrap', T);
  const lab = st.assignments.find(a => a.mode === 'lab'), ex = st.assignments.find(a => a.mode === 'exam');
  const A = call('login', null, { username: 'arun.kumar', password: 'pass' }).token;
  const M = call('login', null, { username: 'meena.raj', password: 'pass' }).token;
  call('submitAssignment', A, { assignmentId: lab.id, type: 'lab', code: 'mark = int(input("Enter mark: "))\\nif mark > 35:\\n    print("Pass")\\nelse:\\n    print("Fail")\\n',
    testOutputs: ['Enter mark: Pass\\n', 'Enter mark: Fail\\n', 'Enter mark: Fail\\n'],
    integrity: { typed: 210, deleted: 12, pasteBlocked: 3, maxBurst: 96, bursts: [{ t: 40, n: 96 }], tabSwitches: 6, runs: 2, errors: 0, activeSec: 70, totalSec: 260, timeline: [0, 180, 20, 0, 4, 6, 0, 0] } });
  call('submitAssignment', M, { assignmentId: lab.id, type: 'lab', code: 'mark = int(input("Mark: "))\\nif mark >= 35:\\n    print("Pass")\\nelse:\\n    print("Fail")\\n',
    testOutputs: ['Mark: Pass\\n', 'Mark: Fail\\n', 'Mark: Pass\\n'],
    integrity: { typed: 140, deleted: 31, maxBurst: 6, tabSwitches: 0, runs: 5, errors: 1, activeSec: 420, totalSec: 600, timeline: [8, 12, 15, 9, 20, 11, 14, 10, 7, 13, 9, 12, 6, 0, 0, 3, 5, 0, 0, 0] } });
  call('submitAssignment', M, { assignmentId: ex.id, type: 'lab', code: 'n = int(input())\\nif n % 2 == 0:\\n    print("Even")\\nelse:\\n    print("Odd")\\n',
    testOutputs: ['Even\\n', 'Odd\\n', 'Even\\n'],
    integrity: { typed: 95, deleted: 8, maxBurst: 4, tabSwitches: 1, fsExits: 1, runs: 3, activeSec: 300, totalSec: 640, timeline: [5, 9, 12, 8, 10, 6, 4, 9, 3, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0] } });

  window.CODETRACK_CONFIG = { apiUrl: 'https://script.google.com/macros/s/DEMO/exec', pyodideUrl: ${pyUrl ? `'${pyUrl}'` : "new URL('pyodide/', location.href).href, pyodideStdlibJs: new URL('pyodide/python_stdlib.js', location.href).href"} };
  window.fetch = (function (realFetch) { return (url, opts) => {
    if (String(url).indexOf('script.google.com') < 0) return realFetch(url, opts);
    return new Promise(res => setTimeout(() => { clear(); const out = doPost({ postData: { contents: opts.body } }).getContent();
      res({ ok: true, status: 200, json: async () => JSON.parse(out) }); }, 150));
  }; })(window.fetch.bind(window));
})();
</script>`;

const bar = `
<div id="demo-bar"><b>Preview</b><span>demo data · clock fixed at Thu 26 Nov, 9:15 AM</span>
  <button data-demo="student">Sign in as student</button><button data-demo="admin">Sign in as instructor</button></div>
<style>
#demo-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;
  background:#1f1f1f;color:#fff;border-radius:999px;padding:6px 8px 6px 16px;box-shadow:0 4px 18px rgba(0,0,0,.25);font-size:13px;max-width:calc(100vw - 24px)}
#demo-bar span{color:#bdc1c6}
#demo-bar button{border:0;border-radius:999px;padding:7px 14px;background:#a8c7fa;color:#041e49;font:500 13px Roboto,Arial,sans-serif;cursor:pointer}
#demo-bar button+button{background:#fff}
body.exam-on #demo-bar{display:none}
@media (max-width:640px){#demo-bar span{display:none}}
</style>
<script>
(function(){
  const who = { student: ['priya.sharma', 'pass'], admin: ['admin', 'ChangeMe@123'] };
  function fill(k) {
    const u = document.getElementById('lg-user');
    if (!u) return false;
    u.value = who[k][0]; document.getElementById('lg-pass').value = who[k][1];
    u.closest('form').requestSubmit();
    return true;
  }
  document.getElementById('demo-bar').addEventListener('click', e => {
    const b = e.target.closest('[data-demo]'); if (!b) return;
    if (fill(b.dataset.demo)) return;
    const so = document.querySelector('[data-act="signOut"]');
    if (so) so.click();
    let n = 0; const t = setInterval(() => { if (fill(b.dataset.demo) || ++n > 40) clearInterval(t); }, 100);
  });
  new MutationObserver(() => document.body.classList.toggle('exam-on', !!document.querySelector('.exam-wrap'))).observe(document.getElementById('app'), { childList: true });
})();
</script>`;

let html = R('docs/index.html')
  .replace('<title>CodeTrack</title>', '<title>CodeTrack Lab preview</title>')
  .replace('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">', () => '<style>' + fs.readFileSync(path.join(__dirname, 'node_modules/@highlightjs/cdn-assets/styles/github.min.css'), 'utf8') + '</style>')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + R('docs/styles.css') + '</style>')
  .replace('<script src="config.js"></script>', () => demo)
  .replace('<script src="lab.js"></script>', () => '<script>' + R('docs/lab.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + R('docs/app.js') + '</script>' + bar);
fs.writeFileSync(path.join(__dirname, 'lab-preview.html'), html);
console.log('lab-preview.html', html.length);
