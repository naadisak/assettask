/**
 * ============================================================
 *  ASSET UPGRADE SYSTEM — js/theme.js
 *  Dark / Light mode manager — ใช้ร่วมกันทุกหน้า
 * ============================================================
 */

const Theme = (() => {
  const KEY    = 'assetsys_theme';
  const ROOT   = document.documentElement;

  const DARK_VARS = {
    '--bg':       '#0a0a0a', '--surface':  '#141414',
    '--surface2': '#1e1e1e', '--surface3': '#252525',
    '--text':     '#f0f0f0', '--muted':    '#777',
    '--border':   '#2a2a2a',
    '--key-bg':   '#1e1e1e', '--key-text': '#f0f0f0',
    '--input-bg': '#1e1e1e', '--input-txt':'#f0f0f0',
    '--card-bg':  '#141414',
    '--topbar-bg':'rgba(10,10,10,.92)',
    '--nav-bg':   'rgba(10,10,10,.95)',
    '--dot-empty':'#333',
  };

  const LIGHT_VARS = {
    '--bg':       '#f4f4f5', '--surface':  '#ffffff',
    '--surface2': '#f1f1f1', '--surface3': '#e8e8e8',
    '--text':     '#111111', '--muted':    '#666666',
    '--border':   '#e0e0e0',
    '--key-bg':   '#ffffff', '--key-text': '#111111',
    '--input-bg': '#f8f8f8', '--input-txt':'#111111',
    '--card-bg':  '#ffffff',
    '--topbar-bg':'rgba(255,255,255,.92)',
    '--nav-bg':   'rgba(255,255,255,.95)',
    '--dot-empty':'#ccc',
  };

  function apply(mode) {
    const vars = mode === 'light' ? LIGHT_VARS : DARK_VARS;
    Object.entries(vars).forEach(([k, v]) => ROOT.style.setProperty(k, v));
    ROOT.setAttribute('data-theme', mode);
    localStorage.setItem(KEY, mode);
  }

  function current() {
    return localStorage.getItem(KEY) || 'dark';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    // update all toggle buttons on page
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.innerHTML = next === 'dark' ? ICON_MOON : ICON_SUN;
    });
    return next;
  }

  function init() {
    apply(current());
  }

  // SVG icons
  const ICON_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  const ICON_SUN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

  // Render a toggle button (call after DOM ready)
  function renderBtn(el) {
    if (!el) return;
    el.setAttribute('data-theme-toggle', '');
    el.innerHTML = current() === 'dark' ? ICON_MOON : ICON_SUN;
    el.addEventListener('click', toggle);
  }

  return { init, toggle, current, apply, renderBtn, ICON_MOON, ICON_SUN };
})();

// Auto-init on load
Theme.init();
