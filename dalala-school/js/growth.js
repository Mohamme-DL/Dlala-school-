/* Dalala School System — student dues statement, CSV/Excel import, year-end promotion, student ID cards. */
'use strict';

Object.assign(I18N.ar, {
  nav_dues: 'مستحقات الطلبة', sub_dues: 'المطلوب والمدفوع والمتبقي على كل طالب', allClasses: 'كل الصفوف', onlyOwing: 'عليهم متبقٍ فقط', allStudents: 'كل الطلبة',
  duesTotal: 'الإجمالي', remind: 'تذكير', nStudents: 'طالب',
  importStudents: 'استيراد طلاب', importHelp: 'اختر ملف Excel (‎.xlsx) أو CSV. الصف الأول عناوين الأعمدة. الأعمدة المطلوبة: الاسم، الجنس، الصف، اسم ولي الأمر، هاتف ولي الأمر.',
  importTemplate: 'تنزيل نموذج', importChoose: 'اختيار ملف', importOk: 'سليم', importBad: 'به أخطاء', importGo: 'استيراد السليم', importDone: 'تم استيراد', importNone: 'لا توجد صفوف سليمة', importReadErr: 'تعذّر قراءة الملف',
  errNoClass: 'الصف غير موجود', errNoGender: 'الجنس غير مفهوم', errDup: 'مكرر', errMissing: 'حقل ناقص',
  promote: 'ترفيع نهاية العام', promoteHelp: 'اختر الصف الذي ينتقل إليه طلاب كل صف، وألغِ تحديد الراسبين ليبقوا في صفهم. طلاب آخر صف يتحولون إلى «متخرج».', promoteTo: 'ينتقلون إلى', graduateOpt: 'تخرج', stayNote: 'الراسبون يبقون', promoteGo: 'تنفيذ الترفيع', promoteDone: 'تم ترفيع', promoteConfirm: 'سيتم نقل الطلاب المحددين. المتابعة؟', promoteNone: 'لا توجد صفوف لها طلاب',
  idCards: 'بطاقات الطلاب', idCardsHelp: 'اختر الصف لطباعة بطاقات هوية الطلاب (صورة، اسم، رقم، صف).', idPrint: 'طباعة البطاقات', idStudent: 'بطاقة طالب',
});
Object.assign(I18N.en, {
  nav_dues: 'Student Dues', sub_dues: 'Billed, paid and remaining per student', allClasses: 'All classes', onlyOwing: 'Owing only', allStudents: 'All students',
  duesTotal: 'Total', remind: 'Remind', nStudents: 'students',
  importStudents: 'Import students', importHelp: 'Choose an Excel (.xlsx) or CSV file. Row 1 holds column headers. Required: name, gender, class, guardian name, guardian phone.',
  importTemplate: 'Download template', importChoose: 'Choose file', importOk: 'valid', importBad: 'with errors', importGo: 'Import valid rows', importDone: 'Imported', importNone: 'No valid rows', importReadErr: 'Could not read the file',
  errNoClass: 'Class not found', errNoGender: 'Gender not understood', errDup: 'Duplicate', errMissing: 'Missing field',
  promote: 'Year-end promotion', promoteHelp: 'Pick the class each class moves to; untick students who repeat. Last-grade students become “graduated”.', promoteTo: 'Moves to', graduateOpt: 'Graduate', stayNote: 'Repeaters stay', promoteGo: 'Promote', promoteDone: 'Promoted', promoteConfirm: 'The selected students will be moved. Continue?', promoteNone: 'No classes with students',
  idCards: 'Student ID cards', idCardsHelp: 'Pick a class to print student ID cards (photo, name, number, class).', idPrint: 'Print cards', idStudent: 'Student ID card',
});

