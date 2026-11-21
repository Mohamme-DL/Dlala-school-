/* Dalala — shared database server for several computers on one network (runs on the main computer).
   - Stores the whole database in one JSON file (atomic writes + daily backups).
   - Clients send record-level changes ({col, put, del} / {obj, value}); the server applies them and
     keeps a change log so other computers receive only what changed (long-polling).
   - Document numbers (S-000123…) and auto codes are made unique here, so two cashiers saving at
     the same moment never get the same number.
   - Every request needs the pairing key (x-dalala-key header).
   - Optional product rules (netrules.js): put(col, rec, ctx) / obj(name, incoming, current, ctx) hooks
     for things like daily order numbers; op.inc = { id: { field: delta } } adds to counters such as
     stock instead of overwriting them, so two cashiers selling the same item never lose a sale. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NUMBERED = { number: true, code: true, receiptNo: true, voucherNo: true }; // fields that must stay unique across computers
const AUTO_CODE = /^([A-Za-z]+-)(\d+)$/;
const LOG_MAX = 5000;
const FILE_MAX = 40 * 1024 * 1024;


/* ================= who may do what (enforced here, not only in the app) =================
   Every request after sign-in carries a session token. The server knows the user and his permissions
   (account type defaults, or the custom list the administrator set) and:
     - refuses writes the user has no right to,
     - never sends money / payroll / admissions / documents / other users' accounts / password data
       to users who may not see them,
     - keeps password data (hash, the copy encrypted for the main administrator) away from everyone else. */
const ADMIN_ONLY = ['users', 'settings'];
const ROLE_PERMS = {
  clerk: ['v:dashboard', 'v:students', 'v:admissions', 'v:attendance', 'v:behavior', 'v:classes', 'v:subjects', 'v:timetable', 'v:reportcards', 'v:certificates', 'v:announcements', 'v:calendar', 'v:docs', 'e:students', 'e:admissions', 'e:attendance', 'e:docs'],
  teacher: ['v:dashboard', 'v:students', 'v:attendance', 'v:behavior', 'v:classes', 'v:subjects', 'v:timetable', 'v:exams', 'v:marks', 'v:reportcards', 'v:homework', 'v:announcements', 'v:calendar', 'e:exams', 'e:homework', 'e:behavior', 'e:attendance', 'e:marks'],
  accountant: ['v:dashboard', 'v:students', 'v:payroll', 'v:salaryPays', 'v:invoices', 'v:payments', 'v:feeTypes', 'v:treasury', 'v:announcements', 'v:calendar', 'v:reports', 'v:docs', 'e:feeTypes', 'e:invoices', 'e:payments', 'e:payroll', 'e:salaryPays'],
  librarian: ['v:dashboard', 'v:books', 'v:loans', 'v:announcements', 'v:calendar', 'e:books', 'e:loans'],
};
const MONEY = ['invoices', 'payments', 'feeTypes', 'treasury', 'reports'], PAYROLL = ['payroll', 'salaryPays', 'treasury'];
const READ_NEEDS = { invoices: MONEY, payments: MONEY, feeTypes: MONEY, payroll: PAYROLL, salaryPays: PAYROLL, admissions: ['admissions'], docs: ['docs'], waLog: ['messages'] };
const OPEN_COLS = ['students', 'employees', 'classes', 'subjects', 'exams', 'homework', 'behavior', 'books', 'loans', 'buses', 'announcements', 'events'];
const OPEN_OBJS = ['att', 'marks', 'tt', 'settings'];
const WRITE_COL = { students: 'students', employees: 'employees', classes: 'classes', subjects: 'subjects', exams: 'exams', homework: 'homework', behavior: 'behavior', admissions: 'admissions', feeTypes: 'feeTypes', invoices: 'invoices', payments: 'payments', books: 'books', loans: 'loans', buses: 'buses', announcements: 'announcements', events: 'events', payroll: 'payroll', salaryPays: 'salaryPays', docs: 'docs' };
const WRITE_OBJ = { att: 'attendance', marks: 'marks' };
const SELF_FIELDS = ['pwHash', 'pwEnc', 'password'];            // what any user may change on his own account

