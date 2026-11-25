/* CodeTrack Lab — a type-only Python editor that runs code in the browser (Pyodide).
   window.CTLab.create(opts) returns a lab instance with a persistent DOM element (lab.el)
   that the app moves between renders, so code, output and integrity data survive re-renders. */
(function () {
'use strict';

const CFG = window.CODETRACK_CONFIG || {};
const PY_URL = CFG.pyodideUrl || 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
const RUN_TIMEOUT_MS = 10000;
const OUT_CAP = 20000;
const BURST = 30;               // chars inserted in one go that count as a "burst"
const TICK = 30;                // seconds per timeline bucket

const esc = s => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = n => `<span class="msi" aria-hidden="true">${n}</span>`;
const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } };
const load = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

/* ---------------------------------------------------------------
 * Python runner: one Web Worker shared by every lab on the page
 * ------------------------------------------------------------- */
/* Runs student code with input() as an awaitable, so the program can pause and wait for the user like a terminal. */
const PY_HELPER = "import ast, inspect, sys\n\ndef __ct_transform(src):\n    tree = ast.parse(src, 'main.py')\n    funcs = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)]\n    need, changed = set(), True\n    while changed:\n        changed = False\n        for f in funcs:\n            if f.name in need: continue\n            for c in ast.walk(f):\n                if isinstance(c, ast.Call) and isinstance(c.func, ast.Name) and (c.func.id == 'input' or c.func.id in need):\n                    need.add(f.name); changed = True; break\n    class T(ast.NodeTransformer):\n        def visit_FunctionDef(self, node):\n            self.generic_visit(node)\n            if node.name not in need: return node\n            return ast.copy_location(ast.AsyncFunctionDef(**{k: getattr(node, k) for k in node._fields}), node)\n        def visit_Call(self, node):\n            self.generic_visit(node)\n            if isinstance(node.func, ast.Name) and node.func.id == 'input':\n                node.func = ast.copy_location(ast.Name('__ct_input', ast.Load()), node.func)\n                return ast.copy_location(ast.Await(node), node)\n            if isinstance(node.func, ast.Name) and node.func.id in need:\n                return ast.copy_location(ast.Await(node), node)\n            return node\n    tree = ast.fix_missing_locations(T().visit(tree))\n    return compile(tree, 'main.py', 'exec', flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)\n\nasync def __ct_exec(src, g):\n    import linecache\n    linecache.cache['main.py'] = (len(src), None, src.splitlines(True), 'main.py')\n    try:\n        code = __ct_transform(src)\n    except SyntaxError:\n        code = compile(src, 'main.py', 'exec')      # real syntax errors / unsupported spots: report as Python would\n    r = eval(code, g)\n    if inspect.iscoroutine(r):\n        await r\n\nasync def __ct_input(prompt=''):\n    import sys\n    sys.stdout.write(str(prompt)); sys.stdout.flush()\n    v = await __js_ask(str(prompt))\n    if v is None:\n        raise EOFError('EOF when reading a line')\n    return str(v)\n";

