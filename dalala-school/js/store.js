/* Dalala School System — local data store (localStorage) + demo seed */
'use strict';

const DB_KEY = 'dalala_school_db_v1';
const COLS = ['students', 'employees', 'classes', 'subjects', 'exams', 'homework', 'behavior', 'admissions',
  'feeTypes', 'invoices', 'payments', 'books', 'loans', 'buses', 'announcements', 'events', 'users'];

const DB = {
  d: null,
  load() {
    try { this.d = JSON.parse(localStorage.getItem(DB_KEY)); } catch (e) { this.d = null; }
    if (!this.d || !this.d.version) { this.d = seedData(); this.save(); }
    COLS.forEach(c => { this.d[c] = this.d[c] || []; });
    this.d.att = this.d.att || {}; this.d.marks = this.d.marks || {}; this.d.tt = this.d.tt || {};
    this.d.settings = Object.assign(defaultSettings(), this.d.settings || {});
  },
  save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.d)); }
    catch (e) { console.error(e); if (typeof toast === 'function') toast(t('storageFull'), 'err'); }
  },
  all(c) { return this.d[c]; },
  get(c, id) { return id ? this.d[c].find(r => r.id === id) : undefined; },
  insert(c, r) { r.id = r.id || uid(); r.createdAt = Date.now(); this.d[c].push(r); this.save(); return r; },
  update(c, id, patch) { const r = this.get(c, id); if (r) { Object.assign(r, patch); this.save(); } return r; },
  remove(c, id) { this.d[c] = this.d[c].filter(r => r.id !== id); this.save(); },
  nextCode(c, field, prefix) {
    const n = Math.max(0, ...this.d[c].map(r => parseInt(String(r[field] || '').replace(/\D/g, ''), 10) || 0));
    return `${prefix}-${String(n + 1).padStart(5, '0')}`;
  },
  reset() { this.d = seedData(); this.save(); },
  wipe() {
    const settings = this.d.settings; const admin = this.d.users.find(u => u.role === 'admin');
    this.d = { version: 1, settings, att: {}, marks: {}, tt: {} };
    COLS.forEach(c => { this.d[c] = []; });
    this.d.users = [admin || { id: uid(), username: 'admin', password: 'admin123', name: 'مدير النظام', role: 'admin', active: true }];
    this.save();
  },
};

function defaultSettings() {
  return {
    schoolName: 'مدارس دلالة النموذجية', schoolNameEn: 'Dalala Model Schools',
    principal: 'أ. عبدالرحمن السالم', principalEn: 'Mr. Abdulrahman Al-Salem',
    phone: '+000 000 0000', email: 'info@dalala.school', address: 'المدينة — الحي التعليمي', addressEn: 'Education District',
    year: '2026 / 2027', currency: 'USD', workDays: [0, 1, 2, 3, 4], periods: 7,
    startTime: '07:30', periodMinutes: 45, breakAfter: 3, breakMinutes: 20, passMark: 50,
  };
}

