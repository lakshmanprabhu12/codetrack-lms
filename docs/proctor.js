/* CodeTrack Proctor: webcam + microphone checks during an exam, entirely in the browser.
   Flags (with a snapshot) are kept in this browser's IndexedDB; the instructor reviews them at <link>#review on the same PC. */
(function () {
'use strict';
const CFG = window.CODETRACK_CONFIG || {};
const VER = '1.2.3';
const WASM = CFG.mpWasm || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const BUNDLE = CFG.mpBundle || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`;
const MODEL = CFG.mpModel || 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const PIN_HASH = CFG.reviewPinHash || '';
const TICK_MS = 250;

const RULES = {
  noFace:  { label: 'No face in view',               hold: 3000 },
  multi:   { label: 'Another person in view',        hold: 1000 },
  away:    { label: 'Looking away from the screen',  hold: 4000 },
  talking: { label: 'Talking (mouth moving)',        hold: 3000 },
  voice:   { label: 'Voice / sound detected',        hold: 3000 },
  dark:    { label: 'Camera covered or too dark',    hold: 3000 },
  camOff:  { label: 'Camera turned off',             hold: 0 }
};
const STUDENT_MSG = {
  noFace: 'Keep your face in front of the camera.', multi: 'Only you should be in front of the camera.',
  away: 'Please look at your screen.', talking: 'Please don\'t talk during the exam.', voice: 'Please keep the room quiet.',
  dark: 'Your camera seems covered or too dark.', camOff: 'Your camera was turned off.'
};

/* ---------- IndexedDB ---------- */
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('ct_proctor', 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore('flags', { keyPath: 'id', autoIncrement: true }); s.createIndex('session', 'session'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function put(rec) {
  try { const d = await db(); await new Promise((res, rej) => { const t = d.transaction('flags', 'readwrite'); t.objectStore('flags').add(rec); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
  catch (e) { /* storage unavailable: keep in memory only */ mem.push(rec); }
}
async function all() {
  try { const d = await db(); return await new Promise((res, rej) => { const q = d.transaction('flags').objectStore('flags').getAll(); q.onsuccess = () => res(q.result.concat(mem)); q.onerror = () => rej(q.error); }); }
  catch (e) { return mem.slice(); }
}
async function wipe() { try { const d = await db(); await new Promise(res => { const t = d.transaction('flags', 'readwrite'); t.objectStore('flags').clear(); t.oncomplete = res; }); } catch (e) { /* ignore */ } mem.length = 0; }
const mem = [];

/* ---------- state ---------- */
const S = { stream: null, video: null, lm: null, loop: null, session: null, cond: {}, open: {}, counts: {}, audio: null, jaw: [], last: 0, widget: null, warnT: null };

async function prepare() {
  if (S.stream && S.stream.active) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser cannot use the camera. Use Chrome on a laptop.');
  try {
    S.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) {
    throw new Error(/NotAllowed|Permission/i.test(e.name + e.message)
      ? 'Camera and microphone access is required for this exam. Click the camera icon in the address bar, choose Allow, then press Take exam again.'
      : 'No working camera or microphone was found. Connect one and try again.');
  }
}

async function loadModel() {
  if (S.lm) return S.lm;
  const mp = await import(BUNDLE);
  const files = await mp.FilesetResolver.forVisionTasks(WASM);
  const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true });
  try { S.lm = await mp.FaceLandmarker.createFromOptions(files, opts('GPU')); }
  catch (e) { S.lm = await mp.FaceLandmarker.createFromOptions(files, opts('CPU')); }
  return S.lm;
}

function widget() {
  if (S.widget) return S.widget;
  const w = document.createElement('div');
  w.id = 'ctp-cam';
  w.innerHTML = `<video playsinline muted></video><div class="ctp-st"><i></i><span>Starting camera…</span></div><div class="ctp-warn"></div>`;
  document.body.appendChild(w);
  S.widget = w;
  return w;
}
function setStatus(text, ok) { const w = S.widget; if (!w) return; w.querySelector('.ctp-st span').textContent = text; w.classList.toggle('ok', !!ok); }
function warn(type) {
  const w = S.widget; if (!w) return;
  const el = w.querySelector('.ctp-warn');
  el.textContent = STUDENT_MSG[type] || ''; el.classList.add('on');
  clearTimeout(S.warnT); S.warnT = setTimeout(() => el.classList.remove('on'), 5000);
}

async function start(session) {
  S.session = session;
  await prepare();
  const w = widget();
  const v = w.querySelector('video');
  v.srcObject = S.stream;
  try { await v.play(); } catch (e) { /* autoplay muted is allowed */ }
  S.video = v;
  S.stream.getVideoTracks().forEach(t => { t.onended = () => flag('camOff'); });
  setupAudio();
  setStatus('Camera on · loading checks…', true);
  try { await loadModel(); setStatus('Camera on · monitoring', true); }
  catch (e) { setStatus('Camera on · face checks unavailable', true); console.warn('Face model failed', e); }
  clearInterval(S.loop);
  S.loop = setInterval(tick, TICK_MS);
}
function stop() {
  clearInterval(S.loop); S.loop = null;
  if (S.stream) S.stream.getTracks().forEach(t => { t.onended = null; t.stop(); });
  S.stream = null;
  if (S.audio) { try { S.audio.ctx.close(); } catch (e) { /* ignore */ } S.audio = null; }
  if (S.widget) { S.widget.remove(); S.widget = null; }
  S.cond = {}; S.open = {}; S.jaw = [];
}

function setupAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaStreamSource(S.stream);
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    src.connect(an);
    S.audio = { ctx, an, buf: new Float32Array(an.fftSize), floor: 0.01 };
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (e) { S.audio = null; }
}
function rms() {
  const a = S.audio; if (!a) return 0;
  a.an.getFloatTimeDomainData(a.buf);
  let s = 0; for (let i = 0; i < a.buf.length; i++) s += a.buf[i] * a.buf[i];
  const v = Math.sqrt(s / a.buf.length);
  a.floor = a.floor * 0.995 + Math.min(v, a.floor * 1.5 + 0.001) * 0.005;   // slow noise-floor estimate
  return v;
}
function brightness() {
  const c = S.small || (S.small = document.createElement('canvas'));
  c.width = 32; c.height = 24;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(S.video, 0, 0, 32, 24);
  const d = x.getImageData(0, 0, 32, 24).data;
  let s = 0; for (let i = 0; i < d.length; i += 4) s += (d[i] + d[i + 1] + d[i + 2]) / 3;
  return s / (d.length / 4);
}
const bs = (cats, name) => { const c = cats.find(k => k.categoryName === name); return c ? c.score : 0; };

function tick() {
  const v = S.video;
  if (!v || v.readyState < 2) return;
  const now = performance.now();
  const on = {};
  const light = brightness();
  on.dark = light < 22;
  const level = rms(); S.lastLevel = level;
  if (S.audio && level > Math.max(0.018, S.audio.floor * 3)) S.voiceAt = now;   // speech has short pauses: bridge gaps under ~0.8 s
  on.voice = !!S.voiceAt && now - S.voiceAt < 800;
  if (S.lm && !on.dark) {
    let r = null;
    try { r = S.lm.detectForVideo(v, now); } catch (e) { r = null; }
    if (r) {
      const n = (r.faceLandmarks || []).length;
      on.noFace = n === 0;
      on.multi = n >= 2;
      if (n >= 1) {
        const L = r.faceLandmarks[0];
        const nose = L[1], le = L[234], re = L[454];
        const yaw = (nose.x - le.x) / Math.max(1e-6, re.x - le.x);            // ~0.5 when facing the screen
        const cats = (r.faceBlendshapes && r.faceBlendshapes[0] && r.faceBlendshapes[0].categories) || [];
        const lookL = (bs(cats, 'eyeLookOutLeft') + bs(cats, 'eyeLookInRight')) / 2;
        const lookR = (bs(cats, 'eyeLookInLeft') + bs(cats, 'eyeLookOutRight')) / 2;
        const lookU = (bs(cats, 'eyeLookUpLeft') + bs(cats, 'eyeLookUpRight')) / 2;
        on.away = yaw < 0.28 || yaw > 0.72 || lookL > 0.6 || lookR > 0.6 || lookU > 0.6;   // looking down (keyboard) is allowed
        S.jaw.push(bs(cats, 'jawOpen'));
        if (S.jaw.length > 8) S.jaw.shift();
        const mean = S.jaw.reduce((a, b) => a + b, 0) / S.jaw.length;
        const sd = Math.sqrt(S.jaw.reduce((a, b) => a + (b - mean) * (b - mean), 0) / S.jaw.length);
        on.talking = S.jaw.length >= 6 && sd > 0.05 && Math.max.apply(null, S.jaw) > 0.18;
      } else S.jaw = [];
    }
  }
  Object.keys(RULES).forEach(k => {
    if (k === 'camOff') return;
    if (on[k]) {
      if (!S.cond[k]) S.cond[k] = now;
      if (!S.open[k] && now - S.cond[k] >= RULES[k].hold) { S.open[k] = true; flag(k); }
    } else { S.cond[k] = 0; S.open[k] = false; }
  });
}

function snapshot() {
  try {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 240;
    c.getContext('2d').drawImage(S.video, 0, 0, 320, 240);
    return c.toDataURL('image/jpeg', 0.7);
  } catch (e) { return ''; }
}
function flag(type) {
  S.counts[type] = (S.counts[type] || 0) + 1;
  warn(type);
  const s = S.session || {};
  const rec = { session: (s.attemptId || 'x') + '|' + (s.student || ''), student: s.student || '', username: s.username || '', exam: s.exam || '',
        type, label: RULES[type].label, at: new Date().toISOString(), section: s.section ? s.section() : '', img: S.video ? snapshot() : '' };
  put(rec);
  if (typeof s.onFlag === 'function') { try { s.onFlag(rec); } catch (e) { /* upload is best effort */ } }
}
function counts() { return Object.assign({}, S.counts); }
function total() { return Object.keys(S.counts).reduce((t, k) => t + S.counts[k], 0); }

/* ---------- instructor review (#review) ---------- */
async function sha(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = iso => { const d = new Date(iso); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); };

function review() {
  let o = document.getElementById('ctp-review');
  if (!o) { o = document.createElement('div'); o.id = 'ctp-review'; document.body.appendChild(o); }
  o.innerHTML = `<div class="ctp-pin"><h2>Proctoring review</h2><p>Enter the instructor PIN to see the camera flags saved on this computer.</p>
    <form id="ctp-pinf"><input id="ctp-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN"><button>Open</button></form><div id="ctp-err"></div>
    <p class="ctp-small"><a href="#" id="ctp-back">← Back to the exam</a></p></div>`;
  o.querySelector('#ctp-back').onclick = e => { e.preventDefault(); o.remove(); history.replaceState(null, '', location.pathname); };
  o.querySelector('#ctp-pinf').onsubmit = async e => {
    e.preventDefault();
    const pin = o.querySelector('#ctp-pin').value.trim();
    if (!PIN_HASH || (await sha('ctp|' + pin)) !== PIN_HASH) { o.querySelector('#ctp-err').textContent = 'Wrong PIN.'; return; }
    showFlags(o);
  };
  setTimeout(() => { const i = o.querySelector('#ctp-pin'); if (i) i.focus(); }, 50);
}
async function showFlags(o) {
  const rows = (await all()).sort((a, b) => String(a.at).localeCompare(b.at));
  const by = {};
  rows.forEach(r => { (by[r.student || 'Unknown'] = by[r.student || 'Unknown'] || []).push(r); });
  const names = Object.keys(by);
  o.innerHTML = `<div class="ctp-rev"><div class="ctp-head"><h2>Proctoring flags on this computer</h2><span class="grow"></span>
      ${rows.length ? '<button id="ctp-dl">Download report</button><button id="ctp-clear" class="danger">Delete all</button>' : ''}<button id="ctp-close">Close</button></div>
    ${rows.length ? names.map(n => {
      const list = by[n], tally = {};
      list.forEach(r => { tally[r.label] = (tally[r.label] || 0) + 1; });
      return `<section><h3>${esc(n)} <small>${esc(list[0].exam)} · ${list.length} flag${list.length > 1 ? 's' : ''}</small></h3>
        <div class="ctp-tally">${Object.keys(tally).map(k => `<span>${esc(k)}: <b>${tally[k]}</b></span>`).join('')}</div>
        <div class="ctp-grid">${list.map(r => `<figure>${r.img ? `<img src="${r.img}" alt="">` : '<div class="ctp-noimg">no image</div>'}<figcaption><b>${esc(r.label)}</b><br>${esc(fmt(r.at))}${r.section ? ' · Section ' + esc(r.section) : ''}</figcaption></figure>`).join('')}</div></section>`;
    }).join('') : '<p class="ctp-empty">No flags are saved in this browser.</p>'}</div>`;
  o.querySelector('#ctp-close').onclick = () => { o.remove(); history.replaceState(null, '', location.pathname); };
  const dl = o.querySelector('#ctp-dl');
  if (dl) dl.onclick = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proctoring report</title><style>body{font:14px Arial,sans-serif;margin:24px;color:#222}figure{display:inline-block;margin:6px;width:240px;vertical-align:top}img{width:240px;border-radius:8px}figcaption{font-size:12px}h3 small{font-weight:400;color:#666}</style></head><body><h2>Proctoring report · ${esc(fmt(new Date().toISOString()))}</h2>` +
      o.querySelector('.ctp-rev').innerHTML.replace(/<button[^>]*>[^<]*<\/button>/g, '') + '</body></html>';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = 'proctoring-report-' + (names.length === 1 ? names[0].replace(/\W+/g, '-') + '-' : '') + new Date().toISOString().slice(0, 10) + '.html';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const cl = o.querySelector('#ctp-clear');
  if (cl) cl.onclick = async () => {
    if (cl.dataset.sure !== '1') { cl.dataset.sure = '1'; cl.textContent = 'Click again to delete everything'; return; }
    await wipe(); showFlags(o);
  };
}
function route() { if (location.hash === '#review') review(); }
window.addEventListener('hashchange', route);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', route); else setTimeout(route, 0);

window.CTProctor = { prepare, start, stop, counts, total, all, wipe, review,
  _debug: () => ({ audio: S.audio ? S.audio.ctx.state : 'none', level: S.lastLevel || 0, floor: S.audio ? S.audio.floor : 0 }) };
})();
