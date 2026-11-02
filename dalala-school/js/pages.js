/* Dalala School System — custom pages */
'use strict';

function pageHead(title, sub, actions = '') {
  return `<div class="page-head"><div><h1>${title}</h1>${sub && !sub.startsWith('sub_') ? `<p>${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></div>`;
}
function selectBox(param, opts, cur, label) {
  return `<label class="sel"><span>${label}</span><select class="input sm" data-chg="nav-param" data-param="${param}">${opts.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(cur) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select></label>`;
}
const classOpts = () => sortedClasses().map(c => ({ v: c.id, l: classLabel(c) }));
const kpi = k => `<a class="kpi ${k.c || ''}" ${k.href ? `href="${k.href}"` : ''}><div class="kpi-ic">${icon(k.ic)}</div><div class="kpi-body"><span>${k.label}</span><b>${k.val}</b>${k.sub ? `<small>${k.sub}</small>` : ''}</div></a>`;
const card = (title, body, extra = '', cls = '') => `<section class="card ${cls}"><div class="card-head"><h3>${title}</h3>${extra}</div><div class="card-body">${body}</div></section>`;
function visibleAnnouncements() {
  const aud = { admin: null, teacher: ['all', 'staff'], accountant: ['all', 'staff'], librarian: ['all', 'staff'], parent: ['all', 'parents', 'students'] }[USER.role];
  return DB.all('announcements').filter(a => !aud || aud.includes(a.audience)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}
function upcomingEvents(n = 5) {
  const T = today();
  return DB.all('events').filter(e => (e.endDate || e.date) >= T).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
}
function eventItem(e) {
  const d = parseISO(e.date);
  return `<li class="ev"><div class="ev-date t-${esc(e.type)}"><b>${fmtNum(d.getDate())}</b><span>${d.toLocaleDateString(locale(), { month: 'short' })}</span></div>
    <div><b>${esc(loc(e, 'title'))}</b><small>${t('opt_' + e.type)}${e.endDate ? ` · ${t('until')} ${fmtDate(e.endDate)}` : ''}</small></div></li>`;
}

/* ================= Dashboard ================= */
function renderDashboard() {
  const T = today();
  const students = DB.all('students').filter(s => s.status === 'active');
  const invs = DB.all('invoices'); const billed = sum(invs, invNet), paid = sum(invs, invPaid);
  const rate = attRateByDate(T);
  const absentToday = Object.entries(DB.d.att).filter(([k]) => k.startsWith(T + '|')).reduce((n, [, v]) => n + Object.values(v).filter(x => x === 'A').length, 0);
  const hour = new Date().getHours();
  const greet = t(hour < 12 ? 'goodMorning' : 'goodEvening');
  const kpis = [
    { ic: 'users', label: t('kpiStudents'), val: fmtNum(students.length), sub: `${fmtNum(students.filter(s => s.gender === 'male').length)} ${t('opt_male')} · ${fmtNum(students.filter(s => s.gender === 'female').length)} ${t('opt_female')}`, c: 'c1', href: '#/students' },
    { ic: 'briefcase', label: t('kpiTeachers'), val: fmtNum(teachers().length), sub: `${fmtNum(DB.all('employees').length)} ${t('kpiStaffTotal')}`, c: 'c2', href: '#/employees' },
    { ic: 'check', label: t('kpiAttendanceToday'), val: rate == null ? '—' : fmtNum(rate, 1) + '%', sub: `${fmtNum(absentToday)} ${t('absentToday')}`, c: 'c3', href: '#/attendance' },
    { ic: 'wallet', label: t('kpiCollected'), val: moneyText(paid), sub: `${fmtNum(pct(paid, billed), 1)}% ${t('ofBilled')}`, c: 'c4', href: '#/invoices' },
  ];
  const minis = [
    { ic: 'layers', l: t('nav_classes'), v: DB.all('classes').length, href: '#/classes' },
    { ic: 'userPlus', l: t('pendingAdmissions'), v: DB.all('admissions').filter(a => ['new', 'review', 'interview'].includes(a.status)).length, href: '#/admissions' },
    { ic: 'receipt', l: t('overdueInvoices'), v: invs.filter(i => invStatus(i) === 'overdue').length, href: '#/invoices' },
    { ic: 'bookOpen', l: t('booksOnLoan'), v: DB.all('loans').filter(l => !l.returnDate).length, href: '#/loans' },
    { ic: 'pencil', l: t('activeHomework'), v: DB.all('homework').filter(h => h.dueDate >= T).length, href: '#/homework' },
    { ic: 'bus', l: t('nav_buses'), v: DB.all('buses').length, href: '#/buses' },
  ];
  const dates = [...new Set(Object.keys(DB.d.att).map(k => k.split('|')[0]))].sort().slice(-10);
  const trend = dates.map(d => ({ label: fmtDate(d, { day: 'numeric', month: 'short' }), value: attRateByDate(d) }));
  const stageCount = STAGES.map((s, i) => ({ label: t('opt_' + s), value: students.filter(x => stageOf(DB.get('classes', x.classId)?.grade) === s).length, color: ['#6366f1', '#06b6d4', '#f59e0b'][i] }));
  const anns = visibleAnnouncements().slice(0, 3);
  const quick = [
    { ic: 'userPlus', l: t('addStudent'), act: 'quick-add', key: 'students', roles: ['admin'] },
    { ic: 'check', l: t('takeAttendance'), href: '#/attendance', roles: ['admin', 'teacher'] },
    { ic: 'pencil', l: t('enterMarks'), href: '#/marks', roles: ['admin', 'teacher'] },
    { ic: 'wallet', l: t('recordPayment'), act: 'quick-add', key: 'payments', roles: ['admin', 'accountant'] },
    { ic: 'megaphone', l: t('newAnnouncement'), act: 'quick-add', key: 'announcements', roles: ['admin'] },
    { ic: 'chart', l: t('nav_reports'), href: '#/reports', roles: ['admin', 'accountant'] },
  ].filter(q => can(q.roles));

  let mySchedule = '';
  if (USER.employeeId && DB.get('employees', USER.employeeId)?.role === 'teacher') {
    const dow = new Date().getDay(); const times = periodTimes(); const items = [];
    if (S().workDays.includes(dow)) Object.entries(DB.d.tt).forEach(([cid, g]) => Object.entries(g).forEach(([k, v]) => {
      const [d, p] = k.split('-').map(Number); if (d === dow && v.teacherId === USER.employeeId) items.push({ p, cid, sid: v.subjectId });
    }));
    items.sort((a, b) => a.p - b.p);
    mySchedule = card(t('myScheduleToday'), items.length ? `<ul class="sched">${items.map(i => `<li style="--c:${subjectColor(i.sid)}"><span class="time" dir="ltr">${times[i.p]?.from}–${times[i.p]?.to}</span><b>${esc(refLabel('subjects', i.sid))}</b><small>${esc(refLabel('classes', i.cid))}</small><a class="btn ghost sm" href="#/attendance?class=${i.cid}">${icon('check')}</a></li>`).join('')}</ul>` : emptyState(t('noClassesToday'), 'calendar'),
      `<a class="link" href="#/timetable?teacher=${USER.employeeId}">${t('viewAll')}</a>`);
  }

  return `<div class="hero"><div><h1>${greet}${t('comma')} ${esc(loc(USER))} 👋</h1><p>${fmtDate(T, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · ${t('f_year')} ${esc(S().year)}</p></div>
      <div class="quick">${quick.map(q => q.href ? `<a class="qbtn" href="${q.href}">${icon(q.ic)}<span>${q.l}</span></a>` : `<button class="qbtn" data-act="${q.act}" data-key="${q.key}">${icon(q.ic)}<span>${q.l}</span></button>`).join('')}</div></div>
    <div class="kpis">${kpis.map(kpi).join('')}</div>
    <div class="minis">${minis.map(m => `<a class="mini" href="${m.href}">${icon(m.ic)}<b>${fmtNum(m.v)}</b><span>${m.l}</span></a>`).join('')}</div>
    ${mySchedule ? `<div class="grid-2">${mySchedule}${card(t('latestAnnouncements'), anns.map(annCard).join('') || emptyState(t('noData')), `<a class="link" href="#/announcements">${t('viewAll')}</a>`)}</div>` : ''}
    <div class="grid-3">
      ${card(t('attendanceTrend'), barChart(trend, { suffix: '%', max: 100 }), `<a class="link" href="#/attendance">${t('viewAll')}</a>`, 'span-2')}
      ${card(t('studentsByStage'), donut(stageCount, { center: fmtNum(students.length), sub: t('student') }))}
    </div>
    <div class="grid-3">
      ${card(t('finance'), `<div class="fin"><div class="fin-row"><span>${t('totalBilled')}</span><b>${moneyText(billed)}</b></div>
        <div class="fin-row ok"><span>${t('f_paid')}</span><b>${moneyText(paid)}</b></div>${progress(pct(paid, billed), 'var(--ok)')}
        <div class="fin-row bad"><span>${t('outstanding')}</span><b>${moneyText(billed - paid)}</b></div></div>`, `<a class="link" href="#/invoices">${t('viewAll')}</a>`)}
      ${card(t('upcomingEvents'), `<ul class="evs">${upcomingEvents().map(eventItem).join('') || emptyState(t('noData'))}</ul>`, `<a class="link" href="#/calendar">${t('nav_calendar')}</a>`)}
      ${mySchedule ? card(t('topClasses'), topClasses()) : card(t('latestAnnouncements'), anns.map(annCard).join('') || emptyState(t('noData')), `<a class="link" href="#/announcements">${t('viewAll')}</a>`)}
    </div>`;
}
function topClasses() {
  const res = sortedClasses().map(c => { const r = studentsOfClass(c.id).map(s => termResult(s, 1).avg).filter(x => x != null); return { label: classLabel(c), value: r.length ? sum(r) / r.length : null }; })
    .filter(x => x.value != null).sort((a, b) => b.value - a.value).slice(0, 6);
  return hbars(res, { suffix: '%', max: 100 });
}

/* ================= Attendance ================= */
let ATT = { key: null, draft: {} };
function renderAttendance(p) {
  const classes = sortedClasses(); if (!classes.length) return pageHead(t('nav_attendance')) + emptyState(t('noClasses'));
  const cid = DB.get('classes', p.class) ? p.class : classes[0].id;
  const date = p.date || today();
  const key = `${date}|${cid}`;
  if (ATT.key !== key) ATT = { key, draft: { ...(DB.d.att[key] || {}) } };
  const studs = studentsOfClass(cid); const saved = !!DB.d.att[key];
  const isWork = S().workDays.includes(parseISO(date).getDay());
  const from = addDays(today(), -30);
  const stBtn = (sid, st) => `<button class="seg-b s-${st} ${ATT.draft[sid] === st ? 'on' : ''}" data-act="att-set" data-sid="${sid}" data-st="${st}" title="${t('att_' + st)}">${t('attShort_' + st)}</button>`;
  return `${pageHead(t('nav_attendance'), t('sub_attendance'), `<button class="btn ghost" data-act="att-export" data-cid="${cid}">${icon('download')}<span>${t('export')}</span></button>`)}
    <div class="card"><div class="toolbar">
      ${selectBox('class', classOpts(), cid, t('f_classId'))}
      <label class="sel"><span>${t('f_date')}</span><input class="input sm" type="date" value="${date}" max="${today()}" data-chg="nav-param" data-param="date"></label>
      <span class="grow"></span>
      ${saved ? badge('active', t('attSaved')) : badge('pending', t('attNotSaved'))}
      ${!isWork ? badge('overdue', t('notWorkDay')) : ''}
    </div>
    <div id="att-counts">${attCounts(studs)}</div>
    ${studs.length ? `<div class="table-wrap"><table class="table att"><thead><tr><th>#</th><th>${t('f_name')}</th><th>${t('f_status')}</th><th>${t('rate30')}</th><th>${t('absenceYear')}</th></tr></thead><tbody>
      ${studs.map((s, i) => { const a = studentAttendance(s.id, cid, from); return `<tr><td>${i + 1}</td><td><a class="who" href="#/student/${s.id}">${avatar(s)}<span>${esc(loc(s))}</span></a></td>
        <td><div class="seg">${['P', 'A', 'L', 'E'].map(st => stBtn(s.id, st)).join('')}</div></td>
        <td>${a.rate == null ? '—' : `<div class="cap"><span>${fmtNum(a.rate, 1)}%</span>${progress(a.rate, a.rate < 80 ? 'var(--bad)' : 'var(--ok)')}</div>`}</td>
        <td>${(() => { const ab = absenceInfo(s.id, cid); return `${fmtNum(ab.absRate, 1)}% ${absenceBadge(ab.level)}`; })()}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="form-actions"><button class="btn ghost" data-act="att-all">${icon('check')}<span>${t('markAllPresent')}</span></button>
      <button class="btn primary" data-act="att-save">${icon('check')}<span>${t('saveAttendance')}</span></button></div>` : emptyState(t('noStudents'))}
    </div>`;
}
function attCounts(studs) {
  const c = { P: 0, A: 0, L: 0, E: 0 }; studs.forEach(s => { const v = ATT.draft[s.id]; if (v) c[v]++; });
  const un = studs.length - c.P - c.A - c.L - c.E;
  return `<div class="summary">${['P', 'A', 'L', 'E'].map(k => `<div class="sum-item s-${k}"><span>${t('att_' + k)}</span><b>${fmtNum(c[k])}</b></div>`).join('')}<div class="sum-item"><span>${t('unmarked')}</span><b>${fmtNum(un)}</b></div></div>`;
}

/* ================= Marks entry ================= */
function renderMarks(p) {
  const exams = DB.all('exams').slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const classes = sortedClasses();
  if (!exams.length || !classes.length) return pageHead(t('nav_marks')) + emptyState(t('needExamsClasses'));
  const exam = DB.get('exams', p.exam) || [...exams].reverse().find(e => e.date <= today()) || exams[0];
  const cls = DB.get('classes', p.class) || classes[0];
  const subs = subjectsForClass(cls);
  const mySub = USER.employeeId ? DB.get('employees', USER.employeeId)?.subjectId : null;
  const sub = subs.find(s => s.id === p.subject) || subs.find(s => s.id === mySub) || subs[0];
  if (!sub) return pageHead(t('nav_marks')) + emptyState(t('noSubjects'));
  const rec = DB.d.marks[`${exam.id}|${sub.id}`] || {};
  const studs = studentsOfClass(cls.id);
  return `${pageHead(t('nav_marks'), t('sub_marks'))}
    <div class="card"><div class="toolbar">
      ${selectBox('exam', exams.map(e => ({ v: e.id, l: `${loc(e, 'title')} (${termName(e.term)})` })), exam.id, t('f_examId'))}
      ${selectBox('class', classOpts(), cls.id, t('f_classId'))}
      ${selectBox('subject', subs.map(s => ({ v: s.id, l: loc(s) })), sub.id, t('f_subjectId'))}
      <span class="grow"></span><span class="pill">${t('f_maxMark')}: <b>${fmtNum(exam.maxMark)}</b></span>
    </div>
    <div id="marks-stats">${marksStats(studs.map(s => rec[s.id]), exam.maxMark)}</div>
    ${studs.length ? `<form id="marks-form" data-exam="${exam.id}" data-sub="${sub.id}" data-max="${exam.maxMark}"><div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>${t('f_name')}</th><th>${t('mark')}</th><th>%</th><th>${t('gradeLbl')}</th></tr></thead><tbody>
      ${studs.map((s, i) => { const v = rec[s.id]; const pr = v === undefined || v === '' ? null : pct(v, exam.maxMark); const g = gradeLetter(pr);
        return `<tr><td>${i + 1}</td><td><span class="who">${avatar(s)}<span>${esc(loc(s))}</span></span></td>
        <td><input class="input mark" type="number" min="0" max="${exam.maxMark}" step="0.5" name="${s.id}" value="${v ?? ''}" data-inp="mark-input"></td>
        <td class="m-pct">${pr == null ? '—' : fmtNum(pr, 1) + '%'}</td><td class="m-g">${pr == null ? '—' : badge('g' + g.letter, `${g.letter} · ${t('gr_' + g.key)}`)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="form-actions"><button class="btn primary" type="button" data-act="marks-save">${icon('check')}<span>${t('saveMarks')}</span></button></div></form>` : emptyState(t('noStudents'))}
    </div>`;
}
function marksStats(vals, max) {
  const v = vals.filter(x => x !== undefined && x !== '' && x !== null).map(Number);
  const pass = v.filter(x => pct(x, max) >= +S().passMark).length;
  const items = [[t('entered'), `${fmtNum(v.length)} / ${fmtNum(vals.length)}`], [t('average'), v.length ? fmtNum(sum(v) / v.length, 1) : '—'],
    [t('highest'), v.length ? fmtNum(Math.max(...v), 1) : '—'], [t('lowest'), v.length ? fmtNum(Math.min(...v), 1) : '—'], [t('passRate'), v.length ? fmtNum(pct(pass, v.length), 1) + '%' : '—']];
  return `<div class="summary">${items.map(([l, x]) => `<div class="sum-item"><span>${l}</span><b>${x}</b></div>`).join('')}</div>`;
}

/* ================= Report cards ================= */
function classResults(cid, term) {
  const res = studentsOfClass(cid).map(s => ({ s, r: termResult(s, term) }));
  const ranked = res.filter(x => x.r.avg != null).sort((a, b) => b.r.avg - a.r.avg);
  ranked.forEach((x, i) => { x.rank = i > 0 && ranked[i - 1].r.avg === x.r.avg ? ranked[i - 1].rank : i + 1; });
  return res;
}
function renderReportCards(p) {
  const classes = sortedClasses(); if (!classes.length) return pageHead(t('nav_reportcards')) + emptyState(t('noClasses'));
  const cls = DB.get('classes', p.class) || classes[0]; const term = p.term || '1';
  const res = classResults(cls.id, term); const subs = subjectsForClass(cls);
  const valid = res.filter(x => x.r.avg != null);
  const dist = ['A', 'B', 'C', 'D', 'F'].map(l => ({ label: l, value: valid.filter(x => gradeLetter(x.r.avg).letter === l).length, color: { A: '#10b981', B: '#06b6d4', C: '#6366f1', D: '#f59e0b', F: '#ef4444' }[l] }));
  return `${pageHead(t('nav_reportcards'), t('sub_reportcards'), `<button class="btn ghost" data-act="rc-export" data-cid="${cls.id}" data-term="${term}">${icon('download')}<span>${t('export')}</span></button>
      <button class="btn primary" data-act="rc-print-all" data-cid="${cls.id}" data-term="${term}">${icon('printer')}<span>${t('printAll')}</span></button>`)}
    <div class="card"><div class="toolbar">${selectBox('class', classOpts(), cls.id, t('f_classId'))}${selectBox('term', [1, 2, 'annual'].map(v => ({ v, l: termName(v) })), term, t('f_term'))}</div>
    <div class="grid-2 inner"><div>${barChart(dist, { height: 150 })}</div>
      <div class="summary col">${[[t('classAverage'), valid.length ? fmtNum(sum(valid, x => x.r.avg) / valid.length, 1) + '%' : '—'], [t('passRate'), valid.length ? fmtNum(pct(valid.filter(x => x.r.avg >= +S().passMark).length, valid.length), 1) + '%' : '—'], [t('studentsCount'), fmtNum(res.length)], [t('res_summary'), ['pass', 'resit', 'fail'].map(k => `${t('res_' + k)}: ${fmtNum(res.filter(x => x.r.status === k).length)}`).join(' · ')]].map(([l, v]) => `<div class="sum-item"><span>${l}</span><b>${v}</b></div>`).join('')}</div></div>
    ${res.length ? `<div class="table-wrap"><table class="table rc"><thead><tr><th>${t('rank')}</th><th>${t('f_name')}</th>${subs.map(s => `<th title="${esc(loc(s))}">${esc(s.code)}</th>`).join('')}<th>${t('average')}</th><th>${t('gradeLbl')}</th><th>${t('result')}</th><th></th></tr></thead><tbody>
      ${res.sort((a, b) => (a.rank || 999) - (b.rank || 999)).map(x => { const g = gradeLetter(x.r.avg); return `<tr><td>${x.rank ? `<span class="rank r${x.rank}">${fmtNum(x.rank)}</span>` : '—'}</td>
        <td><a class="who" href="#/student/${x.s.id}">${avatar(x.s)}<span>${esc(loc(x.s))}</span></a></td>
        ${x.r.subjects.map(su => `<td class="${su.p != null && su.p < +S().passMark ? 'fail' : ''}">${su.p == null ? '—' : fmtNum(su.p, 0)}</td>`).join('')}
        <td><b>${x.r.avg == null ? '—' : fmtNum(x.r.avg, 1) + '%'}</b></td><td>${x.r.avg == null ? '—' : badge('g' + g.letter, g.letter)}</td><td>${resultBadge(x.r.status)}</td>
        <td><button class="icon-btn" data-act="rc-print" data-sid="${x.s.id}" data-term="${term}" title="${t('print')}">${icon('printer')}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : emptyState(t('noStudents'))}</div>`;
}
function reportCardHTML(s, term) {
  const cls = DB.get('classes', s.classId); const r = termResult(s, term);
  const rank = classResults(s.classId, term).find(x => x.s.id === s.id)?.rank;
  const att = studentAttendance(s.id, s.classId); const g = gradeLetter(r.avg);
  const resitSubs = r.subjects.filter(x => x.p != null && x.p < +S().passMark).map(x => loc(x.sub));
  const ly = S().country === 'LY';
  const hr = DB.get('employees', cls?.teacherId);
  return `<div class="rcard">${printHeader(`${t('reportCard')} — ${termName(term)}`)}
    <div class="pbox"><div class="kv"><span>${t('f_name')}</span><b>${esc(loc(s))}</b></div><div class="kv"><span>${t('f_code')}</span><b>${esc(s.code)}</b></div>
    <div class="kv"><span>${t('f_classId')}</span><b>${esc(classLabel(cls))}</b></div><div class="kv"><span>${t('homeroom')}</span><b>${esc(loc(hr))}</b></div>
    ${ly ? `<div class="kv"><span>${t('f_motherName')}</span><b>${esc(s.motherName || '—')}</b></div><div class="kv"><span>${t('f_nationalId')}</span><b>${esc(s.nationalId || '—')}</b></div>
    <div class="kv"><span>${t('f_dob')}</span><b>${fmtDate(s.dob)}${s.birthPlace ? ' — ' + esc(s.birthPlace) : ''}</b></div>${s.seatNumber ? `<div class="kv"><span>${t('f_seatNumber')}</span><b>${esc(s.seatNumber)}</b></div>` : ''}` : ''}</div>
    <table class="ptable"><thead><tr><th>${t('f_subjectId')}</th>${r.exams.map(e => `<th>${esc(loc(e, 'title'))}<br><small>/${fmtNum(e.maxMark)}</small></th>`).join('')}<th>${t('total')}</th><th>%</th><th>${t('gradeLbl')}</th></tr></thead>
    <tbody>${r.subjects.map(x => { const gg = gradeLetter(x.p); return `<tr><td>${esc(loc(x.sub))}</td>${x.cells.map(c => `<td>${c ?? '—'}</td>`).join('')}<td>${x.max ? `${fmtNum(x.got, 1)} / ${fmtNum(x.max)}` : '—'}</td><td>${x.p == null ? '—' : fmtNum(x.p, 1)}</td><td>${x.p == null ? '—' : `${gg.letter} — ${t('gr_' + gg.key)}`}</td></tr>`; }).join('')}</tbody></table>
    <div class="ptotals"><div><span>${t('average')}</span><b>${r.avg == null ? '—' : fmtNum(r.avg, 1) + '%'}</b></div><div><span>${t('gradeLbl')}</span><b>${g.letter} — ${t('gr_' + g.key)}</b></div>
    <div><span>${t('rank')}</span><b>${rank ? `${fmtNum(rank)} / ${fmtNum(studentsOfClass(s.classId).length)}` : '—'}</b></div><div><span>${t('attendanceRate')}</span><b>${att.rate == null ? '—' : fmtNum(att.rate, 1) + '%'}</b></div>
    <div><span>${t('result')}</span><b>${r.status ? t('res_' + r.status) : '—'}</b></div></div>
    ${resitSubs.length ? `<p class="presit"><b>${t(r.status === 'resit' ? 'resitSubjects' : 'failedSubjects')}:</b> ${esc(resitSubs.join('، '))}</p>` : ''}
    <div class="psign"><div>${t('homeroom')}</div><div>${t('principal')}: ${esc(loc(S(), 'principal'))}</div><div>${t('guardianSign')}</div></div></div>`;
}

/* ================= Timetable ================= */
function ttGrid({ cid, teacherId, editable }) {
  const st = S(), times = periodTimes(), days = st.workDays;
  let cells = {};
  if (cid) cells = DB.d.tt[cid] || {};
  else Object.entries(DB.d.tt).forEach(([c, g]) => Object.entries(g).forEach(([k, v]) => { if (v.teacherId === teacherId) cells[k] = { ...v, classId: c }; }));
  const rows = [];
  times.forEach((tm, p) => {
    rows.push(`<tr><th class="tt-time"><b>${fmtNum(p + 1)}</b><small dir="ltr">${tm.from} – ${tm.to}</small></th>${days.map(d => {
      const c = cells[`${d}-${p}`];
      const inner = c && c.subjectId ? `<div class="slot" style="--c:${subjectColor(c.subjectId)}"><b>${esc(refLabel('subjects', c.subjectId))}</b><small>${esc(cid ? (c.teacherId ? refLabel('employees', c.teacherId) : t('noTeacher')) : refLabel('classes', c.classId))}</small></div>` : `<div class="slot empty">${editable ? icon('plus') : ''}</div>`;
      return `<td ${editable ? `class="editable" data-act="tt-cell" data-cid="${cid}" data-d="${d}" data-p="${p}"` : ''}>${inner}</td>`;
    }).join('')}</tr>`);
    if (p + 1 === +st.breakAfter && p + 1 < times.length) rows.push(`<tr class="tt-break"><td colspan="${days.length + 1}">☕ ${t('break')} — ${fmtNum(st.breakMinutes)} ${t('minutes')}</td></tr>`);
  });
  return `<div class="table-wrap"><table class="tt"><thead><tr><th>${t('period')}</th>${days.map(d => `<th>${dayName(d)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function renderTimetable(p) {
  const mode = p.teacher ? 'teacher' : (p.mode || 'class');
  const classes = sortedClasses(); const tch = teachers();
  let body, ctl, title;
  if (mode === 'teacher') {
    const tid = DB.get('employees', p.teacher) ? p.teacher : (USER.employeeId && DB.get('employees', USER.employeeId)?.role === 'teacher' ? USER.employeeId : tch[0]?.id);
    const load = Object.values(DB.d.tt).reduce((n, g) => n + Object.values(g).filter(v => v.teacherId === tid).length, 0);
    ctl = selectBox('teacher', tch.map(e => ({ v: e.id, l: `${loc(e)} — ${refLabel('subjects', e.subjectId)}` })), tid, t('teacher')) + `<span class="pill">${t('weeklyLoad')}: <b>${fmtNum(load)}</b> ${t('periods')}</span>`;
    body = tid ? ttGrid({ teacherId: tid }) : emptyState(t('noData')); title = refLabel('employees', tid);
  } else {
    const cid = DB.get('classes', p.class) ? p.class : classes[0]?.id;
    if (!cid) return pageHead(t('nav_timetable')) + emptyState(t('noClasses'));
    const g = DB.d.tt[cid] || {}; const filled = Object.values(g).filter(v => v.subjectId).length;
    ctl = selectBox('class', classOpts(), cid, t('f_classId')) + `<span class="pill">${t('filledPeriods')}: <b>${fmtNum(filled)}</b> / ${fmtNum(S().workDays.length * S().periods)}</span>`;
    body = ttGrid({ cid, editable: can(['admin']) }); title = refLabel('classes', cid);
  }
  return `${pageHead(t('nav_timetable'), t('sub_timetable'), `<button class="btn ghost" data-act="tt-print" data-title="${esc(title)}">${icon('printer')}<span>${t('print')}</span></button>`)}
    <div class="card"><div class="toolbar"><div class="tabs"><a class="tab ${mode === 'class' ? 'on' : ''}" href="#/timetable?mode=class">${t('byClass')}</a><a class="tab ${mode === 'teacher' ? 'on' : ''}" href="#/timetable?mode=teacher&teacher=${USER.employeeId && DB.get('employees', USER.employeeId)?.role === 'teacher' ? USER.employeeId : (tch[0]?.id || '')}">${t('byTeacher')}</a></div>${ctl}</div>
    <div id="tt-area">${body}</div>${mode === 'class' && can(['admin']) ? `<p class="hint">${t('ttHint')}</p>` : ''}</div>`;
}
function openSlot(cid, d, p) {
  const cls = DB.get('classes', cid); const cur = (DB.d.tt[cid] || {})[`${d}-${p}`] || {};
  const subs = subjectsForClass(cls);
  const busyIn = tid => Object.entries(DB.d.tt).find(([c, g]) => c !== cid && g[`${d}-${p}`]?.teacherId === tid)?.[0];
  const teacherOpts = sid => teachers().slice().sort((a, b) => (b.subjectId === sid) - (a.subjectId === sid)).map(e => { const b = busyIn(e.id);
    return `<option value="${e.id}" ${cur.teacherId === e.id ? 'selected' : ''} ${b ? 'disabled' : ''}>${esc(loc(e))} — ${esc(refLabel('subjects', e.subjectId))}${b ? ` (${t('busyIn')} ${esc(refLabel('classes', b))})` : ''}</option>`; }).join('');
  const root = modal({
    title: `${classLabel(cls)} — ${dayName(d)} — ${t('period')} ${fmtNum(p + 1)}`, size: 'sm',
    body: `<form id="sform" class="form-grid one"><label class="field"><span>${t('f_subjectId')}</span><select class="input" name="sid"><option value="">—</option>${subs.map(s => `<option value="${s.id}" ${cur.subjectId === s.id ? 'selected' : ''}>${esc(loc(s))}</option>`).join('')}</select></label>
      <label class="field"><span>${t('teacher')}</span><select class="input" name="tid"><option value="">—</option>${teacherOpts(cur.subjectId)}</select></label></form>`,
    footer: `<button class="btn ghost danger-t" data-clear>${icon('trash')}<span>${t('clear')}</span></button><span class="grow"></span><button class="btn primary" type="submit" form="sform">${icon('check')}<span>${t('save')}</span></button>`,
  });
  const f = $('#sform', root);
  f.sid.onchange = () => { const keep = f.tid.value; f.tid.innerHTML = `<option value="">—</option>${teacherOpts(f.sid.value)}`; const auto = teachers().find(e => e.subjectId === f.sid.value && !busyIn(e.id)); f.tid.value = keep && DB.get('employees', keep)?.subjectId === f.sid.value ? keep : (auto?.id || ''); };
  $('[data-clear]', root).onclick = () => { if (DB.d.tt[cid]) delete DB.d.tt[cid][`${d}-${p}`]; DB.save(); closeModal(); render(); };
  f.addEventListener('submit', e => {
    e.preventDefault();
    DB.d.tt[cid] = DB.d.tt[cid] || {};
    if (!f.sid.value) delete DB.d.tt[cid][`${d}-${p}`]; else DB.d.tt[cid][`${d}-${p}`] = { subjectId: f.sid.value, teacherId: f.tid.value };
    DB.save(); closeModal(); toast(t('saved')); render();
  });
}

/* ================= Calendar ================= */
function renderCalendar(p) {
  const m = /^\d{4}-\d{2}$/.test(p.m || '') ? p.m : today().slice(0, 7);
  const [y, mo] = m.split('-').map(Number); const first = new Date(y, mo - 1, 1);
  const start = new Date(y, mo - 1, 1 - first.getDay()); const T = today();
  const prev = iso(new Date(y, mo - 2, 1)).slice(0, 7), next = iso(new Date(y, mo, 1)).slice(0, 7);
  const exams = DB.all('exams').map(e => ({ id: e.id, title: e.title, titleEn: e.titleEn, date: e.date, type: 'exam', isExam: 1 }));
  const all = [...DB.all('events'), ...exams];
  const cells = range(0, 41).map(i => {
    const d = new Date(start); d.setDate(start.getDate() + i); const ds = iso(d);
    const evs = all.filter(e => e.date && e.date <= ds && (e.endDate || e.date) >= ds);
    const off = d.getMonth() !== mo - 1, work = S().workDays.includes(d.getDay());
    return `<div class="cal-cell ${off ? 'off' : ''} ${ds === T ? 'today' : ''} ${work ? '' : 'weekend'}" ${can(['admin']) ? `data-act="cal-day" data-date="${ds}"` : ''}>
      <span class="cal-n">${fmtNum(d.getDate())}</span>${evs.slice(0, 3).map(e => `<span class="chip t-${e.type}" ${!e.isExam && can(['admin']) ? `data-act="cal-ev" data-id="${e.id}"` : ''} title="${esc(loc(e, 'title'))}">${esc(loc(e, 'title'))}</span>`).join('')}
      ${evs.length > 3 ? `<span class="more">+${fmtNum(evs.length - 3)}</span>` : ''}</div>`;
  }).join('');
  const monthEvents = all.filter(e => e.date && e.date.slice(0, 7) <= m && (e.endDate || e.date).slice(0, 7) >= m).sort((a, b) => a.date.localeCompare(b.date));
  return `${pageHead(t('nav_calendar'), t('sub_calendar'), can(['admin']) ? `<button class="btn primary" data-act="quick-add" data-key="events">${icon('plus')}<span>${t('addEvent')}</span></button>` : '')}
    <div class="grid-cal"><div class="card"><div class="cal-head"><a class="icon-btn" href="#/calendar?m=${prev}">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}</a>
      <h3>${first.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</h3><a class="icon-btn" href="#/calendar?m=${next}">${icon(LANG === 'ar' ? 'chevL' : 'chevR')}</a>
      <a class="btn ghost sm" href="#/calendar?m=${T.slice(0, 7)}">${t('today')}</a></div>
      <div class="cal">${range(0, 6).map(i => `<div class="cal-dow">${dayName(i, true)}</div>`).join('')}${cells}</div>
      <div class="legend row">${['holiday', 'exam', 'activity', 'meeting', 'trip'].map(x => `<div><i class="t-${x}"></i><span>${t('opt_' + x)}</span></div>`).join('')}</div></div>
    ${card(t('monthEvents'), `<ul class="evs">${monthEvents.map(eventItem).join('') || emptyState(t('noData'))}</ul>`)}</div>`;
}

/* ================= Student profile & portal ================= */
function studentSections(s, { portal } = {}) {
  const cls = DB.get('classes', s.classId); const att = studentAttendance(s.id, s.classId, addDays(today(), -30));
  const r1 = termResult(s, 1), r2 = termResult(s, 2);
  const invs = DB.all('invoices').filter(i => i.studentId === s.id); const bal = sum(invs, invBalance);
  const beh = DB.all('behavior').filter(b => b.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
  const hw = DB.all('homework').filter(h => h.classId === s.classId).sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 8);
  const loans = DB.all('loans').filter(l => l.studentId === s.id);
  const ab = absenceInfo(s.id, s.classId);
  const age = s.dob ? Math.floor((Date.now() - parseISO(s.dob)) / 31557600000) : null;
  const info = [['f_code', s.code], ['f_dob', s.dob ? `${fmtDate(s.dob)} (${fmtNum(age)} ${t('years')})` : '—'], ['f_gender', t('opt_' + s.gender)], ['f_nationalId', s.nationalId], ['f_motherName', s.motherName], ['f_birthPlace', s.birthPlace],
    ['f_nationality', s.nationality ? t('opt_' + s.nationality) : '—'], ['f_familyRegNo', s.familyRegNo], ['f_seatNumber', s.seatNumber],
    ['f_guardianName', LANG === 'en' && s.guardianNameEn ? s.guardianNameEn : s.guardianName], ['f_guardianRelation', s.guardianRelation ? t('opt_' + s.guardianRelation) : '—'], ['f_guardianPhone', s.guardianPhone], ['f_guardianEmail', s.guardianEmail],
    ['f_address', s.address], ['f_busId', s.busId ? refLabel('buses', s.busId) : '—'], ['f_enrollDate', s.enrollDate ? fmtDate(s.enrollDate) : '—'], ['f_medical', s.medical]];
  const resTable = r => r.subjects.length ? `<table class="table compact"><thead><tr><th>${t('f_subjectId')}</th>${r.exams.map(e => `<th>${esc(loc(e, 'title'))}</th>`).join('')}<th>%</th><th>${t('gradeLbl')}</th></tr></thead><tbody>
    ${r.subjects.map(x => { const g = gradeLetter(x.p); return `<tr><td><span class="dot" style="background:${subjectColor(x.sub.id)}"></span> ${esc(loc(x.sub))}</td>${x.cells.map(c => `<td>${c ?? '—'}</td>`).join('')}<td>${x.p == null ? '—' : fmtNum(x.p, 1)}</td><td>${x.p == null ? '—' : badge('g' + g.letter, g.letter)}</td></tr>`; }).join('')}</tbody></table>` : emptyState(t('noData'));
  const k = [
    { ic: 'check', label: t('attendanceRate'), val: att.rate == null ? '—' : fmtNum(att.rate, 1) + '%', sub: `${t('absenceYear')}: ${fmtNum(ab.absRate, 1)}%${ab.level ? ' · ' + t('abs_' + ab.level) : ''}`, c: ab.level === 'limit' ? 'c5' : ab.level ? 'c4' : 'c3' },
    { ic: 'award', label: `${t('average')} — ${termName(1)}`, val: r1.avg == null ? '—' : fmtNum(r1.avg, 1) + '%', sub: r1.avg == null ? '' : t('gr_' + gradeLetter(r1.avg).key), c: 'c1' },
    { ic: 'wallet', label: t('balanceDue'), val: moneyText(bal), sub: `${fmtNum(invs.length)} ${t('invoicesLbl')}`, c: bal > 0 ? 'c5' : 'c2' },
    { ic: 'star', label: t('nav_behavior'), val: `+${fmtNum(beh.filter(b => b.kind === 'positive').length)} / -${fmtNum(beh.filter(b => b.kind === 'negative').length)}`, sub: t('posNeg'), c: 'c4' },
  ];
  return `<div class="kpis">${k.map(kpi).join('')}</div>
    ${portal ? `<div class="grid-2">${card(t('classTimetable'), ttGrid({ cid: s.classId }), '', 'span-2')}</div>` : ''}
    <div class="grid-2">
      ${card(t('personalInfo'), `<div class="info-grid">${info.map(([l, v]) => `<div><span>${t(l)}</span><b>${esc(v || '—')}</b></div>`).join('')}</div>`)}
      ${card(t('homework'), hw.length ? `<ul class="list">${hw.map(h => `<li><span class="dot" style="background:${subjectColor(h.subjectId)}"></span><div><b>${esc(loc(h, 'title'))}</b><small>${esc(refLabel('subjects', h.subjectId))} · ${t('f_dueDate')}: ${fmtDate(h.dueDate)}</small></div>${h.dueDate >= today() ? badge('open') : badge('closed')}</li>`).join('')}</ul>` : emptyState(t('noData')))}
    </div>
    ${card(`${t('academic')} — ${termName(1)}`, resTable(r1), `<button class="btn ghost sm" data-act="rc-print" data-sid="${s.id}" data-term="1">${icon('printer')}<span>${t('reportCard')}</span></button>`)}
    ${ab.level ? `<div class="alert ${ab.level}">${icon('alert')}<div><b>${t('abs_' + ab.level)}</b><span>${t('absAlertText').replace('{n}', fmtNum(ab.absRate, 1)).replace('{w}', S().absenceWarn).replace('{l}', S().absenceLimit)}</span></div></div>` : ''}
    ${r2.avg != null ? card(`${t('academic')} — ${termName(2)}`, resTable(r2), `<button class="btn ghost sm" data-act="rc-print" data-sid="${s.id}" data-term="2">${icon('printer')}<span>${t('reportCard')}</span></button>`) : ''}
    <div class="grid-2">
      ${card(t('attendanceLast30'), `<div class="summary">${['P', 'A', 'L', 'E'].map(x => `<div class="sum-item s-${x}"><span>${t('att_' + x)}</span><b>${fmtNum(att[x])}</b></div>`).join('')}</div>
        <ul class="list">${att.days.filter(d => d.st !== 'P').slice(0, 8).map(d => `<li>${badge('s' + d.st, t('att_' + d.st))}<div><b>${fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</b></div></li>`).join('') || `<li class="muted">${t('perfectAttendance')} 🎉</li>`}</ul>`)}
      ${card(t('fees'), invs.length ? `<table class="table compact"><thead><tr><th>${t('f_feeTypeId')}</th><th>${t('f_net')}</th><th>${t('f_balance')}</th><th>${t('f_status')}</th></tr></thead><tbody>
        ${invs.map(i => `<tr><td>${esc(refLabel('feeTypes', i.feeTypeId))}<small class="muted d-block">${esc(i.number)} · ${fmtDate(i.dueDate)}</small></td><td>${fmtMoney(invNet(i))}</td><td>${fmtMoney(invBalance(i))}</td><td>${badge(invStatus(i))}</td></tr>`).join('')}</tbody></table>` : emptyState(t('noData')))}
    </div>
    <div class="grid-2">
      ${card(t('nav_behavior'), beh.length ? `<ul class="list">${beh.slice(0, 8).map(b => `<li>${badge(b.kind)}<div><b>${t('opt_' + b.category)}</b><small>${fmtDate(b.date)} · ${esc(b.description || '')}</small></div></li>`).join('')}</ul>` : emptyState(t('noData')))}
      ${card(t('nav_loans'), loans.length ? `<ul class="list">${loans.map(l => `<li>${badge(loanStatus(l))}<div><b>${esc(refLabel('books', l.bookId))}</b><small>${fmtDate(l.loanDate)} → ${fmtDate(l.dueDate)}</small></div></li>`).join('')}</ul>` : emptyState(t('noData')))}
    </div>`;
}
function studentHeader(s, actions = '') {
  const cls = DB.get('classes', s.classId);
  return `<div class="profile">${avatar(s, 'xl')}<div class="pf-main"><h1>${esc(loc(s))}</h1><p>${esc(s.code)} · ${esc(classLabel(cls))} · ${t('opt_' + stageOf(cls?.grade))}</p><div>${badge(s.status)} ${s.busId ? badge('info', '🚌 ' + refLabel('buses', s.busId).split(' — ')[0]) : ''}</div></div><div class="head-actions">${actions}</div></div>`;
}
function renderStudent(p) {
  const s = DB.get('students', p.id); if (!s) return emptyState(t('notFound'));
  return studentHeader(s, `<a class="btn ghost" href="#/students">${icon(LANG === 'ar' ? 'chevR' : 'chevL')}<span>${t('back')}</span></a>
    ${can(['admin', 'teacher']) ? `<button class="btn wa" data-act="wa-student" data-id="${s.id}">${icon('whatsapp')}<span>${t('waGuardian')}</span></button>` : ''}
    ${can(ENT.students.edit) ? `<button class="btn primary" data-act="crud-edit" data-key="students" data-id="${s.id}">${icon('edit')}<span>${t('edit')}</span></button>` : ''}`) + studentSections(s);
}
function renderPortal(p) {
  const kids = (USER.studentIds || []).map(id => DB.get('students', id)).filter(Boolean);
  if (!kids.length) return pageHead(t('nav_portal')) + emptyState(t('noChildren'));
  const s = kids.find(k => k.id === p.child) || kids[0];
  const anns = visibleAnnouncements().slice(0, 4);
  return `<div class="hero slim"><div><h1>${t('welcome')}${t('comma')} ${esc(loc(USER))}</h1><p>${t('portalIntro')}</p></div>
      <div class="kids">${kids.map(k => `<a class="kid ${k.id === s.id ? 'on' : ''}" href="#/portal?child=${k.id}">${avatar(k)}<span>${esc(loc(k).split(' ')[0])}</span><small>${esc(refLabel('classes', k.classId))}</small></a>`).join('')}</div></div>
    ${studentHeader(s)}${studentSections(s, { portal: true })}
    <div class="grid-2">${card(t('latestAnnouncements'), anns.map(annCard).join('') || emptyState(t('noData')))}${card(t('upcomingEvents'), `<ul class="evs">${upcomingEvents().map(eventItem).join('') || emptyState(t('noData'))}</ul>`)}</div>`;
}

/* ================= Reports ================= */
function renderReports() {
  const students = DB.all('students').filter(s => s.status === 'active');
  const byGrade = range(1, 12).map(g => ({ label: String(g), value: students.filter(s => DB.get('classes', s.classId)?.grade === g).length }));
  const gender = [{ label: t('opt_male'), value: students.filter(s => s.gender === 'male').length, color: '#6366f1' }, { label: t('opt_female'), value: students.filter(s => s.gender === 'female').length, color: '#ec4899' }];
  const from = addDays(today(), -30);
  const attByStage = STAGES.map((st, i) => {
    let p = 0, n = 0; Object.entries(DB.d.att).forEach(([k, v]) => { const [d, c] = k.split('|'); if (d < from || stageOf(DB.get('classes', c)?.grade) !== st) return; Object.values(v).forEach(x => { n++; if (x === 'P' || x === 'L') p++; }); });
    return { label: t('opt_' + st), value: n ? pct(p, n) : null, color: ['#6366f1', '#06b6d4', '#f59e0b'][i] };
  });
  const invs = DB.all('invoices');
  const finRows = DB.all('feeTypes').map(f => { const ii = invs.filter(i => i.feeTypeId === f.id); return { f, n: ii.length, billed: sum(ii, invNet), paid: sum(ii, invPaid) }; });
  const billed = sum(finRows, r => r.billed), paid = sum(finRows, r => r.paid);
  const methods = ['cash', 'card', 'transfer', 'cheque'].map((m, i) => ({ label: t('opt_' + m), value: sum(DB.all('payments').filter(p => p.method === m), p => p.amount), color: ['#10b981', '#6366f1', '#06b6d4', '#f59e0b'][i] })).filter(x => x.value);
  const results = students.map(s => termResult(s, 1));
  const dist = ['A', 'B', 'C', 'D', 'F'].map(l => ({ label: `${l} · ${t('gr_' + gradeLetter({ A: 95, B: 85, C: 70, D: 55, F: 10 }[l]).key)}`, value: results.filter(r => r.avg != null && gradeLetter(r.avg).letter === l).length, color: { A: '#10b981', B: '#06b6d4', C: '#6366f1', D: '#f59e0b', F: '#ef4444' }[l] }));
  const subjAvg = DB.all('subjects').map(sub => { const v = []; results.forEach(r => { const x = r.subjects.find(y => y.sub.id === sub.id); if (x && x.p != null) v.push(x.p); }); return { label: loc(sub), value: v.length ? sum(v) / v.length : null, color: subjectColor(sub.id) }; }).filter(x => x.value != null).sort((a, b) => b.value - a.value);
  const lowAtt = students.map(s => ({ s, a: studentAttendance(s.id, s.classId, from) })).filter(x => x.a.rate != null && x.a.rate < 85).sort((a, b) => a.a.rate - b.a.rate).slice(0, 8);
  const absWarn = students.map(s => ({ s, a: absenceInfo(s.id, s.classId) })).filter(x => x.a.level).sort((a, b) => b.a.absRate - a.a.absRate);
  const resCount = ['pass', 'resit', 'fail'].map((k, i) => ({ label: t('res_' + k), value: results.filter(r => r.status === k).length, color: ['#10b981', '#f59e0b', '#ef4444'][i] }));
  const debtors = students.map(s => ({ s, b: sum(invs.filter(i => i.studentId === s.id && invStatus(i) === 'overdue'), invBalance) })).filter(x => x.b > 0).sort((a, b) => b.b - a.b).slice(0, 8);
  return `${pageHead(t('nav_reports'), t('sub_reports'), `<button class="btn ghost" data-act="rep-export" data-what="students">${icon('download')}<span>${t('nav_students')}</span></button>
      <button class="btn ghost" data-act="rep-export" data-what="finance">${icon('download')}<span>${t('finance')}</span></button>
      <button class="btn ghost" data-act="rep-export" data-what="attendance">${icon('download')}<span>${t('nav_attendance')}</span></button>`)}
    <div class="grid-3">${card(t('studentsByGrade'), barChart(byGrade), '', 'span-2')}${card(t('studentsByGender'), donut(gender, { center: fmtNum(students.length), sub: t('student') }))}</div>
    <div class="grid-3">${card(t('attendanceByStage'), hbars(attByStage, { suffix: '%', max: 100 }))}${card(t('gradeDistribution'), hbars(dist))}${card(t('paymentMethods'), donut(methods, { center: fmtNum(pct(paid, billed), 0) + '%', sub: t('collected') }))}</div>
    <div class="grid-3">${card(t('subjectAverages'), hbars(subjAvg, { suffix: '%', max: 100 }), '', 'span-2')}${card(`${t('result')} — ${termName(1)}`, donut(resCount, { center: fmtNum(pct(resCount[0].value, sum(resCount, x => x.value)), 0) + '%', sub: t('res_pass') }))}</div>
    ${card(`${t('absenceWarnings')} (${fmtNum(absWarn.length)})`, absWarn.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>${t('f_name')}</th><th>${t('f_classId')}</th><th>${t('att_A')}</th><th>${t('absenceYear')}</th><th>${t('f_status')}</th><th>${t('f_guardianPhone')}</th></tr></thead><tbody>
      ${absWarn.map(x => `<tr><td><a class="who" href="#/student/${x.s.id}">${avatar(x.s)}<span>${esc(loc(x.s))}</span></a></td><td>${esc(refLabel('classes', x.s.classId))}</td><td>${fmtNum(x.a.A)} / ${fmtNum(x.a.total)}</td><td>${fmtNum(x.a.absRate, 1)}%</td><td>${absenceBadge(x.a.level)}</td><td dir="ltr">${esc(x.s.guardianPhone)}</td></tr>`).join('')}</tbody></table></div>` : emptyState(t('noData')), `<button class="btn ghost sm" data-act="rep-export" data-what="absence">${icon('download')}<span>${t('export')}</span></button>`)}
    ${card(t('financeByType'), `<div class="table-wrap"><table class="table"><thead><tr><th>${t('f_feeTypeId')}</th><th>${t('invoicesLbl')}</th><th>${t('totalBilled')}</th><th>${t('f_paid')}</th><th>${t('outstanding')}</th><th>${t('collectionRate')}</th></tr></thead><tbody>
      ${finRows.map(r => `<tr><td>${esc(loc(r.f))}</td><td>${fmtNum(r.n)}</td><td>${fmtMoney(r.billed)}</td><td>${fmtMoney(r.paid)}</td><td>${fmtMoney(r.billed - r.paid)}</td><td><div class="cap"><span>${fmtNum(pct(r.paid, r.billed), 1)}%</span>${progress(pct(r.paid, r.billed), 'var(--ok)')}</div></td></tr>`).join('')}
      <tr class="total-row"><td>${t('total')}</td><td>${fmtNum(invs.length)}</td><td>${fmtMoney(billed)}</td><td>${fmtMoney(paid)}</td><td>${fmtMoney(billed - paid)}</td><td>${fmtNum(pct(paid, billed), 1)}%</td></tr></tbody></table></div>`)}
    <div class="grid-2">${card(t('lowAttendance'), lowAtt.length ? `<ul class="list">${lowAtt.map(x => `<li>${avatar(x.s)}<div><a class="link" href="#/student/${x.s.id}">${esc(loc(x.s))}</a><small>${esc(refLabel('classes', x.s.classId))}</small></div>${badge('overdue', fmtNum(x.a.rate, 1) + '%')}</li>`).join('')}</ul>` : emptyState(t('noData')))}
      ${card(t('topDebtors'), debtors.length ? `<ul class="list">${debtors.map(x => `<li>${avatar(x.s)}<div><a class="link" href="#/student/${x.s.id}">${esc(loc(x.s))}</a><small>${esc(refLabel('classes', x.s.classId))} · ${esc(x.s.guardianPhone)}</small></div><b>${fmtMoney(x.b)}</b></li>`).join('')}</ul>` : emptyState(t('noData')))}</div>`;
}
function reportExport(what) {
  if (what === 'students') exportCrud('students');
  else if (what === 'finance') exportCrud('invoices');
  else if (what === 'absence') {
    const rows = DB.all('students').filter(s => s.status === 'active').map(s => ({ s, a: absenceInfo(s.id, s.classId) })).filter(x => x.a.level)
      .map(x => [x.s.code, loc(x.s), refLabel('classes', x.s.classId), x.a.A, x.a.total, x.a.absRate, t('abs_' + x.a.level), x.s.guardianName, x.s.guardianPhone]);
    exportCSV('absence-warnings', [t('f_code'), t('f_name'), t('f_classId'), t('att_A'), t('total'), t('absenceYear'), t('f_status'), t('f_guardianName'), t('f_guardianPhone')], rows);
  } else {
    const from = addDays(today(), -30);
    const rows = DB.all('students').filter(s => s.status === 'active').map(s => { const a = studentAttendance(s.id, s.classId, from); return [s.code, loc(s), refLabel('classes', s.classId), a.P, a.A, a.L, a.E, a.rate ?? '']; });
    exportCSV('attendance-30d', [t('f_code'), t('f_name'), t('f_classId'), t('att_P'), t('att_A'), t('att_L'), t('att_E'), t('attendanceRate')], rows);
  }
}

/* ================= Settings ================= */
function renderSettings() {
  const st = S();
  const f = (k, type = 'text', extra = '') => `<label class="field"><span>${t('f_' + k)}</span><input class="input" type="${type}" name="${k}" value="${esc(st[k])}" ${extra}></label>`;
  return `${pageHead(t('nav_settings'), t('sub_settings'))}
    <form id="settings-form">
    ${card(t('schoolInfo'), `<div class="form-grid">${f('schoolName')}${f('schoolNameEn', 'text', 'dir="ltr"')}${f('principal')}${f('principalEn', 'text', 'dir="ltr"')}${f('address')}${f('addressEn', 'text', 'dir="ltr"')}${f('phone', 'tel')}${f('email', 'email', 'dir="ltr"')}</div>`)}
    ${card(t('authoritySettings'), `<div class="form-grid">
      <label class="field"><span>${t('f_country')}</span><select class="input" name="country"><option value="LY" ${st.country === 'LY' ? 'selected' : ''}>${t('opt_LY')}</option><option value="other" ${st.country !== 'LY' ? 'selected' : ''}>${t('opt_otherCountry')}</option></select></label>
      <label class="field"><span>${t('f_schoolType')}</span><select class="input" name="schoolType">${['public', 'private', 'religious'].map(v => `<option value="${v}" ${st.schoolType === v ? 'selected' : ''}>${t('opt_' + v)}</option>`).join('')}</select></label>
      ${f('ministry')}${f('ministryEn', 'text', 'dir="ltr"')}${f('supervision')}${f('supervisionEn', 'text', 'dir="ltr"')}
      <label class="field"><span>${t('f_municipality')}</span><input class="input" name="municipality" value="${esc(st.municipality)}" list="dl-mun"><datalist id="dl-mun">${LY_MUNICIPALITIES.map(m => `<option value="${m}">`).join('')}</datalist></label>
      ${f('schoolCode', 'text', 'dir="ltr"')}</div>`)}
    ${card(t('gradingSettings'), `<div class="form-grid">${f('passMark', 'number', 'min="0" max="100"')}${f('maxResit', 'number', 'min="0" max="12"')}
      ${f('bandExcellent', 'number', 'min="0" max="100"')}${f('bandVgood', 'number', 'min="0" max="100"')}${f('bandGood', 'number', 'min="0" max="100"')}<span></span>
      ${f('absenceWarn', 'number', 'min="0" max="100"')}${f('absenceLimit', 'number', 'min="0" max="100"')}
      <label class="field row full"><input type="checkbox" name="validateNid" ${st.validateNid ? 'checked' : ''}><span>${t('f_validateNid')}</span></label></div>
      <p class="hint">${t('gradingHint')}</p>`)}
    ${card(t('academicSettings'), `<div class="form-grid">${f('year')}${f('currency')}${f('periods', 'number', 'min="1" max="12"')}
      ${f('startTime', 'time')}${f('periodMinutes', 'number', 'min="20" max="120"')}${f('breakAfter', 'number', 'min="0" max="12"')}${f('breakMinutes', 'number', 'min="0" max="90"')}
      <div class="field full"><span>${t('f_workDays')}</span><div class="days">${range(0, 6).map(d => `<label class="day"><input type="checkbox" name="wd" value="${d}" ${st.workDays.includes(d) ? 'checked' : ''}><span>${dayName(d)}</span></label>`).join('')}</div></div></div>
      <div class="form-actions"><button class="btn primary" type="button" data-act="settings-save">${icon('check')}<span>${t('save')}</span></button></div>`)}
    </form>
    ${waSettingsCard()}
    ${card(t('dataManagement'), `<p class="hint">${t('dataHint')}</p><div class="btn-row">
      <button class="btn ghost" data-act="backup">${icon('download')}<span>${t('backup')}</span></button>
      <label class="btn ghost">${icon('upload')}<span>${t('restore')}</span><input type="file" accept="application/json,.json" hidden data-chg="restore"></label>
      <button class="btn ghost" data-act="reset-demo">${icon('refresh')}<span>${t('resetDemo')}</span></button>
      <button class="btn danger" data-act="wipe">${icon('trash')}<span>${t('wipeData')}</span></button></div>`)}`;
}

/* ================= Public certificate candidates (Libya: grade 9 & grade 12) ================= */
const CERT_REQUIRED = ['nationalId', 'motherName', 'dob', 'birthPlace'];
function certCandidates(g) {
  return DB.all('students').filter(s => s.status === 'active' && +DB.get('classes', s.classId)?.grade === +g)
    .sort((a, b) => classLabel(DB.get('classes', a.classId)).localeCompare(classLabel(DB.get('classes', b.classId))) || loc(a).localeCompare(loc(b), LANG));
}
function certMissing(s) {
  const miss = CERT_REQUIRED.filter(k => !s[k]).map(k => t('f_' + k));
  if (s.nationalId && s.nationality === 'libyan') { const e = libyanNidError(s.nationalId, s.gender, s.dob); if (e) miss.push(e); }
  return miss;
}
function renderCertificates(p) {
  const g = p.grade === '9' ? 9 : 12; const list = certCandidates(g);
  const ready = list.filter(s => !certMissing(s).length).length, seats = list.filter(s => s.seatNumber).length;
  return `${pageHead(t('nav_certificates'), t('sub_certificates'), `<button class="btn ghost" data-act="cert-export" data-g="${g}">${icon('download')}<span>${t('export')}</span></button>
      <button class="btn ghost" data-act="cert-print" data-g="${g}">${icon('printer')}<span>${t('print')}</span></button>
      <button class="btn primary" data-act="cert-seats" data-g="${g}">${icon('sparkle')}<span>${t('assignSeats')}</span></button>`)}
    <div class="card"><div class="toolbar"><div class="tabs"><a class="tab ${g === 9 ? 'on' : ''}" href="#/certificates?grade=9">${t('cert9')}</a><a class="tab ${g === 12 ? 'on' : ''}" href="#/certificates?grade=12">${t('cert12')}</a></div></div>
    <div class="summary"><div class="sum-item"><span>${t('candidates')}</span><b>${fmtNum(list.length)}</b></div><div class="sum-item s-P"><span>${t('dataComplete')}</span><b>${fmtNum(ready)}</b></div>
      <div class="sum-item s-A"><span>${t('dataIncomplete')}</span><b>${fmtNum(list.length - ready)}</b></div><div class="sum-item"><span>${t('f_seatNumber')}</span><b>${fmtNum(seats)} / ${fmtNum(list.length)}</b></div></div>
    ${list.length ? `<div class="table-wrap"><table class="table crud"><thead><tr><th>${t('f_seatNumber')}</th><th>${t('f_name')}</th><th>${t('f_motherName')}</th><th>${t('f_nationalId')}</th><th>${t('f_dob')}</th><th>${t('f_birthPlace')}</th><th>${t('f_classId')}</th><th>${t('dataCheck')}</th><th></th></tr></thead><tbody>
      ${list.map(s => { const m = certMissing(s); return `<tr><td data-label="${t('f_seatNumber')}" dir="ltr">${esc(s.seatNumber || '—')}</td><td data-label="${t('f_name')}"><a class="who" href="#/student/${s.id}">${avatar(s)}<span>${esc(loc(s))}</span></a></td>
        <td data-label="${t('f_motherName')}">${esc(s.motherName || '—')}</td><td data-label="${t('f_nationalId')}" dir="ltr">${esc(s.nationalId || '—')}</td><td data-label="${t('f_dob')}">${fmtDate(s.dob)}</td><td data-label="${t('f_birthPlace')}">${esc(s.birthPlace || '—')}</td>
        <td data-label="${t('f_classId')}">${esc(refLabel('classes', s.classId))}</td><td data-label="${t('dataCheck')}">${m.length ? `<span title="${esc(m.join('، '))}">${badge('overdue', `${t('missing')}: ${m.length}`)}</span>` : badge('active', '✓')}</td>
        <td class="row-actions"><button class="icon-btn" data-act="crud-edit" data-key="students" data-id="${s.id}" title="${t('edit')}">${icon('edit')}</button></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint">${t('certHint')}</p>` : emptyState(t('noStudents'))}</div>`;
}
function certRows(g) {
  return certCandidates(g).map(s => [s.seatNumber || '', loc(s), s.motherName || '', s.nationalId || '', s.dob || '', s.birthPlace || '', t('opt_' + (s.gender || 'male')),
    t('opt_' + (s.nationality || 'libyan')), refLabel('classes', s.classId), loc(S(), 'schoolName'), S().schoolCode || '', S().municipality || '']);
}
const certHeaders = () => [t('f_seatNumber'), t('f_name'), t('f_motherName'), t('f_nationalId'), t('f_dob'), t('f_birthPlace'), t('f_gender'), t('f_nationality'), t('f_classId'), t('f_schoolName'), t('f_schoolCode'), t('f_municipality')];
function assignSeats(g) {
  const list = certCandidates(g); const yr = String(S().year || '').match(/\d{4}/)?.[0] || today().slice(0, 4);
  const used = new Set(DB.all('students').map(s => s.seatNumber).filter(Boolean)); let n = 0, seq = 1;
  list.filter(s => !s.seatNumber).forEach(s => {
    let code; do { code = `${yr.slice(2)}${String(g).padStart(2, '0')}${(S().schoolCode || '00').replace(/\D/g, '').slice(-3).padStart(3, '0')}${String(seq++).padStart(4, '0')}`; } while (used.has(code));
    s.seatNumber = code; used.add(code); n++;
  });
  DB.save(); toast(`${t('seatsAssigned')}: ${fmtNum(n)}`); render();
}
