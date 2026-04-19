/* ============================================================
   BIFROST WINES — admin-auth.js
   Session Guard & Login Logic
   ============================================================ */

const ADMIN_USER     = 'bifrost@admin';
const ADMIN_PASS     = 'vortex2024';
const SESSION_KEY    = 'bifrost_admin_session';
const SESSION_USER   = 'bifrost_admin_user';
const SESSION_ROLE   = 'bifrost_admin_role';

/* ── Session Helpers ─────────────────────────────────────────── */
const AdminAuth = {
  isLoggedIn() {
    return localStorage.getItem(SESSION_KEY) === 'authenticated';
  },

  // Sync fallback (initial superadmin)
  _syncCheck(username, password) {
    return username === ADMIN_USER && password === ADMIN_PASS;
  },

  async loginAsync(username, password) {
    // 1. Try DB admins first
    try {
      if (window.BifrostDB) {
        await window.BifrostDB.ready();
        const admin = await window.BifrostDB.verifyAdmin(username, password);
        if (admin) {
          localStorage.setItem(SESSION_KEY, 'authenticated');
          localStorage.setItem(SESSION_USER, admin.username);
          localStorage.setItem(SESSION_ROLE, admin.role || 'admin');
          return true;
        }
      }
    } catch (e) { /* fallthrough */ }

    // 2. Fallback: hardcoded superadmin
    if (this._syncCheck(username, password)) {
      localStorage.setItem(SESSION_KEY, 'authenticated');
      localStorage.setItem(SESSION_USER, username);
      localStorage.setItem(SESSION_ROLE, 'superadmin');
      return true;
    }
    return false;
  },

  logout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER);
    localStorage.removeItem(SESSION_ROLE);
    window.location.href = 'admin-login.html';
  },

  requireAuth(requiredRole = null) {
    if (!this.isLoggedIn()) {
      window.location.replace('admin-login.html');
      return false;
    }
    if (requiredRole && this.getRole() !== requiredRole) {
      // Si se requiere superadmin y el usuario es solo admin, redirigir al dashboard
      window.location.replace('admin-dashboard.html');
      return false;
    }
    return true;
  },

  getUser() {
    return localStorage.getItem(SESSION_USER) || 'Admin';
  },

  getRole() {
    return localStorage.getItem(SESSION_ROLE) || 'admin';
  },

  isSuperAdmin() {
    return this.getRole() === 'superadmin';
  }
};

/* ── Login Page Logic ────────────────────────────────────────── */
function initLoginPage() {
  // Redirect if already logged in
  if (AdminAuth.isLoggedIn()) {
    window.location.replace('admin-dashboard.html');
    return;
  }

  const form     = document.getElementById('admin-login-form');
  const errorEl  = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const username = document.getElementById('admin-username')?.value.trim();
    const password = document.getElementById('admin-password')?.value;

    // Show loading state
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.querySelector('.btn-login__text').innerHTML = `
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        style="animation:spinBtn 0.7s linear infinite;">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Autenticando…`;

    setTimeout(async () => {
      const success = await AdminAuth.loginAsync(username, password);
      if (success) {
        submitBtn.classList.remove('loading');
        submitBtn.querySelector('.btn-login__text').innerHTML = `
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          ¡Acceso Concedido!`;
        submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #66BB6A)';
        setTimeout(() => {
          window.location.replace('admin-dashboard.html');
        }, 600);
      } else {
        if (errorEl) {
          errorEl.textContent = 'Credenciales incorrectas. Verifica tu usuario y contraseña.';
          errorEl.classList.add('show');
        }
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.querySelector('.btn-login__text').innerHTML = `
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          Entrar al Dashboard`;

        // Shake the card
        const card = document.querySelector('.admin-login-card');
        if (card) {
          card.style.transition = 'transform 80ms ease';
          card.style.transform = 'translateX(8px)';
          setTimeout(() => { card.style.transform = 'translateX(-8px)'; }, 80);
          setTimeout(() => { card.style.transform = 'translateX(6px)'; },  160);
          setTimeout(() => { card.style.transform = 'translateX(-6px)'; }, 240);
          setTimeout(() => { card.style.transform = 'translateX(0)'; card.style.transition = ''; }, 320);
        }

        // Clear after 4 seconds
        setTimeout(() => {
          if (errorEl) errorEl.classList.remove('show');
        }, 4000);
      }
    }, 800);
  });

  // Toggle password visibility
  const toggleBtn = document.getElementById('toggle-password');
  const passInput = document.getElementById('admin-password');
  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const show = passInput.type === 'password';
      passInput.type = show ? 'text' : 'password';
      toggleBtn.innerHTML = show
        ? `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
           </svg>`
        : `<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
           </svg>`;
    });
  }
}

/* ── Dashboard Guard ─────────────────────────────────────────── */
function initDashboardGuard() {
  if (!AdminAuth.requireAuth()) return false;

  // Show logged-in user
  const userEl = document.querySelector('.admin-user-pill');
  if (userEl) {
    const user = AdminAuth.getUser();
    const dot = userEl.querySelector('.user-dot');
    userEl.innerHTML = `
      <span class="user-dot" style="width:6px;height:6px;border-radius:50%;background:#4CAF50;box-shadow:0 0 6px rgba(76,175,80,0.6);flex-shrink:0;"></span>
      ${user}`;
  }

  // Logout button
  const logoutBtn = document.getElementById('admin-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        AdminAuth.logout();
      }
    });
  }

  return true;
}

/* ── Auto Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;

  if (path.includes('admin-login')) {
    initLoginPage();
  } else if (path.includes('admin-dashboard')) {
    initDashboardGuard();
  }
});

window.AdminAuth = AdminAuth;
