/* Dalala School System — typing language follows the field.
   Fields that need English (user name, password, e-mail, codes, numbers, English names…) accept English
   and Arabic fields accept Arabic, whatever the keyboard language currently is: the physical key that was
   pressed decides the letter. Nobody has to switch the keyboard language by hand.
   - Works on keystrokes only (pasted text is never changed).
   - Ctrl+Alt+K turns this on / off on this computer. */
'use strict';
(() => {
  const AR_RE = /[؀-ۿݐ-ݿ]/;
  const LAT_RE = /^[A-Za-z]$/;
  const LAT_PUNCT = { Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'], Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'], Backquote: ['`', '~'] };
  const DIGIT_SHIFT = { 1: '!', 2: '@', 3: '#', 4: '$', 5: '%', 6: '^', 7: '&', 8: '*', 9: '(', 0: ')' };
  /* Windows "Arabic (101)" layout: physical key → [normal, with Shift] */
  const AR = {
    KeyQ: ['ض', 'َ'], KeyW: ['ص', 'ً'], KeyE: ['ث', 'ُ'], KeyR: ['ق', 'ٌ'], KeyT: ['ف', 'لإ'], KeyY: ['غ', 'إ'], KeyU: ['ع', '‘'], KeyI: ['ه', '÷'], KeyO: ['خ', '×'], KeyP: ['ح', '؛'],
    BracketLeft: ['ج', '<'], BracketRight: ['د', '>'], KeyA: ['ش', 'ِ'], KeyS: ['س', 'ٍ'], KeyD: ['ي', ']'], KeyF: ['ب', '['], KeyG: ['ل', 'لأ'], KeyH: ['ا', 'أ'], KeyJ: ['ت', 'ـ'], KeyK: ['ن', '،'], KeyL: ['م', '/'],
    Semicolon: ['ك', ':'], Quote: ['ط', '"'], KeyZ: ['ئ', '~'], KeyX: ['ء', 'ْ'], KeyC: ['ؤ', '}'], KeyV: ['ر', '{'], KeyB: ['لا', 'لآ'], KeyN: ['ى', 'آ'], KeyM: ['ة', '’'],
    Comma: ['و', ','], Period: ['ز', '.'], Slash: ['ظ', '؟'], Backquote: ['ذ', '~'],
  };
  const EN_NAME = /^(username|u|p|password|o|n|code|number|receiptNo|voucherNo|plate|section|isbn|email|phone|iban|url)$|(^|[a-z])(En|_en)$/;
  const NO_CONV = new Set(['number', 'date', 'month', 'time', 'datetime-local', 'week', 'file', 'checkbox', 'radio', 'range', 'color', 'hidden', 'search', 'button', 'submit']);

  let on = true; try { on = localStorage.getItem('dalala_autokb') !== '0'; } catch (e) { /* ignore */ }

  function kindOf(el) {
    if (!el || !el.tagName) return null;
    const tag = el.tagName; if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;
    if (el.readOnly || el.disabled) return null;
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (NO_CONV.has(type)) return null;
    const kb = el.getAttribute('data-kb'); if (kb) return kb === 'off' ? null : kb;
    if (type === 'password' || type === 'email' || type === 'url' || type === 'tel') return 'en';
    if (el.getAttribute('dir') === 'ltr') return 'en';
    if (el.getAttribute('dir') === 'auto') return null;          // free text in either language (e.g. message boxes)
    if (EN_NAME.test(el.getAttribute('name') || el.id || '')) return 'en';
    return 'ar';
  }

  function insert(el, text) {
    el.focus();
    if (document.execCommand && document.execCommand('insertText', false, text)) return;
    const s = el.selectionStart, e = el.selectionEnd; if (s == null) { el.value += text; return; }
    el.setRangeText(text, s, e, 'end'); el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  let latinLayout = true;   // the last letter key told us which layout is active
  document.addEventListener('keydown', e => {
    if (!on || e.defaultPrevented || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return;
    const key = e.key || ''; if (key.length < 1 || key === 'Dead') return;
    const code = e.code || '';
    if (/^Key[A-Z]$/.test(code)) latinLayout = LAT_RE.test(key);
    const kind = kindOf(e.target); if (!kind) return;
    const shift = e.shiftKey, caps = e.getModifierState && e.getModifierState('CapsLock');
    if (kind === 'en') {
      if (!AR_RE.test(key)) return;                                  // already English
      let out = null;
      if (/^Key[A-Z]$/.test(code)) { const ch = code[3]; out = (shift !== caps) ? ch : ch.toLowerCase(); }
      else if (/^Digit[0-9]$/.test(code)) out = shift ? DIGIT_SHIFT[code[5]] : code[5];
      else if (LAT_PUNCT[code]) out = LAT_PUNCT[code][shift ? 1 : 0];
      if (out == null) return;
      e.preventDefault(); insert(e.target, out); return;
    }
    // Arabic field: only when the keyboard is on English (Latin letter pressed, or a punctuation key while on English)
    const isLatinLetter = LAT_RE.test(key);
    const isPunctOnLatin = !!AR[code] && !/^Key/.test(code) && latinLayout && !AR_RE.test(key) && key.length === 1;
    if (!(isLatinLetter || isPunctOnLatin)) return;
    const m = AR[code]; if (!m) return;
    e.preventDefault(); insert(e.target, m[shift ? 1 : 0]);
  }, true);

  /* tell the browser which language the field expects (spell-check, and keyboards that honour it) */
  document.addEventListener('focusin', e => {
    const k = kindOf(e.target); if (!k) return;
    e.target.setAttribute('lang', k === 'en' ? 'en' : 'ar');
    if (k === 'en') e.target.setAttribute('autocapitalize', 'off');
  });

  /* Ctrl+Alt+K: switch automatic language on / off */
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.altKey && (e.key || '').toLowerCase() === 'k') {
      on = !on; try { localStorage.setItem('dalala_autokb', on ? '1' : '0'); } catch (x) { /* ignore */ }
      if (typeof toast === 'function') toast(on ? t('autoKbOn') : t('autoKbOff'));
      e.preventDefault();
    }
  });
  if (typeof I18N !== 'undefined') {
    Object.assign(I18N.ar, { autoKbOn: 'تبديل لغة الكتابة تلقائياً: مفعّل', autoKbOff: 'تبديل لغة الكتابة تلقائياً: متوقف' });
    Object.assign(I18N.en, { autoKbOn: 'Automatic typing language: on', autoKbOff: 'Automatic typing language: off' });
  }
})();
