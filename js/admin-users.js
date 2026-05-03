/* ============================================================
   BIFROST WINES — admin-users.js
   Panel de Administradores: Lista, Agregar, Activar/Desactivar, Eliminar
   ============================================================ */

let adminsCache = [];

function getUniqueAdmins(admins = []) {
  const byUsername = new Map();
  (Array.isArray(admins) ? admins : [])
    .filter(a => a && typeof a === 'object' && a.username)
    .forEach(admin => {
      const username = String(admin.username).trim();
      if (!username || username === 'bifrost@admin') return;

      const existing = byUsername.get(username);
      if (!existing) {
        byUsername.set(username, { ...admin, username });
        return;
      }

      const existingCreated = new Date(existing.createdAt || 0).getTime() || 0;
      const currentCreated = new Date(admin.createdAt || 0).getTime() || 0;
      const existingId = Number(existing.id) || 0;
      const currentId = Number(admin.id) || 0;
      if (currentCreated > existingCreated || currentId > existingId) {
        byUsername.set(username, { ...admin, username });
      }
    });

  return Array.from(byUsername.values());
}

/* ── Bootstrap ───────────────────────────────────────────────── */
async function initUsersPanel() {
  const tbody = document.querySelector('#admins-table tbody');
  try {
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--color-text-muted);">Conectando a Firebase...</td></tr>';
    await window.BifrostDB.ready();
    adminsCache = getUniqueAdmins(await window.BifrostDB.getAllAdmins());
    renderAdminsTable();
    initUserModal();
  } catch (err) {
    console.error("Error cargando panel de admins:", err);
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--color-danger);">
      Error cargando administradores: ${err.message}.
    </td></tr>`;
  }

  // ── Seguridad: solo superadmin puede agregar/eliminar admins ──
  const isSuperAdmin = window.AdminAuth?.isSuperAdmin();
  const addBtn = document.getElementById('add-user-btn');
  if (addBtn) {
    if (!isSuperAdmin) {
      addBtn.style.display = 'none';
      // Mostrar aviso en el panel
      const panel = document.getElementById('admins-panel');
      const header = panel?.querySelector('.admin-panel__header');
      if (header) {
        const notice = document.createElement('div');
        notice.style.cssText = 'padding:0.6rem 1rem;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:10px;font-size:0.78rem;color:rgba(212,175,55,0.85);margin-top:0.5rem;';
        notice.textContent = '⚠️ Solo los Super Administradores pueden agregar, editar o eliminar administradores.';
        header.appendChild(notice);
      }
    }
  }

  window.addEventListener('admins-updated', async () => {
    adminsCache = getUniqueAdmins(await window.BifrostDB.getAllAdmins());
    renderAdminsTable();
  });
}

/* ── Render Table ────────────────────────────────────────────── */
function renderAdminsTable() {
  const tbody = document.querySelector('#admins-table tbody');
  if (!tbody) return;

  const currentUser = window.AdminAuth?.getUser() || '';

  const validAdmins = getUniqueAdmins(adminsCache);

  if (validAdmins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--color-text-muted);">
      No hay administradores registrados o válidos.
    </td></tr>`;
    return;
  }

  const roleColors = {
    superadmin: { bg: 'rgba(212,175,55,0.15)',  color: '#D4AF37', label: 'Super Admin' },
    admin:      { bg: 'rgba(69,162,158,0.15)',  color: '#45A29E', label: 'Admin' },
  };

  tbody.innerHTML = validAdmins.map(admin => {
    const rc      = roleColors[admin.role] || roleColors.admin;
    const isSelf    = currentUser && admin.username === currentUser;
    const dateStr = admin.createdAt
      ? new Date(admin.createdAt).toLocaleDateString('es-NI', { day:'2-digit', month:'short', year:'numeric' })
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
      <td style="font-size:0.75rem;color:var(--color-text-muted);">${dateStr}</td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;
          color:${admin.active ? '#4CAF50' : '#F44336'}">
          <span style="width:6px;height:6px;border-radius:50%;background:${admin.active ? '#4CAF50' : '#F44336'};"></span>
          ${admin.active ? 'Activo' : 'Inactivo'}
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

  renderAdminsTable();
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
    renderAdminsTable();
    showToast(`${admin.username} eliminado`, 'info');
  } catch (err) {
    showToast('Error al eliminar administrador', 'error');
  }
}

