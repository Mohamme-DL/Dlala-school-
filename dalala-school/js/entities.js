/* Dalala School System — entity schemas + generic CRUD engine */
'use strict';

const STAGES = ['primary', 'middle', 'secondary'];
const gradeOpts = () => range(1, 12);
const stageFilter = getGrade => ({ k: 'stage', opts: STAGES, test: (r, v) => stageOf(getGrade(r)) === v });
const studentGrade = r => DB.get('classes', DB.get('students', r.studentId || r.id)?.classId)?.grade;

const ENT = {
  students: {
    icon: 'users', edit: ['admin'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'STD', unique: 1 },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<a class="who" href="#/student/${r.id}">${avatar(r)}<span>${esc(loc(r))}</span></a>` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'motherName', type: 'text' },
      { k: 'gender', type: 'select', opts: ['male', 'female'], req: 1, list: 1 },
      { k: 'dob', type: 'date' },
      { k: 'birthPlace', type: 'text', datalist: () => LY_MUNICIPALITIES },
      { k: 'nationality', type: 'select', opts: ['libyan', 'nonLibyan'], def: 'libyan' },
      { k: 'nationalId', type: 'text', dir: 'ltr' },
      { k: 'familyRegNo', type: 'text', dir: 'ltr' },
      { k: 'classId', type: 'ref', ref: 'classes', req: 1, list: 1 },
      { k: 'seatNumber', type: 'text', dir: 'ltr' },
      { k: 'guardianName', type: 'text', req: 1 },
      { k: 'guardianNameEn', type: 'text', dir: 'ltr' },
      { k: 'guardianRelation', type: 'select', opts: ['father', 'mother', 'brother', 'other'], def: 'father' },
      { k: 'guardianPhone', type: 'tel', req: 1, list: 1 },
      { k: 'guardianEmail', type: 'email' },
      { k: 'address', type: 'text', datalist: () => LY_MUNICIPALITIES },
      { k: 'busId', type: 'ref', ref: 'buses' },
      { k: 'enrollDate', type: 'date', def: () => today() },
      { k: 'status', type: 'select', opts: ['active', 'transferred', 'graduated', 'withdrawn'], def: 'active', list: 1, badge: 1 },
      { k: 'medical', type: 'textarea', full: 1 },
    ],
    filters: [stageFilter(r => DB.get('classes', r.classId)?.grade), { k: 'classId' }, { k: 'gender' }, { k: 'status' }],
    actions: [{ icon: 'eye', label: 'view', href: r => '#/student/' + r.id }],
    validate: r => {
      if (S().country !== 'LY') return null;
      if (S().validateNid && r.nationality === 'libyan' && r.nationalId) { const e = libyanNidError(r.nationalId, r.gender, r.dob); if (e) return e; }
      if (r.guardianPhone && !isLyPhone(r.guardianPhone)) return t('errPhone');
      return null;
    },
  },

  admissions: {
    icon: 'userPlus', edit: ['admin'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'ADM', unique: 1 },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r) },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'gender', type: 'select', opts: ['male', 'female'], req: 1 },
      { k: 'dob', type: 'date' },
      { k: 'grade', type: 'select', opts: gradeOpts, optLabel: gradeName, num: 1, req: 1, list: 1 },
      { k: 'guardianName', type: 'text', req: 1 },
      { k: 'guardianPhone', type: 'tel', req: 1, list: 1 },
      { k: 'prevSchool', type: 'text' },
      { k: 'applyDate', type: 'date', def: () => today(), list: 1 },
      { k: 'status', type: 'select', opts: ['new', 'review', 'interview', 'accepted', 'rejected', 'enrolled'], def: 'new', list: 1, badge: 1 },
      { k: 'notes', type: 'textarea', full: 1 },
    ],
    filters: [{ k: 'status' }, { k: 'grade' }],
    actions: [{ icon: 'userPlus', label: 'enroll', show: r => r.status === 'accepted', fn: r => enrollApplicant(r) }],
    summary: rows => ['new', 'review', 'interview', 'accepted', 'enrolled', 'rejected'].map(s => ({ label: t('opt_' + s), value: rows.filter(r => r.status === s).length, cls: 'b-' + s })),
  },

  classes: {
    icon: 'layers', edit: ['admin'], order: (a, b) => a.grade - b.grade || String(a.section).localeCompare(b.section),
    fields: [
      { k: 'grade', type: 'select', opts: gradeOpts, optLabel: gradeName, num: 1, req: 1, list: 1 },
      { k: 'section', type: 'text', req: 1, list: 1 },
      { k: 'track', type: 'select', opts: ['general', 'scientific', 'literary', 'religious'], def: 'general', list: 1 },
      { k: 'stage', type: 'calc', list: 1, get: r => t('opt_' + stageOf(r.grade)) },
      { k: 'teacherId', type: 'ref', ref: 'employees', refFilter: e => e.role === 'teacher', list: 1 },
      { k: 'room', type: 'text', list: 1 },
      { k: 'capacity', type: 'number', def: 30, list: 1 },
      { k: 'count', type: 'calc', list: 1, get: r => studentsOfClass(r.id).length, fmt: r => { const n = studentsOfClass(r.id).length; return `<div class="cap"><span>${n} / ${r.capacity || '∞'}</span>${progress(r.capacity ? n / r.capacity * 100 : 0)}</div>`; } },
    ],
    filters: [stageFilter(r => r.grade), { k: 'track' }],
    validate: r => (+r.grade < 10 && r.track && r.track !== 'general' ? t('errTrack') : null),
    actions: [{ icon: 'grid', label: 'timetable', href: r => '#/timetable?class=' + r.id }, { icon: 'check', label: 'attendance', href: r => '#/attendance?class=' + r.id }],
  },

  subjects: {
    icon: 'book', edit: ['admin'],
    fields: [
      { k: 'code', type: 'text', req: 1, list: 1, unique: 1 },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<span class="dot" style="background:${subjectColor(r.id)}"></span> ${esc(loc(r))}` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'fromGrade', type: 'select', opts: gradeOpts, optLabel: gradeName, num: 1, req: 1, list: 1, def: 1 },
      { k: 'toGrade', type: 'select', opts: gradeOpts, optLabel: gradeName, num: 1, req: 1, list: 1, def: 12 },
      { k: 'track', type: 'select', opts: ['all', 'scientific', 'literary', 'religious'], def: 'all', list: 1 },
      { k: 'weeklyHours', type: 'number', def: 2, list: 1 },
      { k: 'teachersCount', type: 'calc', list: 1, get: r => teachers().filter(e => e.subjectId === r.id).length },
    ],
    validate: r => (+r.fromGrade > +r.toGrade ? t('errGradeRange') : null),
  },

  employees: {
    icon: 'briefcase', edit: ['admin'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'EMP', unique: 1 },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r), fmt: r => `<span class="who">${avatar(r)}<span>${esc(loc(r))}</span></span>` },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'gender', type: 'select', opts: ['male', 'female'], req: 1 },
      { k: 'nationalId', type: 'text', dir: 'ltr' },
      { k: 'role', type: 'select', opts: ['teacher', 'principal', 'vice', 'admin', 'accountant', 'librarian', 'counselor', 'nurse', 'driver'], req: 1, list: 1, def: 'teacher' },
      { k: 'subjectId', type: 'ref', ref: 'subjects', list: 1 },
      { k: 'phone', type: 'tel', list: 1 },
      { k: 'email', type: 'email', dir: 'ltr' },
      { k: 'qualification', type: 'select', opts: ['diploma', 'bachelor', 'master', 'phd'] },
      { k: 'hireDate', type: 'date' },
      { k: 'salary', type: 'number', money: 1 },
      { k: 'status', type: 'select', opts: ['active', 'leave', 'terminated'], def: 'active', list: 1, badge: 1 },
    ],
    filters: [{ k: 'role' }, { k: 'subjectId' }, { k: 'status' }],
    validate: r => (S().country === 'LY' && S().validateNid && r.nationalId ? libyanNidError(r.nationalId, r.gender) : null),
    actions: [{ icon: 'grid', label: 'timetable', show: r => r.role === 'teacher', href: r => '#/timetable?teacher=' + r.id }],
  },

  exams: {
    icon: 'file', edit: ['admin'], order: (a, b) => (a.date || '').localeCompare(b.date || ''),
    fields: [
      { k: 'title', type: 'text', req: 1, list: 1, show: r => loc(r, 'title') },
      { k: 'titleEn', type: 'text', dir: 'ltr' },
      { k: 'term', type: 'select', opts: [1, 2], optLabel: termName, num: 1, req: 1, list: 1, def: 1 },
      { k: 'type', type: 'select', opts: ['coursework', 'quiz', 'monthly', 'midterm', 'final'], req: 1, list: 1, badge: 1 },
      { k: 'date', type: 'date', list: 1 },
      { k: 'maxMark', type: 'number', req: 1, def: 20, list: 1 },
      { k: 'entered', type: 'calc', list: 1, get: r => Object.keys(DB.d.marks).filter(k => k.startsWith(r.id + '|')).length },
    ],
    filters: [{ k: 'term' }, { k: 'type' }],
    actions: [{ icon: 'pencil', label: 'enterMarks', href: r => '#/marks?exam=' + r.id }],
  },

  homework: {
    icon: 'pencil', edit: ['admin', 'teacher'], order: (a, b) => (b.dueDate || '').localeCompare(a.dueDate || ''),
    fields: [
      { k: 'title', type: 'text', req: 1, list: 1, show: r => loc(r, 'title') },
      { k: 'titleEn', type: 'text', dir: 'ltr' },
      { k: 'classId', type: 'ref', ref: 'classes', req: 1, list: 1 },
      { k: 'subjectId', type: 'ref', ref: 'subjects', req: 1, list: 1 },
      { k: 'teacherId', type: 'ref', ref: 'employees', refFilter: e => e.role === 'teacher', def: () => USER?.employeeId || '' },
      { k: 'assignDate', type: 'date', def: () => today() },
      { k: 'dueDate', type: 'date', req: 1, list: 1, def: () => addDays(today(), 3), fmt: r => `${fmtDate(r.dueDate)} ${r.dueDate < today() ? badge('closed') : badge('open')}` },
      { k: 'description', type: 'textarea', full: 1 },
    ],
    filters: [{ k: 'classId' }, { k: 'subjectId' }],
  },

  behavior: {
    icon: 'star', edit: ['admin', 'teacher'], order: (a, b) => (b.date || '').localeCompare(a.date || ''),
    fields: [
      { k: 'studentId', type: 'ref', ref: 'students', req: 1, list: 1 },
      { k: 'date', type: 'date', def: () => today(), list: 1 },
      { k: 'kind', type: 'select', opts: ['positive', 'negative'], req: 1, list: 1, badge: 1, def: 'positive' },
      { k: 'category', type: 'select', opts: ['excellence', 'participation', 'cooperation', 'lateness', 'misconduct', 'uniform', 'absence'], list: 1 },
      { k: 'description', type: 'textarea', full: 1, list: 1 },
      { k: 'actionTaken', type: 'text' },
    ],
    filters: [{ k: 'kind' }, { k: 'category' }],
  },

  feeTypes: {
    icon: 'tag', edit: ['admin', 'accountant'],
    fields: [
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r) },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'stage', type: 'select', opts: ['all', ...STAGES], def: 'all', list: 1 },
      { k: 'billed', type: 'calc', list: 1, money: 1, get: r => sum(DB.all('invoices').filter(i => i.feeTypeId === r.id), invNet) },
    ],
  },

  invoices: {
    icon: 'receipt', edit: ['admin', 'accountant'], order: (a, b) => String(b.number).localeCompare(String(a.number)),
    fields: [
      { k: 'number', type: 'text', list: 1, auto: 'INV', unique: 1 },
      { k: 'studentId', type: 'ref', ref: 'students', req: 1, list: 1 },
      { k: 'feeTypeId', type: 'ref', ref: 'feeTypes', req: 1, list: 1 },
      { k: 'amount', type: 'number', money: 1, req: 1 },
      { k: 'discount', type: 'number', money: 1, def: 0 },
      { k: 'net', type: 'calc', money: 1, list: 1, get: invNet },
      { k: 'paid', type: 'calc', money: 1, list: 1, get: invPaid },
      { k: 'balance', type: 'calc', money: 1, list: 1, get: invBalance },
      { k: 'dueDate', type: 'date', list: 1, def: () => addDays(today(), 30) },
      { k: 'status', type: 'calc', list: 1, get: r => t('opt_' + invStatus(r)), fmt: r => badge(invStatus(r)) },
      { k: 'notes', type: 'textarea', full: 1 },
    ],
    filters: [{ k: 'status', opts: ['paid', 'partial', 'unpaid', 'overdue'], test: (r, v) => invStatus(r) === v }, { k: 'feeTypeId' }, stageFilter(studentGrade)],
    actions: [
      { icon: 'wallet', label: 'pay', show: r => invBalance(r) > 0, roles: ['admin', 'accountant'], fn: r => openForm('payments', null, { invoiceId: r.id, amount: invBalance(r) }) },
      { icon: 'printer', label: 'print', fn: r => printInvoice(r) },
    ],
    tools: [{ icon: 'sparkle', label: 'genInvoices', roles: ['admin', 'accountant'], fn: () => openGenerateInvoices() }],
    summary: rows => [
      { label: t('f_net'), value: moneyText(sum(rows, invNet)) },
      { label: t('f_paid'), value: moneyText(sum(rows, invPaid)), cls: 'b-paid' },
      { label: t('f_balance'), value: moneyText(sum(rows, invBalance)), cls: 'b-overdue' },
    ],
    onChange: (form, name) => {
      if (name !== 'feeTypeId') return;
      const ft = DB.get('feeTypes', form.feeTypeId.value); if (ft && !+form.amount.value) form.amount.value = ft.amount;
    },
  },

  payments: {
    icon: 'wallet', edit: ['admin', 'accountant'], order: (a, b) => String(b.receiptNo).localeCompare(String(a.receiptNo)),
    fields: [
      { k: 'receiptNo', type: 'text', list: 1, auto: 'RC', unique: 1 },
      { k: 'invoiceId', type: 'ref', ref: 'invoices', req: 1, list: 1, refFilter: (i, cur) => invBalance(i) > 0 || i.id === cur },
      { k: 'student', type: 'calc', list: 1, get: r => loc(DB.get('students', DB.get('invoices', r.invoiceId)?.studentId)) },
      { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
      { k: 'date', type: 'date', def: () => today(), list: 1 },
      { k: 'method', type: 'select', opts: ['cash', 'card', 'transfer', 'cheque'], def: 'cash', list: 1 },
      { k: 'notes', type: 'textarea', full: 1 },
    ],
    filters: [{ k: 'method' }],
    validate: (r, old) => {
      const inv = DB.get('invoices', r.invoiceId); if (!inv) return null;
      const allowed = invBalance(inv) + (old && old.invoiceId === r.invoiceId ? +old.amount : 0);
      if (+r.amount <= 0) return t('errAmount');
      return +r.amount > allowed + 0.001 ? `${t('errOverpay')} (${moneyText(allowed)})` : null;
    },
    actions: [{ icon: 'printer', label: 'printReceipt', fn: r => printReceipt(r) }],
    afterSave: (r, isNew) => { if (isNew) confirmBox(t('printReceiptQ'), () => printReceipt(r), { danger: false, okLabel: t('print') }); },
    summary: rows => [{ label: t('total'), value: moneyText(sum(rows, r => r.amount)), cls: 'b-paid' }, { label: t('count'), value: fmtNum(rows.length) }],
  },

  books: {
    icon: 'bookOpen', edit: ['admin', 'librarian'],
    fields: [
      { k: 'code', type: 'text', list: 1, auto: 'BK', unique: 1 },
      { k: 'title', type: 'text', req: 1, list: 1 },
      { k: 'author', type: 'text', list: 1 },
      { k: 'category', type: 'select', opts: ['story', 'science', 'religion', 'history', 'reference', 'language'], list: 1 },
      { k: 'isbn', type: 'text', dir: 'ltr' },
      { k: 'copies', type: 'number', def: 1, list: 1 },
      { k: 'shelf', type: 'text' },
      { k: 'available', type: 'calc', list: 1, get: bookAvailable, fmt: r => { const a = bookAvailable(r); return a > 0 ? badge('active', fmtNum(a)) : badge('overdue', '0'); } },
    ],
    filters: [{ k: 'category' }],
    actions: [{ icon: 'plus', label: 'lend', show: r => bookAvailable(r) > 0, fn: r => openForm('loans', null, { bookId: r.id }) }],
  },

  loans: {
    icon: 'bookOpen', edit: ['admin', 'librarian'], order: (a, b) => (b.loanDate || '').localeCompare(a.loanDate || ''),
    fields: [
      { k: 'bookId', type: 'ref', ref: 'books', req: 1, list: 1 },
      { k: 'studentId', type: 'ref', ref: 'students', req: 1, list: 1 },
      { k: 'loanDate', type: 'date', def: () => today(), list: 1 },
      { k: 'dueDate', type: 'date', def: () => addDays(today(), 14), list: 1 },
      { k: 'returnDate', type: 'date' },
      { k: 'status', type: 'calc', list: 1, get: r => t('opt_' + loanStatus(r)), fmt: r => badge(loanStatus(r)) },
    ],
    filters: [{ k: 'status', opts: ['borrowed', 'overdue', 'returned'], test: (r, v) => loanStatus(r) === v }],
    validate: (r, old) => { const b = DB.get('books', r.bookId); return !old && b && !r.returnDate && bookAvailable(b) <= 0 ? t('errNoCopies') : null; },
    actions: [{ icon: 'check', label: 'markReturned', show: r => !r.returnDate, fn: r => { DB.update('loans', r.id, { returnDate: today() }); toast(t('saved')); render(); } }],
  },

  buses: {
    icon: 'bus', edit: ['admin'],
    fields: [
      { k: 'number', type: 'text', req: 1, list: 1, unique: 1 },
      { k: 'plate', type: 'text', list: 1 },
      { k: 'driverName', type: 'text', list: 1 },
      { k: 'driverPhone', type: 'tel', list: 1 },
      { k: 'route', type: 'text', list: 1, show: r => loc(r, 'route') },
      { k: 'routeEn', type: 'text', dir: 'ltr' },
      { k: 'capacity', type: 'number', def: 30 },
      { k: 'riders', type: 'calc', list: 1, get: r => DB.all('students').filter(s => s.busId === r.id && s.status === 'active').length,
        fmt: r => { const n = DB.all('students').filter(s => s.busId === r.id && s.status === 'active').length; return `<div class="cap"><span>${n} / ${r.capacity || '∞'}</span>${progress(r.capacity ? n / r.capacity * 100 : 0)}</div>`; } },
    ],
    actions: [{ icon: 'users', label: 'riders', fn: r => showRiders(r) }],
  },

  announcements: {
    icon: 'megaphone', edit: ['admin'], order: (a, b) => (b.date || '').localeCompare(a.date || ''),
    fields: [
      { k: 'title', type: 'text', req: 1, list: 1, show: r => loc(r, 'title') },
      { k: 'titleEn', type: 'text', dir: 'ltr' },
      { k: 'body', type: 'textarea', req: 1, full: 1 },
      { k: 'bodyEn', type: 'textarea', full: 1, dir: 'ltr' },
      { k: 'audience', type: 'select', opts: ['all', 'staff', 'parents', 'students'], def: 'all', list: 1 },
      { k: 'priority', type: 'select', opts: ['normal', 'important', 'urgent'], def: 'normal', list: 1, badge: 1 },
      { k: 'date', type: 'date', def: () => today(), list: 1 },
    ],
    filters: [{ k: 'audience' }, { k: 'priority' }],
    card: r => annCard(r),
  },

  events: {
    icon: 'calendar', edit: ['admin'], order: (a, b) => (a.date || '').localeCompare(b.date || ''),
    fields: [
      { k: 'title', type: 'text', req: 1, list: 1, show: r => loc(r, 'title') },
      { k: 'titleEn', type: 'text', dir: 'ltr' },
      { k: 'type', type: 'select', opts: ['holiday', 'exam', 'activity', 'meeting', 'trip'], def: 'activity', list: 1, badge: 1 },
      { k: 'date', type: 'date', req: 1, list: 1, def: () => today() },
      { k: 'endDate', type: 'date', list: 1 },
      { k: 'description', type: 'textarea', full: 1 },
    ],
    validate: r => (r.endDate && r.endDate < r.date ? t('errDateRange') : null),
  },

  users: {
    icon: 'shield', edit: ['admin'],
    fields: [
      { k: 'username', type: 'text', req: 1, list: 1, unique: 1, dir: 'ltr' },
      { k: 'password', type: 'password', req: 1, dir: 'ltr' },
      { k: 'name', type: 'text', req: 1, list: 1, show: r => loc(r) },
      { k: 'nameEn', type: 'text', dir: 'ltr' },
      { k: 'role', type: 'select', opts: ['admin', 'teacher', 'accountant', 'librarian', 'parent'], req: 1, list: 1, badge: 1 },
      { k: 'employeeId', type: 'ref', ref: 'employees', list: 1 },
      { k: 'studentIds', type: 'multiref', ref: 'students', full: 1 },
      { k: 'active', type: 'bool', def: true, list: 1 },
    ],
    filters: [{ k: 'role' }],
    canDelete: r => r.id !== USER.id,
  },
};

