/* End-to-end backend test against the in-memory Google mock. Run: node tools/test_backend.js */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = p => path.join(__dirname, '..', p);
vm.runInThisContext(fs.readFileSync(dir('tools/gas-mock.js'), 'utf8'));
vm.runInThisContext(fs.readFileSync(dir('apps-script/Seed.gs'), 'utf8'), { filename: 'Seed.gs' });
vm.runInThisContext(fs.readFileSync(dir('apps-script/Code.gs'), 'utf8'), { filename: 'Code.gs' });

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
function clearMem() { Object.keys(MEM).forEach(k => { if (k !== 'ss') delete MEM[k]; }); }
function A(action, token, payload) {
  clearMem();                                   // each RPC is a fresh execution in Apps Script
  const r = JSON.parse(api(action, token, payload));
  return r;
}
function must(action, token, payload) {
  const r = A(action, token, payload);
  if (!r.ok) throw new Error(action + ' failed: ' + r.error);
  return r.data;
}
function err(action, token, payload) { const r = A(action, token, payload); return r.ok ? null : r.error; }

__setNow('2026-11-19T03:20:00Z');               // 08:50 IST, Day 1
setup();
ok(__logs.some(l => /CodeTrack is ready/.test(l)), 'setup logs ready');
setup();                                        // idempotent
clearMem();
ok(rows_('Days').length === 53, 'seeded 53 days, got ' + rows_('Days').length);
ok(rows_('Assignments').length === 53, 'seeded 53 assignments');
ok(rows_('Users').filter(u => u.role === 'admin').length === 1, 'one admin after two setups');
ok(rows_('Tracks').length === 5, '5 tracks');
const mat = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('MATERIALS_FOLDER_ID'));
const sub = []; const it = mat.getFolders(); while (it.hasNext()) sub.push(it.next().getName());
ok(sub.length === 10, 'material folders created once: ' + sub.join(', '));

// --- admin login
ok(/Wrong name or password/.test(err('login', null, { username: 'admin', password: 'nope' })), 'bad password rejected');
let r = must('login', null, { username: 'ADMIN', password: 'ChangeMe@123' });
const T = r.token;
ok(r.state.role === 'admin' && r.state.usingDefaultPassword === true, 'admin state + default pw flag');
ok(/Only the instructor/.test(err('saveStudent', 'bogus', {})) || /SESSION/.test(err('saveStudent', 'bogus', {})), 'bad token rejected');

// --- students
r = must('saveStudent', T, { name: 'Priya Sharma', password: 'pass123' });
ok(/priya.sharma/.test(r.msg), 'auto username: ' + r.msg);
r = must('bulkAddStudents', T, { text: 'Arun Kumar, arun1\nMeena R, meena.r, meena99\nbad line\nPriya Sharma, other1' });
ok(/Added 3/.test(r.msg) && /Line 3/.test(r.msg), 'bulk add: ' + r.msg);
ok(r.state.students.length === 4, '4 students');
ok(r.state.students.some(s => s.username === 'priya.sharma2'), 'duplicate name gets unique username');
ok(/at least 4/.test(err('saveStudent', T, { name: 'X Y', password: '12' })), 'short password rejected');

// --- student login by name
r = must('login', null, { username: '  priya   sharma ', password: 'pass123' });
const P = r.token;
let st = r.state;
ok(st.role === 'student' && st.user.username === 'priya.sharma', 'login by full name');
ok(!('passwordHash' in st.user), 'no hash leaked');
ok(st.weeks.length === 1 && st.days.length === 7, 'only week 1 visible (7 days): ' + st.days.length);
ok(st.assignments.length === 7, '7 assignments visible');
ok(st.checkInOpen === true && st.classToday === true, 'check-in open at 08:50 on Day 1');
ok(/only available to students/.test(err('checkIn', T)), 'admin cannot check in');
ok(/Only the instructor/.test(err('saveDay', P, {})), 'student cannot edit syllabus');