/* ── Modal ───────────────────────────────────────────────────── */
let editingUserId = null;

function initUserModal() {
  const openBtn  = document.getElementById('add-user-btn');
  const modal    = document.getElementById('user-modal');
  const form     = document.getElementById('user-form');
  const cancelBtn = document.getElementById('cancel-user-btn');

  if (!modal || !form) return;

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

  // Show/hide password confirm
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
}

async function openEditUserModal(id) {
  const admin = adminsCache.find(a => a.id === id);
  const modal = document.getElementById('user-modal');
  if (!admin || !modal) return;

  editingUserId = id;
  document.getElementById('user-modal-title').textContent = 'Editar Administrador';

  const fields = {
    'user-username': admin.username,
    'user-role':     admin.role || 'admin',
  };
  Object.entries(fields).forEach(([fieldId, val]) => {
    const el = document.getElementById(fieldId);
    if (el) el.value = val;
  });

  // Password optional on edit
  const passGroup = document.getElementById('user-password-group');
  if (passGroup) passGroup.style.display = '';
  const passInput = document.getElementById('user-password');
  if (passInput) { passInput.value = ''; passInput.placeholder = 'Dejar vacío para no cambiar'; }

  openAdminModal2(modal);
}

async function saveAdminUser(form, modal) {
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const username = document.getElementById('user-username')?.value.trim();
    const password = document.getElementById('user-password')?.value;
    const confirm  = document.getElementById('user-password-confirm')?.value;
    const role     = document.getElementById('user-role')?.value || 'admin';

    if (!username) { showToast('El nombre de usuario es obligatorio', 'warning'); return; }

    if (!editingUserId) {
      // New admin — only superadmin can add
      if (!window.AdminAuth?.isSuperAdmin()) {
        showToast('Solo los superadministradores pueden agregar nuevos admins', 'warning');
        return;
      }
      // password required
      if (!password) { showToast('La contraseña es obligatoria', 'warning'); return; }
      if (password !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
      if (password.length < 6)  { showToast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }

      // Check duplicate
      const exists = adminsCache.find(a => a.username === username);
      if (exists) { showToast('Ya existe un administrador con ese nombre de usuario', 'error'); return; }

      const added = await window.BifrostDB.addAdmin({
        username, password, role, active: true,
        createdAt: new Date().toISOString(),
      });
      adminsCache.push(added);
      showToast(`Administrador "${username}" creado`, 'success');

    } else {
      // Edit existing
      const admin = adminsCache.find(a => a.id === editingUserId);
      if (!admin) return;

      if (admin.role === 'superadmin' && role !== 'superadmin') {
        showToast('No puedes cambiar el rol del superadministrador', 'warning');
        return;
      }

      admin.username = username;
      admin.role     = role;
      if (password) {
        if (password !== confirm) { showToast('Las contraseñas no coinciden', 'error'); return; }
        if (password.length < 6)  { showToast('La contraseña debe tener al menos 6 caracteres', 'warning'); return; }
        admin.password = password;
      }

      await window.BifrostDB.updateAdmin(admin);
      const idx = adminsCache.findIndex(a => a.id === editingUserId);
      if (idx !== -1) adminsCache[idx] = admin;
      showToast(`Administrador "${username}" actualizado`, 'success');
    }

    renderAdminsTable();
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
window.initUsersPanel     = initUsersPanel;
window.toggleAdminActive  = toggleAdminActive;
window.deleteAdminUser    = deleteAdminUser;
window.openEditUserModal  = openEditUserModal;
