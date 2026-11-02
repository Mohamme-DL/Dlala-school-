/* Dalala School System — app shell, routing, auth, events */
'use strict';

let USER = null;
const ALL = ['admin', 'teacher', 'accountant', 'librarian', 'parent'];
const STAFF = ['admin', 'teacher', 'accountant', 'librarian'];

const MENU = [
  { g: 'g_main', items: [
    { id: 'dashboard', icon: 'home', roles: STAFF },
    { id: 'portal', icon: 'heart', roles: ['parent'] },
  ] },
  { g: 'g_students', items: [
    { id: 'students', icon: 'users', roles: ['admin', 'teacher', 'accountant'] },
    { id: 'admissions', icon: 'userPlus', roles: ['admin'] },
    { id: 'attendance', icon: 'check', roles: ['admin', 'teacher'] },
    { id: 'behavior', icon: 'star', roles: ['admin', 'teacher'] },
  ] },
  { g: 'g_academic', items: [
    { id: 'classes', icon: 'layers', roles: ['admin', 'teacher'] },
    { id: 'subjects', icon: 'book', roles: ['admin', 'teacher'] },
    { id: 'timetable', icon: 'grid', roles: ['admin', 'teacher'] },
    { id: 'exams', icon: 'file', roles: ['admin', 'teacher'] },
    { id: 'marks', icon: 'pencil', roles: ['admin', 'teacher'] },
    { id: 'reportcards', icon: 'award', roles: ['admin', 'teacher'] },
    { id: 'certificates', icon: 'file', roles: ['admin'] },
    { id: 'homework', icon: 'clipboard', roles: ['admin', 'teacher'] },
  ] },
  { g: 'g_staff', items: [{ id: 'employees', icon: 'briefcase', roles: ['admin'] }] },
  { g: 'g_finance', items: [
    { id: 'invoices', icon: 'receipt', roles: ['admin', 'accountant'] },
    { id: 'payments', icon: 'wallet', roles: ['admin', 'accountant'] },
    { id: 'feeTypes', icon: 'tag', roles: ['admin', 'accountant'] },
  ] },
  { g: 'g_services', items: [
    { id: 'books', icon: 'bookOpen', roles: ['admin', 'librarian'] },
    { id: 'loans', icon: 'clock', roles: ['admin', 'librarian'] },
    { id: 'buses', icon: 'bus', roles: ['admin'] },
  ] },
  { g: 'g_comm', items: [
    { id: 'announcements', icon: 'megaphone', roles: ALL },
    { id: 'calendar', icon: 'calendar', roles: ALL },
  ] },
  { g: 'g_system', items: [
    { id: 'reports', icon: 'chart', roles: ['admin', 'accountant'] },
    { id: 'users', icon: 'shield', roles: ['admin'] },
    { id: 'settings', icon: 'settings', roles: ['admin'] },
  ] },
];
const PAGES = {
  dashboard: renderDashboard, portal: renderPortal, attendance: renderAttendance, marks: renderMarks, reportcards: renderReportCards,
  timetable: renderTimetable, certificates: renderCertificates, calendar: renderCalendar, reports: renderReports, settings: renderSettings, student: renderStudent,
  announcements: () => (can(ENT.announcements.edit) ? renderCrud('announcements') : pageHead(t('nav_announcements'), t('sub_announcements')) + `<div class="cards-grid">${visibleAnnouncements().map(annCard).join('') || emptyState(t('noData'))}</div>`),
};
const PAGE_ROLES = { student: ['admin', 'teacher', 'accountant'] };
function pageRoles(id) { if (PAGE_ROLES[id]) return PAGE_ROLES[id]; for (const g of MENU) for (const i of g.items) if (i.id === id) return i.roles; return null; }
const homePage = () => (USER.role === 'parent' ? 'portal' : 'dashboard');

