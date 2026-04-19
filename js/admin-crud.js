/* ============================================================
   BIFROST WINES — admin-crud.js
   Dashboard CRUD: Wines, Stock, Discounts, Flash Sale
   ============================================================ */

let winesCache    = [];
let settingsCache = {};
let editingWineId = null;
let currentPanel  = 'inventory'; // 'inventory' | 'discounts'

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.AdminAuth?.isLoggedIn()) return; // Guard already handled

  await window.BifrostDB.ready();

  await loadData();
  initNavigation();
  initFlashSale();
  initAddWineModal();
  initImageUpload();   // ← nuevo: zona de carga de imagen
  initSearchFilter();
  initMobileMenu();
  updateStatCards();

  // ── Escuchar sincronización automática desde Firebase ──────────
  // database.js dispara 'wines-updated' cada vez que Firebase Realtime DB
  // actualiza productos_ecommerce (ej: cuando costos.html registra un lote).
  window.addEventListener('wines-updated', async () => {
    try {
      winesCache = await window.BifrostDB.getAllWines();
      renderInventoryTable();
      renderDiscountTable();
      updateStatCards();
      _updateNavWineCount();
    } catch (err) {
      console.warn('wines-updated reload error:', err);
    }
  });
});

/* ── Load Data ───────────────────────────────────────────────── */
async function loadData() {
  try {
    [winesCache, settingsCache] = await Promise.all([
      window.BifrostDB.getAllWines(),
      window.BifrostDB.getSettings(),
    ]);
    renderInventoryTable();
    renderDiscountTable();
    syncFlashSaleUI();
    _updateNavWineCount();
  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load data', 'error');
  }
}

/* ── Nav Wine Badge ──────────────────────────────────────────── */
function _updateNavWineCount() {
  const badge = document.getElementById('nav-wine-count');
  if (badge) badge.textContent = winesCache.length || 0;
}

/* ── Navigation ──────────────────────────────────────────────── */
function initNavigation() {
  const links = document.querySelectorAll('.admin-nav-link[data-panel]');
  links.forEach(link => {
    link.addEventListener('click', () => {
      const panel = link.dataset.panel;
      switchPanel(panel);
    });
  });

  // Init active
  switchPanel('inventory');
}

function switchPanel(panel) {
  currentPanel = panel;

  document.querySelectorAll('.admin-nav-link[data-panel]').forEach(l => {
    l.classList.toggle('active', l.dataset.panel === panel);
  });

  document.querySelectorAll('.admin-panel').forEach(p => {
    p.classList.toggle('hidden', p.dataset.panel !== panel);
  });

  // Ocultar stat cards cuando se muestra el panel de Telegram
  const statsGrid = document.querySelector('.admin-stats-grid');
  if (statsGrid) {
    statsGrid.style.display = panel === 'telegram' ? 'none' : '';
  }

  // Update topbar title
  const titleEl = document.querySelector('.admin-topbar__title');
  if (titleEl) {
    const titles = { inventory: 'Inventory Management', discounts: 'Discount Management' };
    titleEl.textContent = titles[panel] || 'Dashboard';
  }
}

// Exportar switchPanel globalmente
window.switchPanel = switchPanel;

