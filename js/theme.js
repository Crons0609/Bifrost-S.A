/* ============================================================
   BIFROST WINES — theme.js
   Dark / Light Mode Management
   ============================================================ */

const THEME_KEY = 'bifrost_theme';

const ThemeManager = {
  /* ── Get/Set ─────────────────────────────────────────────── */
  getCurrent() {
    return localStorage.getItem(THEME_KEY) || 'dark';
  },

  apply(theme) {
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    ThemeManager._updateButtons(theme);
  },

  toggle() {
    const next = ThemeManager.getCurrent() === 'dark' ? 'light' : 'dark';
    ThemeManager.apply(next);
  },

  init() {
    // Apply saved preference immediately (prevents flash)
    ThemeManager.apply(ThemeManager.getCurrent());

    // Wire up all toggle buttons on page
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', ThemeManager.toggle);
    });
  },

  /* ── Update button icons/labels ──────────────────────────── */
  _updateButtons(theme) {
    const isDark = theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      const iconEl  = btn.querySelector('.theme-icon');
      const labelEl = btn.querySelector('.theme-label');

      if (iconEl) {
        iconEl.innerHTML = isDark
          ? /* sun */ `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>`
          : /* moon */ `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>`;
      }

      if (labelEl) {
        labelEl.textContent = isDark ? 'Modo Claro' : 'Modo Oscuro';
      }

      btn.setAttribute('title', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    });
  }
};

// Expose globally
window.ThemeManager = ThemeManager;

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ThemeManager.init);
} else {
  ThemeManager.init();
}