/* ---------- reference labels ---------- */
const REF_LABEL = {
  classes: classLabel,
  students: s => `${loc(s)} (${s.code || ''})`,
  employees: e => loc(e),
  subjects: s => loc(s),
  buses: b => `${b.number} — ${loc(b, 'route')}`,
  books: b => b.title,
  feeTypes: f => loc(f),
  invoices: i => `${i.number} — ${loc(DB.get('students', i.studentId))} — ${loc(DB.get('feeTypes', i.feeTypeId))}`,
  exams: e => loc(e, 'title'),
};
function refLabel(ref, id) { const r = DB.get(ref, id); return r ? (REF_LABEL[ref] || (x => loc(x)))(r) : '—'; }
function refOptions(f, cur) {
  let rows = DB.all(f.ref).slice();
  if (f.ref === 'classes') rows = sortedClasses();
  if (f.ref === 'students') rows = rows.filter(s => s.status === 'active' || s.id === cur || (Array.isArray(cur) && cur.includes(s.id)));
  if (f.refFilter) rows = rows.filter(r => f.refFilter(r, cur) || r.id === cur);
  return rows.map(r => ({ v: r.id, l: (REF_LABEL[f.ref] || (x => loc(x)))(r) }));
}
function fieldOpts(f) {
  const o = typeof f.opts === 'function' ? f.opts() : f.opts;
  return (o || []).map(v => ({ v, l: f.optLabel ? f.optLabel(v) : t('opt_' + v) }));
}
const fieldLabel = f => t('f_' + f.k);
function can(roles) { return !!USER && (USER.role === 'admin' || (roles || ['admin']).includes(USER.role)); }