const WORKER_SRC = `
let py = null, queue = [], dec = new TextDecoder(), errDec = new TextDecoder();
let cur = null, interactive = false, pendingAsk = null;
let HELPER = '';
function post(m) { self.postMessage(m); }
async function init(url, stdlibJs) {
  if (stdlibJs) {
    // Hosts that cannot serve .zip ship the standard library as base64 inside a .js file
    importScripts(stdlibJs);
    const bin = atob(self.PY_STDLIB_B64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    self.PY_STDLIB_B64 = null;
    const realFetch = self.fetch.bind(self);
    self.fetch = (u, o) => /python_stdlib\.zip/.test(String(u && u.url || u)) ? Promise.resolve(new Response(bytes, { headers: { 'Content-Type': 'application/zip' } })) : realFetch(u, o);
  }
  importScripts(url + 'pyodide.js');
  py = await loadPyodide({ indexURL: url });
  py.setStdout({ write: b => { post({ t: 'out', id: cur, s: dec.decode(b, { stream: true }) }); return b.length; } });
  py.setStderr({ write: b => { post({ t: 'err', id: cur, s: errDec.decode(b, { stream: true }) }); return b.length; } });
  py.runPython(HELPER);
  // input(): take queued values first (tests); otherwise pause and ask the page, like a terminal
  py.globals.set('__js_ask', () => {
    if (queue.length) { const v = queue.shift(); post({ t: 'in', id: cur, s: v }); return Promise.resolve(v); }
    if (!interactive) { post({ t: 'eof', id: cur }); return Promise.resolve(null); }
    return new Promise(res => { pendingAsk = res; post({ t: 'ask', id: cur }); });
  });
  py.setStdin({ stdin: () => {
    if (!queue.length) { post({ t: 'eof', id: cur }); return undefined; }
    const v = queue.shift();
    post({ t: 'in', id: cur, s: v });
    return v + '\\n';
  } });
  post({ t: 'ready', v: py.version });
}
self.onmessage = async e => {
  const m = e.data;
  if (m.t === 'init') { HELPER = m.helper; try { await init(m.url, m.stdlib); } catch (err) { post({ t: 'fail', s: String(err && err.message || err) }); } return; }
  if (m.t === 'answer') { if (pendingAsk) { const r = pendingAsk; pendingAsk = null; r(m.s); } return; }
  if (m.t !== 'run') return;
  cur = m.id; queue = (m.stdin || []).slice(); interactive = !!m.interactive; pendingAsk = null;
  const t0 = performance.now();
  try {
    try { await py.loadPackagesFromImports(m.code); } catch (e2) { /* offline or unknown package: let the import fail normally */ }
    const g = py.globals.get('dict')();
    g.set('__name__', '__main__');
    g.set('__ct_input', py.globals.get('__ct_input'));
    await py.globals.get('__ct_exec')(m.code, g);
    g.destroy();
    post({ t: 'done', id: cur, ok: true, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    post({ t: 'done', id: cur, ok: false, error: String(err && err.message || err), ms: Math.round(performance.now() - t0) });
  }
};`;

const Runner = {
  worker: null, ready: false, loading: null, seq: 0, jobs: {}, listeners: new Set(),
  status() { return this.ready ? 'ready' : this.loading ? 'loading' : 'idle'; },
  emit() { this.listeners.forEach(fn => { try { fn(this.status()); } catch (e) { /* ignore */ } }); },
  start() {
    if (this.ready) return Promise.resolve();
    if (this.loading) return this.loading;
    this.loading = new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }))); }
      catch (e) { this.loading = null; reject(new Error('This browser cannot run Python here.')); return; }
      this.worker = w;
      const guard = setTimeout(() => { this.reset(); reject(new Error('Python did not load within 60 seconds. Check your internet connection and press Run again.')); }, 60000);
      w.onmessage = e => {
        const m = e.data;
        if (m.t === 'ready') { clearTimeout(guard); this.ready = true; this.emit(); resolve(); return; }
        if (m.t === 'fail') { clearTimeout(guard); this.reset(); reject(new Error('Could not load Python: ' + m.s)); return; }
        const job = this.jobs[m.id];
        if (job) job.onMsg(m);
      };
      w.onerror = e => { e.preventDefault(); clearTimeout(guard); this.reset(); reject(new Error('Could not load Python. Check your internet connection and try again.')); };
      w.postMessage({ t: 'init', url: PY_URL, stdlib: CFG.pyodideStdlibJs || '', helper: PY_HELPER });
    });
    this.emit();
    this.loading.catch(() => { this.loading = null; this.emit(); });
    return this.loading;
  },
  reset() {
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* ignore */ } }
    this.worker = null; this.ready = false; this.loading = null;
    Object.keys(this.jobs).forEach(id => { const j = this.jobs[id]; delete this.jobs[id]; j.finish({ ok: false, killed: true }); });
    this.emit();
  },
  /* Runs code; onOut(kind, text) streams output. Resolves { ok, error, ms, timeout, killed, eof } */
  answer(text) { if (this.worker) this.worker.postMessage({ t: 'answer', s: text }); },
  async run(code, stdin, onOut, timeoutMs, onAsk) {
    await this.start();
    const id = ++this.seq;
    return new Promise(resolve => {
      let done = false, eof = false;
      const finish = r => {
        if (done) return; done = true;
        clearTimeout(timer); delete this.jobs[id];
        r.eof = eof; resolve(r);
      };
      let timer = null;
      const arm = () => { clearTimeout(timer); timer = setTimeout(() => { finish({ ok: false, timeout: true }); this.reset(); this.start().catch(() => {}); }, timeoutMs || RUN_TIMEOUT_MS); };
      arm();
      this.jobs[id] = {
        finish,
        onMsg: m => {
          if (m.t === 'out' || m.t === 'err' || m.t === 'in') onOut(m.t, m.s);
          else if (m.t === 'eof') eof = true;
          else if (m.t === 'ask') { clearTimeout(timer); if (onAsk) onAsk(v => { arm(); this.answer(v); }); }
          else if (m.t === 'done') finish({ ok: m.ok, error: m.error, ms: m.ms });
        }
      };
      this.worker.postMessage({ t: 'run', id, code, stdin, interactive: !!onAsk });
    });
  },
  stop() { if (Object.keys(this.jobs).length) { this.reset(); this.start().catch(() => {}); } }
};