function customPerms(u) { if (!u || !u.perms) return null; try { const a = typeof u.perms === 'string' ? JSON.parse(u.perms) : u.perms; return Array.isArray(a) ? a : null; } catch (e) { return null; } }
function can(u, p) {
  if (!u) return false; if (u.role === 'admin') return true;
  if (ADMIN_ONLY.includes(p.slice(2))) return false;
  return (customPerms(u) || ROLE_PERMS[u.role] || []).includes(p);
}
const canViewAny = (u, list) => list.some(s => can(u, 'v:' + s));
function usersOf(data) { return Array.isArray(data && data.users) ? data.users : []; }
/* the main administrator: the account flagged main, or (until one is flagged) the first administrator */
function mainOf(data) { const us = usersOf(data); return us.find(x => x.main) || us.find(x => x.role === 'admin') || null; }
const isMain = (u, data) => !!u && u.role === 'admin' && (mainOf(data) || {}).id === u.id;

/* ---- what a user may receive ---- */
function cleanUser(rec, viewer, data) {
  const r = { ...rec }; const own = rec.id === viewer.id, main = isMain(viewer, data);
  if (!main) { delete r.pwEnc; delete r.password; if (!own) delete r.pwHash; } else if (!own) delete r.pwHash;
  return r;
}
function cleanEmployee(rec, viewer) { if (canViewAny(viewer, ['employees', 'payroll', 'salaryPays']) || can(viewer, 'e:employees')) return rec; const r = { ...rec }; delete r.salary; return r; }
function cleanSettings(obj, viewer, data) {
  if (!obj || typeof obj !== 'object') return obj; const o = { ...obj };
  if (!o.adminKey) return o;
  if (isMain(viewer, data)) return o;
  if (viewer.role === 'admin') o.adminKey = { pub: o.adminKey.pub }; else delete o.adminKey;
  return o;
}
function readableCol(viewer, col) { if (viewer.role === 'admin') return true; if (col === 'users') return true; if (READ_NEEDS[col]) return canViewAny(viewer, READ_NEEDS[col]); return OPEN_COLS.includes(col); }
function filterRecords(col, recs, viewer, data) {
  if (col === 'users') return viewer.role === 'admin' ? recs.map(r => cleanUser(r, viewer, data)) : recs.filter(r => r.id === viewer.id).map(r => cleanUser(r, viewer, data));
  if (col === 'employees') return recs.map(r => cleanEmployee(r, viewer));
  return recs;
}
function filterData(data, viewer) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (k === 'version') { out[k] = v; continue; }
    if (Array.isArray(v)) { if (readableCol(viewer, k)) out[k] = filterRecords(k, v, viewer, data); else if (WRITE_COL[k] || k === 'users') out[k] = []; continue; }
    if (v && typeof v === 'object') { if (k === 'settings') out[k] = cleanSettings(v, viewer, data); else if (viewer.role === 'admin' || OPEN_OBJS.includes(k)) out[k] = v; continue; }
    out[k] = v;
  }
  return out;
}
function filterOps(ops, viewer, data) {
  const out = [];
  for (const op of ops || []) {
    if (op.obj) {
      if (!(viewer.role === 'admin' || OPEN_OBJS.includes(op.obj))) continue;
      if (op.obj === 'settings') {
        const c = { ...op }, main = isMain(viewer, data);
        if (c.value) c.value = cleanSettings(c.value, viewer, data);
        if (c.patch && 'adminKey' in c.patch) { c.patch = { ...c.patch }; if (!main) { if (viewer.role === 'admin' && c.patch.adminKey) c.patch.adminKey = { pub: c.patch.adminKey.pub }; else delete c.patch.adminKey; } }
        if (!main && c.unset) c.unset = c.unset.filter(k => k !== 'adminKey');
        out.push(c);
      } else out.push(op);
      continue;
    }
    if (!op.col || !readableCol(viewer, op.col)) continue;
    if (op.col === 'users' && viewer.role !== 'admin') { const put = filterRecords('users', op.put || [], viewer, data); const del = (op.del || []).filter(id => id === viewer.id); if (put.length || del.length) out.push({ ...op, put, del }); continue; }
    out.push({ ...op, put: filterRecords(op.col, op.put || [], viewer, data) });
  }
  return out;
}