/* ================= dues statement ================= */
function duesRows(cid, owingOnly) {
  const invs = DB.all('invoices');
  return DB.all('students').filter(s => s.status === 'active' && (!cid || s.classId === cid)).map(s => {
    const ii = invs.filter(i => i.studentId === s.id);
    const billed = sum(ii, invNet), paid = sum(ii, invPaid);
    return { s, billed, paid, bal: Math.max(0, Math.round((billed - paid) * 100) / 100), n: ii.length };
  }).filter(r => !owingOnly || r.bal > 0).sort((a, b) => b.bal - a.bal || String(loc(a.s)).localeCompare(String(loc(b.s))));
}
function renderDues(params) {
  const cid = params.cls || '', owing = params.owing === '1';
  const rows = duesRows(cid, owing);
  const tb = sum(rows, r => r.billed), tp = sum(rows, r => r.paid), tr = sum(rows, r => r.bal);
  const opts = sortedClasses().map(c => `<option value="${c.id}" ${c.id === cid ? 'selected' : ''}>${esc(classLabel(c))}</option>`).join('');
  return `${pageHead(t('nav_dues'), t('sub_dues'), `<button class="btn ghost" data-act="dues-export">${icon('download')}<span>${t('export')}</span></button>`)}
    <div class="toolbar" style="grid-template-columns:repeat(auto-fit,minmax(200px,260px))">
      <select class="input" data-dues-f="cls" ><option value="">${t('allClasses')}</option>${opts}</select>
      <select class="input" data-dues-f="owing" ><option value="0" ${owing ? '' : 'selected'}>${t('allStudents')}</option><option value="1" ${owing ? 'selected' : ''}>${t('onlyOwing')}</option></select></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>${t('f_code')}</th><th>${t('f_name')}</th><th>${t('f_classId')}</th><th>${t('totalBilled')}</th><th>${t('f_paid')}</th><th>${t('f_balance')}</th><th>${t('f_guardianPhone')}</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.s.code)}</td><td><a class="who" href="#/student/${r.s.id}">${avatar(r.s)}<span>${esc(loc(r.s))}</span></a></td><td style="min-width:150px">${esc(refLabel('classes', r.s.classId))}</td><td class="nw">${fmtMoney(r.billed)}</td><td class="nw">${fmtMoney(r.paid)}</td><td class="nw"><b>${fmtMoney(r.bal)}</b></td><td dir="ltr">${esc(r.s.guardianPhone)}</td><td>${r.bal > 0 ? `<button class="btn ghost sm" data-act="wa-student" data-id="${r.s.id}">${icon('whatsapp')}<span>${t('remind')}</span></button>` : ''}</td></tr>`).join('') || `<tr><td colspan="8">${emptyState(t('noData'))}</td></tr>`}
    <tr class="total-row"><td colspan="3">${t('duesTotal')} (${fmtNum(rows.length)} ${t('nStudents')})</td><td class="nw">${fmtMoney(tb)}</td><td class="nw">${fmtMoney(tp)}</td><td class="nw">${fmtMoney(tr)}</td><td></td><td></td></tr></tbody></table></div>`;
}
function duesExport() {
  const { params } = parseHash(); const rows = duesRows(params.cls || '', params.owing === '1');
  exportCSV('student-dues', [t('f_code'), t('f_name'), t('f_classId'), t('totalBilled'), t('f_paid'), t('f_balance'), t('f_guardianName'), t('f_guardianPhone')],
    rows.map(r => [r.s.code, loc(r.s), refLabel('classes', r.s.classId), r.billed, r.paid, r.bal, r.s.guardianName, r.s.guardianPhone]), t('nav_dues'));
}
document.addEventListener('change', e => {
  const el = e.target.closest && e.target.closest('[data-dues-f]'); if (!el) return;
  setParam(el.dataset.duesF, el.value);
});

/* ================= import (CSV / XLSX) ================= */
function parseCSVText(txt) {
  txt = txt.replace(/^﻿/, ''); const first = txt.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(x => String(x).trim() !== ''));
}
async function inflateRaw(u8) {
  const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(u8); w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}
async function readZip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); const files = {};
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  for (let i = 0; i < n; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true); const start = off + 30 + lnl + lel;
    const data = u8.subarray(start, start + csize);
    files[name] = { method, data }; p += 46 + nl + el + cl;
  }
  const get = async nm => { const f = files[nm]; if (!f) return null; const b = f.method === 0 ? f.data : await inflateRaw(f.data); return new TextDecoder().decode(b); };
  return { get, names: Object.keys(files) };
}
async function parseXLSX(buf) {
  const z = await readZip(buf); const dp = new DOMParser();
  const ss = await z.get('xl/sharedStrings.xml'); const strings = [];
  if (ss) dp.parseFromString(ss, 'application/xml').querySelectorAll('si').forEach(si => strings.push(Array.from(si.querySelectorAll('t')).map(x => x.textContent).join('')));
  const sheetName = z.names.filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0]; if (!sheetName) throw new Error('sheet');
  const doc = dp.parseFromString(await z.get(sheetName), 'application/xml'); const rows = [];
  doc.querySelectorAll('sheetData > row').forEach(r => {
    const row = [];
    r.querySelectorAll('c').forEach(c => {
      const ref = c.getAttribute('r') || ''; const col = ref.replace(/\d+/g, '').split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const ty = c.getAttribute('t'); const v = c.querySelector('v'); let val = '';
      if (ty === 's') val = strings[+(v ? v.textContent : 0)] || ''; else if (ty === 'inlineStr') val = Array.from(c.querySelectorAll('t')).map(x => x.textContent).join(''); else val = v ? v.textContent : '';
      row[col < 0 ? row.length : col] = val;
    });
    rows.push(Array.from(row, x => x ?? ''));
  });
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}
const IMP_COLS = {
  name: ['الاسم', 'اسم الطالب', 'الاسم الكامل', 'name', 'student name', 'full name'],
  nameEn: ['الاسم بالانجليزي', 'الاسم بالإنجليزية', 'name en', 'english name'],
  gender: ['الجنس', 'النوع', 'gender', 'sex'],
  dob: ['تاريخ الميلاد', 'الميلاد', 'dob', 'birth date', 'date of birth'],
  cls: ['الصف', 'الفصل', 'class', 'grade'],
  guardianName: ['اسم ولي الأمر', 'ولي الأمر', 'guardian name', 'guardian'],
  guardianPhone: ['هاتف ولي الأمر', 'هاتف', 'رقم الهاتف', 'guardian phone', 'phone', 'mobile'],
  nationalId: ['الرقم الوطني', 'national id', 'nid'],
  motherName: ['اسم الأم', 'mother name'],
  address: ['العنوان', 'address'],
};
const normTxt = s => String(s ?? '').replace(/[ً-ٟـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
const arDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const ORD = ['اول', 'ثاني', 'ثالث', 'رابع', 'خامس', 'سادس', 'سابع', 'ثامن', 'تاسع', 'عاشر', 'حادي عشر', 'ثاني عشر'];
function findClass(txt) {
  const raw = normTxt(arDigits(txt)); if (!raw) return null; const cls = sortedClasses();
  const exact = cls.find(c => normTxt(classLabel(c)) === raw); if (exact) return exact;
  // "الصف الثالث - ب"  /  "3 ب"  /  "3-B"
  const parts = raw.split(/\s*[-—–/،,]\s*|\s+/).filter(Boolean); if (!parts.length) return null;
  let g = 0; const num = raw.match(/\d+/); if (num) g = +num[0];
  if (!g) { const body = raw.replace(/^(ال)?صف\s+/, '').replace(/\s*[-—–/،,].*$/, ''); const i = ORD.findIndex(o => body === o || body === 'ال' + o || body.replace(/^ال/, '') === o); if (i >= 0) g = i + 1; }
  if (!g) return null;
  const rest = raw.replace(/\d+/, '').replace(/^(ال)?صف\s*/, '').replace(/[-—–/،,]/g, ' ').trim();
  const sec = rest.split(/\s+/).filter(Boolean).pop() || '';
  const same = cls.filter(c => +c.grade === g);
  return same.find(c => normTxt(c.section) === normTxt(sec)) || (same.length === 1 && !sec ? same[0] : null);
}
function normDate(v) {
  v = arDigits(String(v ?? '').trim()); if (!v) return '';
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) { const [y, m, d] = v.split('-'); return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; }
  let m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{5}$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + (+v) * 86400000); return d.toISOString().slice(0, 10); } // Excel serial
  return '';
}
function mapImport(rows) {
  const head = rows[0].map(normTxt); const idx = {};
  Object.entries(IMP_COLS).forEach(([k, names]) => { const i = head.findIndex(h => names.map(normTxt).includes(h)); if (i >= 0) idx[k] = i; });
  const seen = new Set(DB.all('students').map(s => normTxt(s.name) + '|' + normTxt(s.guardianPhone)));
  return rows.slice(1).map((r, n) => {
    const g = k => (idx[k] == null ? '' : String(r[idx[k]] ?? '').trim());
    const errs = []; const name = g('name'), gp = g('guardianName'), ph = arDigits(g('guardianPhone')).replace(/[\s-]/g, '');
    if (!name || !gp || !ph) errs.push(t('errMissing'));
    else if (name.split(/\s+/).length < 3) errs.push(t('errFullName'));
    const c = findClass(g('cls')); if (!c) errs.push(t('errNoClass'));
    const gr = normTxt(g('gender')); const gender = ['ذكر', 'male', 'm', 'ولد'].includes(gr) ? 'male' : ['انثي', 'انثى', 'female', 'f', 'بنت'].includes(gr) ? 'female' : ''; if (!gender) errs.push(t('errNoGender'));
    if (S().country === 'LY' && ph && !isLyPhone(ph)) errs.push(t('errPhone'));
    const key = normTxt(name) + '|' + normTxt(ph); if (name && seen.has(key)) errs.push(t('errDup')); else seen.add(key);
    return { n: n + 2, errs, rec: errs.length ? null : { name, nameEn: g('nameEn'), motherName: g('motherName'), gender, dob: normDate(g('dob')), classId: c.id, guardianName: gp, guardianPhone: ph, nationalId: g('nationalId'), address: g('address'), nationality: 'libyan', status: 'active', enrollDate: today() }, label: name };
  });
}
function openImportStudents() {
  const root = modal({ title: `${icon('download')} ${t('importStudents')}`, size: 'lg', body: `<p class="muted">${t('importHelp')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><label class="btn primary">${icon('plus')}<span>${t('importChoose')}</span><input type="file" accept=".xlsx,.csv,.txt" hidden id="imp-file"></label>
    <button class="btn ghost" type="button" id="imp-tpl">${icon('download')}<span>${t('importTemplate')}</span></button></div><div id="imp-out"></div>` });
  $('#imp-tpl', root).onclick = () => csvFile('students-template', [t('f_name'), t('f_gender'), t('f_dob'), t('f_classId'), t('f_guardianName'), t('f_guardianPhone'), t('f_nationalId')], [[t('phNameFull'), t('opt_male'), '2015-09-01', classLabel(sortedClasses()[0]), t('phGuardianFull'), '0912345678', '']]);
  $('#imp-file', root).onchange = async e => {
    const f = e.target.files[0]; if (!f) return; const out = $('#imp-out', root);
    try {
      const rows = /\.xlsx$/i.test(f.name) ? await parseXLSX(await f.arrayBuffer()) : parseCSVText(await f.text());
      if (rows.length < 2) throw new Error('empty');
      const res = mapImport(rows); const ok = res.filter(r => r.rec), bad = res.filter(r => !r.rec);
      out.innerHTML = `<p><b>${fmtNum(ok.length)}</b> ${t('importOk')} · <b>${fmtNum(bad.length)}</b> ${t('importBad')}</p>
        ${bad.length ? `<div class="table-wrap" style="max-height:240px;overflow:auto"><table class="table compact"><tbody>${bad.map(r => `<tr><td>${r.n}</td><td>${esc(r.label)}</td><td>${esc(r.errs.join('، '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <button class="btn primary" id="imp-go" ${ok.length ? '' : 'disabled'}>${icon('check')}<span>${t('importGo')}</span></button>`;
      $('#imp-go', root).onclick = () => {
        ok.forEach(r => DB.insert('students', Object.assign({ code: DB.nextCode('students', 'code', 'STD') }, r.rec)));
        closeModal(); toast(`${t('importDone')} ${fmtNum(ok.length)}`); render();
      };
    } catch (err) { console.error(err); out.innerHTML = `<p class="form-err">${t('importReadErr')}</p>`; }
  };
}

/* ================= year-end promotion ================= */
function openPromotion() {
  const cls = sortedClasses().filter(c => studentsOfClass(c.id).some(s => s.status === 'active')); const maxG = Math.max(0, ...DB.all('classes').map(c => +c.grade));
  if (!cls.length) { toast(t('promoteNone'), 'err'); return; }
  const body = cls.map(c => {
    const next = sortedClasses().filter(x => +x.grade === +c.grade + 1); const def = next.find(x => normTxt(x.section) === normTxt(c.section)) || next[0];
    const last = +c.grade >= maxG || !next.length;
    return `<details class="card" style="padding:10px;margin-bottom:8px"><summary style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(classLabel(c))}</b> <span class="muted">${t('promoteTo')}</span>
      <select class="input" data-pr-class="${c.id}" style="max-width:240px">${next.map(x => `<option value="${x.id}" ${def && x.id === def.id ? 'selected' : ''}>${esc(classLabel(x))}</option>`).join('')}<option value="__grad" ${last ? 'selected' : ''}>${t('graduateOpt')}</option></select></summary>
      <div style="margin-top:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px">${studentsOfClass(c.id).filter(s => s.status === 'active').map(s => `<label><input type="checkbox" data-pr-st="${s.id}" data-cls="${c.id}" checked> ${esc(loc(s))}</label>`).join('')}</div></details>`;
  }).join('');
  const root = modal({ title: `${icon('layers')} ${t('promote')}`, size: 'lg', body: `<p class="muted">${t('promoteHelp')}</p>${body}`, footer: `<button class="btn primary" id="pr-go">${icon('check')}<span>${t('promoteGo')}</span></button>` });
  $('#pr-go', root).onclick = () => {
    if (!confirm(t('promoteConfirm'))) return; let n = 0;
    const year = S().year || '';
    $$('[data-pr-st]', root).forEach(cb => {
      if (!cb.checked) return; const tgt = $(`[data-pr-class="${cb.dataset.cls}"]`, root).value; const s = DB.get('students', cb.dataset.prSt); if (!s) return;
      s.history = (s.history || []).concat([{ year, classId: s.classId, at: today() }]);
      if (tgt === '__grad') s.status = 'graduated'; else s.classId = tgt; n++;
    });
    DB.save(); closeModal(); toast(`${t('promoteDone')} ${fmtNum(n)}`); render();
  };
}

/* ================= student ID cards ================= */
async function cardsHTML(list) {
  const st = S(); const cards = [];
  for (const s of list) {
    let pic = ''; if (s.photoId) { try { const b = await FILES.get(s.photoId); if (b) pic = await blobToDataURL(b); } catch (e) { /* ignore */ } }
    const c = DB.get('classes', s.classId);
    cards.push(`<div style="display:inline-block;width:85.6mm;height:54mm;border:1px solid #444;border-radius:3mm;margin:2mm;padding:3mm;box-sizing:border-box;vertical-align:top;page-break-inside:avoid;overflow:hidden;font-family:inherit">
      <div style="text-align:center;font-weight:700;font-size:11pt;border-bottom:1px solid #999;padding-bottom:1mm">${esc(loc(st, 'schoolName'))}</div>
      <div style="display:flex;gap:3mm;margin-top:2mm;align-items:flex-start"><div style="width:22mm;height:28mm;border:1px solid #999;flex:none">${pic ? `<img src="${pic}" style="width:100%;height:100%;object-fit:cover">` : ''}</div>
      <div style="font-size:9.5pt;line-height:1.55"><b>${esc(loc(s))}</b><br>${t('f_code')}: <span dir="ltr">${esc(s.code)}</span><br>${t('f_classId')}: ${esc(classLabel(c))}<br>${t('f_year')}: ${esc(st.year)}<br>${t('f_guardianPhone')}: <span dir="ltr">${esc(s.guardianPhone)}</span></div></div></div>`);
  }
  return `<div>${cards.join('')}</div>`;
}
async function printStudentCards(list, name) { if (!list.length) { toast(t('noData'), 'err'); return; } printHTML(await cardsHTML(list), { name: name || 'student-cards', title: t('idCards') }); }
function openIdCards() {
  const root = modal({ title: `${icon('award')} ${t('idCards')}`, size: 'sm', body: `<p class="muted">${t('idCardsHelp')}</p>
    <select class="input" id="idc-class"><option value="">${t('allClasses')}</option>${sortedClasses().map(c => `<option value="${c.id}">${esc(classLabel(c))}</option>`).join('')}</select>`, footer: `<button class="btn primary" id="idc-go">${icon('printer')}<span>${t('idPrint')}</span></button>` });
  $('#idc-go', root).onclick = () => { const cid = $('#idc-class', root).value; closeModal(); printStudentCards(DB.all('students').filter(s => s.status === 'active' && (!cid || s.classId === cid))); };
}

/* ================= wiring ================= */
Object.assign(EXTRA_ACT, { 'dues-export': () => duesExport() });
ENT.students.tools = (ENT.students.tools || []).concat([
  { icon: 'download', label: 'importStudents', roles: ['admin', 'clerk'], fn: () => openImportStudents() },
  { icon: 'award', label: 'idCards', roles: ['admin', 'clerk'], fn: () => openIdCards() },
  { icon: 'layers', label: 'promote', roles: ['admin'], fn: () => openPromotion() },
]);
ENT.students.actions = (ENT.students.actions || []).concat([{ icon: 'award', label: 'idStudent', fn: r => printStudentCards([r], 'student-card') }]);