/* ---------- cell rendering ---------- */
function cellText(f, r) {
  const v = f.get ? f.get(r) : r[f.k];
  if (f.show) return f.show(r);
  if (f.money) return moneyText(v);
  switch (f.type) {
    case 'select': return v === '' || v == null ? '—' : (f.optLabel ? f.optLabel(v) : t('opt_' + v));
    case 'ref': return v ? refLabel(f.ref, v) : '—';
    case 'multiref': return (v || []).map(x => refLabel(f.ref, x)).join('، ');
    case 'date': return v ? fmtDate(v) : '—';
    case 'bool': return v ? t('yes') : t('no');
    default: return v === '' || v == null ? '—' : String(v);
  }
}
function cellHtml(f, r) {
  if (f.fmt) return f.fmt(r);
  if (f.money) return fmtMoney(f.get ? f.get(r) : r[f.k]);
  if (f.badge && r[f.k]) return badge(r[f.k]);
  if (f.type === 'bool') return r[f.k] ? badge('active', t('yes')) : badge('withdrawn', t('no'));
  if (f.type === 'ref' && f.ref === 'students' && r[f.k]) { const s = DB.get('students', r[f.k]); if (s) return `<a class="who" href="#/student/${s.id}">${avatar(s)}<span>${esc(loc(s))}</span></a>`; }
  const txt = cellText(f, r);
  return f.type === 'textarea' ? `<span class="clip">${esc(txt)}</span>` : esc(txt);
}
const sortVal = (f, r) => { const v = f.get ? f.get(r) : r[f.k]; return (f.money || f.type === 'number' || f.num || typeof v === 'number') ? +v || 0 : norm(cellText(f, r)); };