/* ---- what a user may write; returns { ops } (cleaned) or { error } ---- */
function authorizeOps(ops, viewer, data) {
  const out = []; const forbid = what => ({ error: 'forbidden', what });
  for (const raw of ops || []) {
    const op = { ...raw };
    if (op.obj) {
      if (/^__/.test(op.obj) || op.obj === 'version') continue;
      if (op.obj === 'settings') {
        if (viewer.role !== 'admin') return forbid('settings');
        if (!isMain(viewer, data)) { if (op.patch && 'adminKey' in op.patch) { op.patch = { ...op.patch }; delete op.patch.adminKey; } if (op.unset) op.unset = op.unset.filter(k => k !== 'adminKey'); if (op.value) return forbid('settings'); }
      } else if (WRITE_OBJ[op.obj]) { if (!can(viewer, 'e:' + WRITE_OBJ[op.obj])) return forbid(op.obj); }
      else if (viewer.role !== 'admin') return forbid(op.obj);
      out.push(op); continue;
    }
    if (!op.col || /^__/.test(op.col)) continue;
    const old = Array.isArray(data && data[op.col]) ? data[op.col] : [];
    const oldBy = new Map(old.map(r => [r.id, r]));
    if (op.col === 'users') {
      const main = isMain(viewer, data); const put = [];
      if (viewer.role !== 'admin') {
        if ((op.del || []).length) return forbid('users');
        for (const r of op.put || []) { if (!r || r.id !== viewer.id || !oldBy.get(r.id)) return forbid('users'); const merged = { ...oldBy.get(r.id) }; for (const f of SELF_FIELDS) if (f in r) merged[f] = r[f]; put.push(merged); }
        out.push({ ...op, put, del: [] }); continue;
      }
      const mainId = (mainOf(data) || {}).id; const nobodyMain = !usersOf(data).some(x => x.main);
      for (const r0 of op.put || []) {
        if (!r0 || !r0.id) continue; const o = oldBy.get(r0.id); const r = { ...r0 };
        if (o && o.id === mainId && !main) return forbid('main administrator');
        if (o) { for (const f of ['pwHash', 'pwEnc', 'password']) if (!(f in r) && f in o) r[f] = o[f]; }
        if (!main) { if (o && o.main) r.main = true; else if (nobodyMain && r.id === viewer.id) r.main = !!r.main; else delete r.main; }
        else if (!('main' in r) && o && 'main' in o) r.main = o.main;
        put.push(r);
      }
      const del = (op.del || []).filter(id => id !== mainId && id !== viewer.id);
      if ((op.del || []).some(id => id === mainId)) return forbid('main administrator');
      out.push({ ...op, put, del }); continue;
    }
    if (op.col === 'waLog') { out.push(op); continue; }
    const sec = WRITE_COL[op.col];
    if (!sec) { if (viewer.role !== 'admin') return forbid(op.col); out.push(op); continue; }
    if (!can(viewer, 'e:' + sec)) return forbid(op.col);
    if (op.col === 'employees') op.put = (op.put || []).map(r => { const o = oldBy.get(r.id); if (o && !('salary' in r) && 'salary' in o) return { ...r, salary: o.salary }; return r; });
    out.push(op);
  }
  return { ops: out };
}

