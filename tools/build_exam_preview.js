/* Builds tools/exam-preview.html: exam-only mode (login → exam home → rules → sections → done) on the mock backend. */
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const pyUrl = process.argv[2] || '';
const paper = R('tools/revision-test.json');
const demo = `
<script>${R('tools/gas-mock.js')}</script>
<script>${R('apps-script/Seed.gs')}</script>
<script>${R('apps-script/Code.gs')}</script>
<script>
(function(){
  const clear = () => Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; });
  const call = (a, t, p) => { clear(); const r = JSON.parse(api(a, t, p || {})); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
  setup();
  const T = call('login', null, { username: 'admin', password: 'ChangeMe@123' }).token;
  call('bulkAddStudents', T, { text: 'Priya Sharma, pass' });
  call('saveExam', T, { json: ${JSON.stringify(paper)} });
  window.__adminToken = T;
  window.CODETRACK_CONFIG = { apiUrl: 'https://script.google.com/macros/s/DEMO/exec', examOnly: true, brandName: 'Python Internship · Assessment',
    ${pyUrl ? `pyodideUrl: '${pyUrl}'` : "pyodideUrl: new URL('pyodide/', location.href).href, pyodideStdlibJs: new URL('pyodide/python_stdlib.js', location.href).href"} };
  window.fetch = (function (realFetch) { return (url, opts) => {
    if (String(url).indexOf('script.google.com') < 0) return realFetch(url, opts);
    return new Promise(res => setTimeout(() => { clear(); const out = doPost({ postData: { contents: opts.body } }).getContent();
      res({ ok: true, status: 200, json: async () => JSON.parse(out) }); }, 150));
  }; })(window.fetch.bind(window));
})();
</script>`;
const hint = `
<div id="demo-hint">Preview · demo student: <b>Priya Sharma</b> / <b>pass</b> <button type="button" id="demo-fill">Fill in</button></div>
<style>
#demo-hint{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:90;background:#1f1f1f;color:#fff;border-radius:999px;padding:6px 8px 6px 16px;font-size:13px;display:flex;gap:8px;align-items:center;box-shadow:0 4px 14px rgba(0,0,0,.2);white-space:nowrap}
#demo-hint button{border:0;border-radius:999px;padding:5px 12px;background:#a8c7fa;color:#041e49;font:500 13px Roboto,Arial,sans-serif;cursor:pointer}
</style>
<script>
(function(){
  const h = document.getElementById('demo-hint');
  document.getElementById('demo-fill').addEventListener('click', () => {
    const u = document.getElementById('lg-user'); if (!u) return;
    u.value = 'Priya Sharma'; document.getElementById('lg-pass').value = 'pass'; u.closest('form').requestSubmit();
  });
  new MutationObserver(() => { h.style.display = document.getElementById('lg-user') ? 'flex' : 'none'; }).observe(document.getElementById('app'), { childList: true });
})();
</script>`;
let html = R('docs/index.html')
  .replace('<title>CodeTrack</title>', '<title>Python Revision Test</title>')
  .replace('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">', () => '<style>' + fs.readFileSync(path.join(__dirname, 'node_modules/@highlightjs/cdn-assets/styles/github.min.css'), 'utf8') + '</style>')
  .replace('<link rel="stylesheet" href="styles.css">', () => '<style>' + R('docs/styles.css') + '</style>')
  .replace('<script src="config.js"></script>', () => demo)
  .replace('<script src="lab.js"></script>', () => '<script>' + R('docs/lab.js') + '</script>')
  .replace('<script src="app.js"></script>', () => '<script>' + R('docs/app.js') + '</script>')
  .replace('<script src="exam.js"></script>', () => '<script>' + R('docs/exam.js') + '</script>' + hint);
fs.writeFileSync(path.join(__dirname, 'exam-preview.html'), html);
console.log('exam-preview.html', html.length);