/* ---------- CRUD page ---------- */
const UI = {};
function crudState(key) { return (UI[key] = UI[key] || { q: '', f: {}, page: 1, sort: null, dir: 1 }); }
function crudRows(key) {
  const cfg = ENT[key], st = crudState(key);
  let rows = DB.all(key).slice();
  for (const [fk, v] of Object.entries(st.f)) {
    if (v === '' || v == null) continue;
    const flt = (cfg.filters || []).find(x => x.k === fk);
    rows = rows.filter(r => (flt && flt.test ? flt.test(r, v) : String(r[fk]) === String(v)));
  }
  if (st.q) {
    const q = norm(st.q).trim(); const fs = cfg.fields.filter(f => f.type !== 'password');
    rows = rows.filter(r => fs.some(f => norm(cellText(f, r)).includes(q) || (f.k.endsWith('En') && norm(r[f.k]).includes(q))));
  }
  if (st.sort) { const f = cfg.fields.find(x => x.k === st.sort); rows.sort((a, b) => { const x = sortVal(f, a), y = sortVal(f, b); return (x > y ? 1 : x < y ? -1 : 0) * st.dir; }); }
  else if (cfg.order) rows.sort(cfg.order);
  return rows;
}

function renderCrud(key, { title, embedded } = {}) {
  const cfg = ENT[key], st = crudState(key), editable = can(cfg.edit);
  const filters = (cfg.filters || []).map(fl => {
    const f = cfg.fields.find(x => x.k === fl.k) || {};
    const opts = fl.opts ? fl.opts.map(v => ({ v, l: t('opt_' + v) })) : f.type === 'ref' ? refOptions(f) : fieldOpts(f);
    return `<select class="input sm" data-chg="crud-filter" data-key="${key}" data-f="${fl.k}">
      <option value="">${t('f_' + fl.k)}: ${t('all')}</option>${opts.map(o => `<option value="${esc(o.v)}" ${String(st.f[fl.k]) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  }).join('');
  const tools = (cfg.tools || []).filter(tl => can(tl.roles)).map((tl, i) => `<button class="btn ghost" data-act="crud-tool" data-key="${key}" data-i="${i}">${icon(tl.icon)}<span>${t(tl.label)}</span></button>`).join('');
  return `${embedded ? '' : pageHead(title || t('nav_' + key), t('sub_' + key), `
      <button class="btn ghost" data-act="crud-export" data-key="${key}">${icon('download')}<span>${t('export')}</span></button>${tools}
      ${editable ? `<button class="btn primary" data-act="crud-add" data-key="${key}">${icon('plus')}<span>${t('add')}</span></button>` : ''}`)}
    <div class="card">
      <div class="toolbar">
        <div class="search">${icon('search')}<input class="input" placeholder="${t('search')}…" value="${esc(st.q)}" data-inp="crud-search" data-key="${key}"></div>
        ${filters}
        ${Object.values(st.f).some(v => v) || st.q ? `<button class="btn ghost sm" data-act="crud-clear" data-key="${key}">${icon('x')}<span>${t('clear')}</span></button>` : ''}
      </div>
      <div id="crud-${key}">${crudTable(key)}</div>
    </div>`;
}

const PAGE_SIZE = 15;
function crudTable(key) {
  const cfg = ENT[key], st = crudState(key), rows = crudRows(key), editable = can(cfg.edit);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE)); st.page = Math.min(st.page, pages);
  const slice = rows.slice((st.page - 1) * PAGE_SIZE, st.page * PAGE_SIZE);
  const cols = cfg.fields.filter(f => f.list);
  const summary = cfg.summary ? `<div class="summary">${cfg.summary(rows).map(s => `<div class="sum-item ${s.cls || ''}"><span>${esc(s.label)}</span><b>${esc(s.value)}</b></div>`).join('')}</div>` : '';
  const actions = r => {
    const custom = (cfg.actions || []).map((a, i) => (a.show && !a.show(r)) || (a.roles && !can(a.roles)) ? '' :
      a.href ? `<a class="icon-btn" href="${a.href(r)}" title="${t(a.label)}">${icon(a.icon)}</a>`
        : `<button class="icon-btn" data-act="crud-action" data-key="${key}" data-i="${i}" data-id="${r.id}" title="${t(a.label)}">${icon(a.icon)}</button>`).join('');
    const ed = editable ? `<button class="icon-btn" data-act="crud-edit" data-key="${key}" data-id="${r.id}" title="${t('edit')}">${icon('edit')}</button>
      ${!cfg.canDelete || cfg.canDelete(r) ? `<button class="icon-btn danger" data-act="crud-del" data-key="${key}" data-id="${r.id}" title="${t('delete')}">${icon('trash')}</button>` : ''}` : '';
    return custom + ed;
  };
  if (!rows.length) return summary + emptyState(t('noResults'), 'search');
  const body = cfg.card
    ? `<div class="cards-grid">${slice.map(r => `<div class="ann-wrap">${cfg.card(r)}<div class="ann-actions">${actions(r)}</div></div>`).join('')}</div>`
    : `<div class="table-wrap"><table class="table crud"><thead><tr>${cols.map(f => `<th data-act="crud-sort" data-key="${key}" data-f="${f.k}" class="sortable">${fieldLabel(f)}${st.sort === f.k ? (st.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th class="act-col"></th></tr></thead>
      <tbody>${slice.map(r => `<tr>${cols.map(f => `<td data-label="${esc(fieldLabel(f))}">${cellHtml(f, r)}</td>`).join('')}<td class="row-actions">${actions(r)}</td></tr>`).join('')}</tbody></table></div>`;
  return `${summary}${body}
    <div class="pager"><span>${t('showing')} ${fmtNum((st.page - 1) * PAGE_SIZE + 1)}–${fmtNum(Math.min(rows.length, st.page * PAGE_SIZE))} ${t('of')} ${fmtNum(rows.length)}</span>
    <div>${pages > 1 ? `<button class="icon-btn" data-act="crud-page" data-key="${key}" data-p="${st.page - 1}" ${st.page <= 1 ? 'disabled' : ''}>${icon(LANG === 'ar' ? 'chevR' : 'chevL')}</button>
      <b>${fmtNum(st.page)} / ${fmtNum(pages)}</b>
      <button class="icon-btn" data-act="crud-page" data-key="${key}" data-p="${st.page + 1}" ${st.page >= pages ? 'disabled' : ''}>${icon(LANG === 'ar' ? 'chevL' : 'chevR')}</button>` : ''}</div></div>`;
}
function refreshCrud(key) { const el = $('#crud-' + key); if (el) el.innerHTML = crudTable(key); else render(); }

function exportCrud(key) {
  const cfg = ENT[key]; const cols = cfg.fields.filter(f => f.type !== 'password');
  exportCSV(key, cols.map(fieldLabel), crudRows(key).map(r => cols.map(f => cellText(f, r))));
}

/* ---------- Form ---------- */
function inputHtml(f, v, rec) {
  const name = `name="${f.k}"`, req = f.req ? 'required' : '', dir = f.dir ? `dir="${f.dir}"` : '';
  switch (f.type) {
    case 'textarea': return `<textarea class="input" rows="3" ${name} ${req} ${dir}>${esc(v)}</textarea>`;
    case 'select': return `<select class="input" ${name} ${req}><option value="">—</option>${fieldOpts(f).map(o => `<option value="${esc(o.v)}" ${String(v) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    case 'ref': return `<select class="input" ${name} ${req}><option value="">—</option>${refOptions(f, v).map(o => `<option value="${esc(o.v)}" ${v === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
    case 'multiref': return `<select class="input" ${name} multiple size="6">${refOptions(f, v || []).map(o => `<option value="${esc(o.v)}" ${(v || []).includes(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select><small class="hint">${t('multiHint')}</small>`;
    case 'bool': return `<label class="switch"><input type="checkbox" ${name} ${v ? 'checked' : ''}><span></span></label>`;
    case 'number': return `<input class="input" type="number" step="any" min="0" ${name} value="${esc(v)}" ${req}>`;
    default: {
      const dl = f.datalist ? `<datalist id="dl-${f.k}">${f.datalist().map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : '';
      return `<input class="input" type="${f.type === 'password' ? 'text' : f.type}" ${name} value="${esc(v)}" ${req} ${dir} ${dl ? `list="dl-${f.k}"` : ''}>${dl}`;
    }
  }
}

function openForm(key, id, preset = {}) {
  const cfg = ENT[key]; const old = id ? DB.get(key, id) : null;
  const rec = old ? { ...old } : {};
  if (!old) cfg.fields.forEach(f => {
    if (f.auto) rec[f.k] = DB.nextCode(key, f.k, f.auto);
    else if (f.def !== undefined) rec[f.k] = typeof f.def === 'function' ? f.def() : f.def;
  });
  Object.assign(rec, preset);
  const fields = cfg.fields.filter(f => f.type !== 'calc');
  const root = modal({
    title: `${t(old ? 'edit' : 'add')} — ${t('ent_' + key)}`, size: 'lg',
    body: `<form id="mform" class="form-grid" novalidate>${fields.map(f => `<label class="field ${f.full ? 'full' : ''}"><span>${fieldLabel(f)}${f.req ? ' <i class="req">*</i>' : ''}</span>${inputHtml(f, rec[f.k] ?? '', rec)}</label>`).join('')}
      <div class="form-err full" hidden></div></form>`,
    footer: `<button class="btn ghost" type="button" data-cancel>${t('cancel')}</button><button class="btn primary" type="submit" form="mform">${icon('check')}<span>${t('save')}</span></button>`,
  });
  const form = $('#mform', root);
  $('[data-cancel]', root).onclick = closeModal;
  if (cfg.onChange) form.addEventListener('change', e => cfg.onChange(form, e.target.name));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const out = {}; let err = null;
    for (const f of fields) {
      const el = form.elements[f.k];
      let v = f.type === 'bool' ? el.checked : f.type === 'multiref' ? [...el.selectedOptions].map(o => o.value) : el.value.trim();
      if (f.type === 'number' || f.num) v = v === '' ? '' : Number(v);
      if (f.req && (v === '' || v == null)) { err = `${t('errRequired')}: ${fieldLabel(f)}`; el.focus(); break; }
      if (f.unique && v !== '' && DB.all(key).some(r => r.id !== id && String(r[f.k]).toLowerCase() === String(v).toLowerCase())) { err = `${t('errUnique')}: ${fieldLabel(f)}`; el.focus(); break; }
      out[f.k] = v;
    }
    if (!err && cfg.validate) err = cfg.validate({ ...rec, ...out }, old);
    const box = $('.form-err', form);
    if (err) { box.hidden = false; box.textContent = err; return; }
    let saved;
    if (old) saved = DB.update(key, id, out); else saved = DB.insert(key, { ...preset, ...out });
    closeModal(); toast(t('saved')); render();
    if (cfg.afterSave) cfg.afterSave(saved, !old);
  });
}

function deleteRecord(key, id) {
  confirmBox(t('confirmDelete'), () => {
    DB.remove(key, id);
    if (key === 'invoices') DB.d.payments = DB.d.payments.filter(p => p.invoiceId !== id);
    if (key === 'classes') delete DB.d.tt[id];
    DB.save(); toast(t('deleted')); render();
  });
}

/* ---------- entity specific helpers ---------- */
function enrollApplicant(a) {
  const cls = sortedClasses().filter(c => +c.grade === +a.grade).sort((x, y) => studentsOfClass(x.id).length - studentsOfClass(y.id).length)[0];
  if (!cls) return toast(t('errNoClass'), 'err');
  confirmBox(`${t('enrollQ')} ${esc(classLabel(cls))}`, () => {
    const s = DB.insert('students', { code: DB.nextCode('students', 'code', 'STD'), name: a.name, nameEn: a.nameEn || '', gender: a.gender, dob: a.dob, classId: cls.id,
      guardianName: a.guardianName, guardianPhone: a.guardianPhone, guardianRelation: 'father', enrollDate: today(), status: 'active' });
    DB.update('admissions', a.id, { status: 'enrolled' });
    toast(t('enrolled')); location.hash = '#/student/' + s.id;
  }, { danger: false, okLabel: t('enroll') });
}

function openGenerateInvoices() {
  const root = modal({
    title: t('genInvoices'), size: 'sm',
    body: `<form id="gform" class="form-grid one">
      <label class="field"><span>${t('f_feeTypeId')}</span><select class="input" name="ft" required>${DB.all('feeTypes').map(f => `<option value="${f.id}">${esc(loc(f))} — ${esc(moneyText(f.amount))}</option>`).join('')}</select></label>
      <label class="field"><span>${t('f_dueDate')}</span><input class="input" type="date" name="due" value="${addDays(today(), 30)}" required></label>
      <label class="field"><span>${t('f_stage')}</span><select class="input" name="stage"><option value="">${t('all')}</option>${STAGES.map(s => `<option value="${s}">${t('opt_' + s)}</option>`).join('')}</select></label>
      <label class="field row"><input type="checkbox" name="busOnly"> <span>${t('busOnly')}</span></label>
      <p class="hint">${t('genHint')}</p></form>`,
    footer: `<button class="btn ghost" data-c>${t('cancel')}</button><button class="btn primary" type="submit" form="gform">${icon('sparkle')}<span>${t('generate')}</span></button>`,
  });
  $('[data-c]', root).onclick = closeModal;
  $('#gform', root).addEventListener('submit', e => {
    e.preventDefault(); const fd = new FormData(e.target); const ft = DB.get('feeTypes', fd.get('ft'));
    const stage = fd.get('stage') || (ft.stage !== 'all' ? ft.stage : '');
    let n = 0;
    DB.all('students').filter(s => s.status === 'active').forEach(s => {
      const g = DB.get('classes', s.classId)?.grade;
      if (stage && stageOf(g) !== stage) return;
      if (fd.get('busOnly') && !s.busId) return;
      if (DB.all('invoices').some(i => i.studentId === s.id && i.feeTypeId === ft.id)) return;
      DB.d.invoices.push({ id: uid(), number: DB.nextCode('invoices', 'number', 'INV'), studentId: s.id, feeTypeId: ft.id, amount: ft.amount, discount: 0, dueDate: fd.get('due'), notes: '', createdAt: Date.now() });
      n++;
    });
    DB.save(); closeModal(); toast(`${t('generated')}: ${fmtNum(n)}`); render();
  });
}

function showRiders(bus) {
  const list = DB.all('students').filter(s => s.busId === bus.id && s.status === 'active');
  modal({ title: `${t('riders')} — ${esc(bus.number)}`, body: list.length ? `<table class="table compact"><thead><tr><th>#</th><th>${t('f_name')}</th><th>${t('f_classId')}</th><th>${t('f_guardianPhone')}</th></tr></thead><tbody>
    ${list.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(loc(s))}</td><td>${esc(refLabel('classes', s.classId))}</td><td dir="ltr">${esc(s.guardianPhone)}</td></tr>`).join('')}</tbody></table>` : emptyState(t('noData')) });
}

function annCard(r) {
  return `<article class="ann p-${esc(r.priority)}"><header><span class="ann-ic">${icon('megaphone')}</span><div><h4>${esc(loc(r, 'title'))}</h4>
    <small>${fmtDate(r.date)} · ${t('opt_' + r.audience)}</small></div>${r.priority !== 'normal' ? badge(r.priority) : ''}</header><p>${esc(loc(r, 'body'))}</p></article>`;
}

function printInvoice(inv) {
  const s = DB.get('students', inv.studentId), pays = DB.all('payments').filter(p => p.invoiceId === inv.id);
  printHTML(`${printHeader(t('invoice'))}<div class="pbox"><div class="kv"><span>${t('f_number')}</span><b>${esc(inv.number)}</b></div><div class="kv"><span>${t('f_studentId')}</span><b>${esc(loc(s))} (${esc(s?.code)})</b></div>
    <div class="kv"><span>${t('f_classId')}</span><b>${esc(refLabel('classes', s?.classId))}</b></div><div class="kv"><span>${t('f_dueDate')}</span><b>${fmtDate(inv.dueDate)}</b></div></div>
    <table class="ptable"><thead><tr><th>${t('f_feeTypeId')}</th><th>${t('f_amount')}</th><th>${t('f_discount')}</th><th>${t('f_net')}</th></tr></thead>
    <tbody><tr><td>${esc(refLabel('feeTypes', inv.feeTypeId))}</td><td>${moneyText(inv.amount)}</td><td>${moneyText(inv.discount)}</td><td>${moneyText(invNet(inv))}</td></tr></tbody></table>
    <h4>${t('nav_payments')}</h4><table class="ptable"><thead><tr><th>${t('f_receiptNo')}</th><th>${t('f_date')}</th><th>${t('f_method')}</th><th>${t('f_amount')}</th></tr></thead>
    <tbody>${pays.map(p => `<tr><td>${esc(p.receiptNo)}</td><td>${fmtDate(p.date)}</td><td>${t('opt_' + p.method)}</td><td>${moneyText(p.amount)}</td></tr>`).join('') || `<tr><td colspan="4">—</td></tr>`}</tbody></table>
    <div class="ptotals"><div><span>${t('f_paid')}</span><b>${moneyText(invPaid(inv))}</b></div><div><span>${t('f_balance')}</span><b>${moneyText(invBalance(inv))}</b></div><div><span>${t('f_status')}</span><b>${t('opt_' + invStatus(inv))}</b></div></div>
    <div class="psign"><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>`);
}
function printReceipt(p) {
  const inv = DB.get('invoices', p.invoiceId), s = DB.get('students', inv?.studentId);
  printHTML(`${printHeader(t('receipt'))}<div class="pbox"><div class="kv"><span>${t('f_receiptNo')}</span><b>${esc(p.receiptNo)}</b></div><div class="kv"><span>${t('f_date')}</span><b>${fmtDate(p.date)}</b></div>
    <div class="kv"><span>${t('receivedFrom')}</span><b>${esc(s ? (LANG === 'en' && s.guardianNameEn ? s.guardianNameEn : s.guardianName) : '—')}</b></div><div class="kv"><span>${t('f_studentId')}</span><b>${esc(loc(s))} — ${esc(refLabel('classes', s?.classId))}</b></div>
    <div class="kv"><span>${t('forPayment')}</span><b>${esc(refLabel('feeTypes', inv?.feeTypeId))} (${esc(inv?.number)})</b></div><div class="kv"><span>${t('f_method')}</span><b>${t('opt_' + p.method)}</b></div></div>
    <div class="pamount">${t('f_amount')}: <b>${moneyText(p.amount)}</b></div>
    <div class="ptotals"><div><span>${t('f_net')}</span><b>${moneyText(invNet(inv))}</b></div><div><span>${t('f_paid')}</span><b>${moneyText(invPaid(inv))}</b></div><div><span>${t('f_balance')}</span><b>${moneyText(invBalance(inv))}</b></div></div>
    <div class="psign"><div>${t('accountantSign')}</div><div>${t('stamp')}</div></div>`);
}