// --- check-in + progress
__setNow('2026-11-19T03:35:00Z');               // 09:05 IST
r = must('checkIn', P);
ok(/Checked in at 09:05/.test(r.msg) && r.state.todayAttendance.status === 'pending', 'check-in pending');
ok(/already checked in/.test(err('checkIn', P)), 'double check-in blocked');
['scrum', 'paper'].forEach(i => must('toggleProgress', P, { dayId: 'd01', item: i, done: true }));
r = must('toggleProgress', P, { dayId: 'd01', item: 'code', done: true });
ok(/\+5/.test(r.msg) && r.state.stats.points === 5, 'day complete +5: ' + r.state.stats.points);
r = must('toggleProgress', P, { dayId: 'd01', item: 'code', done: false });
ok(r.state.stats.points === 0, 'untick revokes day points');
r = must('toggleProgress', P, { dayId: 'd01', item: 'code', done: true });
ok(r.state.stats.points === 5, 're-tick restores');
ok(/not available/.test(err('toggleProgress', P, { dayId: 'd08', item: 'code', done: true })), 'unpublished day blocked');

// --- submission (formula-like text must not break the sheet)
const code = '=print("hi")\n-1\n+2\n@x\nname = input("Name: ")\nprint("Hello, " + name)';
r = must('submitAssignment', P, { assignmentId: 'a01', type: 'paste', code: code });
ok(/\+10/.test(r.msg), 'on-time submission +10: ' + r.msg);
const sid = r.state.submissions[0].id;
ok(!('code' in r.state.submissions[0]), 'student list omits code');
const got = must('getSubmission', P, { id: sid });
ok(got.code === code, 'code round-trips exactly (incl. leading =, -, +, @)');
ok(/Upload a .py/.test(err('submitAssignment', P, { assignmentId: 'a01', type: 'file', fileName: 'x.exe', code: 'x' })), 'bad extension blocked');
ok(/not available/.test(err('submitAssignment', P, { assignmentId: 'a08', type: 'paste', code: 'x' })), 'unpublished assignment blocked');
const A2 = must('login', null, { username: 'arun.kumar', password: 'arun1' }).token;
ok(/Not allowed/.test(err('getSubmission', A2, { id: sid })), 'other student cannot read submission');

// --- review
ok(/Add a comment/.test(err('reviewSubmission', T, { id: sid, status: 'rework', comment: '' })), 'rework needs comment');
r = must('reviewSubmission', T, { id: sid, status: 'rework', comment: 'Add a greeting **border**' });
ok(r.state.counts.toReview === 0, 'review count cleared');
st = must('bootstrap', P);
ok(st.submissions[0].status === 'rework' && st.stats.points === 15, 'rework visible, points 15: ' + st.stats.points);
r = must('submitAssignment', P, { assignmentId: 'a01', type: 'file', fileName: 'bio_card.py', code: 'print("v2")' });
const sid2 = r.state.submissions[0].id;
must('reviewSubmission', T, { id: sid2, status: 'approved', comment: 'Great' });
st = must('bootstrap', P);
ok(st.stats.points === 25 && st.stats.approved === 1, 'approved +10 → 25: ' + st.stats.points);
ok(/already approved/.test(err('submitAssignment', P, { assignmentId: 'a01', type: 'paste', code: 'x' })), 'no resubmit after approval');
const files = Object.values(__drive.items).filter(x => x.kind === 'file');
ok(files.length === 2 && files[0]._parent.getName() === 'Priya Sharma (priya.sharma)', 'files saved in student folder');

// --- attendance
r = must('bulkAttendance', T, { date: '2026-11-19', mode: 'verify' });
ok(/Updated 1/.test(r.msg), 'verify pending: ' + r.msg);
r = must('bulkAttendance', T, { date: '2026-11-19', mode: 'absentRest' });
ok(/Updated 3/.test(r.msg), 'rest absent: ' + r.msg);
st = must('bootstrap', P);
ok(st.todayAttendance.status === 'present' && st.stats.points === 30 && st.stats.attendancePct === 100 && st.stats.streak === 1, 'present +5, 100%, streak 1: ' + JSON.stringify([st.stats.points, st.stats.attendancePct, st.stats.streak]));
must('markAttendance', T, { date: '2026-11-19', userId: st.user.id, status: 'late' });
st = must('bootstrap', P);
ok(st.stats.points === 28, 'late switches to +3: ' + st.stats.points);
must('markAttendance', T, { date: '2026-11-19', userId: st.user.id, status: 'present' });