function createServer({ port, key, dir, onEvent = () => {}, rules = {} }) {
  const file = path.join(dir, 'shared-db.json');
  const backups = path.join(dir, 'backups');
  const jfile = path.join(dir, 'journal.ndjson'); // every confirmed change is written here first (durability)
  let state = { version: 0, data: null };
  try { state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* new database */ }
  const log = []; // { v, clientId, ops }
  /* apply already-processed changes (from the journal) to the state */
  function applyChanges(changes) {
    if (!state.data) state.data = {};
    for (const op of changes) {
      if (op.obj) { if (op.value !== undefined) state.data[op.obj] = op.value; else { const o = state.data[op.obj] = { ...(state.data[op.obj] || {}), ...(op.patch || {}) }; (op.unset || []).forEach(k => delete o[k]); } continue; }
      let arr = Array.isArray(state.data[op.col]) ? state.data[op.col] : []; if (op.del && op.del.length) { const ds = new Set(op.del); arr = arr.filter(r => !ds.has(r.id)); }
      const idx = new Map(arr.map((r, i) => [r.id, i])); for (const r of op.put || []) { if (idx.has(r.id)) arr[idx.get(r.id)] = r; else { idx.set(r.id, arr.length); arr.push(r); } }
      state.data[op.col] = arr;
    }
  }
  // replay changes that were confirmed after the last snapshot (power cut / crash)
  try {
    const lines = fs.readFileSync(jfile, 'utf8').split('\n').filter(Boolean); let n = 0;
    for (const line of lines) { let e; try { e = JSON.parse(line); } catch (x) { break; } if (e.v > state.version) { applyChanges(e.ops); state.version = e.v; log.push({ v: e.v, clientId: e.c || '', ops: e.ops }); n++; } }
    if (n) onEvent('recovered', n);
  } catch (e) { /* no journal */ }
  const waiters = new Set();
  /* ---- sessions (token -> user), kept in a small file so a restart does not sign everybody out ---- */
  const sfile = path.join(dir, 'sessions.json'); let sessions = new Map();
  try { sessions = new Map(Object.entries(JSON.parse(fs.readFileSync(sfile, 'utf8')))); } catch (e) { /* none yet */ }
  const saveSessions = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(sfile, JSON.stringify(Object.fromEntries(sessions))); } catch (e) { onEvent('error', 'sessions: ' + e.message); } };
  const fails = new Map(); // ip|user -> { n, until }
  const pbk = (pw, salt) => new Promise((res, rej) => crypto.pbkdf2(pw, salt, 150000, 32, 'sha256', (e, k) => (e ? rej(e) : res(k))));
  async function checkPassword(u, pw) {
    if (u.pwHash) { const [v, s, h] = String(u.pwHash).split('$'); if (v !== 'p1' || !s || !h) return false; const d = (await pbk(String(pw), Buffer.from(s, 'base64'))).toString('base64'); return d.length === h.length && crypto.timingSafeEqual(Buffer.from(d), Buffer.from(h)); }
    if (u.password) { const a = Buffer.from(String(u.password)), b = Buffer.from(String(pw)); return a.length === b.length && crypto.timingSafeEqual(a, b); }
    return false;
  }
  const clients = new Map(); // clientId -> { name, lastSeen, ip }
  let saveTimer = null;
  const mem = {}; // scratch memory for product rules (e.g. renumbered orders)

  let jfd = null;
  function journal(entry) { // append + flush to disk before the change is confirmed to the computer that sent it
    try { fs.mkdirSync(dir, { recursive: true }); if (jfd === null) jfd = fs.openSync(jfile, 'a'); fs.writeSync(jfd, JSON.stringify(entry) + '\n'); fs.fdatasyncSync(jfd); }
    catch (e) { onEvent('error', 'journal: ' + e.message); }
  }
  function snapshotNow() {
    clearTimeout(saveTimer); saveTimer = null;
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, file);
    try { if (jfd !== null) { fs.closeSync(jfd); jfd = null; } fs.writeFileSync(jfile, ''); } catch (e) { /* ignore */ } // the snapshot now holds everything
  }
  if (log.length) { try { snapshotNow(); } catch (e) { onEvent('error', e.message); } }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        snapshotNow();
        const day = new Date().toISOString().slice(0, 10); const bk = path.join(backups, `shared-${day}.json`);
        if (!fs.existsSync(bk)) { fs.mkdirSync(backups, { recursive: true }); fs.copyFileSync(file, bk);
          fs.readdirSync(backups).filter(f => f.startsWith('shared-')).sort().slice(0, -30).forEach(f => fs.rmSync(path.join(backups, f), { force: true })); }
      } catch (e) { onEvent('error', e.message); }
    }, 250);
  }
  function nextNumber(arr, field, value) {
    const m = String(value).match(AUTO_CODE); if (!m) return null;
    const prefix = m[1], width = m[2].length;
    const max = arr.reduce((mx, r) => { const mm = String(r[field] || '').match(AUTO_CODE); return mm && mm[1] === prefix ? Math.max(mx, +mm[2]) : mx; }, 0);
    return prefix + String(max + 1).padStart(width, '0');
  }
  function apply(ops, clientId) {
    if (!state.data) state.data = {};
    const changes = []; const touched = new Set(); const patched = new Map(); // obj -> { patch, unset }
    const ctx = { data: state.data, mem, touch: name => touched.add(name) };
    const r6 = n => Math.round(n * 1e6) / 1e6;
    for (const op of ops || []) {
      if (op.obj) {
        if (op.obj === 'version' || /^__/.test(op.obj)) continue;
        const cur = state.data[op.obj];
        const isPatch = !!(op.patch || op.unset);
        let val = isPatch ? { ...(cur && typeof cur === 'object' ? cur : {}), ...(op.patch || {}) } : op.value;
        if (isPatch) for (const k of op.unset || []) delete val[k];
        if (rules.obj) { const r = rules.obj(op.obj, val, cur, ctx); if (r) { val = r; touched.add(op.obj); } }
        state.data[op.obj] = val;
        if (isPatch) { const p = patched.get(op.obj) || { patch: {}, unset: [] }; Object.assign(p.patch, op.patch || {}); for (const k of op.unset || []) { delete p.patch[k]; p.unset.push(k); } patched.set(op.obj, p); }
        else touched.add(op.obj);
        continue;
      }
      if (!op.col || /^__/.test(op.col)) continue;
      const arr = state.data[op.col] = Array.isArray(state.data[op.col]) ? state.data[op.col] : [];
      const index = new Map(arr.map((r, i) => [r.id, i]));
      const del = (op.del || []).filter(id => index.has(id));
      if (del.length) { const ds = new Set(del); state.data[op.col] = arr.filter(r => !ds.has(r.id)); }
      const target = state.data[op.col]; const idx = new Map(target.map((r, i) => [r.id, i]));
      const put = [];
      for (const rec of op.put || []) {
        if (!rec || !rec.id) continue;
        const inc = op.inc && op.inc[rec.id];
        if (inc && idx.has(rec.id)) { const old = target[idx.get(rec.id)]; for (const [f, d] of Object.entries(inc)) if (typeof old[f] === 'number' && typeof d === 'number') rec[f] = r6(old[f] + d); }
        if (rules.put) rules.put(op.col, rec, ctx);
        for (const f of Object.keys(NUMBERED)) { // keep numbers/codes unique across computers
          if (rec[f] && AUTO_CODE.test(String(rec[f])) && target.some(r => r[f] === rec[f] && r.id !== rec.id)) { const n = nextNumber(target, f, rec[f]); if (n) rec[f] = n; }
        }
        if (idx.has(rec.id)) target[idx.get(rec.id)] = rec; else { idx.set(rec.id, target.length); target.push(rec); }
        put.push(rec);
      }
      if (put.length || del.length) changes.push({ col: op.col, put, del });
    }
    // whole value when replaced or changed by a rule; otherwise only the changed keys (attendance, marks… stay small)
    for (const name of touched) changes.push({ obj: name, value: state.data[name] });
    for (const [name, p] of patched) if (!touched.has(name)) changes.push({ obj: name, patch: p.patch, unset: p.unset });
    if (!changes.length) return { version: state.version, changes: [] };
    state.version++;
    journal({ v: state.version, c: clientId, ops: changes });
    log.push({ v: state.version, clientId, ops: changes }); if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
    persist();
    for (const w of waiters) w(); waiters.clear();
    return { version: state.version, changes };
  }
  const since = v => (log.length && log[0].v <= v + 1) || v === state.version ? { version: state.version, entries: log.filter(e => e.v > v) } : null;

  const server = http.createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, x-dalala-key, x-dalala-client, x-dalala-token', 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') return send(204, {});
    const url = new URL(req.url, 'http://x');
    const okKey = (() => { const k = String(req.headers['x-dalala-key'] || ''); return k.length === key.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(key)); })();
    if (url.pathname === '/api/ping') return send(200, { ok: true, app: 'dalala', version: state.version, keyOk: okKey });
    if (!okKey) return send(401, { error: 'key' });
    const cid = String(req.headers['x-dalala-client'] || '');
    if (cid) clients.set(cid, { ...(clients.get(cid) || {}), lastSeen: Date.now(), ip: req.socket.remoteAddress, name: url.searchParams.get('name') || (clients.get(cid) || {}).name || '' });
    const readJson = cb => { let body = ''; req.setEncoding('utf8'); req.on('data', c => { body += c; if (body.length > 64 * 1024) req.destroy(); }); req.on('end', () => { let m; try { m = JSON.parse(body || '{}'); } catch (e) { return send(400, { error: 'json' }); } cb(m); }); };
    const me = () => { const tok = String(req.headers['x-dalala-token'] || ''); const s = tok && sessions.get(tok); if (!s || s.exp < Date.now()) return null; const u = usersOf(state.data).find(x => x.id === s.uid); return u && u.active !== false && u.role !== 'parent' ? u : null; };
    if (url.pathname === '/api/status') return send(200, { hasData: !!(state.data && usersOf(state.data).length) });
    if (req.method === 'POST' && url.pathname === '/api/login') {
      readJson(async m => {
        const name = String(m.username || '').trim().toLowerCase(), fk = (req.socket.remoteAddress || '') + '|' + name, f = fails.get(fk);
        if (f && f.until > Date.now()) return send(429, { error: 'slow' });
        const u = usersOf(state.data).find(x => x.username && String(x.username).toLowerCase() === name && x.active !== false && x.role !== 'parent');
        let ok = false; try { ok = !!u && await checkPassword(u, m.password); } catch (e) { ok = false; }
        if (!ok) { const n = (f ? f.n : 0) + 1; fails.set(fk, { n, until: n >= 8 ? Date.now() + 60000 : 0 }); await new Promise(r => setTimeout(r, 300)); return send(401, { error: 'login' }); }
        fails.delete(fk);
        const token = crypto.randomBytes(24).toString('base64url'); sessions.set(token, { uid: u.id, exp: Date.now() + 14 * 864e5 });
        for (const [t, s] of sessions) if (s.exp < Date.now()) sessions.delete(t);
        saveSessions(); onEvent('login', u.username); return send(200, { token, userId: u.id });
      });
      return undefined;
    }
    if (req.method === 'POST' && url.pathname === '/api/logout') { sessions.delete(String(req.headers['x-dalala-token'] || '')); saveSessions(); return send(200, { ok: true }); }
    const needAuth = !(req.method === 'POST' && url.pathname === '/api/init');
    const viewer = needAuth ? me() : null;
    if (needAuth && !viewer) return send(401, { error: 'auth' });
    if (req.method === 'GET' && url.pathname === '/api/snapshot') return send(200, { version: state.version, data: filterData(state.data, viewer) });
    if (req.method === 'GET' && url.pathname === '/api/changes') {
      const v = +url.searchParams.get('since') || 0; const wait = url.searchParams.get('wait') === '1';
      const reply = () => { const r = since(v); return r ? send(200, { version: r.version, entries: r.entries.map(e => ({ ...e, ops: filterOps(e.ops, viewer, state.data) })) }) : send(200, { reset: true, version: state.version }); };
      if (!wait || state.version > v) return reply();
      let done = false; const fire = () => { if (done) return; done = true; clearTimeout(tm); waiters.delete(fire); reply(); };
      const tm = setTimeout(fire, 25000); waiters.add(fire); req.on('close', () => { done = true; clearTimeout(tm); waiters.delete(fire); });
      return undefined;
    }
    if (req.method === 'POST' && (url.pathname === '/api/apply' || url.pathname === '/api/init')) {
      let body = ''; req.setEncoding('utf8');
      req.on('data', c => { body += c; if (body.length > 200 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        let msg; try { msg = JSON.parse(body || '{}'); } catch (e) { return send(400, { error: 'json' }); }
        if (url.pathname === '/api/init') {
          if (state.data && Object.keys(state.data).length) { const a = me(); if (!(msg.force && a && a.role === 'admin')) return send(409, { error: 'exists', version: state.version }); }
          state.data = msg.data || {}; state.version++; log.length = 0; try { snapshotNow(); } catch (e) { onEvent('error', e.message); } for (const w of waiters) w(); waiters.clear();
          onEvent('init', cid); return send(200, { version: state.version });
        }
        const a = authorizeOps(msg.ops, viewer, state.data); if (a.error) return send(403, a);
        const r = apply(a.ops, cid); return send(200, { version: r.version, changes: filterOps(r.changes, viewer, state.data) });
      });
      return undefined;
    }
    /* scanned documents / photos: binary files kept next to the database (not inside the JSON) */
    const fm = url.pathname.match(/^\/api\/file\/([A-Za-z0-9_-]{4,64})$/);
    if (fm) {
      const fdir = path.join(dir, 'files'), fp = path.join(fdir, fm[1]);
      if (req.method === 'GET') { try { const b = fs.readFileSync(fp); res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': b.length, 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); return res.end(b); } catch (e) { return send(404, { error: 'not found' }); } }
      const mayWrite = can(viewer, 'e:docs') || can(viewer, 'e:students') || can(viewer, 'e:employees');
      if ((req.method === 'PUT' || req.method === 'DELETE') && !mayWrite) return send(403, { error: 'forbidden' });
      if (req.method === 'DELETE') { try { fs.rmSync(fp, { force: true }); } catch (e) { /* ignore */ } return send(200, { ok: true }); }
      if (req.method === 'PUT') {
        const chunks = []; let n = 0, dead = false;
        req.on('data', c => { n += c.length; if (n > FILE_MAX) { dead = true; send(413, { error: 'too big' }); req.destroy(); } else chunks.push(c); });
        req.on('end', () => { if (dead) return; try { fs.mkdirSync(fdir, { recursive: true }); const tmp = fp + '.tmp'; fs.writeFileSync(tmp, Buffer.concat(chunks)); fs.renameSync(tmp, fp); send(200, { ok: true, size: n }); } catch (e) { send(500, { error: e.message }); } });
        return undefined;
      }
    }
    return send(404, { error: 'not found' });
  });
  return {
    listen: () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', () => resolve()); }),
    close: () => new Promise(r => { try { if (saveTimer || jfd !== null) snapshotNow(); } catch (e) { onEvent('error', e.message); } for (const w of waiters) w(); server.close(() => r()); }),
    flush: () => { try { snapshotNow(); } catch (e) { onEvent('error', e.message); } },
    status: () => ({ version: state.version, hasData: !!state.data, clients: [...clients.entries()].map(([id, c]) => ({ id, ...c, online: Date.now() - c.lastSeen < 60000 })), file }),
  };
}
function newKey() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = crypto.randomBytes(8); return [...b].map(x => A[x % 32]).join('').replace(/(.{4})/, '$1-'); }
module.exports = { createServer, newKey };