function seedData() {
  let seed = 20262027;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const id = () => uid() + Math.floor(rnd() * 1e6).toString(36);
  const T = today();
  const settings = defaultSettings();
  const isWork = d => settings.workDays.includes(parseISO(d).getDay());

  const mAr = ['محمد', 'أحمد', 'علي', 'عمر', 'يوسف', 'خالد', 'إبراهيم', 'عبدالله', 'حسن', 'مصطفى', 'سالم', 'طارق', 'ياسين', 'أنس', 'زياد', 'حمزة', 'آدم', 'كريم'];
  const mEn = ['Mohammed', 'Ahmed', 'Ali', 'Omar', 'Youssef', 'Khalid', 'Ibrahim', 'Abdullah', 'Hassan', 'Mustafa', 'Salem', 'Tariq', 'Yassin', 'Anas', 'Ziad', 'Hamza', 'Adam', 'Karim'];
  const fAr = ['فاطمة', 'مريم', 'عائشة', 'سارة', 'نور', 'هدى', 'ريم', 'ليلى', 'آمنة', 'رنا', 'جنى', 'ملك', 'سلمى', 'دانة', 'لين', 'رهف', 'تسنيم', 'شهد'];
  const fEn = ['Fatima', 'Maryam', 'Aisha', 'Sara', 'Nour', 'Huda', 'Reem', 'Layla', 'Amna', 'Rana', 'Jana', 'Malak', 'Salma', 'Dana', 'Leen', 'Rahaf', 'Tasneem', 'Shahd'];
  const lAr = ['السالم', 'العلي', 'الحسن', 'المصري', 'الزين', 'الشريف', 'النجار', 'الخطيب', 'الحداد', 'القاسم', 'العمري', 'البكري', 'الصادق', 'الفاروق'];
  const lEn = ['Al-Salem', 'Al-Ali', 'Al-Hassan', 'Al-Masri', 'Al-Zein', 'Al-Sharif', 'Al-Najjar', 'Al-Khatib', 'Al-Haddad', 'Al-Qasim', 'Al-Omari', 'Al-Bakri', 'Al-Sadiq', 'Al-Farouq'];
  const person = gender => {
    const i = Math.floor(rnd() * 18), j = Math.floor(rnd() * 18), k = Math.floor(rnd() * lAr.length);
    const [fa, fe] = gender === 'male' ? [mAr[i], mEn[i]] : [fAr[i], fEn[i]];
    return { name: `${fa} ${mAr[j]} ${lAr[k]}`, nameEn: `${fe} ${mEn[j]} ${lEn[k]}`, fatherAr: `${mAr[j]} ${lAr[k]}`, fatherEn: `${mEn[j]} ${lEn[k]}` };
  };
  const phone = () => '09' + Math.floor(10000000 + rnd() * 89999999);

  /* subjects */
  const subjDefs = [
    ['ARB', 'اللغة العربية', 'Arabic Language', 1, 12, 6], ['ENG', 'اللغة الإنجليزية', 'English Language', 1, 12, 5],
    ['MTH', 'الرياضيات', 'Mathematics', 1, 12, 6], ['ISL', 'التربية الإسلامية', 'Islamic Education', 1, 12, 3],
    ['SCI', 'العلوم', 'Science', 1, 9, 4], ['SOC', 'الدراسات الاجتماعية', 'Social Studies', 4, 9, 2],
    ['CMP', 'الحاسوب', 'Computer Science', 4, 12, 2], ['ART', 'التربية الفنية', 'Art Education', 1, 6, 1],
    ['PE', 'التربية البدنية', 'Physical Education', 1, 12, 2], ['PHY', 'الفيزياء', 'Physics', 10, 12, 4],
    ['CHM', 'الكيمياء', 'Chemistry', 10, 12, 3], ['BIO', 'الأحياء', 'Biology', 10, 12, 3],
  ];
  const subjects = subjDefs.map(([code, name, nameEn, fromGrade, toGrade, weeklyHours]) => ({ id: id(), code, name, nameEn, fromGrade, toGrade, weeklyHours }));

  /* classes */
  const classes = [];
  range(1, 12).forEach(g => ['A', 'B'].forEach((sec, i) => classes.push({ id: id(), grade: g, section: sec, room: `${g < 7 ? 1 : g < 10 ? 2 : 3}${String(g).padStart(2, '0')}${i + 1}`, capacity: 30 })));

  /* employees */
  const employees = []; let ec = 0;
  const addEmp = (role, extra = {}) => {
    const g = rnd() < 0.5 ? 'male' : 'female', p = person(g);
    const e = { id: id(), code: `EMP-${String(++ec).padStart(5, '0')}`, name: p.name, nameEn: p.nameEn, gender: g, role, phone: phone(),
      email: `${p.nameEn.split(' ')[0].toLowerCase()}${ec}@dalala.school`, qualification: pick(['bachelor', 'bachelor', 'master', 'diploma', 'phd']),
      hireDate: iso(new Date(2010 + Math.floor(rnd() * 15), Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))), salary: 1500 + Math.floor(rnd() * 20) * 100, status: 'active', ...extra };
    employees.push(e); return e;
  };
  addEmp('principal', { name: settings.principal.replace('أ. ', ''), nameEn: settings.principalEn.replace('Mr. ', ''), gender: 'male' });
  addEmp('vice'); addEmp('accountant'); addEmp('admin'); addEmp('librarian'); addEmp('counselor'); addEmp('nurse');
  const drivers = range(1, 4).map(() => addEmp('driver', { gender: 'male', qualification: 'diploma' }));
  subjects.forEach(s => {
    const need = sum(classes.filter(c => c.grade >= s.fromGrade && c.grade <= s.toGrade), () => s.weeklyHours);
    range(1, Math.max(1, Math.ceil(need / 26))).forEach(() => addEmp('teacher', { subjectId: s.id }));
  });
  const tch = employees.filter(e => e.role === 'teacher');
  classes.forEach((c, i) => { c.teacherId = tch[(i * 7) % tch.length].id; });

  /* buses */
  const routes = [['الحي الشمالي — شارع الجامعة', 'North district — University St.'], ['الحي الشرقي — السوق', 'East district — Market'], ['الحي الغربي — الكورنيش', 'West district — Corniche'], ['الحي الجنوبي — المستشفى', 'South district — Hospital']];
  const buses = drivers.map((d, i) => ({ id: id(), number: `BUS-${i + 1}`, plate: `${10 + i * 7}-${4000 + i * 311}`, driverName: d.name, driverPhone: d.phone, route: routes[i][0], routeEn: routes[i][1], capacity: 30 }));

  /* students */
  const students = []; let sc = 0; const year = new Date().getFullYear();
  classes.forEach(c => range(1, 6).forEach(() => {
    const g = rnd() < 0.5 ? 'male' : 'female', p = person(g);
    students.push({ id: id(), code: `STD-${String(++sc).padStart(5, '0')}`, name: p.name, nameEn: p.nameEn, gender: g,
      dob: iso(new Date(year - c.grade - 6, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27))), classId: c.id,
      nationalId: String(Math.floor(1e11 + rnd() * 9e11)), guardianName: p.fatherAr, guardianNameEn: p.fatherEn, guardianRelation: 'father',
      guardianPhone: phone(), address: pick(routes)[0], busId: rnd() < 0.4 ? pick(buses).id : '', enrollDate: iso(new Date(year - Math.floor(rnd() * Math.min(c.grade, 6)), 8, 1)),
      status: 'active', medical: rnd() < 0.08 ? pick(['ربو خفيف', 'حساسية من الفول السوداني', 'يرتدي نظارة طبية']) : '' });
  }));
  // siblings for the demo parent account
  const sib = [students[3], students[70]];
  sib[1].guardianName = sib[0].guardianName; sib[1].guardianNameEn = sib[0].guardianNameEn; sib[1].guardianPhone = sib[0].guardianPhone;
  sib[1].name = sib[1].name.split(' ')[0] + ' ' + sib[0].guardianName; sib[1].nameEn = sib[1].nameEn.split(' ')[0] + ' ' + sib[0].guardianNameEn;

  /* timetable */
  const tt = {}; const busy = new Set(); const load = {};
  const days = settings.workDays, P = settings.periods;
  classes.forEach(c => {
    const list = []; subjectsForGradeIn(subjects, c.grade).forEach(s => range(1, s.weeklyHours).forEach(() => list.push(s)));
    const grid = {}; const slots = list.slice(0, days.length * P).map((s, i) => ({ s, d: days[i % days.length], p: (Math.floor(i / days.length) + 2 * (i % days.length) + c.grade) % P }));
    const bySub = {}; slots.forEach(x => (bySub[x.s.id] = bySub[x.s.id] || []).push(x));
    Object.entries(bySub).forEach(([sid, sl]) => {
      const cands = tch.filter(e => e.subjectId === sid).sort((a, b) => (load[a.id] || 0) - (load[b.id] || 0));
      const full = cands.find(e => sl.every(x => !busy.has(`${e.id}|${x.d}|${x.p}`)));
      sl.forEach(x => {
        const e = full || cands.find(e2 => !busy.has(`${e2.id}|${x.d}|${x.p}`));
        if (e) { busy.add(`${e.id}|${x.d}|${x.p}`); load[e.id] = (load[e.id] || 0) + 1; }
        grid[`${x.d}-${x.p}`] = { subjectId: sid, teacherId: e ? e.id : '' };
      });
    });
    tt[c.id] = grid;
  });

  /* attendance (last 20 school days incl. today) */
  const att = {}; let d = T, n = 0;
  while (n < 20) {
    if (isWork(d)) {
      classes.forEach(c => {
        const rec = {};
        students.filter(s => s.classId === c.id).forEach(s => { const r = rnd(); rec[s.id] = r < 0.9 ? 'P' : r < 0.95 ? 'A' : r < 0.98 ? 'L' : 'E'; });
        att[`${d}|${c.id}`] = rec;
      });
      n++;
    }
    d = addDays(d, -1);
  }

  /* exams & marks */
  const exams = [
    { id: id(), title: 'اختبار الشهر الأول', titleEn: 'First Monthly Test', term: 1, type: 'monthly', date: addDays(T, -30), maxMark: 20 },
    { id: id(), title: 'اختبار منتصف الفصل', titleEn: 'Midterm Exam', term: 1, type: 'midterm', date: addDays(T, -8), maxMark: 30 },
    { id: id(), title: 'الاختبار النهائي — الفصل الأول', titleEn: 'Term 1 Final Exam', term: 1, type: 'final', date: addDays(T, 45), maxMark: 50 },
    { id: id(), title: 'اختبار الشهر الأول — الفصل الثاني', titleEn: 'Term 2 Monthly Test', term: 2, type: 'monthly', date: addDays(T, 100), maxMark: 20 },
  ];
  const marks = {}; const ability = {}; students.forEach(s => { ability[s.id] = Math.min(0.98, Math.max(0.35, 0.74 + (rnd() + rnd() + rnd() - 1.5) * 0.3)); });
  exams.filter(e => e.date <= T).forEach(ex => subjects.forEach(sub => {
    const rec = {};
    students.forEach(s => { const c = classes.find(x => x.id === s.classId); if (c.grade < sub.fromGrade || c.grade > sub.toGrade) return;
      rec[s.id] = Math.max(0, Math.min(ex.maxMark, Math.round(ex.maxMark * (ability[s.id] + (rnd() - 0.5) * 0.25) * 2) / 2)); });
    marks[`${ex.id}|${sub.id}`] = rec;
  }));

  /* finance */
  const feeTypes = [
    { id: id(), name: 'رسوم دراسية — ابتدائي', nameEn: 'Tuition — Primary', amount: 3000, stage: 'primary' },
    { id: id(), name: 'رسوم دراسية — إعدادي', nameEn: 'Tuition — Middle', amount: 3500, stage: 'middle' },
    { id: id(), name: 'رسوم دراسية — ثانوي', nameEn: 'Tuition — Secondary', amount: 4000, stage: 'secondary' },
    { id: id(), name: 'الكتب والقرطاسية', nameEn: 'Books & Stationery', amount: 400, stage: 'all' },
    { id: id(), name: 'النقل المدرسي', nameEn: 'School Transport', amount: 800, stage: 'all' },
    { id: id(), name: 'الأنشطة والرحلات', nameEn: 'Activities & Trips', amount: 250, stage: 'all' },
  ];
  const invoices = [], payments = []; let ic = 0, rc = 0;
  const addInv = (s, ft, due) => {
    const inv = { id: id(), number: `INV-${String(++ic).padStart(5, '0')}`, studentId: s.id, feeTypeId: ft.id, amount: ft.amount, discount: rnd() < 0.1 ? Math.round(ft.amount * 0.1) : 0, dueDate: due, notes: '' };
    invoices.push(inv);
    const r = rnd(), net = inv.amount - inv.discount;
    const pay = r < 0.5 ? net : r < 0.8 ? Math.round(net / 2) : 0;
    if (pay) payments.push({ id: id(), receiptNo: `RC-${String(++rc).padStart(5, '0')}`, invoiceId: inv.id, amount: pay, date: addDays(T, -Math.floor(rnd() * 50)), method: pick(['cash', 'cash', 'card', 'transfer']), notes: '' });
  };
  students.forEach(s => {
    const c = classes.find(x => x.id === s.classId), st = stageOf(c.grade);
    addInv(s, feeTypes.find(f => f.stage === st), addDays(T, rnd() < 0.3 ? -10 : 40));
    addInv(s, feeTypes[3], addDays(T, -20));
    if (s.busId) addInv(s, feeTypes[4], addDays(T, 25));
  });

  /* library */
  const bookDefs = [['كليلة ودمنة', 'ابن المقفع', 'story'], ['البخلاء', 'الجاحظ', 'story'], ['الأيام', 'طه حسين', 'story'], ['موسوعة العلوم المصورة', 'نخبة من المؤلفين', 'science'],
    ['قصص الأنبياء', 'ابن كثير', 'religion'], ['تاريخ الحضارات', 'ول ديورانت', 'history'], ['المعجم الوسيط', 'مجمع اللغة العربية', 'reference'], ['Oxford Dictionary', 'Oxford Press', 'language'],
    ['Charlotte\'s Web', 'E. B. White', 'story'], ['A Brief History of Time', 'Stephen Hawking', 'science'], ['الرياضيات الممتعة', 'ياكوف بيرلمان', 'science'], ['أطلس العالم', 'الجمعية الجغرافية', 'reference'],
    ['رجال حول الرسول', 'خالد محمد خالد', 'religion'], ['Harry Potter', 'J. K. Rowling', 'story'], ['البرمجة للصغار', 'فريق دلالة', 'science']];
  const books = bookDefs.map(([title, author, category], i) => ({ id: id(), code: `BK-${String(i + 1).padStart(5, '0')}`, title, author, category, isbn: '978' + Math.floor(1e9 + rnd() * 9e9), copies: 2 + Math.floor(rnd() * 5), shelf: `${String.fromCharCode(65 + (i % 5))}-${1 + (i % 4)}` }));
  const loans = range(1, 14).map(i => {
    const ld = addDays(T, -Math.floor(rnd() * 30)); const returned = i % 3 === 0;
    return { id: id(), bookId: pick(books).id, studentId: pick(students).id, loanDate: ld, dueDate: addDays(ld, 14), returnDate: returned ? addDays(ld, 7) : '' };
  });

  /* admissions */
  const admissions = range(1, 8).map(i => {
    const g = rnd() < 0.5 ? 'male' : 'female', p = person(g), gr = 1 + Math.floor(rnd() * 12);
    return { id: id(), code: `ADM-${String(i).padStart(5, '0')}`, name: p.name, nameEn: p.nameEn, gender: g, dob: iso(new Date(year - gr - 6, 3, 10)), grade: gr,
      guardianName: p.fatherAr, guardianPhone: phone(), prevSchool: pick(['مدرسة النور', 'مدرسة الأمل', 'مدرسة الفجر', '']), applyDate: addDays(T, -i * 3),
      status: ['new', 'review', 'interview', 'accepted', 'rejected', 'new', 'accepted', 'interview'][i - 1], notes: '' };
  });

  /* communication */
  const announcements = [
    { id: id(), title: 'بدء التسجيل في الأنشطة الصيفية', titleEn: 'Summer activities registration open', body: 'يسر إدارة المدرسة الإعلان عن فتح باب التسجيل في الأنشطة اللاصفية حتى نهاية الشهر.', bodyEn: 'Registration for extracurricular activities is now open until the end of the month.', audience: 'all', priority: 'normal', date: addDays(T, -1) },
    { id: id(), title: 'اجتماع أولياء الأمور', titleEn: 'Parents meeting', body: 'ندعو أولياء الأمور لحضور الاجتماع الدوري لمناقشة مستوى الطلاب.', bodyEn: 'Parents are invited to the periodic meeting to discuss student progress.', audience: 'parents', priority: 'important', date: addDays(T, -3) },
    { id: id(), title: 'تسليم كشوف الدرجات', titleEn: 'Grade sheets submission', body: 'على جميع المعلمين رصد درجات اختبار منتصف الفصل قبل نهاية الأسبوع.', bodyEn: 'All teachers must enter midterm marks before the end of the week.', audience: 'staff', priority: 'urgent', date: addDays(T, -5) },
    { id: id(), title: 'الزي المدرسي الشتوي', titleEn: 'Winter uniform', body: 'يبدأ العمل بالزي الشتوي اعتباراً من الأسبوع القادم.', bodyEn: 'Winter uniform starts next week.', audience: 'students', priority: 'normal', date: addDays(T, -9) },
  ];
  const events = [
    { id: id(), title: 'اجتماع أولياء الأمور', titleEn: 'Parents meeting', date: addDays(T, 4), type: 'meeting', description: '' },
    { id: id(), title: 'اليوم الرياضي', titleEn: 'Sports Day', date: addDays(T, 9), type: 'activity', description: '' },
    { id: id(), title: 'رحلة علمية — المتحف', titleEn: 'Museum field trip', date: addDays(T, 16), type: 'trip', description: '' },
    { id: id(), title: 'عطلة رسمية', titleEn: 'Public holiday', date: addDays(T, 21), endDate: addDays(T, 23), type: 'holiday', description: '' },
    { id: id(), title: 'بداية الاختبارات النهائية', titleEn: 'Final exams begin', date: addDays(T, 45), endDate: addDays(T, 55), type: 'exam', description: '' },
    { id: id(), title: 'اختبار منتصف الفصل', titleEn: 'Midterm exam', date: addDays(T, -8), type: 'exam', description: '' },
  ];
  const hwTitles = [['حل تمارين الدرس الثالث', 'Solve lesson 3 exercises'], ['كتابة موضوع تعبير', 'Write an essay'], ['مشروع بحثي قصير', 'Short research project'], ['مراجعة الوحدة الأولى', 'Review unit one'], ['قراءة القصة وتلخيصها', 'Read and summarize the story']];
  const homework = range(1, 14).map(i => {
    const c = classes[(i * 5) % classes.length]; const sub = pick(subjectsForGradeIn(subjects, c.grade)); const ht = pick(hwTitles);
    const tid = Object.values(tt[c.id]).find(x => x.subjectId === sub.id)?.teacherId || '';
    return { id: id(), classId: c.id, subjectId: sub.id, title: ht[0], titleEn: ht[1], description: '', assignDate: addDays(T, -i), dueDate: addDays(T, 7 - i), teacherId: tid };
  });
  homework.push(...[sib[0], sib[1]].map(s => { const c = classes.find(x => x.id === s.classId); const sub = subjectsForGradeIn(subjects, c.grade)[2];
    return { id: id(), classId: c.id, subjectId: sub.id, title: 'حل ورقة العمل', titleEn: 'Complete the worksheet', description: '', assignDate: T, dueDate: addDays(T, 3), teacherId: '' }; }));
  const behavior = range(1, 16).map(i => {
    const pos = rnd() < 0.55;
    return { id: id(), studentId: (i < 3 ? sib[i - 1] : pick(students)).id, date: addDays(T, -i * 2), kind: pos ? 'positive' : 'negative',
      category: pos ? pick(['excellence', 'participation', 'cooperation']) : pick(['lateness', 'misconduct', 'uniform']), description: pos ? 'أداء متميز في الحصة' : 'تم التنبيه شفهياً', actionTaken: pos ? 'شهادة شكر' : 'تنبيه' };
  });

  /* users */
  const demoTeacher = tch.find(e => Object.values(tt).some(g => Object.values(g).some(x => x.teacherId === e.id)));
  const users = [
    { id: id(), username: 'admin', password: 'admin123', name: 'مدير النظام', nameEn: 'System Admin', role: 'admin', active: true },
    { id: id(), username: 'teacher', password: 'teacher123', name: demoTeacher.name, nameEn: demoTeacher.nameEn, role: 'teacher', employeeId: demoTeacher.id, active: true },
    { id: id(), username: 'accountant', password: 'acc123', name: employees[2].name, nameEn: employees[2].nameEn, role: 'accountant', employeeId: employees[2].id, active: true },
    { id: id(), username: 'parent', password: 'parent123', name: sib[0].guardianName, nameEn: sib[0].guardianNameEn, role: 'parent', studentIds: [sib[0].id, sib[1].id], active: true },
  ];

  return { version: 1, settings, subjects, classes, employees, buses, students, tt, att, exams, marks, feeTypes, invoices, payments,
    books, loans, admissions, announcements, events, homework, behavior, users };
}
function subjectsForGradeIn(subjects, g) { return subjects.filter(s => g >= s.fromGrade && g <= s.toGrade); }