/* Keep only the student's own frames in a traceback. */
function cleanTraceback(tb) {
  const lines = String(tb || '').replace(/\s+$/, '').split('\n');
  const out = [];
  let skip = false;
  for (const l of lines) {
    const f = /^\s*File "([^"]+)"/.exec(l);
    if (f) { skip = f[1] !== 'main.py'; if (!skip) out.push(l); continue; }
    if (skip && /^\s/.test(l)) continue;
    skip = false;
    out.push(l);
  }
  return out.join('\n');
}
function friendlyHint(err) {
  const last = String(err).trim().split('\n').pop() || '';
  if (/^EOFError/.test(last)) return 'Your program asked for more input than this test gives.';
  if (/^IndentationError|^TabError/.test(last)) return 'Check your indentation: lines inside a block need 4 more spaces than the line ending with ":".';
  if (/^NameError/.test(last)) return 'A name is used before it is defined, or it is misspelt (Python is case-sensitive).';
  if (/^SyntaxError/.test(last)) return 'Python could not read this line. Look for a missing ":", bracket or quote near the arrow.';
  if (/^ValueError: invalid literal for int/.test(last)) return 'int() got text that is not a whole number. Check what you typed.';
  if (/^TypeError: can only concatenate str/.test(last)) return 'You joined text and a number with +. Convert with str(), or use an f-string.';
  if (/^ModuleNotFoundError/.test(last)) return 'That module is not available in the browser Lab.';
  if (/^ZeroDivisionError/.test(last)) return 'Something was divided by zero.';
  return '';
}

/* ---------------------------------------------------------------
 * Integrity tracker
 * ------------------------------------------------------------- */
function newIntegrity() {
  return { typed: 0, deleted: 0, pasteBlocked: 0, copyBlocked: 0, maxBurst: 0, bursts: [], tabSwitches: 0, fsExits: 0,
           runs: 0, errors: 0, activeSec: 0, totalSec: 0, idleSec: 0, reloads: 0, timeline: [], startedAt: '' };
}

/* ---------------------------------------------------------------
 * Lab instance
 * ------------------------------------------------------------- */
