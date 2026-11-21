/* Dalala School System — per-user permissions.
   Roles give default permissions; an admin can customise any user (view / edit per section).
   Permission strings:  v:<section>  (see)   e:<section>  (add / edit / delete).
   Users and Settings are always admin-only so nobody can grant themselves more access. */
'use strict';

const ADMIN_ONLY_PAGES = ['users', 'settings'];
const EXTRA_EDIT = ['attendance', 'marks', 'docs'];          // sections that have an edit right without being a CRUD entity
const EDIT_DEFAULT = { attendance: ['admin', 'clerk', 'teacher'], marks: ['admin', 'teacher'], docs: ['admin', 'clerk'] };

function menuItems() { return MENU.flatMap(g => g.items).filter(i => i.id !== 'portal'); }
/* sections shown in the permissions table, in menu order (+ personal documents) */
function permSections() {
  const ids = menuItems().map(i => i.id).filter(id => !ADMIN_ONLY_PAGES.includes(id));
  ids.push('docs');
  return ids;
}
function hasEditRight(id) { return !!ENT[id] || EXTRA_EDIT.includes(id); }

function roleDefaults(role) {
  const out = [];
  menuItems().forEach(i => { if (i.roles.includes(role)) out.push('v:' + i.id); });
  if (role === 'admin' || ['clerk', 'accountant'].includes(role)) out.push('v:docs');
  Object.keys(ENT).forEach(k => { if ((ENT[k].edit || ['admin']).includes(role)) out.push('e:' + k); });
  EXTRA_EDIT.forEach(k => { if (EDIT_DEFAULT[k].includes(role)) out.push('e:' + k); });
  return out;
}
function userPerms(u) {
  if (!u || !u.perms) return null;
  try { const a = typeof u.perms === 'string' ? JSON.parse(u.perms) : u.perms; return Array.isArray(a) ? a : null; } catch (e) { return null; }
}
function hasPerm(p) {
  if (!USER) return false;
  if (USER.role === 'admin') return true;
  const sec = p.slice(2);
  if (ADMIN_ONLY_PAGES.includes(sec)) return false;
  return (userPerms(USER) || roleDefaults(USER.role)).includes(p);
}
const PAGE_ALIAS = { student: 'students', employee: 'employees' };
const canView = id => hasPerm('v:' + (PAGE_ALIAS[id] || id));
const canEdit = key => hasPerm('e:' + key);
/* first section this user may open (used after sign-in / when a page is not allowed) */
function firstAllowedPage() {
  if (USER.role === 'admin') return 'dashboard';
  const it = menuItems().find(i => canView(i.id));
  return it ? it.id : null;
}

/* ---------- permissions table inside the user form ---------- */
function permsEditorHTML(value, role) {
  const custom = !!(value && String(value).trim());
  const cur = new Set(custom ? (userPerms({ perms: value }) || []) : roleDefaults(role || 'teacher'));
  const rows = permSections().map(id => `<tr><td>${esc(t(id === 'docs' ? 'docsFiles' : 'nav_' + id))}</td>
    <td><input type="checkbox" data-pm="v:${id}" ${cur.has('v:' + id) ? 'checked' : ''}></td>
    <td>${hasEditRight(id) ? `<input type="checkbox" data-pm="e:${id}" ${cur.has('e:' + id) ? 'checked' : ''}>` : '—'}</td></tr>`).join('');
  return `<div class="pm-root"><input type="hidden" name="perms" value="${esc(custom ? value : '')}">
    <label class="pm-custom"><input type="checkbox" data-pm-custom ${custom ? 'checked' : ''}><span>${t('permCustom')}</span></label>
    <p class="hint muted">${t('permHint')}</p>
    <div class="pm-box" ${custom ? '' : 'hidden'}><div class="pm-tools"><button type="button" class="btn ghost sm" data-pm-preset>${t('permPreset')}</button></div>
    <div class="table-wrap"><table class="table pm-table"><thead><tr><th>${t('permSection')}</th><th>${t('permView')}</th><th>${t('permEdit')}</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
}
function pmSync(root) {
  const hid = root.querySelector('input[name=perms]');
  if (!root.querySelector('[data-pm-custom]').checked) { hid.value = ''; return; }
  const list = [...root.querySelectorAll('[data-pm]')].filter(c => c.checked).map(c => c.dataset.pm);
  // an edit right without the matching view right makes no sense: view is implied
  list.filter(p => p.startsWith('e:') && !list.includes('v:' + p.slice(2))).forEach(p => { if (permSections().includes(p.slice(2))) list.push('v:' + p.slice(2)); });
  hid.value = JSON.stringify(list);
}
function pmApplyPreset(root) {
  const form = root.closest('form'); const role = form.elements.role ? form.elements.role.value : 'teacher';
  const set = new Set(roleDefaults(role));
  root.querySelectorAll('[data-pm]').forEach(c => { c.checked = set.has(c.dataset.pm); });
  pmSync(root);
}
document.addEventListener('change', e => {
  const root = e.target.closest && e.target.closest('.pm-root');
  if (root) {
    if (e.target.matches('[data-pm-custom]')) {
      root.querySelector('.pm-box').hidden = !e.target.checked;
      if (e.target.checked) pmApplyPreset(root);
    }
    pmSync(root); return;
  }
  const form = e.target.closest && e.target.closest('form');
  if (form && e.target.name === 'role') { const r = form.querySelector('.pm-root'); if (r && r.querySelector('[data-pm-custom]').checked) { /* keep the custom choice */ } else if (r) { r.outerHTML = permsEditorHTML('', e.target.value); } }
});
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-pm-preset]');
  if (b) { e.preventDefault(); pmApplyPreset(b.closest('.pm-root')); }
});
