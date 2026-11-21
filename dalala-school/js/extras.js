/* Dalala School System — photos, scanned personal documents, staff profile,
   payroll + salary vouchers, cash movement (treasury), void-instead-of-delete for money records. */
'use strict';

/* ================= helpers ================= */
const livePays = () => DB.all('payments').filter(p => !p.voided);
const curMonth = () => today().slice(0, 7);
const monthLabel = m => { const d = parseISO(m + '-01'); return d && !isNaN(d) ? d.toLocaleDateString(locale(), { year: 'numeric', month: 'long' }) : (m || '—'); };
const byName = () => (USER ? (loc(USER) || USER.username) : '');

/* ================= files (scans) live in IndexedDB, not in the JSON database ================= */
const FILES = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => { const r = indexedDB.open('dalala_files', 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => { this._db = r.result; res(r.result); }; r.onerror = () => rej(r.error); });
  },
  async tx(mode, fn) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('f', mode); let out; try { out = fn(tx.objectStore('f')); } catch (e) { rej(e); return; } tx.oncomplete = () => res(out && typeof out === 'object' && 'result' in out ? out.result : out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); },
  /* several computers: the main computer keeps every file; each computer caches what it opened */
  net() { return typeof NETSTATE !== 'undefined' && NETSTATE.on && NETCFG.url ? { url: NETCFG.url, h: { 'x-dalala-key': NETCFG.key || '' } } : null; },
  pendKey: 'dalala_files_pending',
  pend() { try { return JSON.parse(localStorage.getItem(this.pendKey) || '[]'); } catch (e) { return []; } },
  setPend(a) { try { localStorage.setItem(this.pendKey, JSON.stringify([...new Set(a)])); } catch (e) { /* ignore */ } },
  async upload(id, blob) { const n = this.net(); if (!n) return true; try { const r = await fetch(`${n.url}/api/file/${id}`, { method: 'PUT', headers: n.h, body: blob }); return r.ok; } catch (e) { return false; } },
  async put(id, blob) {
    await this.tx('readwrite', s => s.put(blob, id));
    if (this.net() && !(await this.upload(id, blob))) this.setPend([...this.pend(), id]);
  },
  async get(id) {
    const local = await this.tx('readonly', s => s.get(id)); if (local) return local;
    const n = this.net(); if (!n) return null;
    try { const r = await fetch(`${n.url}/api/file/${id}`, { headers: n.h }); if (!r.ok) return null; const b = await r.blob(); await this.tx('readwrite', s => s.put(b, id)); return b; } catch (e) { return null; }
  },
  async del(id) {
    await this.tx('readwrite', s => s.delete(id));
    const n = this.net(); if (n) { try { await fetch(`${n.url}/api/file/${id}`, { method: 'DELETE', headers: n.h }); } catch (e) { /* ignore */ } }
  },
  async flush() {      // resend files that could not reach the main computer while it was offline
    const ids = this.pend(); if (!ids.length || !this.net()) return; const left = [];
    for (const id of ids) { const b = await this.tx('readonly', s => s.get(id)).catch(() => null); if (b && !(await this.upload(id, b))) left.push(id); }
    this.setPend(left);
  },
};
setTimeout(() => { FILES.flush(); setInterval(() => FILES.flush(), 60000); }, 4000);
function loadImage(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => res({ im, u }); im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('image')); }; im.src = u; });
}
async function scaledBlob(file, max, q) {
  const { im, u } = await loadImage(file);
  const k = Math.min(1, max / Math.max(im.width, im.height)); const w = Math.round(im.width * k), h = Math.round(im.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
  URL.revokeObjectURL(u);
  return new Promise((res, rej) => c.toBlob(b => { if (!b) return rej(new Error('image')); b.w = w; b.h = h; res(b); }, 'image/jpeg', q));
}
async function squarePhoto(file) {           // centred square crop, 280px JPEG (about 15 KB)
  const { im, u } = await loadImage(file);
  const s = Math.min(im.width, im.height), sx = (im.width - s) / 2, sy = (im.height - s) / 2;
  const c = document.createElement('canvas'); c.width = c.height = 280; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 280, 280); x.drawImage(im, sx, sy, s, s, 0, 0, 280, 280);
  URL.revokeObjectURL(u); return new Promise((res, rej) => c.toBlob(bl => (bl ? res(bl) : rej(new Error('image'))), 'image/jpeg', 0.78));
}

/* ---------- photos: small JPEGs kept in the file store (not in the database), loaded on demand ---------- */
const PHOTO_URLS = new Map();
async function photoURL(id) {
  if (PHOTO_URLS.has(id)) return PHOTO_URLS.get(id);
  const b = await FILES.get(id).catch(() => null); if (!b) return '';
  const u = URL.createObjectURL(b); PHOTO_URLS.set(id, u); return u;
}
async function hydratePhotos() {
  for (const img of document.querySelectorAll('img[data-pid]:not([src])')) { const u = await photoURL(img.dataset.pid); if (u) img.src = u; }
}
{ let tm = null; new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(hydratePhotos, 30); }).observe(document.documentElement, { childList: true, subtree: true }); }
const blobToDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
function photoFieldHTML(v) {
  return `<div class="photo-field"><span class="av xl has-img" data-photo-prev>${v ? `<img data-pid="${esc(v)}" alt="">` : icon('users')}</span>
    <div><label class="btn ghost sm">${icon('plus')}<span>${t('choosePhoto')}</span><input type="file" accept="image/*" hidden data-photo-file></label>
    <button type="button" class="btn ghost sm" data-photo-clear ${v ? '' : 'hidden'}>${icon('trash')}<span>${t('removePhoto')}</span></button></div>
    <input type="hidden" name="photoId" value="${esc(v || '')}"></div>`;
}
document.addEventListener('change', async e => {
  const inp = e.target.closest && e.target.closest('[data-photo-file]'); if (!inp || !inp.files[0]) return;
  const box = inp.closest('.photo-field');
  try {
    const blob = await squarePhoto(inp.files[0]); const id = uid(); await FILES.put(id, blob);
    const u = URL.createObjectURL(blob); PHOTO_URLS.set(id, u);
    box.querySelector('input[name=photoId]').value = id; box.querySelector('[data-photo-prev]').innerHTML = `<img src="${u}" alt="">`; box.querySelector('[data-photo-clear]').hidden = false;
  } catch (err) { toast(t('errImage'), 'err'); }
  inp.value = '';
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-photo-clear]'); if (!b) return;
  const box = b.closest('.photo-field'); box.querySelector('input[name=photoId]').value = ''; box.querySelector('[data-photo-prev]').innerHTML = icon('users'); b.hidden = true;
});