function parseHash() {
  const h = location.hash.replace(/^#\/?/, ''); const [path, qs] = h.split('?'); const parts = path.split('/').filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(qs || ''));
  if (parts[1]) params.id = decodeURIComponent(parts[1]);
  return { page: parts[0] || '', params };
}
function setParam(k, v) {
  const { page, params } = parseHash(); delete params.id; params[k] = v;
  const id = parseHash().params.id;
  location.hash = `#/${page}${id ? '/' + id : ''}?${new URLSearchParams(params)}`;
}

/* ---------- theme & language ---------- */
function applyPrefs() {
  document.documentElement.lang = LANG;
  document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
  let theme = null; try { theme = localStorage.getItem('dalala_theme'); } catch (e) { /* ignore */ }
  if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
  document.title = `${t('appName')} — ${loc(S(), 'schoolName')}`;
}
function isDark() { const th = document.documentElement.dataset.theme; return th ? th === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function setLang(l) { LANG = l; try { localStorage.setItem('dalala_lang', l); } catch (e) { /* ignore */ } applyPrefs(); render(); }

/* ---------- auth ---------- */
function restoreSession() {
  let id = null; try { id = localStorage.getItem('dalala_session'); } catch (e) { /* ignore */ }
  USER = id ? DB.all('users').find(u => u.id === id && u.active !== false) || null : null;
}
function login(username, password) {
  const u = DB.all('users').find(x => x.username.toLowerCase() === username.trim().toLowerCase() && x.password === password && x.active !== false);
  if (!u) return false;
  USER = u; try { localStorage.setItem('dalala_session', u.id); } catch (e) { /* ignore */ }
  location.hash = '#/' + homePage(); render(); return true;
}
function logout() { USER = null; try { localStorage.removeItem('dalala_session'); } catch (e) { /* ignore */ } location.hash = ''; render(); }

function renderLogin() {
  const demos = [['admin', 'admin123', 'role_admin', 'shield'], ['teacher', 'teacher123', 'role_teacher', 'pencil'], ['accountant', 'acc123', 'role_accountant', 'wallet'], ['parent', 'parent123', 'role_parent', 'heart']];
  $('#app').innerHTML = `<div class="login">
    <div class="login-art"><div class="art-inner">${LOGO}<h1>${t('appName')}</h1><p>${t('tagline')}</p>
      <ul>${['feat1', 'feat2', 'feat3', 'feat4'].map(f => `<li>${icon('check')}<span>${t(f)}</span></li>`).join('')}</ul></div>
      <div class="blob b1"></div><div class="blob b2"></div></div>
    <div class="login-form"><div class="lf-top"><button class="btn ghost sm" data-act="lang">${icon('globe')}<span>${LANG === 'ar' ? 'English' : 'العربية'}</span></button>
      <button class="icon-btn" data-act="theme">${icon(isDark() ? 'sun' : 'moon')}</button></div>
      <form id="login-form" class="lf-box"><div class="lf-logo">${LOGO}<div><b>${t('appName')}</b><small>${esc(loc(S(), 'schoolName'))}</small></div></div>
        <h2>${t('signIn')}</h2><p class="muted">${t('signInSub')}</p>
        <label class="field"><span>${t('username')}</span><input class="input" name="u" autocomplete="username" dir="ltr" required></label>
        <label class="field"><span>${t('password')}</span><input class="input" name="p" type="password" autocomplete="current-password" dir="ltr" required></label>
        <div class="form-err" hidden>${t('loginError')}</div>
        <button class="btn primary block" type="submit">${t('signIn')}</button>
        <div class="demo"><span>${t('demoAccounts')}</span><div>${demos.map(([u, p, r, ic]) => `<button type="button" class="demo-b" data-act="demo-login" data-u="${u}" data-p="${p}">${icon(ic)}<span>${t(r)}</span></button>`).join('')}</div></div>
      </form><p class="foot">© ${new Date().getFullYear()} ${t('appName')}</p></div></div>`;
  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    if (!login(e.target.u.value, e.target.p.value)) $('.form-err', e.target).hidden = false;
  });
}

