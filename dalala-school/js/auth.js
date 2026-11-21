/* Dalala School System — sign-in and password protection.
   - Passwords are never stored as text: each user keeps a salted PBKDF2 hash (used to sign in) and a copy
     encrypted with the MAIN administrator's public key (RSA-OAEP).
   - The matching private key is stored locked by the main administrator's own password, so only the main
     administrator — after typing that password — can read what other users' passwords are.
   - Everything here works on the shared database too: hashes and encrypted copies sync like any record. */
'use strict';

const _enc = new TextEncoder(), _dec = new TextDecoder();
const _b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
const _unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const PBKDF_ITER = 150000;
async function pbkdf2Bits(pw, salt, bits) {
  const k = await crypto.subtle.importKey('raw', _enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF_ITER }, k, bits));
}
async function hashPassword(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return `p1$${_b64(salt)}$${_b64(await pbkdf2Bits(pw, salt, 256))}`; }
async function verifyPassword(pw, stored) {
  const [v, s, h] = String(stored || '').split('$'); if (v !== 'p1' || !s || !h) return false;
  const d = _b64(await pbkdf2Bits(pw, _unb64(s), 256)); let diff = d.length ^ h.length; for (let i = 0; i < d.length; i++) diff |= d.charCodeAt(i) ^ (h.charCodeAt(i) || 0); return diff === 0;
}
async function wrapWithPassword(pw, bytes) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', await pbkdf2Bits(pw, salt, 256), 'AES-GCM', false, ['encrypt']);
  return `${_b64(salt)}$${_b64(iv)}$${_b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes)))}`;
}
async function unwrapWithPassword(pw, str) {
  const [s, i, c] = String(str).split('$');
  const key = await crypto.subtle.importKey('raw', await pbkdf2Bits(pw, _unb64(s), 256), 'AES-GCM', false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: _unb64(i) }, key, _unb64(c)));
}
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
async function ensureAdminKeys(adminPw) {
  const st = DB.d.settings; if (st.adminKey && st.adminKey.pub) return;
  const kp = await crypto.subtle.generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
  const pub = _b64(new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey)));
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  st.adminKey = { pub, wrapped: await wrapWithPassword(adminPw, priv) }; DB.save();
}
async function encryptForAdmin(plain) {
  const ak = DB.d.settings.adminKey; if (!ak || !ak.pub) return '';
  const key = await crypto.subtle.importKey('spki', _unb64(ak.pub), RSA, false, ['encrypt']);
  return _b64(new Uint8Array(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, _enc.encode(plain))));
}
async function decryptAsAdmin(adminPw, cipher) {
  const priv = await unwrapWithPassword(adminPw, DB.d.settings.adminKey.wrapped);
  const key = await crypto.subtle.importKey('pkcs8', priv, RSA, false, ['decrypt']);
  return _dec.decode(await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, key, _unb64(cipher)));
}
/* fields to store for a user's new password */
async function passwordFields(plain) { return { pwHash: await hashPassword(plain), pwEnc: await encryptForAdmin(plain), password: '' }; }

/* the main administrator: the first administrator account */
function mainAdmin() { return DB.all('users').find(u => u.main) || null; }
async function migratePasswords(adminPw) {
  await ensureAdminKeys(adminPw);
  for (const u of DB.all('users')) if (u.password && !u.pwHash) DB.update('users', u.id, await passwordFields(u.password));
}

/* ---------- sign in ---------- */
let MUST_CHANGE_PW = false;
async function login(username, password) {
  const u = DB.all('users').find(x => x.username.toLowerCase() === String(username).trim().toLowerCase() && x.active !== false && x.role !== 'parent');
  if (!u) return false;
  let ok = false;
  if (u.pwHash) ok = await verifyPassword(password, u.pwHash);
  else if (u.password) ok = u.password === password;
  if (!ok) return false;
  let me = u;
  if (!mainAdmin()) { const first = DB.all('users').find(x => x.role === 'admin'); if (first && first.id === u.id) me = DB.update('users', u.id, { main: true }); }
  if (me.main) await migratePasswords(password);
  else if (!u.pwHash) DB.update('users', u.id, await passwordFields(password));
  USER = DB.get('users', u.id);
  try { localStorage.setItem('dalala_session', u.id); } catch (e) { /* ignore */ }
  MUST_CHANGE_PW = USER.main && password === 'admin123';
  location.hash = '#/' + homePage(); render();
  if (MUST_CHANGE_PW) setTimeout(() => { toast(t('changeDefaultPw'), 'err'); ACT.chpass(); }, 400);
  return true;
}

