/* CodeTrack sectioned exams: rules → confirm → one section at a time → done.
   Loaded after app.js; it plugs into the app through window.CTApp. */
(function () {
'use strict';
const A = window.CTApp;
if (!A) return;
const { S, $, $$, esc, icon, rich, pill, toast, call, act, render, confirmDialog, store, load, plural, first, fmtDT, fmtTime, emptyState, avatar } = A;
const CFG = window.CODETRACK_CONFIG || {};
const PROCTOR = () => !!(CFG.proctor && window.CTProctor);

/* ---------- helpers ---------- */
function exams() { return (S.data && S.data.exams) || []; }
function examById(id) { return exams().find(e => e.id === id); }
function istMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - 330 * 60000 : NaN;
}
function fmtLeft(ms) {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
}
function durNum(e) { return e.durationMin >= 60 ? Math.round(e.durationMin / 6) / 10 : e.durationMin; }
function durUnit(e) { return e.durationMin >= 60 ? 'hour' : 'minute'; }
function qCount(e) { return e.sections.reduce((t, s) => t + s.questions.length, 0); }
function draftKey() { return 'ct_exam_v1_' + S.data.user.id + '_' + S.xm.examId; }
function saveDraft() { if (S.xm) store(draftKey(), JSON.stringify({ answers: S.xm.answers, integ: S.xm.integ })); }

/* ---------- home cards (dashboard, welcome, exam-only home) ---------- */
function examCards(compact) {
  const list = exams();
  if (!list.length) return '';
  return list.map(e => {
    const at = e.attempt;
    const st = !at ? 'new' : at.status === 'submitted' ? 'done' : 'progress';
    const btn = st === 'done' ? `<span class="pill green">${icon('task_alt')} Submitted ${at.submittedAt ? fmtDT(at.submittedAt) : ''}</span>`
      : `<button class="btn filled ${compact ? 'sm' : ''}" data-act="xmOpen" data-id="${esc(e.id)}">${icon(st === 'new' ? 'edit_document' : 'play_arrow')} ${st === 'new' ? 'Take exam' : 'Resume exam'}</button>`;
    return `<div class="xm-card">
      <span class="xm-ic">${icon('assignment')}</span>
      <div class="grow"><div class="xm-title">${esc(e.title)}</div>
        <div class="xm-meta">${e.total} marks · ${plural(Math.round(e.durationMin / 60 * 10) / 10, 'hour')} · ${e.sections.length} sections · ${qCount(e)} questions</div>
        ${e.description && !compact ? `<div class="xm-desc">${esc(e.description)}</div>` : ''}
        ${st === 'progress' ? `<div class="xm-desc" style="color:var(--amber)">${icon('timer', 'sm')} In progress · Section ${esc((e.sections[at.section] || {}).id || '')} · ends ${fmtTime(at.deadline.slice(11, 16))}</div>` : ''}</div>
      ${btn}</div>`;
  }).join('');
}

function renderExamHome() {
  const d = S.data, u = d.user;
  S.mounted = null;
  $('#app').innerHTML = `<div class="xm-home">
    <header class="xm-top"><span class="xm-logo">${icon('school')}</span><div class="grow"><b>${esc(CFG.brandName || d.settings.courseTitle)}</b><div class="small muted">Online assessment</div></div>
      ${avatar(u.name)}<span class="hide-sm">${esc(u.name)}</span><button class="btn text sm" data-act="signOut">${icon('logout')} Sign out</button></header>
    <main class="xm-home-main">
      <h1 class="xm-h1">Hello, ${esc(first(u.name))}</h1>
      <p class="muted" style="margin:0 0 22px">${exams().length ? 'Your exam is ready. Read the rules carefully before you start.' : 'There is no exam open for you right now.'}</p>
      ${exams().length ? examCards(false) : emptyState('event_busy', 'No exam is open right now. Check back when your instructor tells you.')}
    </main></div>`;
}

/* ---------- flow ---------- */
function open(id) {
  const e = examById(id);
  if (!e) return toast('This exam is not available.', true);
  S.xm = { examId: id, phase: e.attempt ? (e.attempt.status === 'submitted' ? 'done' : 'rules') : 'rules', agreed: false };
  render();
  window.scrollTo(0, 0);
}
function close() {
  stopTimer();
  if (PROCTOR()) window.CTProctor.stop();
  destroyLabs();
  S.xm = null;
  hideOverlay();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { /* ignore */ }
  render();
}

function renderXm() {
  const e = examById(S.xm.examId);
  S.mounted = null;
  if (!e) { S.xm = null; return render(); }
  if (S.xm.phase === 'rules') return renderRules(e);
  if (S.xm.phase === 'done') return renderDone(e);
  return renderSection(e);
}

function renderRules(e) {
  const at = e.attempt, resume = at && at.status !== 'submitted';
  $('#app').innerHTML = `<div class="xm-page"><div class="xm-sheet">
    <button class="btn text" data-act="xmClose" style="margin:-8px 0 6px -12px">${icon('arrow_back')} Back</button>
    <div class="xm-kicker">${icon('assignment')} Exam</div>
    <h1 class="xm-h1">${esc(e.title)}</h1>
    ${e.description ? `<p class="muted" style="margin:0 0 18px">${esc(e.description)}</p>` : ''}
    <div class="xm-facts">
      <div><b>${e.total}</b><span>marks</span></div><div><b>${durNum(e)}</b><span>${durUnit(e)}${durNum(e) === 1 ? '' : 's'}</span></div>
      <div><b>${e.sections.length}</b><span>sections</span></div><div><b>${qCount(e)}</b><span>questions</span></div></div>
    <div class="table-wrap" style="margin:18px 0"><table class="table"><thead><tr><th>Section</th><th>What</th><th>Questions</th><th style="text-align:right">Marks</th></tr></thead><tbody>
      ${e.sections.map(s => `<tr><td><b>${esc(s.id)}</b></td><td>${esc(s.title)}</td><td>${s.pick ? 'Any ' + s.pick + ' of ' + s.questions.length : s.questions.length}</td><td style="text-align:right">${s.pick ? s.pick * (s.questions[0] || {}).marks : s.marks}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="xm-rules">
      <div class="xm-col do"><div class="h3">${icon('check_circle')} Do</div><ul>
        <li>Sit in a quiet place with your laptop charged and internet on.</li>
        <li>Stay in full screen and in this window until you submit.</li>
        <li>Read every question fully; type all code yourself with 4-space indentation.</li>
        <li>Press <b>Run</b> to test your programs before you submit.</li>
        <li>Submit each section before the timer ends — it moves you to the next one.</li></ul></div>
      <div class="xm-col dont"><div class="h3">${icon('cancel')} Don't</div><ul>
        <li>Don't open other tabs, apps, Google, ChatGPT or notes.</li>
        <li>Don't copy or paste — paste is turned off and attempts are recorded.</li>
        <li>Don't talk to others or use your phone.</li>
        <li>Don't refresh or close the page unless your instructor tells you to.</li>
        <li>You can't go back to a section after you submit it.</li>
        ${e.maxExits ? `<li><b>Leaving full screen or the exam window ${e.maxExits} times submits your exam automatically</b>, with a flag for your instructor.</li>` : ''}</ul></div>
    </div>
    <div class="xm-notice">${icon('videocam')}<div><b>Digital invigilation.</b> Your voice and video may be recorded for digital invigilation. Leaving the exam window, leaving full screen and paste attempts are logged and shared with your instructor.</div></div>
    ${PROCTOR() ? `<div class="xm-notice cam">${icon('photo_camera')}<div><b>Camera &amp; microphone monitoring.</b> Your webcam and microphone stay on for the whole exam. The system flags moments when your face is not visible, another person appears, you look away from the screen for long, or you talk. Each flagged moment is saved as a photo for your instructor. Keep your face in view and the room quiet. When you press Take exam your browser will ask to use the camera and microphone — choose <b>Allow</b>.</div></div>` : ''}
    <div class="xm-notice soft">${icon('timer')}<div>The <b>${durNum(e)}-${durUnit(e)} timer</b> starts when you press Take exam and keeps running even if you close the page. When it reaches zero your answers are submitted automatically.</div></div>
    <label class="xm-agree"><input type="checkbox" data-change="xmAgree" ${S.xm.agreed ? 'checked' : ''}> I have read the rules and I will follow them${PROCTOR() ? ', and I allow camera and microphone monitoring' : ''}.</label>
    <div class="row end" style="margin-top:18px"><button class="btn filled xm-go" data-act="xmStart" ${S.xm.agreed ? '' : 'disabled'}>${icon(resume ? 'play_arrow' : 'edit_document')} ${resume ? 'Resume exam' : 'Take exam'}</button></div>
  </div></div>`;
}

async function start() {
  const e = examById(S.xm.examId), resume = e.attempt && e.attempt.status !== 'submitted';
  if (!resume && !(await confirmDialog('Start the exam now?', `The <b>${durNum(e)}-${durUnit(e)} timer</b> starts immediately and cannot be paused. Make sure you are ready.`, 'Yes, start the exam'))) return;
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (x) { /* ignore */ }
  if (PROCTOR()) {
    try { await window.CTProctor.prepare(); }
    catch (x) { try { if (document.fullscreenElement) document.exitFullscreen(); } catch (y) { /* ignore */ } return toast(x.message, true); }
  }
  try {
    const r = resume ? { state: await call('bootstrap') } : await call('startExam', { examId: e.id });
    S.data = r.state;
  } catch (x) { return toast(x.message, true); }
  const fresh = examById(S.xm.examId);
  if (!fresh || !fresh.attempt) return toast('Could not start the exam. Try again.', true);
  if (fresh.attempt.status === 'submitted') { S.xm.phase = 'done'; return render(); }
  S.xm.skew = istMs(S.data.serverNow) - Date.now();
  S.xm.end = istMs(fresh.attempt.deadline);
  let saved = null;
  try { saved = JSON.parse(load(draftKey()) || 'null'); } catch (x) { saved = null; }
  S.xm.answers = (saved && saved.answers) || {};
  S.xm.integ = Object.assign({ typed: 0, deleted: 0, pasteBlocked: 0, maxBurst: 0, bursts: [], tabSwitches: 0, fsExits: 0, reloads: 0 }, (saved && saved.integ) || {});
  if (saved) S.xm.integ.reloads++;
  S.xm.phase = 'take';
  S.xm.busy = false;
  startTimer();
  render();
  if (PROCTOR()) {
    const ex = examById(S.xm.examId);
    window.CTProctor.start({ student: S.data.user.name, username: S.data.user.username, exam: ex.title, attemptId: ex.attempt.id,
      section: () => { const e2 = S.xm && examById(S.xm.examId); return e2 && e2.attempt ? (e2.sections[e2.attempt.section] || {}).id || '' : ''; },
      onFlag: rec => { call('proctorFlag', { examId: ex.id, type: rec.type, label: rec.label, section: rec.section, at: rec.at, img: rec.img }).catch(() => { /* kept locally anyway */ }); } })
      .catch(x => toast('Camera monitoring could not start: ' + x.message, true));
  }
}

/* ---------- taking a section ---------- */
function labFor(e, q) {
  const key = A.labKey('xm', e.attempt.id + ':' + q.id);
  return A.getLab(key, { exam: true, title: q.id.toLowerCase() + '.py', tests: q.tests || [],
    starter: '# ' + q.id + ' · ' + (q.title || '') + '\n\n' });
}
function destroyLabs() { Object.keys(S.labs || {}).filter(k => k.indexOf(':xm:') >= 0).forEach(k => A.destroyLab(k)); }
function curSection(e) { return e.sections[e.attempt.section]; }
function isAnswered(e, q) {
  if (q.type === 'code') { const l = S.labs[A.labKey('xm', e.attempt.id + ':' + q.id)]; return !!(l && l.getCode().replace(/^#.*$/gm, '').trim()); }
  const v = S.xm.answers[q.id];
  return v !== undefined && v !== null && String(v).trim() !== '';
}
function renderSection(e) {
  const sec = curSection(e);
  if (!sec) { S.xm.phase = 'done'; return renderDone(e); }
  const idx = e.attempt.section, lastSec = idx === e.sections.length - 1;
  const qHtml = sec.questions.map((q, i) => {
    const head = `<div class="xm-qhead"><span class="xm-qn">${esc(q.id)}</span><div class="grow">${q.title ? `<div class="xm-qtitle">${esc(q.title)}</div>` : ''}<div class="xm-qtext">${rich(q.text)}</div></div><span class="xm-qm">${plural(q.marks, 'mark')}</span></div>
      ${q.code ? `<pre class="code xm-snip"><code class="language-python">${esc(q.code)}</code></pre>` : ''}`;
    let body = '';
    if (q.type === 'mcq') {
      body = `<div class="xm-opts">${q.options.map((o, j) => `<label class="xm-opt ${S.xm.answers[q.id] === j ? 'on' : ''}"><input type="radio" name="${esc(q.id)}" value="${j}" data-change="xmMcq" data-q="${esc(q.id)}" ${S.xm.answers[q.id] === j ? 'checked' : ''}>
        <span class="xm-letter">${'abcdefgh'[j]}</span><span class="${/[()<>"'=._]/.test(o) ? 'mono' : ''}">${esc(o)}</span></label>`).join('')}</div>`;
    } else if (q.type === 'text') {
      body = `<textarea class="xm-text ${q.mono ? 'mono' : ''}" data-input="xmText" data-q="${esc(q.id)}" rows="${q.mono ? 5 : 4}" spellcheck="${q.mono ? 'false' : 'true'}" placeholder="${q.mono ? 'Type your answer exactly…' : 'Type your answer…'}">${esc(S.xm.answers[q.id] || '')}</textarea>`;
    } else {
      labFor(e, q);
      body = A.labMount(A.labKey('xm', e.attempt.id + ':' + q.id));
    }
    return `<div class="xm-q ${q.type === 'code' ? 'wide' : ''}" id="q-${esc(q.id)}">${head}${body}</div>`;
  }).join('');
  $('#app').innerHTML = `<div class="xm-take">
    <header class="xm-bar">
      <div class="grow" style="min-width:0"><div class="xm-bar-title">${esc(e.title)}</div><div class="small muted">${esc(S.data.user.name)}</div></div>
      <ol class="xm-steps">${e.sections.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'cur' : ''}">${i < idx ? icon('check') : `<span>${esc(s.id)}</span>`}<em>${esc(s.title)}</em></li>`).join('')}</ol>
      ${e.maxExits ? `<span class="pill ${(S.xm.integ.strikes || 0) ? 'amber' : ''}" id="xm-strikes" title="Times you left full screen or the exam window">${icon('warning')} Warnings <b style="margin-left:4px">${S.xm.integ.strikes || 0} / ${e.maxExits}</b></span>` : ''}
      <span class="exam-timer" id="xm-timer">${icon('timer')}<span>${fmtLeft(left())}</span></span>
    </header>
    <main class="xm-main">
      <div class="xm-sec-head"><div class="xm-kicker">Section ${esc(sec.id)} of ${e.sections.length}</div><h1 class="xm-h1">${esc(sec.title)}</h1>
        <p class="muted" style="margin:4px 0 0">${rich(sec.instructions || '')}</p></div>
      <div class="xm-qs">${qHtml}</div>
      <div class="xm-foot"><span class="muted" id="xm-count"></span><span class="grow"></span>
        <button class="btn filled xm-go" data-act="xmSubmit">${icon(lastSec ? 'task_alt' : 'arrow_forward')} ${lastSec ? 'Submit exam' : 'Submit section ' + esc(sec.id) + ' & continue'}</button></div>
    </main></div>`;
  A.afterRender($('#app'));
  updateCount();
  if (S.xm.overlay) showOverlay(S.xm.overlay);
}
function updateCount() {
  const e = examById(S.xm.examId), sec = e && curSection(e), el = $('#xm-count');
  if (!sec || !el) return;
  const n = sec.questions.filter(q => isAnswered(e, q)).length;
  el.textContent = `Answered ${n} of ${sec.questions.length}` + (sec.pick ? ` · answer any ${sec.pick}` : '');
}

async function submitSection(auto) {
  const xm = S.xm;
  if (!xm || xm.busy) return;
  const e = examById(xm.examId), sec = curSection(e);
  if (!sec) return;
  const missing = sec.questions.filter(q => !isAnswered(e, q)).length;
  const lastSec = e.attempt.section === e.sections.length - 1;
  if (!auto) {
    const need = sec.pick ? Math.max(0, sec.pick - (sec.questions.length - missing)) : missing;
    const warn = need ? `<br><br><b style="color:var(--red)">${plural(need, 'question')} not answered${sec.pick ? ' (you need ' + sec.pick + ')' : ''}.</b>` : '';
    if (!(await confirmDialog(lastSec ? 'Submit your exam?' : 'Submit section ' + sec.id + '?', (lastSec ? 'This finishes your exam.' : 'You cannot come back to this section after submitting.') + warn, lastSec ? 'Submit exam' : 'Submit & continue'))) return;
  }
  xm.busy = true;
  const btn = $('[data-act="xmSubmit"]'); if (btn) { btn.disabled = true; btn.innerHTML = icon('progress_activity') + ' Submitting…'; }
  const answers = {}, testOutputs = {};
  const labs = [];
  for (const q of sec.questions) {
    if (q.type === 'code') {
      const l = S.labs[A.labKey('xm', e.attempt.id + ':' + q.id)];
      answers[q.id] = l ? l.getCode() : '';
      if (l) labs.push(l);
      if (l && (q.tests || []).length && l.getCode().replace(/^#.*$/gm, '').trim()) {
        const outs = await l.runTests(true);
        if (outs) testOutputs[q.id] = outs;
      }
    } else answers[q.id] = xm.answers[q.id] === undefined ? '' : xm.answers[q.id];
  }
  const integ = Object.assign({}, xm.integ, { totalSec: Math.round((Date.now() + (xm.skew || 0) - (xm.end - e.durationMin * 60000)) / 1000) });
  labs.forEach(l => { const x = l.getIntegrity(); integ.typed += x.typed; integ.deleted += x.deleted; integ.pasteBlocked += x.pasteBlocked; integ.maxBurst = Math.max(integ.maxBurst, x.maxBurst); integ.runs = (integ.runs || 0) + x.runs; integ.errors = (integ.errors || 0) + x.errors; integ.activeSec = (integ.activeSec || 0) + x.activeSec; });
  if (auto) integ.autoSubmitted = auto;
  if (PROCTOR()) integ.camFlags = window.CTProctor.total();
  let r;
  try { r = await call('submitExamSection', { examId: e.id, sectionId: sec.id, answers, testOutputs, integrity: integ, final: !!auto }); }
  catch (x) {
    xm.busy = false;
    toast(x.message + (auto ? ' — your answers are saved; press Submit again.' : ''), true);
    if (/already submitted|Refresh/.test(x.message)) { try { S.data = await call('bootstrap'); } catch (y) { /* ignore */ } render(); }
    else if (btn) { btn.disabled = false; btn.innerHTML = 'Try again'; }
    return;
  }
  S.data = r.state;
  xm.busy = false;
  saveDraft();
  const fresh = examById(xm.examId);
  if (fresh.attempt.status === 'submitted') {
    stopTimer(); destroyLabs(); hideOverlay();
    if (PROCTOR()) window.CTProctor.stop();
    store(draftKey(), null);
    xm.phase = 'done';
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch (x) { /* ignore */ }
  } else toast(r.msg);
  render();
  window.scrollTo(0, 0);
}

function renderDone(e) {
  const at = e.attempt || {}, log = at.sectionLog || {};
  $('#app').innerHTML = `<div class="xm-page"><div class="xm-sheet xm-done">
    <div class="xm-done-ic">${icon('celebration')}</div>
    <h1 class="xm-h1">You're doing great, ${esc(first(S.data.user.name))}!</h1>
    <p class="xm-lead">Your exam <b>${esc(e.title)}</b> has been submitted successfully.</p>
    <p class="muted">Your answers will be evaluated by your instructor, and the results will be announced soon. Keep practising — every program you type makes you better.</p>
    <div class="xm-log">${e.sections.map(s => `<div>${icon(log[s.id] ? 'check_circle' : 'remove_circle_outline')}<span class="grow">Section ${esc(s.id)} · ${esc(s.title)}</span><span class="muted small">${log[s.id] ? fmtTime(log[s.id].slice(11, 16)) : 'not answered'}</span></div>`).join('')}</div>
    <div class="row" style="justify-content:center;margin-top:22px"><button class="btn filled" data-act="xmClose">${icon('home')} Back to home</button></div>
  </div></div>`;
}

/* ---------- timer, focus tracking, overlay ---------- */
function left() { return S.xm && S.xm.end ? S.xm.end - (Date.now() + (S.xm.skew || 0)) : 0; }
function startTimer() {
  stopTimer();
  S.xm.timer = setInterval(() => {
    if (!S.xm || S.xm.phase !== 'take') return;
    const ms = left(), el = $('#xm-timer');
    if (el) { el.querySelector('span:last-child').textContent = fmtLeft(ms); el.className = 'exam-timer' + (ms < 60000 ? ' danger' : ms < 600000 ? ' warn' : ''); }
    if (ms <= 0 && !S.xm.busy && !S.xm.autoDone) { S.xm.autoDone = true; hideOverlay(); toast("Time's up — submitting your answers…"); submitSection('time up'); }
  }, 1000);
}
function stopTimer() { if (S.xm && S.xm.timer) { clearInterval(S.xm.timer); S.xm.timer = null; } }
function taking() { return S.xm && S.xm.phase === 'take'; }
let awayAt = 0, lastStrike = 0;
function maxExits() { const e = S.xm && examById(S.xm.examId); return e && e.maxExits !== undefined ? +e.maxExits : 5; }
/* One warning per time the student leaves; leaving the window and full screen together counts once. */
function strike(kind) {
  if (!taking() || S.xm.busy || S.xm.autoDone) return;
  const now = Date.now();
  if (now - lastStrike > 2000) { S.xm.integ.strikes = (S.xm.integ.strikes || 0) + 1; lastStrike = now; }
  saveDraft();
  const max = maxExits();
  if (max > 0 && S.xm.integ.strikes >= max) {
    S.xm.autoDone = true;
    hideOverlay();
    toast('You left the exam ' + S.xm.integ.strikes + ' times — your exam is being submitted.', true);
    submitSection('left the exam ' + S.xm.integ.strikes + ' times');
    return;
  }
  showOverlay(kind);
}
function away() {
  if (!taking() || awayAt) return;
  awayAt = Date.now();
  S.xm.integ.tabSwitches++;
  strike('away');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) away(); else awayAt = 0; });
window.addEventListener('blur', () => setTimeout(() => { if (!document.hasFocus() && !document.hidden) away(); }, 400));
window.addEventListener('focus', () => { awayAt = 0; });
document.addEventListener('fullscreenchange', () => {
  if (!taking() || S.xm.busy || document.fullscreenElement) return;
  S.xm.integ.fsExits++;
  strike('fs');
});
function showOverlay(kind) {
  if (!S.xm) return;
  const pillEl = $('#xm-strikes'); if (pillEl) { pillEl.classList.add('amber'); pillEl.querySelector('b').textContent = (S.xm.integ.strikes || 0) + ' / ' + maxExits(); }
  S.xm.overlay = kind;
  let o = $('#xm-overlay');
  if (!o) { o = document.createElement('div'); o.id = 'xm-overlay'; o.className = 'exam-overlay'; document.body.appendChild(o); }
  o.innerHTML = `<div class="box">${icon(kind === 'fs' ? 'fullscreen_exit' : 'warning')}
    <h2>${kind === 'fs' ? 'You left full screen' : 'You left the exam window'}</h2>
    <p class="muted">This has been recorded and shared with your instructor. Your timer is still running.</p>
    ${maxExits() ? `<div class="xm-strikes">${Array.from({ length: maxExits() }, (_, i) => `<i class="${i < (S.xm.integ.strikes || 0) ? 'on' : ''}"></i>`).join('')}</div>
    <p style="margin:6px 0 16px"><b>Warning ${S.xm.integ.strikes || 0} of ${maxExits()}.</b> ${maxExits() - (S.xm.integ.strikes || 0) === 1 ? '<b style="color:var(--red)">One more time and your exam is submitted automatically.</b>' : 'At ' + maxExits() + ' your exam is submitted automatically.'}</p>` : ''}
    <button class="btn filled" data-act="xmResume">${icon('fullscreen')} Return to the exam</button></div>`;
}
function hideOverlay() { const o = $('#xm-overlay'); if (o) o.remove(); if (S.xm) S.xm.overlay = null; }

// paste / typing tracking for written answers
document.addEventListener('paste', ev => { if (taking() && ev.target.closest && ev.target.closest('.xm-take') && !ev.target.closest('.lab')) { ev.preventDefault(); S.xm.integ.pasteBlocked++; saveDraft(); toast('Paste is turned off during the exam.', true); } }, true);
document.addEventListener('drop', ev => { if (taking() && ev.target.closest && ev.target.closest('.xm-take')) ev.preventDefault(); }, true);
['copy', 'cut', 'contextmenu'].forEach(t => document.addEventListener(t, ev => { if (taking() && ev.target.closest && ev.target.closest('.xm-take') && !ev.target.closest('.lab')) ev.preventDefault(); }, true));

/* ---------- hooks for the app ---------- */
Object.assign(A.ACTIONS, {
  xmOpen: el => open(el.dataset.id),
  xmClose: close,
  xmStart: start,
  xmSubmit: () => submitSection(false),
  xmResume: () => { hideOverlay(); try { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (x) { /* ignore */ } }
});
Object.assign(A.CHANGES, {
  xmAgree: el => { S.xm.agreed = el.checked; const b = $('[data-act="xmStart"]'); if (b) b.disabled = !el.checked; },
  xmMcq: el => { S.xm.answers[el.dataset.q] = +el.value; saveDraft(); $$(`input[name="${el.dataset.q}"]`).forEach(r => r.closest('.xm-opt').classList.toggle('on', r.checked)); updateCount(); }
});
const prevLen = {};
Object.assign(A.INPUTS, {
  xmText: el => {
    const q = el.dataset.q, before = prevLen[q] === undefined ? String(S.xm.answers[q] || '').length : prevLen[q];
    const delta = el.value.length - before; prevLen[q] = el.value.length;
    if (delta > 0) { S.xm.integ.typed += delta; if (delta >= 30) { S.xm.integ.maxBurst = Math.max(S.xm.integ.maxBurst, delta); } } else S.xm.integ.deleted -= delta;
    S.xm.answers[q] = el.value; saveDraft(); updateCount();
  }
});
document.addEventListener('input', ev => { if (taking() && ev.target.closest && ev.target.closest('.xm-take .lab')) updateCount(); });

A.exam = { examCards, renderExamHome, renderXm, active: () => !!S.xm };
})();