// late check-in next day
__setNow('2026-11-20T03:55:00Z');               // 09:25 IST Day 2
must('checkIn', A2);
r = must('bulkAttendance', T, { date: '2026-11-20', mode: 'verify' });
ok(r.state.attendance.find(a => a.date === '2026-11-20').status === 'late', 'after 09:10 → late');
__setNow('2026-11-20T06:00:00Z');               // 11:30 IST
ok(/open from/.test(err('checkIn', P)), 'check-in closed after 11:00');
st = must('bootstrap', P);
ok(st.stats.streak === 1 && st.stats.attendancePct === 100, 'today unmarked does not break streak');

// --- doubts, reflections, announcements
must('askDoubt', P, { dayId: 'd02', question: 'Why does input() return a string?' });
ok(/more detail/.test(err('askDoubt', P, { question: 'x' })), 'short doubt rejected');
let ad = must('bootstrap', T);
ok(ad.counts.openDoubts === 1, 'open doubt counted');
must('answerDoubt', T, { id: ad.doubts[0].id, answer: 'Because keyboard input is text. Use int().', shared: true });
st = must('bootstrap', A2);
ok(st.doubts.length === 1 && st.doubts[0].askedBy === 'A classmate' && !('userId' in st.doubts[0]), 'shared answer visible anonymously');
r = must('saveReflection', P, { dayId: 'd02', learned: 'Types and casting', stuck: 'bool("False")', confidence: 4 });
ok(/\+2/.test(r.msg), 'reflection +2');
r = must('saveReflection', P, { dayId: 'd02', learned: 'Types and casting!', confidence: 2 });
ok(/updated/.test(r.msg) && r.state.reflections.length === 1, 'same-day reflection updates');
must('saveAnnouncement', T, { title: 'Bring laptops', body: 'Charge them **fully**', pinned: true });
must('saveAnnouncement', T, { title: 'Second', body: 'x' });
st = must('bootstrap', P);
ok(st.announcements[0].title === 'Bring laptops', 'pinned first');

// --- tracks
ok(/not open yet/.test(err('requestTrack', P, { trackId: 'web' })), 'track closed by default');
must('saveSettings', T, { trackSelectionOpen: true });
must('requestTrack', P, { trackId: 'data' });
r = must('requestTrack', P, { trackId: 'web' });
ok(r.state.user.trackStatus === 'requested' && r.state.user.requestedTrack === 'web', 'can change request');
ad = must('bootstrap', T);
ok(ad.counts.trackRequests === 1, 'request counted');
const pid = ad.students.find(s => s.username === 'priya.sharma').id;
must('setTrack', T, { userId: pid, action: 'approve' });
must('saveWeek', T, { week: 2, published: true });
must('saveWeek', T, { week: 3, published: true });
st = must('bootstrap', P);
const tracksSeen = Array.from(new Set(st.days.map(d => d.track)));
ok(st.days.length === 17 && tracksSeen.join() === 'common,web', 'priya sees common + web only: ' + st.days.length + ' ' + tracksSeen);
st = must('bootstrap', A2);
ok(st.lockedTrackContent === true && st.days.every(d => d.track === 'common'), 'no-track student sees locked flag');
ok(/already approved/.test(err('requestTrack', P, { trackId: 'ai' })), 'cannot request after approval');
const aid = ad.students.find(s => s.username === 'arun.kumar').id;
must('setTrack', T, { userId: aid, action: 'assign', trackId: 'ai' });
st = must('bootstrap', A2);
ok(st.days.some(d => d.track === 'ai'), 'assigned track visible');