/* ---------- layout ---------- */
function sidebar(page) {
  return `<aside class="sidebar"><div class="brand">${LOGO}<div><b>${t('appName')}</b><small>${esc(loc(S(), 'schoolName'))}</small></div></div>
    <nav>${MENU.map(g => { const items = g.items.filter(i => i.roles.includes(USER.role)); if (!items.length) return '';
      return `<div class="nav-g"><span>${t(g.g)}</span>${items.map(i => `<a href="#/${i.id}" class="nav-i ${page === i.id || (page === 'student' && i.id === 'students') ? 'on' : ''}">${icon(i.icon)}<span>${t('nav_' + i.id)}</span></a>`).join('')}</div>`; }).join('')}</nav>
    <div class="side-foot">${t('f_year')}: <b>${esc(S().year)}</b></div></aside>`;
}
function topbar(page) {
  const title = page === 'student' ? t('studentProfile') : t('nav_' + page);
  return `<header class="topbar"><button class="icon-btn only-m" data-act="menu">${icon('menu')}</button>
    <div class="crumbs"><span>${t('appName')}</span><b>${title}</b></div><span class="grow"></span>
    <button class="btn ghost sm" data-act="lang" title="Language">${icon('globe')}<span>${LANG === 'ar' ? 'EN' : 'ع'}</span></button>
    <button class="icon-btn" data-act="theme" title="${t('theme')}">${icon(isDark() ? 'sun' : 'moon')}</button>
    <div class="user-menu"><button class="user-b" data-act="user-menu">${avatar(USER)}<div><b>${esc(loc(USER))}</b><small>${t('role_' + USER.role)}</small></div></button>
      <div class="dropdown" hidden><button data-act="chpass">${icon('key')}<span>${t('changePassword')}</span></button><button data-act="logout" class="danger-t">${icon('logout')}<span>${t('logout')}</span></button></div></div>
  </header>`;
}

function render() {
  applyPrefs();
  if (!USER) { renderLogin(); return; }
  let { page, params } = parseHash();
  const roles = pageRoles(page);
  if (!page || !roles || !roles.includes(USER.role)) { page = homePage(); if (location.hash !== '#/' + page) { history.replaceState(null, '', '#/' + page); } params = {}; }
  let content;
  try { content = PAGES[page] ? PAGES[page](params) : renderCrud(page); }
  catch (e) { console.error(e); content = emptyState(t('errorPage') + ': ' + e.message, 'alert'); }
  const scrollY = window.__lastPage === page ? window.scrollY : 0; window.__lastPage = page;
  $('#app').innerHTML = `<div class="shell">${sidebar(page)}<div class="side-back" data-act="menu"></div><div class="main">${topbar(page)}<main class="content" id="content">${content}</main></div></div>`;
  window.scrollTo(0, scrollY);
}

