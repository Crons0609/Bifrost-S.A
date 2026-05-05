/* ============================================================
   BIFROST WINES — admin-users.js
   Panel de Administradores: Lista, Capital, Acciones y Ganancia
   ============================================================ */

let adminsCache = [];
let editingUserId = null;
let adminsSyncBound = false;

const COST_RECIPES_KEY = 'bifrost_cost_recetas_lujo';
const COST_RECIPES_FB_URL = 'https://bifrost-sa-default-rtdb.firebaseio.com/recetas_lujo.json';

let adminFinanceState = {
  totalInvestmentNio: 0,
  projectedRevenueNio: 0,
  projectedCostNio: 0,
  projectedProfitNio: 0,
  distributableProfitNio: 0,
};

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeAdminRecord(admin = {}) {
  return {
    ...admin,
    investmentNio: normalizeAmount(admin.investmentNio ?? admin.inversionNio ?? admin.aporteNio ?? 0),
  };
}

function formatNio(value) {
  return `C$ ${normalizeAmount(value).toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPct(value) {
  return `${normalizeAmount(value).toLocaleString('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function parseRecipeMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value || '0').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRecipeUnits(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = parseInt(String(value || '0').replace(/[^\d.-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getUniqueAdmins(admins = []) {
  const byUsername = new Map();
  (Array.isArray(admins) ? admins : [])
    .filter(a => a && typeof a === 'object' && a.username)
    .forEach(admin => {
      const normalizedAdmin = normalizeAdminRecord(admin);
      const username = String(normalizedAdmin.username).trim();
      if (!username || username === 'bifrost@admin') return;

      const existing = byUsername.get(username);
      if (!existing) {
        byUsername.set(username, { ...normalizedAdmin, username });
        return;
      }

      const existingCreated = new Date(existing.createdAt || 0).getTime() || 0;
      const currentCreated = new Date(normalizedAdmin.createdAt || 0).getTime() || 0;
      const existingId = Number(existing.id) || 0;
      const currentId = Number(normalizedAdmin.id) || 0;
      if (currentCreated > existingCreated || currentId > existingId) {
        byUsername.set(username, { ...normalizedAdmin, username });
      }
    });

  return Array.from(byUsername.values());
}

function getAdminSharePct(admin) {
  if (adminFinanceState.totalInvestmentNio <= 0) return 0;
  return (normalizeAmount(admin.investmentNio) / adminFinanceState.totalInvestmentNio) * 100;
}

function getAdminProjectedProfit(admin) {
  return adminFinanceState.distributableProfitNio * (getAdminSharePct(admin) / 100);
}

function getAdminProjectedRoiPct(admin) {
  const investment = normalizeAmount(admin.investmentNio);
  if (investment <= 0) return 0;
  return (getAdminProjectedProfit(admin) / investment) * 100;
}

async function loadCostRecipes() {
  try {
    const res = await fetch(COST_RECIPES_FB_URL);
    if (res.ok) {
      const data = await res.json();
      const recipes = Object.values(data || {}).filter(Boolean);
      localStorage.setItem(COST_RECIPES_KEY, JSON.stringify(recipes));
      return recipes;
    }
  } catch (err) {
    console.warn('No se pudo cargar recetas_lujo desde Firebase:', err);
  }

  try {
    return JSON.parse(localStorage.getItem(COST_RECIPES_KEY) || '[]');
  } catch {
    return [];
  }
}

function computeFinanceFromRecipes(recipes = []) {
  return (Array.isArray(recipes) ? recipes : []).reduce((acc, recipe) => {
    const saleRevenue = parseRecipeMoney(recipe.res_venta_total_lote);
    const storedProfit = parseRecipeMoney(recipe.res_ganancia_total_lote);
    const pvp = parseRecipeMoney(recipe.res_pvp);
    const bottles = parseRecipeUnits(recipe.res_bots);
    const cpt = parseRecipeMoney(recipe.res_cpt);
    const fallbackRevenue = pvp * bottles;
    const revenue = saleRevenue > 0 ? saleRevenue : fallbackRevenue;
    const profit = recipe.res_ganancia_total_lote != null
      ? storedProfit
      : (revenue - cpt);

    acc.projectedRevenueNio += revenue;
    acc.projectedCostNio += cpt;
    acc.projectedProfitNio += profit;
    return acc;
  }, {
    projectedRevenueNio: 0,
    projectedCostNio: 0,
    projectedProfitNio: 0,
  });
}

async function refreshAdminFinancials({ keepManualPool = true } = {}) {
  const recipes = await loadCostRecipes();
  const summary = computeFinanceFromRecipes(recipes);
  const totalInvestmentNio = getUniqueAdmins(adminsCache)
    .reduce((sum, admin) => sum + normalizeAmount(admin.investmentNio), 0);

  const poolInput = document.getElementById('admin-profit-pool');
  const hasManualPool = keepManualPool && poolInput?.dataset.touched === 'true';
  const manualPool = hasManualPool ? normalizeAmount(poolInput.value) : null;

  adminFinanceState = {
    totalInvestmentNio,
    projectedRevenueNio: summary.projectedRevenueNio,
    projectedCostNio: summary.projectedCostNio,
    projectedProfitNio: summary.projectedProfitNio,
    distributableProfitNio: hasManualPool ? manualPool : summary.projectedProfitNio,
  };

  renderAdminsTable();
  renderAdminFinanceBoard();
  initAdminFinanceControls();
}

/* ── Bootstrap ───────────────────────────────────────────────── */
async function initUsersPanel() {
  const tbody = document.querySelector('#admins-table tbody');
  if (!window.AdminAuth?.canAccessAdminsPanel?.()) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--color-danger);">
        Acceso restringido. Solo los superadministradores pueden entrar a este apartado.
      </td></tr>`;
    }
    window.switchPanel?.('inventory');
    return;
  }

  try {
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--color-text-muted);">Conectando a Firebase...</td></tr>';
    await window.BifrostDB.ready();
    adminsCache = getUniqueAdmins(await window.BifrostDB.getAllAdmins());
    await refreshAdminFinancials({ keepManualPool: false });
    initUserModal();
  } catch (err) {
    console.error("Error cargando panel de admins:", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--color-danger);">
      Error cargando administradores: ${err.message}.
    </td></tr>`;
  }

  const isSuperAdmin = window.AdminAuth?.isSuperAdmin();
  const addBtn = document.getElementById('add-user-btn');
  if (addBtn && !isSuperAdmin) {
    addBtn.style.display = 'none';
    const panel = document.getElementById('admins-panel');
    const header = panel?.querySelector('.admin-panel__header');
    if (header && !header.querySelector('[data-admins-readonly-notice="true"]')) {
      const notice = document.createElement('div');
      notice.dataset.adminsReadonlyNotice = 'true';
      notice.style.cssText = 'padding:0.6rem 1rem;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:10px;font-size:0.78rem;color:rgba(212,175,55,0.85);margin-top:0.5rem;';
      notice.textContent = '⚠️ Solo los Super Administradores pueden agregar, editar o eliminar administradores.';
      header.appendChild(notice);
    }
  }

  if (!adminsSyncBound) {
    adminsSyncBound = true;
    window.addEventListener('admins-updated', async () => {
      adminsCache = getUniqueAdmins(await window.BifrostDB.getAllAdmins());
      await refreshAdminFinancials();
    });
  }
}