/* ================= scanned personal documents ================= */
const DOC_KINDS = ['idCard', 'birthCert', 'familyBook', 'passport', 'certificate', 'contract', 'medicalDoc', 'photoDoc', 'otherDoc'];
function docsCard(ownerType, ownerId) {
  if (!canView('docs')) return '';
  const rows = DB.all('docs').filter(d => d.ownerType === ownerType && d.ownerId === ownerId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const canScan = !!window.dalalaScan;
  const up = canEdit('docs') ? `<div class="doc-up"><select class="input sm" data-dx-kind>${DOC_KINDS.map(k => `<option value="${k}">${t('doc_' + k)}</option>`).join('')}</select>
    ${canScan ? `<button type="button" class="btn primary sm" data-act="doc-scan" data-ot="${ownerType}" data-oid="${ownerId}">${icon('printer')}<span>${t('scanNow')}</span></button>` : ''}
    <label class="btn ${canScan ? 'ghost' : 'primary'} sm">${icon('plus')}<span>${t('addFile')}</span><input type="file" hidden multiple accept="image/*,application/pdf" data-dx-file data-ot="${ownerType}" data-oid="${ownerId}"></label></div><p class="muted hint">${t(canScan ? 'scanHint' : 'scanHintNoDevice')}</p>` : '';
  const list = rows.length ? `<div class="doc-list">${rows.map(d => `<div class="doc-row"><span class="doc-ic">${icon('file')}</span><div class="doc-info"><b>${esc(t('doc_' + d.kind))}</b><small class="muted">${esc(d.fileName)} · ${fmtDate(d.date)} · ${Math.max(1, Math.round((d.size || 0) / 1024))} KB</small></div>
      <button class="icon-btn" data-act="doc-view" data-id="${d.id}" title="${t('view')}">${icon('eye')}</button><button class="icon-btn" data-act="doc-save" data-id="${d.id}" title="${t('download')}">${icon('download')}</button>
      ${canEdit('docs') ? `<button class="icon-btn danger" data-act="doc-del" data-id="${d.id}" title="${t('delete')}">${icon('trash')}</button>` : ''}</div>`).join('')}</div>` : `<p class="muted">${t('noDocs')}</p>`;
  return card(t('docsFiles'), up + list);
}
document.addEventListener('change', async e => {
  const inp = e.target.closest && e.target.closest('[data-dx-file]'); if (!inp || !inp.files.length) return;
  const kind = inp.closest('.doc-up').querySelector('[data-dx-kind]').value; let n = 0;
  for (const f of [...inp.files]) {
    try {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      if (isPdf && f.size > 12 * 1024 * 1024) { toast(`${f.name}: ${t('errFileBig')}`, 'err'); continue; }
      const blob = isPdf ? f : await scaledBlob(f, 2000, 0.82);
      const id = uid(); await FILES.put(id, blob);
      DB.insert('docs', { id, ownerType: inp.dataset.ot, ownerId: inp.dataset.oid, kind, fileName: f.name, mime: isPdf ? 'application/pdf' : 'image/jpeg', size: blob.size, date: today(), by: byName() }); n++;
    } catch (err) { console.error(err); toast(`${f.name}: ${t('errImage')}`, 'err'); }
  }
  inp.value = ''; if (n) { toast(t('saved')); render(); }
});
const EXTRA_ACT = {
  'doc-scan': el => scanFlow(el.dataset.ot, el.dataset.oid, el.closest('.doc-up').querySelector('[data-dx-kind]').value),
  'doc-view': async el => {
    const d = DB.get('docs', el.dataset.id); const blob = d && await FILES.get(d.id);
    if (!blob) return toast(t('errFileMissing'), 'err');
    const u = URL.createObjectURL(blob);
    const body = d.mime === 'application/pdf' ? `<iframe class="doc-frame" src="${u}"></iframe>` : `<img class="doc-img" src="${u}" alt="">`;
    const root = modal({ title: esc(t('doc_' + d.kind)), size: 'lg', body, footer: `<button class="btn ghost" data-x2>${t('close')}</button><button class="btn primary" data-sv>${icon('download')}<span>${t('download')}</span></button>` });
    $('[data-x2]', root).onclick = () => { URL.revokeObjectURL(u); closeModal(); };
    $('[data-sv]', root).onclick = () => saveBlob(blob, d.fileName.replace(/\.[^.]+$/, '') + (d.mime === 'application/pdf' ? '.pdf' : '.jpg'));
  },
  'doc-save': async el => { const d = DB.get('docs', el.dataset.id); const blob = d && await FILES.get(d.id); if (!blob) return toast(t('errFileMissing'), 'err'); saveBlob(blob, d.fileName.replace(/\.[^.]+$/, '') + (d.mime === 'application/pdf' ? '.pdf' : '.jpg')); },
  'doc-del': el => confirmBox(t('confirmDelete'), async () => { const d = DB.get('docs', el.dataset.id); if (!d) return; try { await FILES.del(d.id); } catch (e) { /* ignore */ } DB.remove('docs', d.id); toast(t('deleted')); render(); }),
  'void-rec': el => voidRecord(el.dataset.key, el.dataset.id),
  'pay-gen': () => openGeneratePayroll(),
  'emp-print': el => printEmployeeCard(DB.get('employees', el.dataset.id)),
};
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }

/* ---------- direct scanning: every page the scanner delivers goes into ONE multi-page PDF ---------- */
async function pdfFromJpegs(items) {
  const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = x => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; };
  const num = v => (+v).toFixed(2);
  push('%PDF-1.4\n');
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
  const n = items.length;
  obj(1, '<</Type/Catalog/Pages 2 0 R>>');
  obj(2, `<</Type/Pages/Count ${n}/Kids[${items.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}]>>`);
  for (let i = 0; i < n; i++) {
    const it = items[i], bytes = new Uint8Array(await it.blob.arrayBuffer());
    const land = it.w > it.h * 1.15, PW = land ? 841.89 : 595.28, PH = land ? 595.28 : 841.89, M = 14;
    const k = Math.min((PW - 2 * M) / it.w, (PH - 2 * M) / it.h), w = it.w * k, h = it.h * k, x = (PW - w) / 2, y = (PH - h) / 2;
    const content = `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im0 Do Q`;
    obj(3 + 3 * i, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${num(PW)} ${num(PH)}]/Resources<</XObject<</Im0 ${5 + 3 * i} 0 R>>>>/Contents ${4 + 3 * i} 0 R>>`);
    obj(4 + 3 * i, `<</Length ${content.length}>>\nstream\n${content}\nendstream`);
    offs[5 + 3 * i] = len;
    push(`${5 + 3 * i} 0 obj\n<</Type/XObject/Subtype/Image/Width ${it.w}/Height ${it.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${bytes.length}>>\nstream\n`); push(bytes); push('\nendstream\nendobj\n');
  }
  const total = 3 + 3 * n, xref = len;
  push(`xref\n0 ${total}\n0000000000 65535 f \n${offs.slice(1, total).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<</Size ${total}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
function askScanNext(count) {
  return new Promise(resolve => {
    let done = false; const fin = v => { if (done) return; done = true; closeModal(); resolve(v); };
    const root = modal({ title: t('scanNow'), size: 'sm', body: `<div class="confirm-msg">${icon('check')}<p>${t('scanPages')}: <b>${fmtNum(count)}</b><br>${t('scanMore')}</p></div>`,
      footer: `<button class="btn ghost" data-fin>${t('scanDone')}</button><button class="btn primary" data-more>${icon('plus')}<span>${t('scanNext')}</span></button>` });
    $('[data-fin]', root).onclick = () => fin(false); $('[data-more]', root).onclick = () => fin(true);
    $('[data-x]', root).onclick = () => fin(false);
    root.firstElementChild.addEventListener('mousedown', e => { if (e.target === root.firstElementChild) fin(false); });
  });
}
async function scanFlow(ownerType, ownerId, kind) {
  const pages = [];
  try {
    for (;;) {
      const r = await window.dalalaScan.acquire();
      if (!r.ok) { if (!r.canceled) toast(`${t('scanFail')}${r.error ? ': ' + r.error : ''}`, 'err'); break; }
      const raw = await (await fetch('data:image/jpeg;base64,' + r.data)).blob();
      const b = await scaledBlob(raw, 2300, 0.8); pages.push({ blob: b, w: b.w, h: b.h });
      if (!(await askScanNext(pages.length))) break;
    }
    if (!pages.length) return;
    const pdf = await pdfFromJpegs(pages); const id = uid(); await FILES.put(id, pdf);
    DB.insert('docs', { id, ownerType, ownerId, kind, fileName: `scan-${today()}.pdf`, mime: 'application/pdf', size: pdf.size, pages: pages.length, date: today(), by: byName() });
    toast(`${t('saved')} — ${fmtNum(pages.length)} ${t('scanPagesUnit')}`); render();
  } catch (err) { console.error(err); toast(t('scanFail'), 'err'); }
}

/* ---------- amount in words (Arabic, Libyan dinar / dirham) ---------- */
const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUND = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
function arBelow1000(n) {
  const out = [], h = Math.floor(n / 100), r = n % 100;
  if (h) out.push(AR_HUND[h]);
  if (r) { if (r < 20) out.push(AR_ONES[r]); else { const o = r % 10; out.push(o ? `${AR_ONES[o]} و${AR_TENS[Math.floor(r / 10)]}` : AR_TENS[Math.floor(r / 10)]); } }
  return out.join(' و');
}
function arScale(n, one, two, few, many) {       // n of a scale word (ألف / مليون): the grammar changes with the count
  if (n === 1) return one; if (n === 2) return two;
  const r = n % 100;
  return `${arBelow1000(n)} ${r >= 3 && r <= 10 ? few : r >= 11 ? many : one}`;
}
function arInteger(n) {
  if (n === 0) return 'صفر';
  const m = Math.floor(n / 1e6), th = Math.floor((n % 1e6) / 1000), rest = n % 1000, out = [];
  if (m) out.push(arScale(m, 'مليون', 'مليونان', 'ملايين', 'مليونًا'));
  if (th) out.push(arScale(th, 'ألف', 'ألفان', 'آلاف', 'ألفًا'));
  if (rest) out.push(arBelow1000(rest));
  return out.join(' و');
}
const countedNoun = (n, gen, acc, plural) => { const r = n % 100; return r === 0 ? gen : r >= 3 && r <= 10 ? plural : acc; };
function amountWords(v) {
  const cur = String(S().currency || ''); if (LANG !== 'ar' || !/د\.?\s?ل|LYD/i.test(cur) || !(+v >= 0) || +v > 999999999) return '';
  const total = Math.round(+v * 1000), d = Math.floor(total / 1000), m = total % 1000;
  if (!d && !m) return '';
  const parts = [];
  if (d) parts.push(d === 1 ? 'دينار ليبي واحد' : d === 2 ? 'ديناران ليبيان' : `${arInteger(d)} ${countedNoun(d, 'دينار ليبي', 'دينارًا ليبيًا', 'دنانير ليبية')}`);
  if (m) parts.push(m === 1 ? 'درهم واحد' : m === 2 ? 'درهمان' : `${arInteger(m)} ${countedNoun(m, 'درهم', 'درهمًا', 'دراهم')}`);
  return `${t('onlyWords')} ${parts.join(' و')} ${t('noMore')}`;
}
const wordsLine = v => { const w = amountWords(v); return w ? `<div class="pwords">${esc(w)}</div>` : ''; };

/* backup/restore carry the scans too, otherwise a restored copy would lose them */
async function filesForBackup() {
  const out = {};
  const ids = [...DB.all('docs').map(d => d.id), ...DB.all('students').concat(DB.all('employees')).map(r => r.photoId).filter(Boolean)];
  for (const id of ids) { const b = await FILES.get(id); if (b) out[id] = await blobToDataURL(b); }
  return out;
}
async function restoreFiles(map) { for (const [id, url] of Object.entries(map || {})) { const b = await (await fetch(url)).blob(); await FILES.put(id, b); } }

/* ================= void instead of delete (money records) ================= */
function voidRecord(key, id) {
  const r = DB.get(key, id); if (!r || r.voided) return;
  const no = r.receiptNo || r.voucherNo;
  const root = modal({ title: `${t('voidTitle')} — ${esc(no)}`, size: 'sm', body: `<form id="void-form"><p class="muted">${t('voidWarn')}</p><label class="field"><span>${t('voidReason')} <i class="req">*</i></span><textarea class="input" name="r" rows="3" required></textarea></label></form>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn danger" type="submit" form="void-form">${t('voidDo')}</button>` });
  $('[data-x2]', root).onclick = closeModal;
  $('#void-form', root).addEventListener('submit', e => { e.preventDefault(); const v = e.target.r.value.trim(); if (!v) return;
    DB.update(key, id, { voided: true, voidReason: v, voidedAt: today(), voidedBy: byName() }); closeModal(); toast(t('saved')); render(); });
}
const voidBadge = r => (r.voided ? badge('overdue', t('voided')) : badge('paid', t('valid')));

/* audit trail: who created each money record */
(() => { const ins = DB.insert.bind(DB); DB.insert = function (c, r) { if (['payments', 'salaryPays', 'payroll'].includes(c) && USER && !r.by) r.by = byName(); return ins(c, r); }; })();

/* ================= payroll ================= */
const payNet = r => Math.max(0, (+r.base || 0) + (+r.allowances || 0) + (+r.bonus || 0) - (+r.deductions || 0));
const payPaid = r => sum(DB.all('salaryPays').filter(p => p.payrollId === r.id && !p.voided), p => p.amount);
const payBal = r => Math.max(0, Math.round((payNet(r) - payPaid(r)) * 100) / 100);
const payStatus = r => (payBal(r) <= 0.001 ? 'paid' : payPaid(r) > 0 ? 'partial' : 'unpaid');
const empName = id => { const e = DB.get('employees', id); return e ? loc(e) : '—'; };

ENT.payroll = {
  icon: 'wallet', edit: ['admin', 'accountant'], order: (a, b) => String(b.month).localeCompare(String(a.month)) || empName(a.employeeId).localeCompare(empName(b.employeeId)),
  fields: [
    { k: 'employeeId', type: 'ref', ref: 'employees', req: 1, list: 1, refFilter: (e, cur) => e.status !== 'terminated' || e.id === cur },
    { k: 'month', type: 'month', req: 1, list: 1, def: () => curMonth(), show: r => monthLabel(r.month) },
    { k: 'base', type: 'number', money: 1, req: 1 },
    { k: 'allowances', type: 'number', money: 1, def: 0 },
    { k: 'bonus', type: 'number', money: 1, def: 0 },
    { k: 'deductions', type: 'number', money: 1, def: 0 },
    { k: 'net', type: 'calc', money: 1, list: 1, get: payNet },
    { k: 'paid', type: 'calc', money: 1, list: 1, get: payPaid },
    { k: 'balance', type: 'calc', money: 1, list: 1, get: payBal },
    { k: 'status', type: 'calc', list: 1, get: r => t('opt_' + payStatus(r)), fmt: r => badge(payStatus(r)) },
    { k: 'notes', type: 'textarea', full: 1 },
  ],
  filters: [{ k: 'employeeId' }, { k: 'status', opts: ['paid', 'partial', 'unpaid'], test: (r, v) => payStatus(r) === v }],
  actions: [
    { icon: 'wallet', label: 'paySalary', show: r => payBal(r) > 0.001, perm: 'salaryPays', fn: r => openForm('salaryPays', null, { payrollId: r.id, amount: payBal(r) }) },
    { icon: 'printer', label: 'print', fn: r => printPaySlip(r) },
  ],
  tools: [{ icon: 'sparkle', label: 'genPayroll', perm: 'payroll', fn: () => openGeneratePayroll() }],
  summary: rows => [{ label: t('f_net'), value: moneyText(sum(rows, payNet)) }, { label: t('f_paid'), value: moneyText(sum(rows, payPaid)), cls: 'b-paid' }, { label: t('f_balance'), value: moneyText(sum(rows, payBal)), cls: 'b-overdue' }],
  onChange: (form, name) => { if (name !== 'employeeId') return; const e = DB.get('employees', form.employeeId.value); if (e && !+form.base.value) form.base.value = e.salary || ''; },
  validate: (r, old) => {
    if (DB.all('payroll').some(x => x.id !== (old && old.id) && x.employeeId === r.employeeId && x.month === r.month)) return t('errPayrollDup');
    if (old && payPaid(old) > payNet(r) + 0.001) return t('errPayrollBelowPaid');
    return null;
  },
  canDelete: r => payPaid(r) <= 0.001 && !DB.all('salaryPays').some(p => p.payrollId === r.id),
};
ENT.salaryPays = {
  icon: 'receipt', edit: ['admin', 'accountant'], order: (a, b) => String(b.voucherNo).localeCompare(String(a.voucherNo)),
  fields: [
    { k: 'voucherNo', type: 'text', list: 1, auto: 'PV', unique: 1 },
    { k: 'payrollId', type: 'ref', ref: 'payroll', req: 1, list: 1, refFilter: (p, cur) => payBal(p) > 0.001 || p.id === cur },
    { k: 'amount', type: 'number', money: 1, req: 1, list: 1 },
    { k: 'date', type: 'date', def: () => today(), list: 1 },
    { k: 'method', type: 'select', opts: ['cash', 'transfer', 'cheque'], def: 'cash', list: 1 },
    { k: 'state', type: 'calc', list: 1, get: r => (r.voided ? t('voided') : t('valid')), fmt: voidBadge },
    { k: 'notes', type: 'textarea', full: 1 },
  ],
  filters: [{ k: 'method' }],
  validate: (r, old) => {
    if (old && old.voided) return t('errVoidedLocked');
    if (old && USER.role !== 'admin') return t('errLocked');
    const pr = DB.get('payroll', r.payrollId); if (!pr) return null;
    if (+r.amount <= 0) return t('errAmount');
    const allowed = payBal(pr) + (old && old.payrollId === r.payrollId ? +old.amount : 0);
    return +r.amount > allowed + 0.001 ? `${t('errOverpaySalary')} (${moneyText(allowed)})` : null;
  },
  actions: [
    { icon: 'printer', label: 'printVoucher', fn: r => printVoucher(r) },
    { icon: 'x', label: 'voidDo', show: r => !r.voided, perm: 'salaryPays', fn: r => voidRecord('salaryPays', r.id) },
  ],
  afterSave: (r, isNew) => { if (isNew) confirmBox(t('printVoucherQ'), () => printVoucher(r), { danger: false, okLabel: t('print') }); },
  summary: rows => [{ label: t('totalPaidOut'), value: moneyText(sum(rows.filter(r => !r.voided), r => r.amount)), cls: 'b-paid' }, { label: t('count'), value: fmtNum(rows.length) }],
  canDelete: () => false,
};
/* the existing student receipts: same rules — cancel with a reason, never delete */
Object.assign(ENT.payments, { canDelete: () => false });
ENT.payments.fields.splice(ENT.payments.fields.findIndex(f => f.k === 'notes'), 0, { k: 'state', type: 'calc', list: 1, get: r => (r.voided ? t('voided') : t('valid')), fmt: voidBadge });
ENT.payments.actions.push({ icon: 'x', label: 'voidDo', show: r => !r.voided, perm: 'payments', fn: r => voidRecord('payments', r.id) });
ENT.payments.summary = rows => [{ label: t('total'), value: moneyText(sum(rows.filter(r => !r.voided), r => r.amount)), cls: 'b-paid' }, { label: t('count'), value: fmtNum(rows.length) }];
{
  const v0 = ENT.payments.validate;
  ENT.payments.validate = (r, old) => (old && old.voided ? t('errVoidedLocked') : old && USER.role !== 'admin' ? t('errLocked') : v0(r, old));
  ENT.invoices.canDelete = r => !DB.all('payments').some(p => p.invoiceId === r.id);
}

function openGeneratePayroll() {
  const root = modal({ title: t('genPayroll'), size: 'sm', body: `<form id="gp-form"><p class="muted">${t('genPayrollHint')}</p><label class="field"><span>${t('f_month')}</span><input class="input" type="month" name="m" value="${curMonth()}" required></label></form>`,
    footer: `<button class="btn ghost" data-x2>${t('cancel')}</button><button class="btn primary" type="submit" form="gp-form">${icon('check')}<span>${t('create')}</span></button>` });
  $('[data-x2]', root).onclick = closeModal;
  $('#gp-form', root).addEventListener('submit', e => {
    e.preventDefault(); const m = e.target.m.value; if (!m) return; let n = 0;
    DB.all('employees').filter(x => x.status === 'active' && +x.salary > 0).forEach(x => {
      if (DB.all('payroll').some(p => p.employeeId === x.id && p.month === m)) return;
      DB.insert('payroll', { employeeId: x.id, month: m, base: +x.salary, allowances: 0, bonus: 0, deductions: 0, notes: '' }); n++;
    });
    closeModal(); toast(`${t('created')}: ${fmtNum(n)}`); render();
  });
}
function printPaySlip(r) {
  const e = DB.get('employees', r.employeeId) || {};
  printHTML(`${printHeader(t('paySlip'))}<div class="pbox"><div class="kv"><span>${t('f_employeeId')}</span><b>${esc(loc(e))}</b></div><div class="kv"><span>${t('f_role')}</span><b>${esc(e.role ? t('opt_' + e.role) : '—')}</b></div>
    <div class="kv"><span>${t('f_month')}</span><b>${esc(monthLabel(r.month))}</b></div><div class="kv"><span>${t('f_base')}</span><b>${moneyText(r.base)}</b></div><div class="kv"><span>${t('f_allowances')}</span><b>${moneyText(r.allowances || 0)}</b></div>
    <div class="kv"><span>${t('f_bonus')}</span><b>${moneyText(r.bonus || 0)}</b></div><div class="kv"><span>${t('f_deductions')}</span><b>${moneyText(r.deductions || 0)}</b></div></div>
    <div class="pamount">${t('f_net')}: <b>${moneyText(payNet(r))}</b></div>${wordsLine(payNet(r))}
    <div class="ptotals"><div><span>${t('f_paid')}</span><b>${moneyText(payPaid(r))}</b></div><div><span>${t('f_balance')}</span><b>${moneyText(payBal(r))}</b></div></div>
    <div class="psign"><div>${t('accountantSign')}</div><div>${t('receiverSign')}</div><div>${t('stamp')}</div></div>`, { name: 'payslip', title: t('paySlip') });
}
function printVoucher(p) {
  p = DB.get('salaryPays', p.id) || p;   // the number may have been corrected by the shared server
  const pr = DB.get('payroll', p.payrollId) || {}, e = DB.get('employees', pr.employeeId) || {};
  printHTML(`${printHeader(t('payVoucher'))}${p.voided ? `<div class="pamount" style="color:#b91c1c;border-color:#b91c1c">${t('voided')} — ${esc(p.voidReason || '')}</div>` : ''}
    <div class="pbox"><div class="kv"><span>${t('f_voucherNo')}</span><b>${esc(p.voucherNo)}</b></div><div class="kv"><span>${t('f_date')}</span><b>${fmtDate(p.date)}</b></div>
    <div class="kv"><span>${t('paidTo')}</span><b>${esc(loc(e))}</b></div><div class="kv"><span>${t('forPayment')}</span><b>${t('salaryOf')} ${esc(monthLabel(pr.month))}</b></div><div class="kv"><span>${t('f_method')}</span><b>${t('opt_' + p.method)}</b></div></div>
    <div class="pamount">${t('f_amount')}: <b>${moneyText(p.amount)}</b></div>${wordsLine(p.amount)}
    <div class="ptotals"><div><span>${t('f_net')}</span><b>${moneyText(payNet(pr))}</b></div><div><span>${t('f_paid')}</span><b>${moneyText(payPaid(pr))}</b></div><div><span>${t('f_balance')}</span><b>${moneyText(payBal(pr))}</b></div></div>
    <div class="psign"><div>${t('accountantSign')}</div><div>${t('receiverSign')}</div><div>${t('stamp')}</div></div>`, { name: 'voucher-' + p.voucherNo, title: t('payVoucher') });
}

/* ================= treasury: every receipt in, every voucher out ================= */
function treasuryRows() {
  const rows = [];
  DB.all('payments').forEach(p => { const inv = DB.get('invoices', p.invoiceId); rows.push({ date: p.date, no: p.receiptNo, dir: 'in', party: loc(DB.get('students', inv?.studentId)), what: refLabel('feeTypes', inv?.feeTypeId), method: p.method, amount: +p.amount, voided: p.voided, createdAt: p.createdAt || 0 }); });
  DB.all('salaryPays').forEach(p => { const pr = DB.get('payroll', p.payrollId); rows.push({ date: p.date, no: p.voucherNo, dir: 'out', party: empName(pr?.employeeId), what: `${t('salaryOf')} ${monthLabel(pr?.month)}`, method: p.method, amount: +p.amount, voided: p.voided, createdAt: p.createdAt || 0 }); });
  return rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.createdAt - b.createdAt);
}
function renderTreasury(p) {
  const all = treasuryRows(); const months = [...new Set(all.map(r => String(r.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();
  const m = p.month || 'all';
  const rows = all.filter(r => m === 'all' || String(r.date).startsWith(m));
  const live = rows.filter(r => !r.voided); const inn = sum(live.filter(r => r.dir === 'in'), r => r.amount), out = sum(live.filter(r => r.dir === 'out'), r => r.amount);
  const bal = { cash: 0, transfer: 0, card: 0, cheque: 0 }; live.forEach(r => { bal[r.method] = (bal[r.method] || 0) + (r.dir === 'in' ? r.amount : -r.amount); });
  let run = 0; const withRun = rows.map(r => { if (!r.voided) run += r.dir === 'in' ? r.amount : -r.amount; return { ...r, run }; });
  const head = [t('f_date'), t('f_number'), t('moveType'), t('party'), t('forPayment'), t('f_method'), t('moneyIn'), t('moneyOut'), t('balanceRun')];
  const data = withRun.map(r => [fmtDate(r.date), r.no, r.dir === 'in' ? t('typeIn') : t('typeOut'), r.party, r.what, t('opt_' + r.method), r.dir === 'in' && !r.voided ? fmtNum(r.amount, 2) : '', r.dir === 'out' && !r.voided ? fmtNum(r.amount, 2) : '', r.voided ? t('voided') : fmtNum(r.run, 2)]);
  window.__treasury = { head, data, title: `${t('nav_treasury')} — ${m === 'all' ? t('all') : monthLabel(m)}`, summary: [[t('moneyIn'), moneyText(inn)], [t('moneyOut'), moneyText(out)], [t('netCash'), moneyText(inn - out)]] };
  return `${pageHead(t('nav_treasury'), t('sub_treasury'), `<button class="btn ghost" data-act="tr-export">${icon('download')}<span>${t('export')}</span></button><button class="btn primary" data-act="tr-print">${icon('printer')}<span>${t('print')}</span></button>`)}
    <div class="card"><div class="toolbar">${selectBox('month', [{ v: 'all', l: t('all') }, ...months.map(x => ({ v: x, l: monthLabel(x) }))], m, t('f_month'))}</div>
    <div class="summary"><div class="sum-item b-paid"><span>${t('moneyIn')}</span><b>${moneyText(inn)}</b></div><div class="sum-item b-overdue"><span>${t('moneyOut')}</span><b>${moneyText(out)}</b></div><div class="sum-item"><span>${t('netCash')}</span><b>${moneyText(inn - out)}</b></div>
    ${Object.entries(bal).filter(([, v]) => Math.abs(v) > 0.001).map(([k, v]) => `<div class="sum-item"><span>${t('opt_' + k)}</span><b>${moneyText(v)}</b></div>`).join('')}</div>
    ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${withRun.map((r, i) => `<tr class="${r.voided ? 'row-void' : ''}">${data[i].map((c, j) => `<td>${j === 2 ? badge(r.dir === 'in' ? 'paid' : 'overdue', c) : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : emptyState(t('noResults'), 'search')}</div>`;
}
Object.assign(EXTRA_ACT, {
  'tr-export': () => { const x = window.__treasury; exportCSV('treasury', x.head, x.data, x.title); },
  'tr-print': () => { const x = window.__treasury; printHTML(`${printHeader(x.title)}<div class="pbox">${x.summary.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>${tableHTML(x.head, x.data)}<div class="psign"><div>${t('accountantSign')}</div><div>${t('principal')}</div><div>${t('stamp')}</div></div>`, { name: 'treasury', title: x.title, wide: true }); },
});

/* ================= staff profile ================= */
function renderEmployee(p) {
  const e = DB.get('employees', p.id); if (!e) return emptyState(t('notFound'));
  const pay = DB.all('payroll').filter(r => r.employeeId === e.id).sort((a, b) => String(b.month).localeCompare(String(a.month)));
  const info = [['f_code', e.code], ['f_role', e.role ? t('opt_' + e.role) : ''], ['f_subjectId', e.subjectId ? refLabel('subjects', e.subjectId) : ''], ['f_gender', e.gender ? t('opt_' + e.gender) : ''], ['f_nationalId', e.nationalId], ['f_phone', e.phone], ['f_email', e.email],
    ['f_qualification', e.qualification ? t('opt_' + e.qualification) : ''], ['f_hireDate', e.hireDate ? fmtDate(e.hireDate) : ''], ['f_status', e.status ? t('opt_' + e.status) : ''], ...(canView('payroll') ? [['f_salary', e.salary ? moneyText(e.salary) : '']] : [])];
  const payCard = canView('payroll') ? card(t('nav_payroll'), pay.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>${t('f_month')}</th><th>${t('f_net')}</th><th>${t('f_paid')}</th><th>${t('f_balance')}</th><th></th></tr></thead><tbody>${pay.map(r => `<tr><td>${esc(monthLabel(r.month))}</td><td>${fmtMoney(payNet(r))}</td><td>${fmtMoney(payPaid(r))}</td><td>${fmtMoney(payBal(r))}</td><td>${badge(payStatus(r))}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${t('noResults')}</p>`) : '';
  return `<div class="profile">${avatar(e, 'xl')}<div class="pf-main"><h1>${esc(loc(e))}</h1><p>${esc(e.code || '')} · ${esc(e.role ? t('opt_' + e.role) : '')}</p></div>
    <div class="head-actions"><button class="btn ghost" data-act="emp-print" data-id="${e.id}">${icon('printer')}<span>${t('print')}</span></button>
    ${canEdit('employees') ? `<button class="btn primary" data-act="crud-edit" data-key="employees" data-id="${e.id}">${icon('edit')}<span>${t('edit')}</span></button>` : ''}</div></div>
    <div class="grid-2">${card(t('personalInfo'), `<div class="kv-list">${info.filter(x => x[1]).map(([k, v]) => `<div class="kv"><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`)}${docsCard('employees', e.id)}</div>${payCard}`;
}
async function printEmployeeCard(e) {
  if (!e) return;
  const pic = e.photoId ? await FILES.get(e.photoId).then(b => (b ? blobToDataURL(b) : ''), () => '') : '';
  const rows = [['f_code', e.code], ['f_role', e.role ? t('opt_' + e.role) : ''], ['f_subjectId', e.subjectId ? refLabel('subjects', e.subjectId) : ''], ['f_nationalId', e.nationalId], ['f_phone', e.phone], ['f_qualification', e.qualification ? t('opt_' + e.qualification) : ''], ['f_hireDate', e.hireDate ? fmtDate(e.hireDate) : '']].filter(x => x[1]);
  printHTML(`${printHeader(t('empCard'))}${pic ? `<div style="text-align:center"><img src="${esc(pic)}" style="width:110px;height:110px;object-fit:cover;border-radius:8px"></div>` : ''}<div class="pbox"><div class="kv"><span>${t('f_name')}</span><b>${esc(loc(e))}</b></div>${rows.map(([k, v]) => `<div class="kv"><span>${t(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="psign"><div>${t('principal')}</div><div>${t('stamp')}</div></div>`, { name: 'employee-' + (e.code || ''), title: t('empCard') });
}

/* ================= translations ================= */
Object.assign(I18N.ar, {
  nav_employee: 'ملف الموظف', role_clerk: 'إداري', opt_clerk: 'إداري', nav_payroll: 'مرتبات المعلمين والموظفين', nav_salaryPays: 'سندات صرف المرتبات', nav_treasury: 'الحركة المالية (الصندوق)', nav_docs: 'الأوراق الشخصية', g_hr: 'الموارد البشرية',
  sub_payroll: 'كشوف المرتبات الشهرية ومتابعة المستحق والمصروف', sub_salaryPays: 'سندات الصرف المسلَّمة للمعلمين والموظفين', sub_treasury: 'كل سندات القبض من الطلبة وسندات الصرف في كشف واحد',
  ent_payroll: 'كشف راتب', ent_salaryPays: 'سند صرف', f_month: 'الشهر', f_base: 'الراتب الأساسي', f_allowances: 'العلاوات', f_bonus: 'مكافأة', f_deductions: 'الخصومات', f_voucherNo: 'رقم السند', f_payrollId: 'كشف الراتب', f_state: 'الحالة', f_photo: 'الصورة الشخصية', f_perms: 'الصلاحيات', f_photoId: 'الصورة الشخصية',
  paySalary: 'صرف مرتب', genPayroll: 'إنشاء كشف الشهر', genPayrollHint: 'سيُنشأ كشف لكل موظف فعّال له راتب، ولن يتكرر كشف موجود.', paySlip: 'كشف راتب', payVoucher: 'سند صرف', printVoucher: 'طباعة السند', printVoucherQ: 'هل تريد طباعة سند الصرف؟', paidTo: 'صُرف إلى', salaryOf: 'راتب شهر', receiverSign: 'توقيع المستلم', totalPaidOut: 'إجمالي المصروف',
  voided: 'ملغى', valid: 'سارٍ', voidDo: 'إلغاء السند', voidTitle: 'إلغاء سند', voidWarn: 'لا تُحذف السندات المالية حفاظاً على التوثيق، وإنما تُلغى مع ذكر السبب ويبقى رقمها ظاهراً في السجل.', voidReason: 'سبب الإلغاء',
  errOverpaySalary: 'المبلغ يتجاوز المتبقي من صافي الراتب', errLocked: 'لا يعدّل السند بعد إصداره إلا مدير النظام. للتصحيح ألغِ السند وأنشئ بدلاً منه.', errVoidedLocked: 'السند ملغى ولا يمكن تعديله', errPayrollDup: 'يوجد كشف لهذا الموظف في نفس الشهر', errPayrollBelowPaid: 'صافي الراتب أقل من المصروف فعلاً',
  moveType: 'نوع الحركة', typeIn: 'قبض', typeOut: 'صرف', party: 'الجهة', moneyIn: 'المقبوض', moneyOut: 'المصروف', netCash: 'الصافي', balanceRun: 'الرصيد',
  created: 'تم إنشاء', create: 'إنشاء', close: 'إغلاق', view: 'عرض', download: 'تنزيل', personalInfo: 'البيانات الشخصية', empCard: 'بطاقة موظف',
  docsFiles: 'الأوراق الشخصية (ممسوحة ضوئياً)', scanNow: 'مسح مباشر', addFile: 'رفع ملف (PDF أو صورة)', scanHint: 'اضغط «مسح مباشر» لتشغيل الماسح الضوئي، وكل الصفحات تُحفظ في ملف PDF واحد. أو ارفع ملف PDF أو صورة جاهزاً.', scanHintNoDevice: 'ارفع ملف PDF أو صورة من الماسح الضوئي أو الهاتف.', scanPages: 'عدد الصفحات الممسوحة', scanMore: 'هل تريد مسح صفحة أخرى؟', scanNext: 'صفحة أخرى', scanDone: 'إنهاء وحفظ PDF', scanFail: 'تعذّر المسح الضوئي', scanPagesUnit: 'صفحة', onlyWords: 'فقط', noMore: 'لا غير', noDocs: 'لا توجد أوراق محفوظة بعد',
  doc_idCard: 'بطاقة هوية / رقم وطني', doc_birthCert: 'شهادة ميلاد', doc_familyBook: 'كتيب العائلة / ورقة قيد', doc_passport: 'جواز سفر', doc_certificate: 'شهادة دراسية', doc_contract: 'عقد / قرار تعيين', doc_medicalDoc: 'ورقة طبية', doc_photoDoc: 'صورة شخصية ورقية', doc_otherDoc: 'أخرى',
  errFileBig: 'الملف كبير (الحد 12 ميجا)', errImage: 'تعذّر قراءة الصورة', errFileMissing: 'الملف غير موجود على هذا الجهاز',
  noPermission: 'ليست لديك صلاحية لهذا الإجراء', choosePhoto: 'اختيار صورة', removePhoto: 'حذف الصورة',
  permCustom: 'تخصيص صلاحيات هذا المستخدم', permHint: 'إن لم تُفعَّل، تُطبَّق الصلاحيات الافتراضية لنوع الحساب. المستخدمون والإعدادات للمدير فقط.', permPreset: 'استعادة صلاحيات نوع الحساب', permSection: 'القسم', permView: 'عرض', permEdit: 'إضافة وتعديل',
});
Object.assign(I18N.en, {
  nav_employee: 'Staff file', role_clerk: 'Administrative', opt_clerk: 'Administrative', nav_payroll: 'Staff payroll', nav_salaryPays: 'Salary vouchers', nav_treasury: 'Cash movement', nav_docs: 'Personal documents', g_hr: 'Human resources',
  sub_payroll: 'Monthly payroll sheets: due and paid', sub_salaryPays: 'Payment vouchers issued to staff', sub_treasury: 'All student receipts and salary vouchers in one statement',
  ent_payroll: 'Payroll sheet', ent_salaryPays: 'Salary voucher', f_month: 'Month', f_base: 'Basic salary', f_allowances: 'Allowances', f_bonus: 'Bonus', f_deductions: 'Deductions', f_voucherNo: 'Voucher #', f_payrollId: 'Payroll sheet', f_state: 'State', f_photo: 'Photo', f_perms: 'Permissions', f_photoId: 'Photo',
  paySalary: 'Pay salary', genPayroll: 'Create month payroll', genPayrollHint: 'Creates a sheet for every active employee with a salary; existing sheets are not duplicated.', paySlip: 'Pay slip', payVoucher: 'Payment voucher', printVoucher: 'Print voucher', printVoucherQ: 'Print the payment voucher?', paidTo: 'Paid to', salaryOf: 'Salary of', receiverSign: 'Receiver signature', totalPaidOut: 'Total paid out',
  voided: 'Void', valid: 'Valid', voidDo: 'Void', voidTitle: 'Void document', voidWarn: 'Financial documents are never deleted, to keep the record complete. They are voided with a reason and the number stays in the log.', voidReason: 'Reason',
  errOverpaySalary: 'Amount exceeds the remaining net salary', errLocked: 'Only the administrator can edit an issued voucher. To correct it, void it and create a new one.', errVoidedLocked: 'This voucher is void and cannot be edited', errPayrollDup: 'A sheet for this employee and month already exists', errPayrollBelowPaid: 'Net is lower than the amount already paid',
  moveType: 'Type', typeIn: 'Receipt', typeOut: 'Payment', party: 'Party', moneyIn: 'Received', moneyOut: 'Paid out', netCash: 'Net', balanceRun: 'Balance',
  created: 'Created', create: 'Create', close: 'Close', view: 'View', download: 'Download', personalInfo: 'Personal information', empCard: 'Employee card',
  docsFiles: 'Personal documents (scans)', scanNow: 'Scan now', addFile: 'Upload file (PDF or image)', scanHint: 'Press “Scan now” to use the scanner; all pages are saved as one PDF. Or upload a ready PDF or image.', scanHintNoDevice: 'Upload a PDF or image from your scanner or phone.', scanPages: 'Pages scanned', scanMore: 'Scan another page?', scanNext: 'Another page', scanDone: 'Finish and save PDF', scanFail: 'Scanning failed', scanPagesUnit: 'page(s)', onlyWords: 'Only', noMore: 'and no more', noDocs: 'No documents saved yet',
  doc_idCard: 'ID card / national number', doc_birthCert: 'Birth certificate', doc_familyBook: 'Family book', doc_passport: 'Passport', doc_certificate: 'Certificate', doc_contract: 'Contract / appointment', doc_medicalDoc: 'Medical paper', doc_photoDoc: 'Printed photo', doc_otherDoc: 'Other',
  errFileBig: 'File too large (max 12 MB)', errImage: 'Could not read the image', errFileMissing: 'File is not on this computer',
  noPermission: 'You do not have permission for this action', choosePhoto: 'Choose photo', removePhoto: 'Remove photo',
  permCustom: 'Customise this user’s permissions', permHint: 'When off, the default permissions of the account type apply. Users and Settings are administrator-only.', permPreset: 'Reset to account-type defaults', permSection: 'Section', permView: 'View', permEdit: 'Add & edit',
});