function changePasswordForm() {
  const root = modal({ title: t('changePassword'), size: 'sm',
    body: `<form id="pform" class="form-grid one"><label class="field"><span>${t('currentPassword')}</span><input class="input" type="password" name="o" required dir="ltr"></label>
      <label class="field"><span>${t('newPassword')}</span><input class="input" type="password" name="n" minlength="6" required dir="ltr"></label><div class="form-err" hidden></div></form>`,
    footer: `<button class="btn primary" type="submit" form="pform">${t('save')}</button>` });
  $('#pform', root).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, bad = m => { const b = $('.form-err', f); b.hidden = false; b.textContent = m; };
    if (!(USER.pwHash ? await verifyPassword(f.o.value, USER.pwHash) : f.o.value === USER.password)) return bad(t('wrongPassword'));
    if (f.n.value.length < 6) return bad(t('passwordShort'));
    try {
      if (USER.main) {         // the main administrator's password unlocks the private key: re-lock it with the new one
        await ensureAdminKeys(f.o.value);
        const priv = await unwrapWithPassword(f.o.value, DB.d.settings.adminKey.wrapped);
        DB.d.settings.adminKey = { ...DB.d.settings.adminKey, wrapped: await wrapWithPassword(f.n.value, priv) }; DB.save();
      }
      USER = DB.update('users', USER.id, await passwordFields(f.n.value));
    } catch (err) { console.error(err); return bad(t('errorPage')); }
    MUST_CHANGE_PW = false; closeModal(); toast(t('saved'));
  });
}

/* ---------- main administrator: see a user's password ---------- */
function revealPasswordFlow(u) {
  if (!USER || !USER.main) return toast(t('noPermission'), 'err');
  const root = modal({ title: `${t('revealPass')} — ${esc(loc(u))}`, size: 'sm',
    body: `<form id="rv-form" class="form-grid one"><p class="muted">${t('revealAsk')}</p><label class="field"><span>${t('currentPassword')}</span><input class="input" type="password" name="o" required dir="ltr"></label><div class="form-err" hidden></div><div id="rv-out"></div></form>`,
    footer: `<button class="btn ghost" data-x2>${t('close')}</button><button class="btn primary" type="submit" form="rv-form">${icon('eye')}<span>${t('revealPass')}</span></button>` });
  $('[data-x2]', root).onclick = closeModal;
  $('#rv-form', root).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, bad = m => { const b = $('.form-err', f); b.hidden = false; b.textContent = m; };
    $('.form-err', f).hidden = true;
    if (!(await verifyPassword(f.o.value, USER.pwHash))) return bad(t('wrongPassword'));
    if (!u.pwEnc) return bad(t('revealNone'));
    try { const pw = await decryptAsAdmin(f.o.value, u.pwEnc); $('#rv-out', f).innerHTML = `<div class="pw-reveal"><code dir="ltr">${esc(pw)}</code></div>`; f.o.value = ''; }
    catch (err) { console.error(err); bad(t('revealNone')); }
  });
}

/* ---------- users entity: store hashes, never text ---------- */
{
  const U = ENT.users;
  const pf = U.fields.find(f => f.k === 'password'); pf.req = 0;
  U.validate = (r, old) => {
    if (old && old.main && !USER.main) return t('errMainAdmin');
    if (old && old.main && r.password) return t('errMainPass');
    if (!old && !r.password) return `${t('errRequired')}: ${t('f_password')}`;
    if (r.password && r.password.length < 6) return t('passwordShort');
    if (old && old.main && (r.role !== 'admin' || r.active === false)) return t('errMainAdmin');
    return null;
  };
  U.prepare = async (out, old) => {
    if (out.password) Object.assign(out, await passwordFields(out.password)); else delete out.password;
  };
  U.canDelete = r => r.id !== USER.id && !r.main;
  U.actions = [{ icon: 'eye', label: 'revealPass', show: r => !!(USER && USER.main), fn: r => revealPasswordFlow(r) }];
}

Object.assign(I18N.ar, {
  revealPass: 'إظهار كلمة المرور', revealAsk: 'للمدير الرئيسي فقط. أدخل كلمة مرورك أنت للتأكيد.', revealNone: 'لا تتوفر نسخة مقروءة لهذه الكلمة. عيّن كلمة مرور جديدة للمستخدم.',
  changeDefaultPw: 'غيّر كلمة المرور الافتراضية الآن', errMainAdmin: 'حساب المدير الرئيسي لا يعدّله إلا هو', errMainPass: 'يغيّر المدير الرئيسي كلمة مروره من قائمة حسابه (تغيير كلمة المرور)',
  passKeepHint: 'عند التعديل اتركها فارغة للإبقاء على كلمة المرور الحالية',
});
Object.assign(I18N.en, {
  revealPass: 'Show password', revealAsk: 'Main administrator only. Enter your own password to confirm.', revealNone: 'No readable copy exists for this password. Set a new password for the user.',
  changeDefaultPw: 'Change the default password now', errMainAdmin: 'Only the main administrator can edit this account', errMainPass: 'The main administrator changes their own password from the account menu',
  passKeepHint: 'When editing, leave blank to keep the current password',
});
