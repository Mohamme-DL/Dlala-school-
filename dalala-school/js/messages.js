/* Dalala School — WhatsApp messages to parents (meeting invitation, summons, results, absence, fees, custom) */
'use strict';

const WA_TYPES = ['meeting', 'summon', 'results', 'absence', 'fees', 'custom'];
const WA_VARS = {
  meeting: '{guardian} {student} {date} {time} {place} {school}', summon: '{guardian} {student} {class} {date} {time} {person} {reason} {school}',
  results: '{student} {class} {term} {results} {avg} {grade} {status} {school}', absence: '{student} {class} {status} {date} {absRate} {school}',
  fees: '{student} {class} {amount} {school}', custom: '{text} {guardian} {student} {class} {school}',
};
const WA_DEFAULTS = {
  meeting: 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة: {student}\n\nتتشرف إدارة {school} بدعوتكم لحضور اجتماع أولياء الأمور\n📅 يوم {date}\n🕘 الساعة {time}\n📍 في {place}\n\nحضوركم يهمنا ويسهم في متابعة مستوى أبنائكم.\nإدارة {school}',
  summon: 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة: {student} ({class})\n\nنرجو التكرم بالحضور إلى المدرسة\n📅 يوم {date} 🕘 الساعة {time}\nلمقابلة: {person}\nبخصوص: {reason}\n\nشاكرين تعاونكم.\nإدارة {school}',
  results: 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة: {student} ({class})\n\nنتائج {term}:\n{results}\n\nالمعدل: {avg}% — التقدير: {grade}\nالنتيجة: {status}\n\nإدارة {school}',
  absence: 'السلام عليكم ورحمة الله\nنحيطكم علماً بأن الطالب/ة {student} ({class}) {status} اليوم {date}.\nنسبة الغياب حتى الآن: {absRate}%.\n\nنرجو متابعة الأمر مع المدرسة.\nإدارة {school}',
  fees: 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة: {student} ({class})\n\nنود تذكيركم بوجود رسوم دراسية مستحقة بقيمة {amount}.\nنرجو التكرم بالسداد في أقرب وقت، أو التواصل مع الحسابات.\n\nإدارة {school}',
  custom: 'السلام عليكم ورحمة الله\nولي أمر الطالب/ة: {student}\n\n{text}\n\nإدارة {school}',
};