/* ── Render Table ────────────────────────────────────────────── */
function renderAdminsTable() {
  const tbody = document.querySelector('#admins-table tbody');
  if (!tbody) return;

  const currentUser = window.AdminAuth?.getUser() || '';
  const validAdmins = getUniqueAdmins(adminsCache);

  if (validAdmins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--color-text-muted);">
      No hay administradores registrados o válidos.
    </td></tr>`;
    return;
  }

  const roleColors = {
    superadmin: { bg: 'rgba(212,175,55,0.15)', color: '#D4AF37', label: 'Super Admin' },
    admin: { bg: 'rgba(69,162,158,0.15)', color: '#45A29E', label: 'Admin' },
  };

  tbody.innerHTML = validAdmins.map(admin => {
    const rc = roleColors[admin.role] || roleColors.admin;
    const isSelf = currentUser && admin.username === currentUser;
    const statusLabel = admin.active ? 'Habilitado' : 'Bloqueado';
    const statusColor = admin.active ? '#4CAF50' : '#F44336';
    const sharePct = getAdminSharePct(admin);
    const projectedProfit = getAdminProjectedProfit(admin);
    const projectedProfitColor = projectedProfit > 0
      ? '#9B6DD9'
      : projectedProfit < 0
        ? '#EF5350'
        : 'var(--color-text-muted)';
    const dateStr = admin.createdAt
      ? new Date(admin.createdAt).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="
            width:36px;height:36px;border-radius:50%;
            background:linear-gradient(135deg,rgba(212,175,55,0.2),rgba(69,162,158,0.15));
            border:1px solid rgba(212,175,55,0.25);
            display:flex;align-items:center;justify-content:center;
            font-weight:700;font-size:0.875rem;color:var(--color-gold);">
            ${admin.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-weight:600;font-size:0.875rem;">${admin.username}</div>
            ${isSelf ? `<div style="font-size:0.68rem;color:#45A29E;">● Tú</div>` : ''}
          </div>
        </div>
      </td>
      <td>
        <span style="display:inline-block;padding:2px 10px;border-radius:var(--radius-full);
          background:${rc.bg};color:${rc.color};font-size:0.7rem;font-weight:700;letter-spacing:0.08em;">
          ${rc.label}
        </span>
      </td>
      <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--color-gold);font-weight:700;">
        ${formatNio(admin.investmentNio)}
      </td>
      <td style="font-size:0.78rem;color:${sharePct > 0 ? '#45A29E' : 'var(--color-text-muted)'};font-weight:700;">
        ${sharePct > 0 ? formatPct(sharePct) : '—'}
      </td>
      <td style="font-family:var(--font-mono);font-size:0.78rem;color:${projectedProfitColor};font-weight:700;">
        ${projectedProfit !== 0 ? formatNio(projectedProfit) : '—'}
      </td>
      <td style="font-size:0.75rem;color:var(--color-text-muted);">${dateStr}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;
          color:${statusColor}">
          <span style="width:6px;height:6px;border-radius:50%;background:${statusColor};"></span>
          ${statusLabel}
        </span>
      </td>
      <td style="font-size:0.75rem;color:var(--color-text-muted);">${admin.lastLogin ? new Date(admin.lastLogin).toLocaleString('es-NI') : 'Nunca'}</td>
      <td>
        <div class="table-actions">
          ${!isSelf ? `
            <button class="btn btn--sm ${admin.active ? 'btn--outline' : 'btn--primary'}"
              onclick="toggleAdminActive(${admin.id})"
              title="${admin.active ? 'Desactivar' : 'Activar'}">
              ${admin.active
                ? `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>`
                : `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`}
            </button>
          ` : ''}
          <button class="btn btn--sm btn--outline" onclick="openEditUserModal(${admin.id})" title="Editar">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          ${!isSelf ? `
            <button class="btn btn--sm btn--danger" onclick="deleteAdminUser(${admin.id})" title="Eliminar">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderAdminFinanceBoard() {
  const totalInvestmentEl = document.getElementById('admins-total-investment');
  const investorsCountEl = document.getElementById('admins-investors-count');
  const masterProfitEl = document.getElementById('admins-master-profit');
  const profitPoolKpiEl = document.getElementById('admins-profit-pool-kpi');
  const noteEl = document.getElementById('admins-finance-note');
  const poolInput = document.getElementById('admin-profit-pool');
  const sharesTbody = document.querySelector('#admins-shares-table tbody');

  const validAdmins = getUniqueAdmins(adminsCache)
    .sort((a, b) => normalizeAmount(b.investmentNio) - normalizeAmount(a.investmentNio));
  const investorsCount = validAdmins.filter(admin => normalizeAmount(admin.investmentNio) > 0).length;

  if (totalInvestmentEl) totalInvestmentEl.textContent = formatNio(adminFinanceState.totalInvestmentNio);
  if (investorsCountEl) investorsCountEl.textContent = investorsCount;
  if (masterProfitEl) masterProfitEl.textContent = formatNio(adminFinanceState.projectedProfitNio);
  if (profitPoolKpiEl) profitPoolKpiEl.textContent = formatNio(adminFinanceState.distributableProfitNio);
  if (poolInput && document.activeElement !== poolInput) {
    poolInput.value = adminFinanceState.distributableProfitNio.toFixed(2);
  }

  if (noteEl) {
    noteEl.innerHTML = `
      Base contable actual: <strong style="color:var(--color-gold);">capital aportado en NIO</strong> frente a
      <strong style="color:#45A29E;">ganancia total del lote si se vende completo</strong>, ya calculada con margen e impuestos.
      Venta total proyectada: <strong>${formatNio(adminFinanceState.projectedRevenueNio)}</strong>.
      Costos acumulados de lotes: <strong>${formatNio(adminFinanceState.projectedCostNio)}</strong>.
    `;
  }

  if (!sharesTbody) return;

  if (validAdmins.length === 0) {
    sharesTbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted);">
      No hay administradores cargados para calcular participaciones.
    </td></tr>`;
    return;
  }

  sharesTbody.innerHTML = validAdmins.map(admin => {
    const sharePct = getAdminSharePct(admin);
    const assignedProfit = getAdminProjectedProfit(admin);
    const roiPct = getAdminProjectedRoiPct(admin);
    const assignedProfitColor = assignedProfit > 0
      ? '#9B6DD9'
      : assignedProfit < 0
        ? '#EF5350'
        : 'var(--color-text-muted)';
    const roiColor = roiPct > 0
      ? '#4CAF50'
      : roiPct < 0
        ? '#EF5350'
        : 'var(--color-text-muted)';

    return `
      <tr>
        <td style="font-weight:600;">${admin.username}</td>
        <td style="font-family:var(--font-mono);color:var(--color-gold);font-weight:700;">${formatNio(admin.investmentNio)}</td>
        <td style="color:${sharePct > 0 ? '#45A29E' : 'var(--color-text-muted)'};font-weight:700;">${sharePct > 0 ? formatPct(sharePct) : '—'}</td>
        <td style="font-family:var(--font-mono);color:${assignedProfitColor};font-weight:700;">${assignedProfit !== 0 ? formatNio(assignedProfit) : '—'}</td>
        <td style="color:${roiColor};font-weight:700;">${roiPct !== 0 ? formatPct(roiPct) : '—'}</td>
      </tr>
    `;
  }).join('');
}

function initAdminFinanceControls() {
  const poolInput = document.getElementById('admin-profit-pool');
  const syncBtn = document.getElementById('admin-profit-sync-btn');

  if (poolInput && poolInput.dataset.bound !== 'true') {
    poolInput.dataset.bound = 'true';
    poolInput.addEventListener('input', () => {
      poolInput.dataset.touched = 'true';
      adminFinanceState.distributableProfitNio = normalizeAmount(poolInput.value);
      renderAdminsTable();
      renderAdminFinanceBoard();
    });
  }

  if (syncBtn && syncBtn.dataset.bound !== 'true') {
    syncBtn.dataset.bound = 'true';
    syncBtn.addEventListener('click', () => {
      adminFinanceState.distributableProfitNio = adminFinanceState.projectedProfitNio;
      if (poolInput) {
        poolInput.dataset.touched = 'false';
        poolInput.value = adminFinanceState.projectedProfitNio.toFixed(2);
      }
      renderAdminsTable();
      renderAdminFinanceBoard();
    });
  }
}

/* ── Toggle Active ───────────────────────────────────────────── */
async function toggleAdminActive(id) {
  if (!window.AdminAuth?.isSuperAdmin()) {
    showToast('Solo los superadministradores pueden activar/desactivar admins', 'warning');
    return;
  }
  const admin = adminsCache.find(a => a.id === id);
  if (!admin) return;

  admin.active = !admin.active;
  await window.BifrostDB.updateAdmin(admin);
  const idx = adminsCache.findIndex(a => a.id === id);
  if (idx !== -1) adminsCache[idx] = admin;

  await refreshAdminFinancials();
  showToast(`${admin.username} ${admin.active ? 'activado' : 'desactivado'}`, admin.active ? 'success' : 'info');
}

/* ── Delete ──────────────────────────────────────────────────── */
async function deleteAdminUser(id) {
  if (!window.AdminAuth?.isSuperAdmin()) {
    showToast('Solo los superadministradores pueden eliminar admins', 'warning');
    return;
  }
  const admin = adminsCache.find(a => a.id === id);
  if (!admin) return;
  if (!confirm(`¿Eliminar al administrador "${admin.username}"? Esta acción no se puede deshacer.`)) return;

  try {
    await window.BifrostDB.deleteAdmin(id);
    adminsCache = adminsCache.filter(a => a.id !== id);
    await refreshAdminFinancials();
    showToast(`${admin.username} eliminado`, 'info');
  } catch (err) {
    showToast('Error al eliminar administrador', 'error');
  }
}

/* ── Modal ───────────────────────────────────────────────────── */
function initUserModal() {
  const openBtn = document.getElementById('add-user-btn');
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  const cancelBtn = document.getElementById('cancel-user-btn');

  if (!modal || !form) return;
  if (form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  openBtn?.addEventListener('click', () => {
    editingUserId = null;
    resetUserForm();
    document.getElementById('user-modal-title').textContent = 'Agregar Administrador';
    document.getElementById('user-password-group').style.display = '';
    openAdminModal2(modal);
  });

  cancelBtn?.addEventListener('click', () => closeAdminModal2(modal));
  modal.querySelector('.modal__backdrop')?.addEventListener('click', () => closeAdminModal2(modal));
  modal.querySelector('.modal__close')?.addEventListener('click', () => closeAdminModal2(modal));

  const passInput = document.getElementById('user-password');
  const confirmGroup = document.getElementById('user-confirm-group');
  passInput?.addEventListener('input', () => {
    if (confirmGroup) confirmGroup.style.display = passInput.value ? '' : 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveAdminUser(form, modal);
  });
}

function resetUserForm() {
  const form = document.getElementById('user-form');
  if (form) form.reset();
  const confirmGroup = document.getElementById('user-confirm-group');
  if (confirmGroup) confirmGroup.style.display = 'none';
  const passInput = document.getElementById('user-password');
  if (passInput) passInput.placeholder = 'Mínimo 6 caracteres';
  const investmentInput = document.getElementById('user-investment');
  if (investmentInput) investmentInput.value = '';
}

async function openEditUserModal(id) {
  const admin = adminsCache.find(a => a.id === id);
  const modal = document.getElementById('user-modal');
  if (!admin || !modal) return;

  editingUserId = id;
  document.getElementById('user-modal-title').textContent = 'Editar Administrador';

  const fields = {
    'user-username': admin.username,
    'user-role': admin.role || 'admin',
    'user-investment': normalizeAmount(admin.investmentNio).toFixed(2),
  };
  Object.entries(fields).forEach(([fieldId, val]) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val;
  });

  const passGroup = document.getElementById('user-password-group');
  if (passGroup) passGroup.style.display = '';
  const passInput = document.getElementById('user-password');
  if (passInput) {
    passInput.value = '';
    passInput.placeholder = 'Dejar vacío para no cambiar';
  }
  const confirmInput = document.getElementById('user-password-confirm');
  if (confirmInput) confirmInput.value = '';
  const confirmGroup = document.getElementById('user-confirm-group');
  if (confirmGroup) confirmGroup.style.display = 'none';

  openAdminModal2(modal);
}

async function saveAdminUser(form, modal) {
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const username = document.getElementById('user-username')?.value.trim();
    const password = document.getElementById('user-password')?.value;
    const confirm = document.getElementById('user-password-confirm')?.value;
    const role = document.getElementById('user-role')?.value || 'admin';
    const investmentNio = normalizeAmount(document.getElementById('user-investment')?.value);

    if (!username) {
      showToast('El nombre de usuario es obligatorio', 'warning');
      return;
    }

    if (!editingUserId) {
      if (!window.AdminAuth?.isSuperAdmin()) {
        showToast('Solo los superadministradores pueden agregar nuevos admins', 'warning');
        return;
      }
      if (!password) {
        showToast('La contraseña es obligatoria', 'warning');
        return;
      }
      if (password !== confirm) {
        showToast('Las contraseñas no coinciden', 'error');
        return;
      }
      if (password.length < 6) {
        showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
        return;
      }

      const exists = adminsCache.find(a => a.username === username);
      if (exists) {
        showToast('Ya existe un administrador con ese nombre de usuario', 'error');
        return;
      }

      const added = await window.BifrostDB.addAdmin({
        username,
        password,
        role,
        investmentNio,
        active: true,
        createdAt: new Date().toISOString(),
      });
      adminsCache.push(normalizeAdminRecord(added));
      showToast(`Administrador "${username}" creado`, 'success');
    } else {
      const admin = adminsCache.find(a => a.id === editingUserId);
      if (!admin) return;

      if (admin.role === 'superadmin' && role !== 'superadmin') {
        showToast('No puedes cambiar el rol del superadministrador', 'warning');
        return;
      }

      admin.username = username;
      admin.role = role;
      admin.investmentNio = investmentNio;

      if (password) {
        if (password !== confirm) {
          showToast('Las contraseñas no coinciden', 'error');
          return;
        }
        if (password.length < 6) {
          showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
          return;
        }
        admin.password = password;
      }

      await window.BifrostDB.updateAdmin(admin);
      const idx = adminsCache.findIndex(a => a.id === editingUserId);
      if (idx !== -1) adminsCache[idx] = normalizeAdminRecord(admin);
      showToast(`Administrador "${username}" actualizado`, 'success');
    }

    await refreshAdminFinancials();
    closeAdminModal2(modal);
  } catch (err) {
    console.error('Error al guardar admin:', err);
    showToast('Error al guardar el administrador', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}

function openAdminModal2(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminModal2(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
  editingUserId = null;
}

/* ── Exports ─────────────────────────────────────────────────── */
window.initUsersPanel = initUsersPanel;
window.toggleAdminActive = toggleAdminActive;
window.deleteAdminUser = deleteAdminUser;
window.openEditUserModal = openEditUserModal;
