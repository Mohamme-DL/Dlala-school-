/* Dalala School System — core helpers, UI primitives, charts */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sum = (arr, fn = x => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

/* ---------- Icons (stroke, 24x24) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7v1"/>',
  userPlus: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M19 8v6M22 11h-6"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  bookOpen: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-3 2-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 11h16M8 18v3M16 18v3"/><circle cx="8" cy="14.5" r="1"/><circle cx="16" cy="14.5" r="1"/>',
  megaphone: '<path d="m3 11 15-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  printer: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

const LOGO = `<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><rect width="48" height="48" rx="14" fill="url(#lg1)"/><path d="M10 15.5c4.5-1.6 9-1.2 14 1.6 5-2.8 9.5-3.2 14-1.6v18c-4.5-1.6-9-1.2-14 1.6-5-2.8-9.5-3.2-14-1.6z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 17v18" stroke="#fff" stroke-width="2.6"/><circle cx="24" cy="9.5" r="3" fill="#fde68a"/></svg>`;

/* ---------- Formatting ---------- */
const locale = () => (LANG === 'ar' ? 'ar-u-nu-latn' : 'en-US');
const S = () => DB.d.settings;
function fmtNum(n, d = 0) { return Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: d }); }
function fmtMoney(n) { return `${fmtNum(n, 2)} <small class="cur">${esc(S().currency || '')}</small>`; }
function moneyText(n) { return `${fmtNum(n, 2)} ${S().currency || ''}`; }
function parseISO(s) { if (!s) return null; const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function iso(d) { const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function today() { return iso(new Date()); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
function fmtDate(s, opt) { const d = parseISO(s); if (!d || isNaN(d)) return '—'; return d.toLocaleDateString(locale(), opt || { year: 'numeric', month: 'short', day: 'numeric' }); }
function dayName(i, short) { return t(short ? 'daysShort' : 'days')[i]; }
function loc(r, k = 'name') { if (!r) return '—'; return (LANG === 'en' && r[k + 'En']) ? r[k + 'En'] : (r[k] ?? '—'); }
function gradeName(g) { const a = t('grades'); return Array.isArray(a) ? a[g - 1] : 'Grade ' + g; }
function stageOf(g) { g = +g; return !g ? '' : g <= 6 ? 'primary' : g <= 9 ? 'middle' : 'secondary'; }
function classLabel(c) { return c ? `${gradeName(c.grade)} — ${c.section}${c.track && c.track !== 'general' ? ` (${t('opt_' + c.track)})` : ''}` : '—'; }
function termName(n) { return t('opt_term' + n); }
function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }
function norm(s) { return String(s ?? '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي'); }
function hue(str) { let h = 0; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function avatar(r, size = '') { const n = loc(r); return `<span class="av ${size}" style="--h:${hue(r.id || n)}">${esc((n || '?').trim().charAt(0))}</span>`; }
function badge(v, label) { return `<span class="badge b-${esc(v)}">${esc(label ?? t('opt_' + v))}</span>`; }
function gradeLetter(p) {
  if (p == null || isNaN(p)) return { letter: '—', key: 'na' };
  const st = S();
  const s = [[+st.bandExcellent || 85, 'A', 'excellent'], [+st.bandVgood || 75, 'B', 'vgood'], [+st.bandGood || 65, 'C', 'good'], [+st.passMark || 50, 'D', 'pass'], [0, 'F', 'fail']];
  const [, letter, key] = s.find(x => p >= x[0]);
  return { letter, key };
}

/* ---------- Domain lookups ---------- */
const teachers = () => DB.all('employees').filter(e => e.role === 'teacher' && e.status !== 'terminated');
function studentsOfClass(cid) {
  return DB.all('students').filter(s => s.classId === cid && s.status === 'active')
    .sort((a, b) => loc(a).localeCompare(loc(b), LANG));
}
function subjectsForGrade(g, track) {
  g = +g; return DB.all('subjects').filter(s => g >= +s.fromGrade && g <= +s.toGrade && (!s.track || s.track === 'all' || s.track === (track || 'general')));
}
function subjectsForClass(c) { return c ? subjectsForGrade(c.grade, c.track) : []; }

/* ---------- Results (pass / second sitting / fail) ---------- */
function resultStatus(subjects) {
  const valid = subjects.filter(x => x.p != null); if (!valid.length) return null;
  const failed = valid.filter(x => x.p < +S().passMark);
  if (!failed.length) return 'pass';
  return failed.length <= (+S().maxResit || 0) ? 'resit' : 'fail';
}
const RES_BADGE = { pass: 'active', resit: 'partial', fail: 'overdue' };
function resultBadge(st) { return st ? badge(RES_BADGE[st], t('res_' + st)) : '—'; }

/* ---------- Absence limits (warning / deprivation) ---------- */
function absenceInfo(sid, cid) {
  const a = studentAttendance(sid, cid);
  const rate = a.total ? pct(a.A, a.total) : 0;
  const level = rate >= +S().absenceLimit ? 'limit' : rate >= +S().absenceWarn ? 'warn' : null;
  return { ...a, absRate: rate, level };
}
function absenceBadge(level) { return level ? badge(level === 'limit' ? 'overdue' : 'partial', t('abs_' + level)) : ''; }

/* ---------- Libyan validation ---------- */
function libyanNidError(nid, gender, dob) {
  const s = String(nid || '').replace(/\s/g, '');
  if (!/^[12]\d{11}$/.test(s)) return t('errNid12');
  if (gender && s[0] !== (gender === 'male' ? '1' : '2')) return t('errNidGender');
  if (dob && s.slice(1, 5) !== String(dob).slice(0, 4)) return t('errNidYear');
  return null;
}
function isLyPhone(v) { return /^(\+?218|00218|0)?(9[1-6]\d{7}|[2-8]\d{7,8})$/.test(String(v || '').replace(/[\s-]/g, '')); }
const LY_MUNICIPALITIES = ['طرابلس', 'بنغازي', 'مصراتة', 'الزاوية', 'زليتن', 'الخمس', 'صبراتة', 'صرمان', 'غريان', 'ترهونة', 'سرت', 'البيضاء', 'درنة', 'طبرق', 'أجدابيا', 'المرج', 'سبها', 'أوباري', 'مرزق', 'غات', 'الكفرة', 'نالوت', 'يفرن', 'زوارة', 'بني وليد', 'جنزور', 'تاجوراء', 'سوق الجمعة', 'أبوسليم', 'حي الأندلس', 'العجيلات', 'الجميل', 'القره بوللي', 'مسلاتة', 'هون', 'ودان', 'براك الشاطئ', 'الأبيار', 'شحات', 'الجفرة', 'جالو', 'قصر الأخيار', 'العزيزية', 'ككلة', 'الزنتان', 'الرجبان', 'جادو', 'ورشفانة'];
function sortedClasses() { return DB.all('classes').slice().sort((a, b) => a.grade - b.grade || String(a.section).localeCompare(b.section)); }
function invPaid(inv) { return sum(DB.all('payments').filter(p => p.invoiceId === inv.id), p => p.amount); }
function invNet(inv) { return Math.max(0, (+inv.amount || 0) - (+inv.discount || 0)); }
function invBalance(inv) { return Math.max(0, Math.round((invNet(inv) - invPaid(inv)) * 100) / 100); }
function invStatus(inv) {
  const b = invBalance(inv), p = invPaid(inv);
  if (b <= 0.001) return 'paid';
  if (inv.dueDate && inv.dueDate < today()) return 'overdue';
  return p > 0 ? 'partial' : 'unpaid';
}
function loanStatus(l) { return l.returnDate ? 'returned' : (l.dueDate && l.dueDate < today() ? 'overdue' : 'borrowed'); }
function bookAvailable(b) { return (+b.copies || 0) - DB.all('loans').filter(l => l.bookId === b.id && !l.returnDate).length; }

/* attendance: DB.d.att["YYYY-MM-DD|classId"] = { studentId: 'P'|'A'|'L'|'E' } */
function attFor(date, cid) { return DB.d.att[`${date}|${cid}`]; }
function studentAttendance(sid, cid, from) {
  const c = { P: 0, A: 0, L: 0, E: 0, days: [] };
  for (const [k, v] of Object.entries(DB.d.att)) {
    const [d, kc] = k.split('|');
    if (kc !== cid || (from && d < from) || !v[sid]) continue;
    c[v[sid]]++; c.days.push({ date: d, st: v[sid] });
  }
  c.total = c.P + c.A + c.L + c.E;
  c.rate = c.total ? pct(c.P + c.L, c.total) : null;
  c.days.sort((a, b) => b.date.localeCompare(a.date));
  return c;
}
function attRateByDate(date) {
  let p = 0, n = 0;
  for (const [k, v] of Object.entries(DB.d.att)) {
    if (!k.startsWith(date + '|')) continue;
    for (const st of Object.values(v)) { n++; if (st === 'P' || st === 'L') p++; }
  }
  return n ? pct(p, n) : null;
}

/* marks: DB.d.marks["examId|subjectId"] = { studentId: number } */
function termResult(student, term) {
  const cls = DB.get('classes', student.classId); if (!cls) return { subjects: [], avg: null, exams: [] };
  if (term === 'annual') {
    const r1 = termResult(student, 1), r2 = termResult(student, 2);
    const subjects = r1.subjects.map((x, i) => { const y = r2.subjects[i]; const ps = [x.p, y.p].filter(v => v != null);
      return { sub: x.sub, cells: [x.p, y.p], got: 0, max: 0, p: ps.length ? Math.round(sum(ps) / ps.length * 10) / 10 : null }; });
    const valid = subjects.filter(s => s.p !== null);
    return { exams: [{ title: termName(1), maxMark: 100 }, { title: termName(2), maxMark: 100 }], subjects,
      avg: valid.length ? Math.round(sum(valid, s => s.p) / valid.length * 10) / 10 : null, status: resultStatus(subjects) };
  }
  const exams = DB.all('exams').filter(e => String(e.term) === String(term)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const subjects = subjectsForClass(cls).map(sub => {
    let got = 0, max = 0; const cells = exams.map(ex => {
      const m = DB.d.marks[`${ex.id}|${sub.id}`]?.[student.id];
      if (m !== undefined && m !== null && m !== '') { got += +m; max += +ex.maxMark; }
      return m;
    });
    return { sub, cells, got, max, p: max ? pct(got, max) : null };
  });
  const valid = subjects.filter(s => s.p !== null);
  const avg = valid.length ? Math.round(sum(valid, s => s.p) / valid.length * 10) / 10 : null;
  return { exams, subjects, avg, status: resultStatus(subjects) };
}

/* ---------- Timetable helpers ---------- */
function periodTimes() {
  const st = S(); const [h, m] = (st.startTime || '07:30').split(':').map(Number);
  let cur = h * 60 + m; const out = [];
  for (let p = 0; p < (+st.periods || 7); p++) {
    const s = cur, e = cur + (+st.periodMinutes || 45);
    out.push({ s, e }); cur = e;
    if (p + 1 === +st.breakAfter) cur += (+st.breakMinutes || 20);
  }
  const f = x => `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
  return out.map(x => ({ from: f(x.s), to: f(x.e) }));
}
const SUBJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#a855f7'];
function subjectColor(sid) { const i = DB.all('subjects').findIndex(s => s.id === sid); return SUBJECT_COLORS[(i < 0 ? 0 : i) % SUBJECT_COLORS.length]; }

/* ---------- Modal / toast / confirm ---------- */
function modal({ title, body, footer = '', size = '' }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal ${size}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${title}</h3><button class="icon-btn" type="button" data-x>${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div></div>`;
  root.classList.add('open');
  const back = root.firstElementChild;
  back.addEventListener('mousedown', e => { if (e.target === back) closeModal(); });
  $('[data-x]', root).onclick = closeModal;
  setTimeout(() => { const f = $('.modal-body input:not([type=hidden]):not([readonly]), .modal-body select, .modal-body textarea', root); f && f.focus(); }, 40);
  return root;
}
function closeModal() { const r = $('#modal-root'); r.innerHTML = ''; r.classList.remove('open'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal-root.open')) closeModal(); });

function confirmBox(msg, onYes, { danger = true, okLabel } = {}) {
  const root = modal({
    title: t('confirm'), size: 'sm',
    body: `<div class="confirm-msg">${icon('alert', danger ? 'danger' : '')}<p>${msg}</p></div>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${okLabel || t('yes')}</button>`,
  });
  $('[data-x2]', root).onclick = closeModal;
  $('[data-ok]', root).onclick = () => { closeModal(); onYes(); };
}

function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

/* ---------- Charts ---------- */
function barChart(items, { height = 190, suffix = '', max } = {}) {
  if (!items.length) return emptyState(t('noData'));
  const m = max || Math.max(1, ...items.map(i => +i.value || 0));
  return `<div class="bars" style="height:${height}px">${items.map(i => `
    <div class="bar-col" title="${esc(i.label)}: ${fmtNum(i.value, 1)}${suffix}">
      <div class="bar-val">${i.value == null ? '—' : fmtNum(i.value, 0) + suffix}</div>
      <div class="bar-track"><div class="bar" style="height:${Math.max(2, (+i.value || 0) / m * 100)}%;${i.color ? `background:${i.color}` : ''}"></div></div>
      <div class="bar-lbl">${esc(i.label)}</div>
    </div>`).join('')}</div>`;
}
function hbars(items, { suffix = '', max } = {}) {
  const m = max || Math.max(1, ...items.map(i => +i.value || 0));
  return `<div class="hbars">${items.map(i => `<div class="hbar"><span class="hbar-lbl">${esc(i.label)}</span>
    <div class="progress"><span style="width:${Math.min(100, (+i.value || 0) / m * 100)}%;${i.color ? `background:${i.color}` : ''}"></span></div>
    <b>${i.value == null ? '—' : fmtNum(i.value, 1) + suffix}</b></div>`).join('')}</div>`;
}
function donut(items, { center = '', sub = '' } = {}) {
  const total = sum(items, i => i.value) || 1, r = 60, C = 2 * Math.PI * r; let off = 0;
  const segs = items.map(i => {
    const len = i.value / total * C;
    const s = `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${i.color}" stroke-width="20" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"/>`;
    off += len; return s;
  }).join('');
  return `<div class="donut-box"><div class="donut-wrap"><svg viewBox="0 0 160 160"><circle r="${r}" cx="80" cy="80" fill="none" stroke="var(--line)" stroke-width="20"/><g transform="rotate(-90 80 80)">${segs}</g></svg>
    <div class="donut-center"><b>${center}</b><span>${sub}</span></div></div>
    <div class="legend">${items.map(i => `<div><i style="background:${i.color}"></i><span>${esc(i.label)}</span><b>${fmtNum(i.value)}</b></div>`).join('')}</div></div>`;
}
const progress = (p, color) => `<div class="progress"><span style="width:${Math.max(0, Math.min(100, p || 0))}%;${color ? `background:${color}` : ''}"></span></div>`;
const emptyState = (msg, ic = 'sparkle') => `<div class="empty">${icon(ic)}<p>${esc(msg)}</p></div>`;

/* ---------- Files / print ---------- */
function downloadFile(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function exportCSV(name, headers, rows) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  downloadFile(`${name}-${today()}.csv`, '﻿' + [headers, ...rows].map(r => r.map(q).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
function printHTML(html) {
  const pa = $('#print-area');
  pa.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr');
  pa.innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 60);
}
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); $('#print-area').innerHTML = ''; });
function printHeader(title) {
  const st = S();
  const ly = st.country === 'LY' ? `<div class="ph-gov"><b>${t('libyaState')}</b><span>${esc(loc(st, 'ministry'))}</span><span>${esc(loc(st, 'supervision'))}</span></div>` : '';
  return `${ly}<div class="ph">${LOGO.replace(/lg1/g, 'lgp')}<div><h2>${esc(loc(st, 'schoolName'))}</h2><p>${esc(loc(st, 'address') || '')} · <span class="ltr">${esc(st.phone || '')}</span>${st.schoolCode ? ` · ${t('f_schoolCode')}: ${esc(st.schoolCode)}` : ''}</p></div>
    <div class="ph-end"><b>${esc(title)}</b><span>${t('f_year')}: ${esc(st.year || '')}</span><span>${fmtDate(today())}</span></div></div>`;
}
