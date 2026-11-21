/* ---------- Output: print (A4 options) / PDF / Word / Excel / CSV ----------
   Everything the user can print or export goes through one dialog. Tables can be saved as
   Excel (.xlsx), Word (.docx), PDF or CSV; documents (report cards, invoices, receipts…) can be
   printed, saved as PDF or as Word. The files are generated here, offline, without libraries. */

/* ----- minimal ZIP writer (stored, no compression) ----- */
const ZIP_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function zipCrc(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = ZIP_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zipFiles(files) {
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const name = enc.encode(f.name); const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data; const crc = zipCrc(data);
    const head = new Uint8Array([0x50, 0x4B, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), 0, 0]);
    parts.push(head, name, data);
    central.push({ name, crc, size: data.length, off });
    off += head.length + name.length + data.length;
  }
  let cd = 0;
  for (const c of central) {
    const h = new Uint8Array([0x50, 0x4B, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(c.crc), ...u32(c.size), ...u32(c.size), ...u16(c.name.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(c.off)]);
    parts.push(h, c.name); cd += h.length + c.name.length;
  }
  parts.push(new Uint8Array([0x50, 0x4B, 5, 6, 0, 0, 0, 0, ...u16(central.length), ...u16(central.length), ...u32(cd), ...u32(off), 0, 0]));
  return new Blob(parts);
}
const xmlEsc = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ----- Excel ----- */
function xlsxColName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function buildXLSX(sheetName, headers, rows) {
  const rtl = LANG === 'ar';
  const sheet = String(sheetName || 'Sheet1').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1';
  const all = [headers, ...rows];
  const widths = headers.map((_, c) => Math.min(48, Math.max(8, ...all.map(r => String(r[c] ?? '').length)) * 1.15 + 2));
  const cell = (v, r, c, hdr) => {
    const ref = xlsxColName(c) + (r + 1); const s = hdr ? 1 : 2; const str = String(v ?? '');
    if (!hdr && /^-?\d+(\.\d+)?$/.test(str) && !/^-?0\d/.test(str) && str.replace(/[-.]/g, '').length <= 15) return `<c r="${ref}" s="${s}"><v>${str}</v></c>`;
    return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(str)}</t></is></c>`;
  };
  const sd = all.map((r, i) => `<row r="${i + 1}"${i === 0 ? ' ht="24" customHeight="1"' : ''}>${headers.map((_, c) => cell(r[c], i, c, i === 0)).join('')}</row>`).join('');
  const last = xlsxColName(Math.max(0, headers.length - 1)) + all.length;
  const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zipFiles([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS}" xmlns:r="${R}"><bookViews><workbookView/></bookViews><sheets><sheet name="${xmlEsc(sheet)}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/></Relationships>` },
    { name: 'xl/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FF1E1B4B"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE0E7FF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFBFC5D2"/></left><right style="thin"><color rgb="FFBFC5D2"/></right><top style="thin"><color rgb="FFBFC5D2"/></top><bottom style="thin"><color rgb="FFBFC5D2"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="${rtl ? 'right' : 'left'}" vertical="center"/></xf></cellXfs></styleSheet>` },
    { name: 'xl/worksheets/sheet1.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0" rightToLeft="${rtl ? 1 : 0}"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w.toFixed(1)}" customWidth="1"/>`).join('')}</cols><sheetData>${sd}</sheetData><autoFilter ref="A1:${last}"/><pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${headers.length > 7 ? 'landscape' : 'portrait'}" fitToHeight="0"/></worksheet>` },
  ]);
}