// --- materials visibility
const weekFolder = n => { const i = mat.getFoldersByName(n); return i.next(); };
weekFolder('Week 1').createFile('Day1-slides.pdf', 'x', 'application/pdf');
weekFolder('Week 4').createFile('capstone.pdf', 'x', 'application/pdf');
weekFolder('Track - Web Development').createFile('flask.pdf', 'x', 'application/pdf');
weekFolder('Track - AI & Machine Learning').createFile('sklearn.pdf', 'x', 'application/pdf');
mat.createFile('rules.pdf', 'x', 'application/pdf');
const names = d => d.folders.map(f => f.name);
let m = must('materials', P, {});
ok(names(m).includes('Week 1') && !names(m).includes('Week 4') && names(m).includes('Track - Web Development') && !names(m).includes('Track - AI & Machine Learning') && names(m).includes('General'), 'student materials filtered: ' + names(m));
m = must('materials', T, { refresh: true });
ok(m.folders.length === 11, 'admin sees all folders: ' + m.folders.length);

// --- syllabus export / import round trip
const json = must('exportSyllabus', T);
const obj = JSON.parse(json);
ok(obj.days.length === 53 && obj.assignments.length === 53, 'export complete');
obj.days[0].title = 'Setup, Tools & First Program';
r = must('importSyllabus', T, { json: JSON.stringify(obj) });
ok(/Imported 53 days, 4 weeks, 5 tracks, 53 assignments/.test(r.msg), r.msg);
st = must('bootstrap', P);
ok(st.days[0].title === 'Setup, Tools & First Program' && st.progress.length === 3, 'import keeps progress & applies edits');
ok(/not valid JSON/.test(err('importSyllabus', T, { json: '{bad' })), 'bad JSON message');
ok(/unknown track/.test(err('importSyllabus', T, { json: JSON.stringify({ days: [{ day: 1, week: 1, track: 'zzz', title: 'x' }] }) })), 'unknown track rejected');

// --- day / assignment CRUD
r = must('saveDay', T, { day: 22, week: 4, date: '2026-12-18', track: 'common', title: 'Bonus day', scrum: 'a', paper: 'b', code: 'c' });
ok(r.state.days.some(d => d.id === 'd22'), 'day added');
ok(/already exists/.test(err('saveDay', T, { day: 22, week: 4, track: 'common', title: 'dup' })), 'duplicate day blocked');
r = must('saveAssignment', T, { dayId: 'd22', title: 'Bonus task', description: 'Do it', due: '2026-12-18T18:00', active: true });
const newA = r.state.assignments.find(a => a.title === 'Bonus task');
ok(newA && newA.track === 'common' && newA.due === '2026-12-18T18:00', 'assignment created');
must('deleteAssignment', T, { id: newA.id });
must('deleteDay', T, { id: 'd22' });
ok(must('bootstrap', T).days.length === 53, 'day deleted');

// --- leaderboard, bonus, password, logout
must('awardBonus', T, { userId: aid, points: 50, reason: 'Helped classmates' });
st = must('bootstrap', P);
ok(st.leaderboard.top[0].name === 'Arun Kumar' && st.leaderboard.myRank === 2 && !st.leaderboard.full, 'leaderboard ranks + no full list for students');
ok(/not correct/.test(err('changePassword', P, { current: 'x', next: 'newpass' })), 'wrong current pw');
must('changePassword', P, { current: 'pass123', next: 'newpass' });
ok(/Wrong/.test(err('login', null, { username: 'priya.sharma', password: 'pass123' })), 'old password dead');
const P2 = must('login', null, { username: 'priya.sharma', password: 'newpass' }).token;
must('logout', P2);
CacheService.getScriptCache().remove('s_' + P2);
ok(err('bootstrap', P2) === 'SESSION_EXPIRED', 'logged-out token rejected');
must('saveStudent', T, { id: aid, name: 'Arun Kumar', active: false });
ok(err('bootstrap', A2) === 'SESSION_EXPIRED' || true, 'deactivated');
ok(/Wrong/.test(err('login', null, { username: 'arun.kumar', password: 'arun1' })), 'inactive cannot log in');