/* ── Stat Cards ──────────────────────────────────────────────── */
function updateStatCards() {
  const total    = winesCache.length;
  const inStock  = winesCache.filter(w => w.stock > 5).length;
  const lowStock = winesCache.filter(w => w.stock > 0 && w.stock <= 5).length;
  const outStock = winesCache.filter(w => w.stock <= 0).length;

  setText('stat-total',     total);
  setText('stat-in-stock',  inStock);
  setText('stat-low-stock', lowStock);
  setText('stat-out-stock', outStock);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ── Inventory Table ─────────────────────────────────────────── */
function renderInventoryTable() {
  const tbody = document.querySelector('#inventory-table tbody');
  if (!tbody) return;

  if (winesCache.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center; padding:40px; color:var(--color-text-muted);">
        No wines in database. Add your first wine above.
      </td></tr>`;
    return;
  }

  const searchQuery = document.querySelector('#table-search')?.value.toLowerCase() || '';
  const display = searchQuery
    ? winesCache.filter(w => w.name.toLowerCase().includes(searchQuery) || w.category.toLowerCase().includes(searchQuery))
    : winesCache;

  tbody.innerHTML = display.map(wine => {
    const level = window.BifrostDB.constructor.stockLevel(wine.stock);
    const levelColors = { in: '#4CAF50', low: '#FFC107', out: '#F44336' };
    return `
      <tr>
        <td>
          <div class="wine-cell">
            <div class="wine-cell__thumb">
              ${wine.imageUrl
                ? `<img src="${wine.imageUrl}" alt="${wine.name}">`
                : wine.emoji || '🍷'}
            </div>
            <div class="wine-cell__info">
              <div class="wine-cell__name">${wine.name}</div>
              <div class="wine-cell__vintage">${wine.vintage}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--color-text-secondary)">${wine.category}</td>
        <td style="color:var(--color-gold); font-weight:600;">$${wine.price.toFixed(2)}</td>
        <td>
          <div class="stock-controls">
            <button class="stock-adj-btn" onclick="adjustStock(${wine.id}, -1)">−</button>
            <input type="number" class="stock-input" value="${wine.stock}"
              min="0" id="stock-${wine.id}"
              onchange="setStock(${wine.id}, this.value)">
            <button class="stock-adj-btn" onclick="adjustStock(${wine.id}, 1)">+</button>
          </div>
        </td>
        <td>
          <span style="
            display:inline-flex; align-items:center; gap:6px;
            font-size:0.75rem; font-weight:600;
            color:${levelColors[level]}">
            <span style="
              width:7px; height:7px; border-radius:50%;
              background:${levelColors[level]};
              box-shadow:0 0 6px ${levelColors[level]}88">
            </span>
            ${level === 'in' ? 'In Stock' : level === 'low' ? 'Low' : 'Out'}
          </span>
        </td>
        <td>
          ${wine.featured
            ? `<span style="color:var(--color-gold); font-size:0.75rem; font-weight:600;">★ Featured</span>`
            : `<span style="color:var(--color-text-muted); font-size:0.75rem;">—</span>`}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn--sm btn--outline" onclick="openEditWineModal(${wine.id})" title="Edit">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn btn--sm btn--danger" onclick="deleteWine(${wine.id})" title="Delete">
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ── Discount Table ──────────────────────────────────────────── */
function renderDiscountTable() {
  const tbody = document.querySelector('#discount-table tbody');
  if (!tbody) return;

  tbody.innerHTML = winesCache.map(wine => `
    <tr>
      <td>
        <div class="wine-cell">
          <div class="wine-cell__thumb">${wine.emoji || '🍷'}</div>
          <div class="wine-cell__info">
            <div class="wine-cell__name">${wine.name}</div>
            <div class="wine-cell__vintage">${wine.vintage} · ${wine.category}</div>
          </div>
        </div>
      </td>
      <td style="color:var(--color-gold); font-weight:600;">$${wine.price.toFixed(2)}</td>
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" class="discount-input" id="disc-${wine.id}"
            value="${wine.discount || 0}" min="0" max="100"
            onchange="setDiscount(${wine.id}, this.value)">
          <span style="color:var(--color-text-muted); font-size:0.75rem;">%</span>
        </div>
      </td>
      <td style="color:var(--color-text-secondary); font-size:0.875rem;">
        ${wine.discount > 0
          ? `$${(wine.price * (1 - wine.discount / 100)).toFixed(2)}`
          : `<span style="color:var(--color-text-muted)">No discount</span>`}
      </td>
      <td>
        <button class="btn btn--sm btn--outline" onclick="applyDiscount(${wine.id})">Apply</button>
      </td>
    </tr>`).join('');
}

/* ── Stock Controls ──────────────────────────────────────────── */
async function adjustStock(id, delta) {
  const wine = winesCache.find(w => w.id === id);
  if (!wine) return;

  const newStock = Math.max(0, wine.stock + delta);
  await updateWineField(id, { stock: newStock });
  const input = document.getElementById(`stock-${id}`);
  if (input) input.value = newStock;
  showToast(`${wine.name}: Stock → ${newStock}`, 'success');
}

async function setStock(id, rawValue) {
  const value = parseInt(rawValue) || 0;
  const newStock = Math.max(0, value);
  const wine = winesCache.find(w => w.id === id);
  if (!wine) return;
  await updateWineField(id, { stock: newStock });
  showToast(`${wine.name}: Stock updated to ${newStock}`, 'success');
}

/* ── Discount Controls ───────────────────────────────────────── */
async function setDiscount(id, rawValue) {
  // Just stores value temporarily; applyDiscount confirms
}

async function applyDiscount(id) {
  const input = document.getElementById(`disc-${id}`);
  if (!input) return;

  const pct = Math.max(0, Math.min(100, parseInt(input.value) || 0));
  const wine = winesCache.find(w => w.id === id);
  if (!wine) return;

  await updateWineField(id, { discount: pct });
  input.value = pct;
  renderDiscountTable();
  showToast(`${wine.name}: ${pct ? `${pct}% discount applied` : 'Discount removed'}`, 'success');
}

/* ── Shared field update ─────────────────────────────────────── */
async function updateWineField(id, fields) {
  const idx = winesCache.findIndex(w => w.id === id);
  if (idx === -1) return;

  const updated = { ...winesCache[idx], ...fields };
  await window.BifrostDB.updateWine(updated);
  winesCache[idx] = updated;
  updateStatCards();
  renderInventoryTable();
}

/* ── Flash Sale ──────────────────────────────────────────────── */
function initFlashSale() {
  const toggle    = document.getElementById('flash-sale-toggle');
  const pctInput  = document.getElementById('flash-sale-pct');

  if (!toggle || !pctInput) return;

  toggle.addEventListener('change', toggleFlashSale);
  pctInput.addEventListener('change', updateFlashPct);
}

async function toggleFlashSale() {
  const toggle = document.getElementById('flash-sale-toggle');
  const active = toggle?.checked;
  settingsCache.flashSaleActive = active;
  await window.BifrostDB.saveSettings(settingsCache);
  syncFlashSaleUI();
  showToast(
    active
      ? `⚡ Vortex Flash Sale ACTIVE — ${settingsCache.flashSaleDiscount}% off all items!`
      : 'Flash Sale deactivated.',
    active ? 'success' : 'info'
  );
}

async function updateFlashPct() {
  const input = document.getElementById('flash-sale-pct');
  const pct   = Math.max(1, Math.min(99, parseInt(input?.value) || 20));
  if (input) input.value = pct;
  settingsCache.flashSaleDiscount = pct;
  await window.BifrostDB.saveSettings(settingsCache);
  showToast(`Flash sale discount updated to ${pct}%`, 'info');
}

function syncFlashSaleUI() {
  const toggle   = document.getElementById('flash-sale-toggle');
  const pctInput = document.getElementById('flash-sale-pct');
  const banner   = document.querySelector('.flash-sale-banner');

  if (toggle)   toggle.checked  = !!settingsCache?.flashSaleActive;
  if (pctInput) pctInput.value  = settingsCache?.flashSaleDiscount ?? 20;

  if (banner) {
    banner.style.borderColor = settingsCache?.flashSaleActive
      ? 'rgba(212,175,55,0.5)'
      : 'rgba(212,175,55,0.25)';
  }
}

/* ── Add / Edit Wine Modal ───────────────────────────────────── */
function initAddWineModal() {
  const openBtn  = document.getElementById('add-wine-btn');
  const modal    = document.getElementById('wine-modal');
  const form     = document.getElementById('wine-form');
  const cancelBtn = document.getElementById('cancel-wine-btn');

  if (!modal || !form) return;

  openBtn?.addEventListener('click', () => {
    editingWineId = null;
    resetWineForm();
    document.getElementById('wine-modal-title').textContent = 'Add New Wine';
    openModal(modal);
  });

  cancelBtn?.addEventListener('click', () => closeModal(modal));
  modal.querySelector('.modal__backdrop')?.addEventListener('click', () => closeModal(modal));
  modal.querySelector('.modal__close')?.addEventListener('click', () => closeModal(modal));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveWine(form, modal);
  });
}