/* ---------- variables for one student ---------- */
const guardianOf = s => (s.guardianName || '');
function studentFees(s) { return sum(DB.all('invoices').filter(i => i.studentId === s.id), invBalance); }
function waVarsFor(s, extra = {}) {
  const cls = DB.get('classes', s.classId);
  return { student: s.name, guardian: guardianOf(s), class: cls ? `${(I18N.ar.grades || [])[cls.grade - 1] || cls.grade} — ${cls.section}` : '', school: S().schoolName, ...extra };
}
function waResultsText(s, term) {
  const r = termResult(s, term);
  const lines = r.subjects.filter(x => x.p != null).map(x => `• ${x.sub.name}: ${fmtNum(x.p, 1)}% (${I18N.ar['gr_' + gradeLetter(x.p).key]})`).join('\n');
  return { results: lines || '—', avg: r.avg == null ? '—' : fmtNum(r.avg, 1), grade: r.avg == null ? '—' : I18N.ar['gr_' + gradeLetter(r.avg).key], status: r.status ? I18N.ar['res_' + r.status] : '—', term: I18N.ar['opt_term' + term] || '' };
}
function waAbsenceVars(s, date) {
  const st = DB.d.att[`${date}|${s.classId}`]?.[s.id]; const ab = absenceInfo(s.id, s.classId);
  return { status: st === 'L' ? 'تأخر عن الحضور' : st === 'E' ? 'تغيّب بعذر' : 'تغيّب عن الحضور', date: fmtDateAr(date), absRate: fmtNum(ab.absRate, 1) };
}
function fmtDateAr(d) { const prev = LANG; LANG = 'ar'; try { return fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } finally { LANG = prev; } }
function fmtTime(v) { if (!v) return ''; const [h, m] = v.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'صباحاً' : 'مساءً'}`; }
function moneyAr(n) { return `${fmtNum(n, 2)} ${S().currency || ''}`; }

/* ---------- single student (profile / portal) ---------- */
function waStudentCompose(sid) {
  const s = DB.get('students', sid); if (!s) return;
  const v = waVarsFor(s); const fees = studentFees(s); const T = today();
  const att = DB.d.att[`${T}|${s.classId}`]?.[s.id];
  const choices = [
    { label: t('wa_summon'), type: 'summon', text: waFill(waTemplate('summon'), { ...v, date: fmtDateAr(addDays(T, 1)), time: fmtTime('09:00'), person: t('principal'), reason: '...' }) },
    { label: `${t('wa_results')} — ${termName(1)}`, type: 'results', text: waFill(waTemplate('results'), { ...v, ...waResultsText(s, 1) }) },
    termResult(s, 2).avg != null ? { label: `${t('wa_results')} — ${termName(2)}`, type: 'results', text: waFill(waTemplate('results'), { ...v, ...waResultsText(s, 2) }) } : null,
    { label: t('wa_absence'), type: 'absence', text: waFill(waTemplate('absence'), { ...v, ...waAbsenceVars(s, T) }) },
    fees > 0 ? { label: `${t('wa_fees')} (${moneyText(fees)})`, type: 'fees', text: waFill(waTemplate('fees'), { ...v, amount: moneyAr(fees) }) } : null,
    { label: t('wa_custom'), type: 'custom', text: waFill(waTemplate('custom'), { ...v, text: '' }) },
  ];
  if (att === 'A' || att === 'L') choices.unshift(choices.splice(3, 1)[0]);
  waCompose({ title: s.name, to: `${guardianOf(s)} (${s.name})`, phone: s.guardianPhone, choices });
}

/* ---------- bulk page ---------- */
function renderMessages(p) {
  const type = WA_TYPES.includes(p.type) ? p.type : 'meeting'; const cid = p.class || ''; const T = today();
  const pool = DB.all('students').filter(s => s.status === 'active' && (!cid || s.classId === cid));
  const inp = (k, label, val, typ = 'text') => `<label class="sel"><span>${label}</span><input class="input sm" type="${typ}" value="${esc(p[k] ?? val)}" data-chg="nav-param" data-param="${k}"></label>`;
  let ctl = '', rows = [];
  if (type === 'meeting' || type === 'custom') {
    // one message per guardian phone (brothers and sisters share one message)
    const byPhone = new Map();
    pool.forEach(s => { const k = waPhone(s.guardianPhone) || 'x' + s.id; const g = byPhone.get(k) || { list: [], phone: s.guardianPhone, guardian: guardianOf(s) }; g.list.push(s); byPhone.set(k, g); });
    const date = p.date || addDays(T, 7), time = p.time || '10:00', place = p.place ?? 'قاعة المدرسة';
    if (type === 'meeting') ctl = inp('date', t('f_date'), date, 'date') + inp('time', t('time'), time, 'time') + inp('place', t('place'), place);
    rows = [...byPhone.values()].map(g => { const names = g.list.map(s => s.name).join('، '); const v = { ...waVarsFor(g.list[0]), student: names, date: fmtDateAr(date), time: fmtTime(time), place, text: p.text || '' };
      return { key: g.list.map(s => s.id).join(','), to: g.guardian || names, sub: names, phone: g.phone, type, text: waFill(waTemplate(type), v) }; });
  } else if (type === 'summon') {
    const date = p.date || addDays(T, 1), time = p.time || '09:00', person = p.person ?? t('principal'), reason = p.reason ?? '';
    ctl = inp('date', t('f_date'), date, 'date') + inp('time', t('time'), time, 'time') + inp('person', t('waPerson'), person) + inp('reason', t('waReason'), reason);
    rows = pool.map(s => ({ key: s.id, to: `${guardianOf(s)} (${s.name})`, sub: refLabel('classes', s.classId), phone: s.guardianPhone, type, ref: s.code,
      text: waFill(waTemplate('summon'), { ...waVarsFor(s), date: fmtDateAr(date), time: fmtTime(time), person, reason: reason || '...' }) }));
  } else if (type === 'results') {
    const term = ['1', '2'].includes(p.term) ? p.term : '1';
    ctl = `<label class="sel"><span>${t('f_term')}</span><select class="input sm" data-chg="nav-param" data-param="term">${['1', '2'].map(v => `<option value="${v}" ${term === v ? 'selected' : ''}>${termName(v)}</option>`).join('')}</select></label>`;
    rows = pool.filter(s => termResult(s, term).avg != null).map(s => { const r = waResultsText(s, term);
      return { key: s.id + term, to: `${guardianOf(s)} (${s.name})`, sub: `${refLabel('classes', s.classId)} · ${r.avg}% · ${r.status}`, phone: s.guardianPhone, type, ref: s.code, text: waFill(waTemplate('results'), { ...waVarsFor(s), ...r }) }; });
  } else if (type === 'absence') {
    const date = p.date || T;
    ctl = inp('date', t('f_date'), date, 'date');
    rows = pool.filter(s => ['A', 'L'].includes(DB.d.att[`${date}|${s.classId}`]?.[s.id])).map(s => { const v = waAbsenceVars(s, date);
      return { key: s.id + date, to: `${guardianOf(s)} (${s.name})`, sub: `${refLabel('classes', s.classId)} · ${v.status}`, phone: s.guardianPhone, type, ref: s.code, text: waFill(waTemplate('absence'), { ...waVarsFor(s), ...v }) }; });
  } else if (type === 'fees') {
    const min = +(p.min ?? 0);
    ctl = inp('min', t('waMinAmount'), min, 'number');
    rows = pool.map(s => ({ s, due: studentFees(s) })).filter(x => x.due > Math.max(0.001, min)).sort((a, b) => b.due - a.due)
      .map(({ s, due }) => ({ key: s.id, to: `${guardianOf(s)} (${s.name})`, sub: `${refLabel('classes', s.classId)} · ${moneyText(due)}`, phone: s.guardianPhone, type, ref: s.code, text: waFill(waTemplate('fees'), { ...waVarsFor(s), amount: moneyAr(due) }) }));
  }
  if (type === 'custom') ctl = `<label class="field grow"><span>${t('waCustomText')}</span><textarea class="input" rows="3" data-chg="nav-param" data-param="text" dir="auto" placeholder="${t('waCustomHint')}">${esc(p.text || '')}</textarea></label>`;
  waQueueSet(rows, JSON.stringify([type, cid, p.date, p.time, p.term, p.min, p.text, p.place, p.person, p.reason]));
  return `${pageHead(t('nav_messages'), t('sub_messages'))}
    <div class="card"><div class="tabs wrap">${WA_TYPES.map(k => `<a class="tab ${type === k ? 'on' : ''}" href="#/messages?type=${k}${cid ? '&class=' + cid : ''}">${t('wa_' + k)}</a>`).join('')}</div>
      <div class="toolbar wa-ctl"><label class="sel"><span>${t('f_classId')}</span><select class="input sm" data-chg="nav-param" data-param="class"><option value="">${t('all')}</option>${sortedClasses().map(c => `<option value="${c.id}" ${cid === c.id ? 'selected' : ''}>${esc(classLabel(c))}</option>`).join('')}</select></label>${ctl}</div>
      <div id="wa-queue">${waQueueHtml()}</div></div>
    <div class="grid-2">${card(t('waLogTitle'), waLogHtml())}${card(t('waHowTitle'), `<ol class="howto"><li>${t('waHow1')}</li><li>${t('waHow2')}</li><li>${t('waHow3')}</li><li>${t('waHow4')}</li></ol>`, can(['admin']) ? `<a class="link" href="#/settings">${t('waEditTemplates')}</a>` : '')}</div>`;
}