/* ----- Word ----- */
const MM_TW = 56.6929; // twips per mm
function docxPackage(bodyXml, p, extraFiles = [], extraTypes = '', extraRels = '') {
  const L = p.landscape; const [pw, ph] = p.paper; const w = Math.round((L ? ph : pw) * MM_TW), h = Math.round((L ? pw : ph) * MM_TW), m = Math.round(p.margin * MM_TW);
  const rtl = LANG === 'ar';
  const sect = `<w:sectPr><w:pgSz w:w="${w}" w:h="${h}"${L ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="${Math.round(m / 2)}" w:footer="${Math.round(m / 2)}" w:gutter="0"/>${rtl ? '<w:bidi/>' : ''}</w:sectPr>`;
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  return zipFiles([
    { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>${extraTypes}</Types>` },
    { name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>` },
    { name: 'word/_rels/document.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${extraRels}</Relationships>` },
    { name: 'word/styles.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="24"/><w:lang w:val="en-US" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="60"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>` },
    { name: 'word/document.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${bodyXml}${sect}</w:body></w:document>` },
    ...extraFiles,
  ]);
}
function wPara(text, { bold = false, size = 22, center = false, color = '' } = {}) {
  const rtl = LANG === 'ar';
  return `<w:p><w:pPr>${rtl ? '<w:bidi/>' : ''}<w:jc w:val="${center ? 'center' : 'start'}"/></w:pPr><w:r><w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}${rtl ? '<w:rtl/>' : ''}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r></w:p>`;
}
function buildDOCXTable(title, headers, rows, p) {
  const rtl = LANG === 'ar'; const st = S();
  const [pw, ph] = p.paper; const usable = Math.round(((p.landscape ? ph : pw) - 2 * p.margin) * MM_TW);
  const lens = headers.map((h, c) => Math.min(30, Math.max(4, String(h).length, ...rows.map(r => String(r[c] ?? '').length))));
  const sum = lens.reduce((a, b) => a + b, 0); const cw = lens.map(l => Math.max(500, Math.floor(usable * l / sum)));
  const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(s => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFC5D2"/>`).join('') + '</w:tblBorders>';
  const tc = (txt, i, hdr) => `<w:tc><w:tcPr><w:tcW w:w="${cw[i]}" w:type="dxa"/>${hdr ? '<w:shd w:val="clear" w:color="auto" w:fill="E0E7FF"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${wPara(txt, { bold: hdr, size: 20, center: hdr })}</w:tc>`;
  const trs = [`<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers.map((h, i) => tc(h, i, true)).join('')}</w:tr>`, ...rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${headers.map((_, i) => tc(r[i], i, false)).join('')}</w:tr>`)].join('');
  const body = `${wPara(loc(st, 'schoolName') || '', { bold: true, size: 30, center: true, color: '312E81' })}${wPara(title, { bold: true, size: 26, center: true })}${wPara(`${t('f_year')}: ${st.year || ''}   ·   ${fmtDate(today())}`, { size: 20, center: true, color: '555555' })}<w:p/><w:tbl><w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/>${rtl ? '<w:bidiVisual/>' : ''}${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cw.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${trs}</w:tbl>`;
  return docxPackage(body, p);
}
/* A printable document (report card, invoice, receipt…) as an editable Word file: the page HTML is converted to native Word paragraphs and tables. */
function buildDOCXHtml(html, p) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const [pw, ph] = p.paper; const usable = Math.round(((p.landscape ? ph : pw) - 2 * p.margin) * MM_TW); const rtl = LANG === 'ar';
  const txt = n => (n.textContent || '').replace(/\s+/g, ' ').trim();
  const joined = n => Array.from(n.children).filter(c => !/^(svg|button|script|style)$/i.test(c.tagName)).map(txt).filter(Boolean).join(': ') || txt(n);
  const tbl = (rows, borders, shadeHead) => {
    const cols = Math.max(1, ...rows.map(r => r.reduce((a, c) => a + (c.span || 1), 0))); const cw = Math.floor(usable / cols);
    const bd = borders ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(x => `<w:${x} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`).join('') + '</w:tblBorders>' : '';
    const trs = rows.map(r => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map(c => `<w:tc><w:tcPr><w:tcW w:w="${cw * (c.span || 1)}" w:type="dxa"/>${c.span > 1 ? `<w:gridSpan w:val="${c.span}"/>` : ''}${c.head && shadeHead ? '<w:shd w:val="clear" w:color="auto" w:fill="E0E7FF"/>' : ''}<w:vAlign w:val="center"/></w:tcPr>${wPara(c.text, { bold: c.head, size: 20, center: borders })}</w:tc>`).join('')}</w:tr>`).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/>${rtl ? '<w:bidiVisual/>' : ''}${bd}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>${trs}</w:tbl><w:p/>`;
  };
  const out = [];
  const walk = node => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase(); const cls = el.className && el.className.baseVal === undefined ? String(el.className) : '';
      if (/^(svg|button|script|style|img)$/.test(tag)) continue;
      if (/\bpbreak\b/.test(cls)) { out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>'); continue; }
      if (tag === 'table') {
        const rows = Array.from(el.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(c => ({ text: txt(c), head: c.tagName === 'TH', span: +c.getAttribute('colspan') || 1 })));
        if (rows.length) out.push(tbl(rows, true, true)); continue;
      }
      if (/\b(psign|ptotals)\b/.test(cls)) { const cells = Array.from(el.children).map(c => ({ text: joined(c) })); if (cells.length) out.push(tbl([cells], false, false)); continue; }
      if (/\bkv\b/.test(cls)) { out.push(wPara(joined(el), { size: 22 })); continue; }
      if (/^h[1-6]$/.test(tag)) { out.push(wPara(txt(el), { bold: true, size: tag === 'h1' || tag === 'h2' ? 30 : 24, center: /\b(ph|rcard|cert)/.test(el.parentElement.className) })); continue; }
      const hasBlocks = Array.from(el.children).some(c => /^(div|table|h[1-6]|p|section|ul|ol)$/i.test(c.tagName));
      if (hasBlocks) { walk(el); continue; }
      if (/\bpamount\b/.test(cls)) { out.push(wPara(txt(el), { bold: true, size: 30, center: true })); continue; }
      const t = /\bph-gov\b/.test(cls) ? Array.from(el.children).map(txt).filter(Boolean) : [joined(el)];
      t.forEach(x => x && out.push(wPara(x, { bold: /\b(ph-gov|ph-end)\b/.test(cls) || tag === 'b' || tag === 'strong', center: /\bph-gov\b/.test(cls) })));
    }
  };
  walk(doc.body);
  return docxPackage(out.join('') || wPara(txt(doc.body)), p);
}

/* ----- options (paper / orientation / margins), remembered ----- */
const PAPERS = { A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [216, 279] };
const OUT = {
  pref() { let o = {}; try { o = JSON.parse(localStorage.getItem('dalala.out') || '{}'); } catch (e) { /* ignore */ } return { paper: PAPERS[o.paper] ? o.paper : 'A4', orient: ['auto', 'portrait', 'landscape'].includes(o.orient) ? o.orient : 'auto', margin: [8, 14, 20].includes(+o.margin) ? +o.margin : 14 }; },
  save(o) { try { localStorage.setItem('dalala.out', JSON.stringify(o)); } catch (e) { /* ignore */ } },
  resolve(o, wide) { return { paperName: o.paper, paper: PAPERS[o.paper], landscape: o.orient === 'landscape' || (o.orient === 'auto' && !!wide), margin: o.margin }; },
};
function tableHTML(headers, rows) {
  return `<table class="ptable small"><thead><tr><th>#</th>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td>${headers.map((_, c) => `<td>${esc(r[c] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
function safeName(n) { return String(n || 'export').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'export'; }

/* ----- actions ----- */
function pageStyle(p) {
  const [w, h] = p.paper; const el = document.createElement('style'); el.id = 'pg-style';
  el.textContent = `@media print{@page{size:${p.landscape ? h : w}mm ${p.landscape ? w : h}mm;margin:${p.margin}mm}}`;
  document.head.appendChild(el);
}
function outPrint(html, p) {
  const pa = $('#print-area'); pa.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr'); pa.innerHTML = html;
  const old = $('#pg-style'); if (old) old.remove(); pageStyle(p);
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 60);
}
async function outPDF(html, p, name) {
  if (window.dalalaPrint && window.dalalaPrint.pdf) {
    const pa = $('#print-area'); pa.setAttribute('dir', LANG === 'ar' ? 'rtl' : 'ltr'); pa.innerHTML = html;
    const old = $('#pg-style'); if (old) old.remove(); pageStyle(p);
    document.body.classList.add('printing');
    try {
      await new Promise(r => setTimeout(r, 120));
      const r = await window.dalalaPrint.pdf({ name: safeName(name) + '-' + today(), widthMM: p.paper[0], heightMM: p.paper[1], landscape: p.landscape, marginMM: p.margin });
      if (r && r.ok) toast(t('outPdfSaved')); else if (r && !r.canceled) toast(t('outFailed'), 'err');
    } finally { document.body.classList.remove('printing'); pa.innerHTML = ''; const s = $('#pg-style'); if (s) s.remove(); }
  } else { toast(t('outPdfHint')); outPrint(html, p); } // browser: the print dialog has «Save as PDF»
}
const OUT_MIME = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };

/* The dialog. spec = { name, title, html?, headers?, rows?, wide? } — with headers/rows it is a table (Excel/CSV offered). */
function outputDialog(spec) {
  const isTable = Array.isArray(spec.headers); const pref = OUT.pref();
  const sel = (id, opts, cur) => `<select id="${id}" class="input">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const btn = (act, ic, lbl, cls = 'ghost') => `<button class="btn ${cls} out-btn" data-out="${act}">${icon(ic)}<span>${lbl}</span></button>`;
  const root = modal({
    title: `${icon('printer')} ${esc(spec.title || t('outTitle'))}`, size: 'sm',
    body: `<div class="out-opts">
      <label>${t('outPaper')}${sel('out-paper', Object.keys(PAPERS).map(k => [k, k]), pref.paper)}</label>
      <label>${t('outOrient')}${sel('out-orient', [['auto', t('outAuto')], ['portrait', t('outPortrait')], ['landscape', t('outLandscape')]], pref.orient)}</label>
      <label>${t('outMargin')}${sel('out-margin', [[8, t('outNarrow')], [14, t('outNormal')], [20, t('outWide')]], pref.margin)}</label></div>
      <div class="out-grid">${btn('print', 'printer', t('outPrint'), 'primary')}${btn('pdf', 'download', t('outPdf'))}${btn('docx', 'download', t('outWord'))}${isTable ? btn('xlsx', 'download', t('outExcel')) + btn('csv', 'download', 'CSV') : ''}</div>`,
  });
  const read = () => { const o = { paper: $('#out-paper', root).value, orient: $('#out-orient', root).value, margin: +$('#out-margin', root).value }; OUT.save(o); return o; };
  const header = () => printHeader(spec.title || spec.name);
  const html = () => isTable ? `${header()}${tableHTML(spec.headers, spec.rows)}` : spec.html;
  const wide = () => isTable ? spec.headers.length > 7 : !!spec.wide;
  const nm = safeName(spec.name || spec.title);
  root.firstElementChild.addEventListener('click', async e => { // the dialog element is new each time (the modal root is shared)
    const b = e.target.closest('[data-out]'); if (!b) return;
    const act = b.dataset.out; const o = read(); const p = OUT.resolve(o, wide());
    closeModal();
    try {
      if (act === 'print') outPrint(html(), p);
      else if (act === 'pdf') await outPDF(html(), p, nm);
      else if (act === 'xlsx') downloadFile(`${nm}-${today()}.xlsx`, buildXLSX(spec.title || spec.name, spec.headers, spec.rows), OUT_MIME.xlsx);
      else if (act === 'csv') csvFile(nm, spec.headers, spec.rows);
      else if (act === 'docx') downloadFile(`${nm}-${today()}.docx`, isTable ? buildDOCXTable(spec.title || spec.name, spec.headers, spec.rows, p) : buildDOCXHtml(html(), p), OUT_MIME.docx);
    } catch (err) { toast(t('outFailed'), 'err'); }
  });
}