let LID = 0;
function create(opts) {
  opts = Object.assign({ key: 'playground', title: 'main.py', tests: [], exam: false, submitLabel: 'Submit', starter: '', toast: () => {} }, opts || {});
  const id = 'lab' + (++LID);
  const saveKey = 'ct_lab_v1_' + opts.key;
  const saved = (() => { try { return JSON.parse(load(saveKey) || 'null'); } catch (e) { return null; } })();
  const integ = Object.assign(newIntegrity(), saved && saved.integ || {});
  if (saved) integ.reloads++;
  if (!integ.startedAt) integ.startedAt = new Date().toISOString();
  const st = {
    code: saved && typeof saved.code === 'string' ? saved.code : opts.starter,
    input: saved && typeof saved.input === 'string' ? saved.input : '',
    running: false, testRun: null, results: null, lastKey: Date.now(), bucket: 0, tracking: true, destroyed: false
  };

  const el = document.createElement('div');
  el.className = 'lab' + (opts.exam ? ' exam' : '');
  el.id = id;
  const hasTests = opts.tests && opts.tests.length;
  el.innerHTML = `
    <div class="lab-bar">
      <div class="lab-file">${icon('description')}<span>${esc(opts.title)}</span></div>
      <span class="lab-status" data-r="status"></span>
      <div class="grow"></div>
      <button type="button" class="btn tonal sm" data-r="run" title="Run (Ctrl+Enter)">${icon('play_arrow')} Run</button>
      <button type="button" class="btn text sm hidden" data-r="stop">${icon('stop')} Stop</button>
      ${hasTests ? `<button type="button" class="btn outlined sm" data-r="tests">${icon('fact_check')} ${opts.exam ? 'Check' : 'Run tests'}</button>` : ''}
      ${opts.onSubmit ? `<button type="button" class="btn filled sm" data-r="submit">${icon('send')} ${esc(opts.submitLabel)}</button>` : ''}
    </div>
    <div class="lab-body">
      <div class="lab-editor" data-r="scroll">
        <div class="lab-gutter" data-r="gutter" aria-hidden="true"></div>
        <div class="lab-code">
          <pre class="lab-hl" aria-hidden="true"><code data-r="hl"></code></pre>
          <textarea data-r="ta" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Python code editor"></textarea>
        </div>
      </div>
      <div class="lab-side">
        <div class="lab-panel grow">
          <div class="lab-ph">${icon('terminal')} Terminal <span class="grow"></span><button type="button" class="icon-btn sm" data-r="clear" title="Clear output">${icon('backspace')}</button></div>
          <pre class="lab-out" data-r="out"><span class="muted">Press Run. When your program reaches input(), type your answer here and press Enter.</span></pre>
        </div>
        ${hasTests ? `<div class="lab-panel"><div class="lab-ph">${icon('fact_check')} Test cases <span class="grow"></span><span data-r="score"></span></div><div class="lab-tests" data-r="tests-list"></div></div>` : ''}
      </div>
    </div>
    <div class="lab-foot"><span>${icon('block')} Paste is turned off — type your code.</span><span class="grow"></span><span class="lab-keys"><kbd>Tab</kbd> indent · <kbd>Shift</kbd>+<kbd>Tab</kbd> outdent · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> run</span></div>`;

  const R = n => el.querySelector(`[data-r="${n}"]`);
  const ta = R('ta'), hl = R('hl'), gutter = R('gutter'), out = R('out'), statusEl = R('status');
  ta.value = st.code;

  /* ---------- rendering ---------- */
  function paint() {
    const code = ta.value;
    let html;
    if (window.hljs) { try { html = hljs.highlight(code, { language: 'python', ignoreIllegals: true }).value; } catch (e) { html = esc(code); } }
    else html = esc(code);
    hl.innerHTML = html + '\n';
    const n = code.split('\n').length;
    if (gutter.childElementCount !== n) {
      let g = '';
      for (let i = 1; i <= n; i++) g += '<div>' + i + '</div>';
      gutter.innerHTML = g;
    }
    // size the textarea to its content so the outer box does the scrolling
    ta.style.height = '0px'; ta.style.width = '0px';
    ta.style.height = Math.max(ta.scrollHeight, 200) + 'px';
    ta.style.width = Math.max(ta.scrollWidth, 100) + 'px';
  }
  function setStatus() {
    const s = Runner.status();
    statusEl.className = 'lab-status ' + (st.running ? 'run' : s);
    statusEl.innerHTML = st.running ? `${icon('progress_activity')} Running…` : s === 'ready' ? `${icon('check_circle')} Python ready` : s === 'loading' ? `${icon('downloading')} Loading Python…` : `${icon('cloud_download')} Python loads on first run`;
    R('run').disabled = st.running;
    R('stop').classList.toggle('hidden', !st.running);
    if (R('tests')) R('tests').disabled = st.running;
    if (R('submit')) R('submit').disabled = st.running;
  }
  const onRunner = () => { if (!st.destroyed) setStatus(); };
  Runner.listeners.add(onRunner);

  function outClear() { out.innerHTML = ''; out.dataset.n = '0'; }
  function outWrite(kind, text) {
    const n = +(out.dataset.n || 0);
    if (n > OUT_CAP) return;
    if (n + text.length > OUT_CAP) text = text.slice(0, OUT_CAP - n) + '\n… output cut off (too long)\n';
    out.dataset.n = String(n + text.length);
    const span = document.createElement('span');
    span.className = kind === 'err' ? 'o-err' : kind === 'in' ? 'o-in' : kind === 'info' ? 'o-info' : kind === 'ok' ? 'o-ok' : '';
    span.textContent = kind === 'in' ? text + '\n' : text;
    out.appendChild(span);
    out.scrollTop = out.scrollHeight;
  }

  /* ---------- persistence ---------- */
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => store(saveKey, JSON.stringify({ code: ta.value, integ })), 400);
  }

  /* ---------- editing helpers (execCommand keeps native undo) ---------- */
  function insert(text) {
    ta.focus();
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); onEdit({ inputType: 'insertText', data: text }); }
  }
  function lineStart(pos) { return ta.value.lastIndexOf('\n', pos - 1) + 1; }
  function selectLines() {
    const s = lineStart(ta.selectionStart);
    let e = ta.selectionEnd;
    if (e > s && ta.value[e - 1] === '\n') e--;
    const nl = ta.value.indexOf('\n', e);
    return [s, nl < 0 ? ta.value.length : nl];
  }
  function indentBlock(dedent) {
    const [s, e] = selectLines();
    const block = ta.value.slice(s, e);
    const lines = block.split('\n');
    const next = lines.map(l => dedent ? l.replace(/^( {1,4}|\t)/, '') : '    ' + l).join('\n');
    if (next === block) return;
    const caret = ta.selectionStart;
    ta.setSelectionRange(s, e);
    insert(next);
    if (lines.length === 1) { const d = next.length - block.length; const p = Math.max(s, caret + d); ta.setSelectionRange(p, p); }
    else ta.setSelectionRange(s, s + next.length);
  }

  /* ---------- tracking ---------- */
  let prevLen = ta.value.length;
  function onEdit(e) {
    const len = ta.value.length, delta = len - prevLen;
    prevLen = len;
    const kind = e && e.inputType || '';
    if (/^history/.test(kind)) { /* undo/redo: not typing */ }
    else if (delta > 0) {
      integ.typed += delta; st.bucket += delta;
      if (delta >= BURST) {
        integ.maxBurst = Math.max(integ.maxBurst, delta);
        if (integ.bursts.length < 30) integ.bursts.push({ t: Math.round((Date.now() - Date.parse(integ.startedAt)) / 1000), n: delta });
      }
    } else if (delta < 0) integ.deleted += -delta;
    st.lastKey = Date.now();
    st.code = ta.value;
    paint(); save();
    if (opts.onChange) opts.onChange();
  }
  const blockPaste = (e, what) => {
    e.preventDefault();
    integ.pasteBlocked++; save();
    opts.toast(what || 'Paste is turned off in CodeTrack Lab — type it out, it helps you learn.', true);
  };
  ta.addEventListener('paste', e => blockPaste(e));
  ta.addEventListener('drop', e => blockPaste(e, 'Drag-and-drop is turned off — type your code.'));
  ta.addEventListener('dragover', e => e.preventDefault());
  ta.addEventListener('beforeinput', e => {
    if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop' || e.inputType === 'insertFromPasteAsQuotation') blockPaste(e);
  });
  const blockCopy = e => { if (!opts.exam) return; e.preventDefault(); integ.copyBlocked++; save(); opts.toast('Copying is turned off during the exam.', true); };
  ta.addEventListener('copy', blockCopy);
  ta.addEventListener('cut', blockCopy);
  ta.addEventListener('contextmenu', e => { if (opts.exam) e.preventDefault(); });
  ta.addEventListener('input', onEdit);
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey || ta.selectionStart !== ta.selectionEnd) indentBlock(e.shiftKey);
      else insert('    ');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && ta.selectionStart === ta.selectionEnd) {
      const s = lineStart(ta.selectionStart);
      const before = ta.value.slice(s, ta.selectionStart);
      let ind = (/^[ \t]*/.exec(before) || [''])[0];
      if (/:\s*(#.*)?$/.test(before)) ind += '    ';
      else if (/^\s*(return|pass|break|continue|raise)\b/.test(before) && ind.length >= 4) ind = ind.slice(4);
      e.preventDefault();
      insert('\n' + ind);
      return;
    }
    if (e.key === 'Backspace' && ta.selectionStart === ta.selectionEnd) {
      const p = ta.selectionStart, s = lineStart(p), before = ta.value.slice(s, p);
      if (before.length && /^ +$/.test(before)) {
        const n = before.length % 4 || 4;
        e.preventDefault();
        ta.setSelectionRange(p - n, p);
        try { if (!document.execCommand('delete')) throw 0; } catch (x) { ta.setRangeText('', p - n, p, 'end'); onEdit({ inputType: 'deleteContentBackward' }); }
      }
    }
  });
  R('scroll').addEventListener('mousedown', e => { if (e.target === R('scroll') || e.target.closest('.lab-gutter')) { e.preventDefault(); ta.focus(); } });

  // time & focus tracking
  const tick = setInterval(() => {
    if (st.destroyed || !st.tracking || !document.body.contains(el)) return;
    integ.totalSec++;
    if (!document.hidden && Date.now() - st.lastKey < 60000) integ.activeSec++;
    else if (!document.hidden) integ.idleSec++;
    if (integ.totalSec % TICK === 0) { integ.timeline.push(st.bucket); st.bucket = 0; if (integ.timeline.length > 400) integ.timeline.shift(); save(); }
  }, 1000);
  let awayAt = 0;
  const away = () => {
    if (st.destroyed || !st.tracking || !document.body.contains(el) || awayAt) return;
    awayAt = Date.now();
    integ.tabSwitches++; save();
    if (opts.onAway) opts.onAway(integ.tabSwitches);
  };
  const back = () => { if (awayAt) { awayAt = 0; if (opts.onBack) opts.onBack(integ.tabSwitches); } };
  const onVis = () => { if (document.hidden) away(); else back(); };
  const onBlur = () => { setTimeout(() => { if (!document.hasFocus() && !document.hidden) away(); }, 400); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', back);

  /* ---------- running ---------- */
  /* terminal-style input(): an inline field at the end of the output */
  function ask(reply) {
    const box = document.createElement('span');
    box.className = 'o-ask';
    box.innerHTML = '<input type="text" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Program input">';
    out.appendChild(box);
    const inp = box.querySelector('input');
    const size = () => { inp.style.width = Math.max(2, inp.value.length + 2) + 'ch'; };
    size();
    inp.addEventListener('input', size);
    inp.addEventListener('paste', e => { if (opts.exam) { e.preventDefault(); integ.pasteBlocked++; save(); opts.toast('Paste is turned off during the exam.', true); } });
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const v = inp.value;
      box.remove();
      outWrite('in', v);
      reply(v);
    });
    out.scrollTop = out.scrollHeight;
    setTimeout(() => inp.focus(), 0);
  }
  out.addEventListener('mousedown', e => { const i = out.querySelector('.o-ask input'); if (i && e.target !== i) { e.preventDefault(); i.focus(); } });
  async function exec(code, lines, sink, onAsk) {
    st.running = true; setStatus();
    let r;
    try { r = await Runner.run(code, lines, sink, 0, onAsk); }
    catch (e) { r = { ok: false, loadError: e.message }; }
    st.running = false; setStatus();
    return r;
  }
  async function run() {
    if (st.running) return;
    const code = ta.value;
    if (!code.trim()) { opts.toast('Type some code first.', true); return; }
    outClear();
    let pending = !Runner.ready;
    if (pending) outWrite('info', 'Loading Python (the first run takes a few seconds)…\n');
    integ.runs++;
    const r = await exec(code, [], (k, s) => { if (pending) { pending = false; outClear(); } outWrite(k, s); }, (reply) => { if (pending) { pending = false; outClear(); } ask(reply); });
    if (pending) outClear();
    finishRun(r);
    save();
  }
  function finishRun(r) {
    if (r.loadError) { outWrite('err', r.loadError + '\n'); return; }
    if (r.timeout) { integ.errors++; outWrite('err', '\nStopped: your program ran for more than ' + (RUN_TIMEOUT_MS / 1000) + ' seconds. Is there an endless loop?\n'); return; }
    if (r.killed) { outWrite('info', '\nStopped.\n'); return; }
    if (!r.ok) {
      integ.errors++;
      const tb = cleanTraceback(r.error);
      outWrite('err', (out.dataset.n !== '0' ? '\n' : '') + tb + '\n');
      const h = friendlyHint(tb);
      if (h) outWrite('info', '💡 ' + h + '\n');
      return;
    }
    outWrite('ok', (out.dataset.n !== '0' ? '\n' : '') + '✓ Finished in ' + (r.ms / 1000).toFixed(2) + ' s\n');
  }

  /* run every test input; returns array of stdout strings (no echoed input) */
  async function runTests(quiet) {
    const tests = opts.tests || [];
    if (!tests.length) return [];
    const code = ta.value;
    if (!code.trim()) { opts.toast('Type some code first.', true); return null; }
    const outputs = [], results = [];
    const list = R('tests-list');
    if (!quiet && list) list.innerHTML = '<div class="muted small" style="padding:6px 2px">Running tests…</div>';
    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      let buf = '';
      const lines = String(t.input || '').replace(/\r/g, '').replace(/\n$/, '');
      const r = await exec(code, lines ? lines.split('\n') : [], (k, s) => { if (k === 'out') buf += s; });
      if (r.loadError) { opts.toast(r.loadError, true); if (list) list.innerHTML = ''; return null; }
      if (!r.ok && !r.killed) buf += r.timeout ? '\n[timed out]' : '\n' + cleanTraceback(r.error).split('\n').pop();
      if (r.killed) { if (list) list.innerHTML = ''; return null; }
      outputs.push(buf.slice(0, 4000));
      const pass = t.expect !== undefined ? norm(buf).indexOf(norm(t.expect)) >= 0 && !!norm(t.expect) : null;
      results.push({ pass, output: buf, error: !r.ok });
    }
    st.results = results;
    integ.runs++;
    if (!quiet) renderTests();
    save();
    return outputs;
  }
  function norm(s) { return String(s || '').replace(/\r/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').toLowerCase(); }
  function renderTests() {
    const list = R('tests-list');
    if (!list) return;
    const tests = opts.tests || [], res = st.results;
    let passed = 0, known = 0;
    list.innerHTML = tests.map((t, i) => {
      const r = res && res[i];
      let state = 'wait', label = '';
      if (r) {
        if (r.pass === null) { state = r.error ? 'bad' : 'ran'; label = r.error ? 'Error' : 'Ran'; }
        else { known++; if (r.pass) passed++; state = r.pass ? 'ok' : 'bad'; label = r.pass ? 'Passed' : 'Failed'; }
      }
      const showExpect = t.expect !== undefined;
      return `<details class="lab-test ${state}"><summary><span class="lt-dot">${icon(state === 'ok' ? 'check_circle' : state === 'bad' ? 'cancel' : state === 'ran' ? 'radio_button_checked' : 'radio_button_unchecked')}</span>
          <span class="grow">Test ${i + 1}${t.hidden ? ' · hidden' : ''}</span><span class="lt-label">${label}</span></summary>
        <div class="lt-body">
          <div><b>Input</b><pre>${esc(t.input || '(none)')}</pre></div>
          ${showExpect ? `<div><b>Expected output contains</b><pre>${esc(t.expect)}</pre></div>` : `<div class="muted small">Expected output is hidden${opts.exam ? ' during the exam' : ''}.</div>`}
          ${r ? `<div><b>Your output</b><pre>${esc(r.output || '(nothing printed)')}</pre></div>` : ''}
        </div></details>`;
    }).join('');
    const sc = R('score');
    if (sc) sc.innerHTML = res && known ? `<span class="pill ${passed === known ? 'green' : 'amber'}">${passed}/${known} passed</span>` : '';
  }

  R('run').addEventListener('click', run);
  R('stop').addEventListener('click', () => Runner.stop());
  R('clear').addEventListener('click', outClear);
  if (R('tests')) R('tests').addEventListener('click', () => { if (!st.running) runTests(false); });
  if (R('submit')) R('submit').addEventListener('click', () => submit(false));

  async function submit(auto) {
    if (st.running && !auto) return;
    if (st.running) Runner.stop();
    const code = ta.value;
    if (!code.trim() && !auto) { opts.toast('Type some code first.', true); return; }
    let outputs = [];
    if ((opts.tests || []).length && code.trim()) {
      outputs = await runTests(!!opts.exam);
      if (outputs === null) outputs = [];
    }
    return opts.onSubmit({ code, testOutputs: outputs, integrity: getIntegrity(auto) , auto: !!auto });
  }
  function getIntegrity(auto) {
    const x = JSON.parse(JSON.stringify(integ));
    if (st.bucket) x.timeline.push(st.bucket);
    if (auto) x.autoSubmitted = typeof auto === 'string' ? auto : 'auto';
    return x;
  }

  paint(); setStatus(); renderTests();
  if (opts.exam || opts.preload) Runner.start().catch(() => {});

  return {
    el, integ,
    focus() { ta.focus(); },
    paint,
    run, runTests, submit,
    getCode: () => ta.value,
    getIntegrity,
    setTracking(v) { st.tracking = !!v; },
    noteFullscreenExit() { integ.fsExits++; save(); },
    clearSaved() { store(saveKey, null); },
    destroy() {
      st.destroyed = true;
      clearInterval(tick); clearTimeout(saveT);
      Runner.listeners.delete(onRunner);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', back);
      el.remove();
    }
  };
}

window.CTLab = { create, Runner, cleanTraceback };
})();
