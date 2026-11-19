/* Builds tools/preview.html: the real Index/Styles/App wired to the mocked backend, with demo data. */
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const NM = p => 'file://' + path.join(__dirname, 'node_modules', p);

const fonts = `<style>
@font-face{font-family:Roboto;font-weight:400;src:url(${NM('@fontsource/roboto/files/roboto-latin-400-normal.woff2')})}
@font-face{font-family:Roboto;font-weight:500;src:url(${NM('@fontsource/roboto/files/roboto-latin-500-normal.woff2')})}
@font-face{font-family:Roboto;font-weight:700;src:url(${NM('@fontsource/roboto/files/roboto-latin-700-normal.woff2')})}
@font-face{font-family:'Roboto Mono';font-weight:400;src:url(${NM('@fontsource/roboto-mono/files/roboto-mono-latin-400-normal.woff2')})}
@font-face{font-family:'Material Symbols Outlined';font-weight:100 700;src:url(${NM('material-symbols/material-symbols-outlined.woff2')})}
</style><link rel="stylesheet" href="${NM('@highlightjs/cdn-assets/styles/github.min.css')}">`;

const demo = `
<script>${R('tools/gas-mock.js')}</script>
<script>${R('apps-script/Seed.gs')}</script>
<script>${R('apps-script/Code.gs')}</script>
<script>
(function(){
  const q = new URLSearchParams(location.search);
  __setNow(q.get('now') || '2026-11-19T03:35:00Z');           // 09:05 IST on Day 1
  const clear = () => Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; });
  const call = (a, t, p) => { clear(); const r = JSON.parse(api(a, t, p || {})); if (!r.ok) throw new Error(a + ': ' + r.error); return r.data; };
  window.__call = call;
  setup();
  const T = call('login', null, { username: 'admin', password: 'ChangeMe@123' }).token;
  call('bulkAddStudents', T, { text: ['Priya Sharma, pass','Arun Kumar, pass','Meena Raj, pass','Karthik S, pass','Divya Lakshmi, pass','Rahul Verma, pass','Sneha Iyer, pass','Vikram N, pass'].join('\\n') });
  const tok = {}; ['priya.sharma','arun.kumar','meena.raj','karthik.s','divya.lakshmi','rahul.verma','sneha.iyer'].forEach(u => { tok[u] = call('login', null, { username: u, password: 'pass' }).token; });
  const P = tok['priya.sharma'];
  // a few check-ins & progress
  ['priya.sharma','arun.kumar','meena.raj','divya.lakshmi','sneha.iyer'].forEach(u => call('checkIn', tok[u]));
  call('toggleProgress', P, { dayId: 'd01', item: 'scrum', done: true });
  ['scrum','paper','code'].forEach(i => { call('toggleProgress', tok['arun.kumar'], { dayId: 'd01', item: i, done: true }); call('toggleProgress', tok['meena.raj'], { dayId: 'd01', item: i, done: true }); });
  call('submitAssignment', tok['arun.kumar'], { assignmentId: 'a01', type: 'paste', code: '# Bio card\\nname = input("Name: ")\\nage = input("Age: ")\\ncity = input("City: ")\\n\\nprint("=" * 30)\\nprint(f"Name : {name}")\\nprint(f"Age  : {age}")\\nprint(f"City : {city}")\\nprint("=" * 30)' });
  call('submitAssignment', tok['meena.raj'], { assignmentId: 'a01', type: 'file', fileName: 'bio_card.py', code: 'name = input("Your name: ")\\nprint("Hello", name)' });
  call('askDoubt', tok['divya.lakshmi'], { dayId: 'd01', question: 'VS Code says "python is not recognized". What should I do?' });
  call('saveReflection', tok['arun.kumar'], { dayId: 'd01', learned: 'print and input, running files from terminal', stuck: '', confidence: 4 });
  call('saveReflection', tok['karthik.s'], { dayId: 'd01', learned: 'Installed Python', stuck: 'Not sure how input works with numbers', confidence: 2 });
  call('saveAnnouncement', T, { title: 'Welcome to the internship!', body: 'Bring your laptop **fully charged** every day. Check in between 8:45 and 11:00 AM.', pinned: true });
  call('saveAnnouncement', T, { title: 'Study materials', body: 'Day 1 slides are in Study materials > Week 1.' });
  const mat = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('MATERIALS_FOLDER_ID'));
  const sub = n => mat.getFoldersByName(n).next();
  sub('Week 1').createFile('Day 1 - Setup & First Program.pdf', 'x'.repeat(240000), 'application/pdf');
  sub('Week 1').createFile('print_input_examples.py', 'print(1)', 'text/x-python');
  sub('Week 1').createFile('Python cheat sheet', 'x'.repeat(12000), 'application/vnd.google-apps.document');
  sub('Common').createFile('VS Code install guide.pdf', 'x'.repeat(90000), 'application/pdf');
  if (q.get('tracks')) {
    call('saveSettings', T, { trackSelectionOpen: true });
    call('requestTrack', tok['meena.raj'], { trackId: 'data' });
  }
  const as = q.get('as') || 'student';
  localStorage.setItem('codetrack_token_v1', as === 'admin' ? T : P);
  // google.script.run shim (async, JSON round trip like the real thing)
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get() {
    let ok = () => {}, bad = () => {};
    const r = { withSuccessHandler(f) { ok = f; return r; }, withFailureHandler(f) { bad = f; return r; },
      api(a, t, p) { setTimeout(() => { try { clear(); ok(api(a, t, JSON.parse(JSON.stringify(p || {})))); } catch (e) { bad(e); } }, 120); } };
    return r;
  } });
})();
</script>`;

let html = R('apps-script/Index.html')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>\s*/g, '')
  .replace(/<link rel="stylesheet" href="https:\/\/cdnjs[^>]*>/, () => fonts)
  .replace(/<script src="https:\/\/cdnjs[^>]*><\/script>/, `<script src="${NM('@highlightjs/cdn-assets/highlight.min.js')}"></script>`)
  .replace("<?!= include('Styles'); ?>", () => R('apps-script/Styles.html'))
  .replace("<?!= include('App'); ?>", () => demo + R('apps-script/App.html'));
fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
console.log('preview.html written', html.length);