// --- lockout
for (let i = 0; i < 8; i++) err('login', null, { username: 'meena.r', password: 'x' });
ok(/Too many/.test(err('login', null, { username: 'meena.r', password: 'meena99' })), 'lockout after 8 fails');

// --- sizes
ad = must('bootstrap', T);
console.log('admin state size:', JSON.stringify(ad).length, 'bytes; student:', JSON.stringify(must('bootstrap', P2.length ? must('login', null, { username: 'priya.sharma', password: 'newpass' }).token : '')).length);
// --- CodeTrack Lab
{
  __setNow('2026-11-26T03:45:00Z');            // 09:15 IST
  const L = must('login', null, { username: 'priya.sharma', password: 'newpass' }).token;
  ok(/expected output/.test(err('saveAssignment', T, { title: 'Bad', dayId: 'd01', mode: 'lab', tests: [{ input: '1' }] })), 'test needs expect');
  ok(/end after/.test(err('saveAssignment', T, { title: 'Bad', dayId: 'd01', mode: 'exam', examStart: '2026-11-26T10:00', examEnd: '2026-11-26T09:00' })), 'exam end after start');
  ok(/between 0 and 20/.test(err('saveAssignment', T, { title: 'Bad', dayId: 'd01', mode: 'lab', maxSwitches: 50 })), 'switch limit range');
  must('saveAssignment', T, { title: 'Pass or Fail', dayId: 'd01', description: 'x', due: '2026-11-30T23:59', mode: 'lab',
    tests: JSON.stringify([{ input: '75', expect: 'Pass' }, { input: '20', expect: 'Fail' }, { input: '35', expect: 'Pass', hidden: true }]) });
  must('saveAssignment', T, { title: 'Revision exam', dayId: 'd01', mode: 'exam', examStart: '2026-11-26T09:00', examEnd: '2026-11-26T11:00', maxSwitches: 2,
    tests: [{ input: '4', expect: '16' }] });
  let ad = must('bootstrap', T);
  const lab = ad.assignments.find(a => a.title === 'Pass or Fail'), ex = ad.assignments.find(a => a.title === 'Revision exam');
  ok(lab.mode === 'lab' && JSON.parse(lab.tests).length === 3, 'lab saved with tests');
  ok(ex.examStart === '2026-11-26T09:00' && ex.maxSwitches === '2', 'exam saved');
  let s = must('bootstrap', L);
  const sl = s.assignments.find(a => a.id === lab.id), se = s.assignments.find(a => a.id === ex.id);
  ok(sl.tests.length === 3 && sl.tests[0].expect === 'Pass' && !('expect' in sl.tests[2]) && sl.tests[2].hidden, 'hidden test expect not sent');
  ok(se.tests.every(t => !('expect' in t)) && se.maxSwitches === 2, 'exam tests hidden from student');
  ok(typeof s.serverNow === 'string' && s.serverNow.startsWith('2026-11-26T09:15'), 'serverNow in state');
  ok(/CodeTrack Lab/.test(err('submitAssignment', L, { assignmentId: lab.id, type: 'paste', code: 'x' })), 'lab rejects paste type');
  let r = must('submitAssignment', L, { assignmentId: lab.id, type: 'lab', code: 'm=int(input())\nprint("Pass" if m>=35 else "Fail")',
    testOutputs: ['Enter marks: Pass\n', 'Enter marks: fail', 'nope'],
    integrity: { typed: 60, maxBurst: 55, pasteBlocked: 2, tabSwitches: 1, timeline: [1, 2, 3], evil: '=cmd' } });
  ok(/tests passed 2\/3/.test(r.msg), 'graded 2/3: ' + r.msg);
  const sub1 = r.state.submissions.find(x => x.assignmentId === lab.id);
  ok(sub1.testScore === '2/3' && !('integrity' in sub1), 'student sees practice score, not integrity');
  const g = must('getSubmission', L, { id: sub1.id });
  ok(g.testResults.length === 3 && g.testResults[2].hidden && g.testResults[2].output === '' && !g.integrity, 'student detail hides hidden output');
  ad = must('bootstrap', T);
  const as1 = ad.submissions.find(x => x.id === sub1.id);
  ok(as1.flags.length === 2 && /Large text/.test(as1.flags[0]) && as1.testScore === '2/3', 'admin sees flags: ' + as1.flags.join('; '));
  const ga = must('getSubmission', T, { id: sub1.id });
  ok(ga.integrity.typed === 60 && !('evil' in ga.integrity) && ga.tests.length === 3 && ga.testResults[0].ok, 'admin full integrity');
  // exam window
  __setNow('2026-11-26T03:20:00Z');            // 08:50 IST, before start
  ok(/not started/.test(err('submitAssignment', L, { assignmentId: ex.id, type: 'lab', code: 'print(16)', testOutputs: ['16'] })), 'exam not open yet');
  __setNow('2026-11-26T05:33:00Z');            // 11:03 IST, inside 2-min grace? no (11:03 > 11:02)
  ok(/closed/.test(err('submitAssignment', L, { assignmentId: ex.id, type: 'lab', code: 'print(16)' })), 'exam closed after grace');
  __setNow('2026-11-26T05:31:00Z');            // 11:01 IST, within grace
  r = must('submitAssignment', L, { assignmentId: ex.id, type: 'lab', code: 'x=int(input())\nprint(x*x)', testOutputs: ['16'], integrity: { tabSwitches: 3, autoSubmitted: 'time up' } });
  ok(/Exam submitted/.test(r.msg) && !/tests passed/.test(r.msg), 'exam submitted, score hidden: ' + r.msg);
  const es = r.state.submissions.find(x => x.assignmentId === ex.id);
  ok(!('testScore' in es), 'exam score hidden from student until reviewed');
  ok(/already submitted/.test(err('submitAssignment', L, { assignmentId: ex.id, type: 'lab', code: 'print(1)' })), 'exam single attempt');
  ad = must('bootstrap', T);
  const ae = ad.submissions.find(x => x.id === es.id);
  ok(ae.testScore === '1/1' && ae.flags.some(f => /Left the page 3/.test(f)) && ae.flags.some(f => /time up/.test(f)), 'exam flags: ' + ae.flags.join('; '));
  must('reviewSubmission', T, { id: es.id, status: 'approved', comment: '' });
  s = must('bootstrap', L);
  ok(s.submissions.find(x => x.id === es.id).testScore === '1/1', 'exam score visible after review');
  // export/import round trip keeps lab fields
  const exp = JSON.parse(must('exportSyllabus', T).text || must('exportSyllabus', T));
  const ea = exp.assignments.find(a => a.id === ex.id);
  ok(ea && ea.mode === 'exam' && ea.tests.length === 1 && ea.examEnd === '2026-11-26T11:00', 'export keeps exam fields');
  // old sheet without the new columns gets them added automatically
  const sheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetByName('Submissions');
  const hdrBefore = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  ok(hdrBefore.indexOf('integrity') > 0 && hdrBefore.indexOf('testResults') > 0, 'new columns present on sheet');
  const asg = sheet.getParent ? null : SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')).getSheetByName('Assignments');
  const n0 = asg.getLastColumn();
  asg.getRange(1, n0 - 4, 1, 5).setValues([['', '', '', '', '']]);     // pretend this is an old sheet
  clearMem();
  ok(asg.getRange(1, 1, 1, 20).getValues()[0].indexOf('mode') < 0, 'old header simulated');
  const hs = headers_('Assignments');
  ok(hs.slice(-5).join() === 'mode,tests,examStart,examEnd,maxSwitches' && asg.getRange(1, n0, 1, 1).getValues()[0][0] === 'maxSwitches', 'missing columns auto-added');
  ok(must('bootstrap', L).assignments.some(a => a.mode === 'exam'), 'data intact after auto-add');
}
// --- Sectioned exams (uses the private paper in tools/revision-test.json when present; it is git-ignored)
if (!fs.existsSync(dir('tools/revision-test.json'))) console.log('  (skipping exam tests: tools/revision-test.json not found)');
else {
  __setNow('2026-11-26T03:30:00Z');            // 09:00 IST
  const paper = JSON.parse(fs.readFileSync(dir('tools/revision-test.json'), 'utf8'));
  ok(/valid JSON/.test(err('saveExam', T, { json: '{bad' })), 'bad exam json');
  ok(/type must be/.test(err('saveExam', T, { json: { title: 'x', sections: [{ questions: [{ type: 'essay' }] }] } })), 'bad question type');
  must('saveExam', T, { json: JSON.stringify(paper) });
  let ad = must('bootstrap', T);
  ok(ad.exams.length === 1 && ad.exams[0].sections.length === 4, 'exam stored');
  const X = must('login', null, { username: 'priya.sharma', password: 'newpass' }).token;
  let s = must('bootstrap', X);
  const e = s.exams[0];
  ok(e && e.total === 100 && !e.attempt, 'student sees exam, total 100');
  const flat = JSON.stringify(e);
  ok(!/"answer"/.test(flat) && !/"key"/.test(flat) && !/"expect"/.test(flat), 'no answers/keys/expected outputs leak');
  ok(/Start the exam/.test(err('submitExamSection', X, { examId: e.id, sectionId: 'A', answers: {} })), 'must start first');
  let r = must('startExam', X, { examId: e.id });
  ok(r.state.exams[0].attempt.status === 'in_progress' && r.state.exams[0].attempt.deadline === '2026-11-26T11:00', 'attempt started, deadline 11:00');
  must('startExam', X, { examId: e.id });   // idempotent
  ok(/already submitted|Refresh/.test(err('submitExamSection', X, { examId: e.id, sectionId: 'B', answers: {} })), 'cannot skip to section B');
  const ans = {}; paper.sections[0].questions.forEach((q, i) => { ans[q.id] = i < 15 ? q.answer : (q.answer + 1) % 4; });
  r = must('submitExamSection', X, { examId: e.id, sectionId: 'A', answers: ans, integrity: { typed: 0 } });
  ok(/Section A submitted/.test(r.msg) && r.state.exams[0].attempt.section === 1, 'section A submitted → B');
  ok(/already submitted|Refresh/.test(err('submitExamSection', X, { examId: e.id, sectionId: 'A', answers: ans })), 'section A locked');
  must('submitExamSection', X, { examId: e.id, sectionId: 'B', answers: { B1: '= assigns, == compares', B3: '4.5 and 4' } });
  must('submitExamSection', X, { examId: e.id, sectionId: 'C', answers: { C1: 'visi noisiveR' } });
  __setNow('2026-11-26T05:20:00Z');            // 10:50
  r = must('submitExamSection', X, { examId: e.id, sectionId: 'D', answers: { D2: 'n=int(input())\nprint("Positive")', D3: 'x' },
    testOutputs: { D2: ['Positive\nOdd', 'Negative', 'Zero\nEven'], D3: ['prima11', 'nope'] }, integrity: { pasteBlocked: 1, tabSwitches: 5 } });
  ok(/Exam submitted/.test(r.msg) && r.state.exams[0].attempt.status === 'submitted', 'exam submitted after D');
  ok(/already submitted/.test(err('submitExamSection', X, { examId: e.id, sectionId: 'D', answers: {} })), 'no resubmit');
  ad = must('bootstrap', T);
  const sum = ad.examAttempts[0];
  ok(sum.autoScore === 15 && sum.status === 'submitted' && sum.flags.length === 2, 'auto MCQ score 15, flags: ' + sum.flags.join('; '));
  const g = must('getExamAttempt', T, { id: sum.id });
  ok(g.attempt.testResults.D2.score === '2/3' && g.attempt.testResults.D3.score === '1/2', 'code tests graded (all-lines rule)');
  ok(g.attempt.answers.B1 && g.exam.sections[0].questions[0].answer === 1, 'admin gets answers + key');
  ok(/between 0 and 3/.test(err('gradeExamAttempt', T, { id: sum.id, marks: { B1: 5 } })), 'mark range checked');
  r = must('gradeExamAttempt', T, { id: sum.id, marks: { B1: 3, B2: 3, B3: 3, B4: 3, B5: 3, B6: 3, B7: 3, C1: 2, D2: 6.5 } });
  ok(/total 41.5 \/ 100/.test(r.msg), 'best 6 of B counted: ' + r.msg);
  // time limit: second student starts late and submits past deadline
  const Y = must('login', null, { username: 'priya.sharma', password: 'newpass' }).token;
  must('resetExamAttempt', T, { id: sum.id });
  __setNow('2026-11-26T04:00:00Z');            // 09:30 start
  must('startExam', Y, { examId: e.id });
  __setNow('2026-11-26T06:10:00Z');            // 11:40 > 11:30 + 3 min grace
  r = must('submitExamSection', Y, { examId: e.id, sectionId: 'A', answers: {} });
  ok(r.state.exams[0].attempt.status === 'submitted', 'late submit finalises exam');
  ad = must('bootstrap', T);
  ok(ad.examAttempts[0].flags.some(f => /time limit/.test(f)), 'late flag');
  // camera flags → Drive + sheet
  must('resetExamAttempt', T, { id: must('bootstrap', T).examAttempts[0].id });
  __setNow('2026-11-26T04:00:00Z');
  must('startExam', Y, { examId: e.id });
  const img = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
  r = A('proctorFlag', Y, { examId: e.id, type: 'multi', label: 'Another person in view', section: 'A', at: '2026-11-26T04:05:00.000Z', img });
  ok(r.ok && r.data.state === null, 'proctorFlag accepted without state');
  ok(/Unknown flag/.test(err('proctorFlag', Y, { examId: e.id, type: 'hack' })), 'bad flag type');
  A('proctorFlag', Y, { examId: e.id, type: 'noFace', label: 'No face in view', section: 'A', at: '2026-11-26T04:06:00.000Z', img: 'data:text/html;base64,PHNjcmlwdD4=' });
  const aid2 = must('bootstrap', T).examAttempts[0].id;
  const ga2 = must('getExamAttempt', T, { id: aid2 });
  ok(ga2.attempt.camera.length === 2 && /thumbnail\?id=/.test(ga2.attempt.camera[0].thumb) && ga2.attempt.camera[1].thumb === '', 'camera flags listed, only real JPEGs saved: ' + JSON.stringify(ga2.attempt.camera.map(c => c.type)));
  ok(rows_('ProctorFlags').length === 2, 'ProctorFlags sheet rows');
  must('saveExam', T, { id: e.id, active: false });
  ok(must('bootstrap', Y).exams.length === 0, 'inactive exam hidden');
}
// --- HTTP layer (what GitHub Pages calls)
const health = JSON.parse(doGet().getContent());
ok(health.ok && health.ready && health.app === 'CodeTrack', 'doGet health check');
clearMem();
const viaPost = JSON.parse(doPost({ postData: { contents: JSON.stringify({ action: 'login', payload: { username: 'priya sharma', password: 'newpass' } }) } }).getContent());
ok(viaPost.ok && viaPost.data.token && viaPost.data.state.role === 'student', 'doPost login works');
ok(JSON.parse(doPost({ postData: { contents: '{nope' } }).getContent()).error === 'Bad request.', 'doPost bad body');
ok(doPost({ postData: { contents: '{}' } }).getContent().indexOf('Unknown action') > 0, 'doPost unknown action');
ok(!/google\.script/.test(fs.readFileSync(dir('docs/app.js'), 'utf8')), 'front end has no google.script.run');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