function resetWineForm() {
  const form = document.getElementById('wine-form');
  if (form) form.reset();
  clearImageUpload();
}

/* ── Image Upload ───────────────────────────────────────── */
const MAX_IMG_BYTES = 5 * 1024 * 1024; // 5 MB

function initImageUpload() {
  const zone      = document.getElementById('img-upload-zone');
  const fileInput = document.getElementById('wine-image-file');
  const urlInput  = document.getElementById('wine-image');
  const clearBtn  = document.getElementById('img-clear-btn');

  if (!zone || !fileInput) return;

  /* ─ File input change ───────────────────────────────── */
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) processImageFile(file);
  });

  /* ─ Drag & Drop ───────────────────────────────────── */
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) processImageFile(file);
    else showToast('Solo se permiten archivos de imagen', 'warning');
  });

  /* ─ URL fallback ───────────────────────────────────── */
  urlInput?.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (url) {
      setImageFinal(url);
      showImagePreview(url, null);
    } else {
      // Only clear if no file was uploaded
      const final = document.getElementById('wine-image-final')?.value || '';
      if (!final.startsWith('data:')) clearImageUpload();
    }
  });

  /* ─ Clear button ───────────────────────────────────── */
  clearBtn?.addEventListener('click', clearImageUpload);
}

function processImageFile(file) {
  if (file.size > MAX_IMG_BYTES) {
    showToast(`La imagen es demasiado grande (máx. 5 MB). Tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB`, 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result;
    setImageFinal(base64);
    showImagePreview(base64, file);
    // Also clear the URL field to avoid confusion
    const urlInput = document.getElementById('wine-image');
    if (urlInput) urlInput.value = '';
  };
  reader.onerror = () => showToast('Error al leer el archivo', 'error');
  reader.readAsDataURL(file);
}

function showImagePreview(src, file) {
  const wrap    = document.getElementById('img-preview-wrap');
  const img     = document.getElementById('img-preview');
  const zone    = document.getElementById('img-upload-zone');
  const badge   = document.getElementById('img-size-badge');

  if (!wrap || !img) return;
  img.src = src;
  wrap.style.display = 'block';
  zone.style.display = 'none';

  if (badge && file) {
    const kb = (file.size / 1024).toFixed(0);
    const mb = (file.size / 1024 / 1024).toFixed(2);
    badge.textContent = file.size > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
  } else if (badge) {
    badge.textContent = '';
  }
}

function clearImageUpload() {
  const wrap      = document.getElementById('img-preview-wrap');
  const img       = document.getElementById('img-preview');
  const zone      = document.getElementById('img-upload-zone');
  const fileInput = document.getElementById('wine-image-file');
  const urlInput  = document.getElementById('wine-image');
  const final     = document.getElementById('wine-image-final');

  if (img)       img.src            = '';
  if (wrap)      wrap.style.display = 'none';
  if (zone)      zone.style.display = 'flex';
  if (fileInput) fileInput.value    = '';
  if (urlInput)  urlInput.value     = '';
  if (final)     final.value        = '';
}

function setImageFinal(value) {
  const el = document.getElementById('wine-image-final');
  if (el) el.value = value;
}

async function openEditWineModal(id) {
  const wine  = winesCache.find(w => w.id === id);
  const modal = document.getElementById('wine-modal');
  if (!wine || !modal) return;

  editingWineId = id;
  document.getElementById('wine-modal-title').textContent = 'Edit Wine';

  // Map values
  const fieldMap = {
    'wine-name':        wine.name,
    'wine-vintage':     wine.vintage,
    'wine-category':    wine.category,
    'wine-price':       wine.price,
    'wine-stock':       wine.stock,
    'wine-discount':    wine.discount || 0,
    'wine-description': wine.description,
    'wine-image':       wine.imageUrl || '',
    'wine-emoji':       wine.emoji || '🍷',
    'wine-region':      wine.region || '',
    'wine-alcohol':     wine.alcohol || '',
    'wine-pairing':     wine.pairing || '',
  };

  Object.entries(fieldMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  const featuredEl = document.getElementById('wine-featured');
  if (featuredEl) featuredEl.checked = !!wine.featured;

  const tastingEl = document.getElementById('wine-tasting');
  if (tastingEl) tastingEl.value = (wine.tastingNotes || []).join(', ');

  // Populate image: show preview if imageUrl exists
  clearImageUpload();
  if (wine.imageUrl) {
    setImageFinal(wine.imageUrl);
    // If it's a URL (not base64), populate the URL field and show preview
    if (!wine.imageUrl.startsWith('data:')) {
      const urlInput = document.getElementById('wine-image');
      if (urlInput) urlInput.value = wine.imageUrl;
    }
    showImagePreview(wine.imageUrl, null);
  }

  openModal(modal);
}

async function saveWine(form, modal) {
  const submitBtn = form.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving…';

  try {
    const tastingRaw = document.getElementById('wine-tasting')?.value || '';

    // Priority: base64 upload > URL field > keep existing on edit
    const finalImg   = document.getElementById('wine-image-final')?.value.trim() ||
                       document.getElementById('wine-image')?.value.trim() ||
                       '';

    const wineData = {
      name:         document.getElementById('wine-name')?.value.trim(),
      vintage:      parseInt(document.getElementById('wine-vintage')?.value) || new Date().getFullYear(),
      category:     document.getElementById('wine-category')?.value || 'Vino Tinto',
      price:        parseFloat(document.getElementById('wine-price')?.value) || 0,
      stock:        parseInt(document.getElementById('wine-stock')?.value) || 0,
      discount:     parseInt(document.getElementById('wine-discount')?.value) || 0,
      description:  document.getElementById('wine-description')?.value.trim() || '',
      imageUrl:     finalImg,
      emoji:        document.getElementById('wine-emoji')?.value.trim() || '',
      region:       document.getElementById('wine-region')?.value.trim() || '',
      alcohol:      document.getElementById('wine-alcohol')?.value.trim() || '',
      pairing:      document.getElementById('wine-pairing')?.value.trim() || '',
      featured:     document.getElementById('wine-featured')?.checked || false,
      tastingNotes: tastingRaw.split(',').map(t => t.trim()).filter(Boolean),
    };

    if (editingWineId) {
      wineData.id = editingWineId;
      await window.BifrostDB.updateWine(wineData);
      const idx = winesCache.findIndex(w => w.id === editingWineId);
      if (idx !== -1) winesCache[idx] = wineData;
      showToast(`${wineData.name} updated successfully`, 'success');
    } else {
      const added = await window.BifrostDB.addWine(wineData);
      winesCache.push(added);
      showToast(`${wineData.name} added to collection`, 'success');
    }

    renderInventoryTable();
    renderDiscountTable();
    updateStatCards();
    _updateNavWineCount();
    closeModal(modal);
  } catch (err) {
    console.error('Save wine error:', err);
    showToast('Failed to save wine', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Wine';
  }
}

/* ── Delete Wine ─────────────────────────────────────────────── */
async function deleteWine(id) {
  const wine = winesCache.find(w => w.id === id);
  if (!wine) return;

  if (!confirm(`Delete "${wine.name}" (${wine.vintage})? This cannot be undone.`)) return;

  try {
    await window.BifrostDB.deleteWine(id);
    winesCache = winesCache.filter(w => w.id !== id);
    renderInventoryTable();
    renderDiscountTable();
    updateStatCards();
    _updateNavWineCount();
    showToast(`${wine.name} removed from collection`, 'info');
  } catch (err) {
    console.error('Delete error:', err);
    showToast('Failed to delete wine', 'error');
  }
}

/* ── Search / Filter ─────────────────────────────────────────── */
function initSearchFilter() {
  const input = document.getElementById('table-search');
  if (!input) return;

  input.addEventListener('input', () => {
    renderInventoryTable();
  });
}

/* ── Modal Helpers ───────────────────────────────────────────── */
function openModal(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
  editingWineId = null;
  clearImageUpload(); // reset upload zone on every close
}

/* ── Mobile Sidebar ──────────────────────────────────────────── */
function initMobileMenu() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar   = document.querySelector('.admin-sidebar');

  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('mobile-open') &&
        !sidebar.contains(e.target) &&
        e.target !== toggleBtn) {
      sidebar.classList.remove('mobile-open');
    }
  });
}

/* ── Toast (fallback if main.js not loaded) ─────────────────── */
if (typeof window.showToast !== 'function') {
  window.showToast = function(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
  };
}

/* ── Global Exports ──────────────────────────────────────────── */
window.adjustStock     = adjustStock;
window.setStock        = setStock;
window.applyDiscount   = applyDiscount;
window.deleteWine      = deleteWine;
window.openEditWineModal = openEditWineModal;