/* ---------- actions ---------- */
const ACT = {
  lang: () => setLang(LANG === 'ar' ? 'en' : 'ar'),
  theme: () => { const next = isDark() ? 'light' : 'dark'; try { localStorage.setItem('dalala_theme', next); } catch (e) { /* ignore */ } render(); },
  menu: () => document.body.classList.toggle('nav-open'),
  'user-menu': el => { const d = el.parentElement.querySelector('.dropdown'); d.hidden = !d.hidden; },
  logout: () => logout(),
  'demo-login': el => login(el.dataset.u, el.dataset.p),
  chpass: () => {
    const root = modal({ title: t('changePassword'), size: 'sm',
      body: `<form id="pform" class="form-grid one"><label class="field"><span>${t('currentPassword')}</span><input class="input" type="password" name="o" required dir="ltr"></label>
        <label class="field"><span>${t('newPassword')}</span><input class="input" type="password" name="n" minlength="6" required dir="ltr"></label><div class="form-err" hidden></div></form>`,
      footer: `<button class="btn primary" type="submit" form="pform">${t('save')}</button>` });
    $('#pform', root).addEventListener('submit', e => { e.preventDefault(); const f = e.target;
      if (f.o.value !== USER.password) { const b = $('.form-err', f); b.hidden = false; b.textContent = t('wrongPassword'); return; }
      if (f.n.value.length < 6) { const b = $('.form-err', f); b.hidden = false; b.textContent = t('passwordShort'); return; }
      DB.update('users', USER.id, { password: f.n.value }); closeModal(); toast(t('saved')); });
  },
  'quick-add': el => openForm(el.dataset.key),
  'crud-add': el => openForm(el.dataset.key),
  'crud-edit': el => openForm(el.dataset.key, el.dataset.id),
  'crud-del': el => deleteRecord(el.dataset.key, el.dataset.id),
  'crud-export': el => exportCrud(el.dataset.key),
  'crud-tool': el => ENT[el.dataset.key].tools[+el.dataset.i].fn(),
  'crud-action': el => ENT[el.dataset.key].actions[+el.dataset.i].fn(DB.get(el.dataset.key, el.dataset.id)),
  'crud-sort': el => { const st = crudState(el.dataset.key); if (st.sort === el.dataset.f) st.dir = -st.dir; else { st.sort = el.dataset.f; st.dir = 1; } refreshCrud(el.dataset.key); },
  'crud-page': el => { crudState(el.dataset.key).page = +el.dataset.p; refreshCrud(el.dataset.key); },
  'crud-clear': el => { Object.assign(crudState(el.dataset.key), { q: '', f: {}, page: 1 }); render(); },
  'att-set': el => {
    const { sid, st } = el.dataset; ATT.draft[sid] = st;
    $$('.seg-b', el.parentElement).forEach(b => b.classList.toggle('on', b === el));
    const cid = ATT.key.split('|')[1]; $('#att-counts').innerHTML = attCounts(studentsOfClass(cid));
  },
  'att-all': () => { const cid = ATT.key.split('|')[1]; studentsOfClass(cid).forEach(s => { ATT.draft[s.id] = 'P'; }); render(); },
  'att-save': () => {
    const cid = ATT.key.split('|')[1]; const studs = studentsOfClass(cid);
    const missing = studs.filter(s => !ATT.draft[s.id]).length;
    const doSave = () => { DB.d.att[ATT.key] = { ...ATT.draft }; DB.save(); toast(t('attSavedMsg')); render(); };
    if (missing) confirmBox(`${fmtNum(missing)} ${t('unmarkedWarn')}`, doSave, { danger: false, okLabel: t('saveAnyway') }); else doSave();
  },
  'att-export': el => {
    const cid = el.dataset.cid; const from = addDays(today(), -30);
    exportCSV('attendance-' + classLabel(DB.get('classes', cid)).replace(/\s/g, ''), [t('f_code'), t('f_name'), t('att_P'), t('att_A'), t('att_L'), t('att_E'), t('attendanceRate')],
      studentsOfClass(cid).map(s => { const a = studentAttendance(s.id, cid, from); return [s.code, loc(s), a.P, a.A, a.L, a.E, a.rate ?? '']; }));
  },
  'marks-save': () => {
    const f = $('#marks-form'); const key = `${f.dataset.exam}|${f.dataset.sub}`; const max = +f.dataset.max; const rec = {};
    for (const inp of $$('input.mark', f)) {
      if (inp.value === '') continue; const v = Number(inp.value);
      if (isNaN(v) || v < 0 || v > max) { inp.focus(); inp.classList.add('bad'); toast(`${t('errMarkRange')} 0–${max}`, 'err'); return; }
      rec[inp.name] = v;
    }
    DB.d.marks[key] = rec; DB.save(); toast(t('marksSaved')); render();
  },
  'rc-print': el => printHTML(reportCardHTML(DB.get('students', el.dataset.sid), el.dataset.term)),
  'rc-print-all': el => printHTML(studentsOfClass(el.dataset.cid).map(s => reportCardHTML(s, el.dataset.term)).join('<div class="pbreak"></div>')),
  'rc-export': el => {
    const cls = DB.get('classes', el.dataset.cid); const subs = subjectsForClass(cls);
    exportCSV('results-' + classLabel(cls).replace(/\s/g, ''), [t('rank'), t('f_code'), t('f_name'), ...subs.map(s => loc(s)), t('average'), t('gradeLbl')],
      classResults(cls.id, el.dataset.term).map(x => [x.rank || '', x.s.code, loc(x.s), ...x.r.subjects.map(s => s.p ?? ''), x.r.avg ?? '', gradeLetter(x.r.avg).letter]));
  },
  'tt-cell': el => openSlot(el.dataset.cid, +el.dataset.d, +el.dataset.p),
  'tt-print': el => printHTML(`${printHeader(t('nav_timetable') + ' — ' + el.dataset.title)}${$('#tt-area').innerHTML}`),
  'cal-day': (el, e) => { if (e.target.closest('[data-act="cal-ev"]')) return; openForm('events', null, { date: el.dataset.date }); },
  'cal-ev': el => openForm('events', el.dataset.id),
  'rep-export': el => reportExport(el.dataset.what),
  'cert-seats': el => confirmBox(t('assignSeatsQ'), () => assignSeats(+el.dataset.g), { danger: false, okLabel: t('assignSeats') }),
  'cert-export': el => exportCSV(`candidates-grade${el.dataset.g}`, certHeaders(), certRows(+el.dataset.g)),
  'cert-print': el => printHTML(`${printHeader(t(+el.dataset.g === 9 ? 'cert9' : 'cert12') + ' — ' + t('candidates'))}<table class="ptable small"><thead><tr><th>#</th>${certHeaders().slice(0, 9).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
    ${certRows(+el.dataset.g).map((r, i) => `<tr><td>${i + 1}</td>${r.slice(0, 9).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table><div class="psign"><div>${t('f_supervision')}</div><div>${t('principal')}: ${esc(loc(S(), 'principal'))}</div><div>${t('stamp')}</div></div>`),
  'settings-save': () => {
    const f = $('#settings-form'); const st = S(); const num = ['passMark', 'periods', 'periodMinutes', 'breakAfter', 'breakMinutes', 'maxResit', 'bandExcellent', 'bandVgood', 'bandGood', 'absenceWarn', 'absenceLimit'];
    const nb = num.map(k => f.elements[k] ? +f.elements[k].value : 0);
    const [pm, , , , , , be, bv, bg] = nb;
    if (!(be > bv && bv > bg && bg > pm)) { toast(t('errBands'), 'err'); return; }
    st.validateNid = f.elements.validateNid.checked;
    ['country', 'schoolType', 'ministry', 'ministryEn', 'supervision', 'supervisionEn', 'municipality', 'schoolCode', 'schoolName', 'schoolNameEn', 'principal', 'principalEn', 'address', 'addressEn', 'phone', 'email', 'year', 'currency', 'startTime', ...num].forEach(k => { if (f.elements[k]) st[k] = num.includes(k) ? Number(f.elements[k].value) || 0 : f.elements[k].value.trim(); });
    st.workDays = $$('input[name=wd]:checked', f).map(i => +i.value);
    if (!st.workDays.length) st.workDays = [0, 1, 2, 3, 4];
    DB.save(); toast(t('saved')); render();
  },
  backup: () => downloadFile(`dalala-backup-${today()}.json`, JSON.stringify(DB.d, null, 1), 'application/json'),
  'reset-demo': () => confirmBox(t('resetConfirm'), () => { DB.reset(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
  wipe: () => confirmBox(t('wipeConfirm'), () => { DB.wipe(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }),
};
const CHG = {
  'crud-filter': el => { const st = crudState(el.dataset.key); st.f[el.dataset.f] = el.value; st.page = 1; render(); },
  'nav-param': el => setParam(el.dataset.param, el.value),
  restore: el => {
    const file = el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => { try { const d = JSON.parse(rd.result); if (!d.version || !Array.isArray(d.students)) throw new Error('bad');
      confirmBox(t('restoreConfirm'), () => { DB.d = d; DB.save(); DB.load(); restoreSession(); if (!USER) { logout(); return; } toast(t('done')); render(); }); }
      catch (e) { toast(t('invalidFile'), 'err'); } };
    rd.readAsText(file);
  },
};
let searchTimer;
const INP = {
  'crud-search': el => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { const st = crudState(el.dataset.key); st.q = el.value; st.page = 1; refreshCrud(el.dataset.key); }, 150); },
  'mark-input': el => {
    const f = $('#marks-form'); const max = +f.dataset.max; const v = el.value === '' ? null : Number(el.value);
    const bad = v != null && (isNaN(v) || v < 0 || v > max); el.classList.toggle('bad', bad);
    const tr = el.closest('tr'); const p = v == null || bad ? null : pct(v, max); const g = gradeLetter(p);
    $('.m-pct', tr).textContent = p == null ? '—' : fmtNum(p, 1) + '%';
    $('.m-g', tr).innerHTML = p == null ? '—' : badge('g' + g.letter, `${g.letter} · ${t('gr_' + g.key)}`);
    $('#marks-stats').innerHTML = marksStats($$('input.mark', f).map(i => (i.value === '' ? undefined : i.value)), max);
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!e.target.closest('.user-menu')) $$('.dropdown').forEach(d => { d.hidden = true; });
  if (e.target.closest('.nav-i')) document.body.classList.remove('nav-open');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el); });
window.addEventListener('hashchange', () => { closeModal(); render(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());

DB.load();
restoreSession();
render();
