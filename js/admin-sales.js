/* ============================================================
   BIFROST WINES — admin-sales.js
   Panel de Ventas: Registro Web + Mercado, KPIs, Historial
   ============================================================ */

let salesCache = [];
let winesForSales = [];
let salesFilter = 'all';   // 'all' | 'web' | 'mercado' | 'otro'
let salesSort   = 'newest';
let editingSaleId = null;

/* ── Bootstrap ───────────────────────────────────────────────── */
async function initSalesPanel() {
  await window.BifrostDB.ready();
  [salesCache, winesForSales] = await Promise.all([
    window.BifrostDB.getAllSales(),
    window.BifrostDB.getAllWines(),
  ]);

  populateSaleWineSelect();
  renderSalesKPIs();
  renderSalesTable();
  initSalesModal();
  initSalesFilters();
  initSalesSort();
}

/* ── Populate Wine Selector ──────────────────────────────────── */
function populateSaleWineSelect() {
  const sel = document.getElementById('sale-wine-id');
  if (!sel) return;
  sel.innerHTML = `<option value="">— Vino externo / no listado —</option>` +
    winesForSales.map(w =>
      `<option value="${w.id}">${w.name} (${w.vintage}) — $${w.price.toFixed(2)}</option>`
    ).join('');
}

/* ── KPI Cards ───────────────────────────────────────────────── */
function renderSalesKPIs() {
  const all     = salesCache;
  const web     = all.filter(s => s.channel === 'web');
  const mercado = all.filter(s => s.channel === 'mercado');
  const otro    = all.filter(s => s.channel === 'otro');

  const totalRev  = all.reduce((s, v) => s + (v.totalAmount || 0), 0);
  const webRev    = web.reduce((s, v) => s + (v.totalAmount || 0), 0);
  const mercRev   = mercado.reduce((s, v) => s + (v.totalAmount || 0), 0);
  const totalUnits = all.reduce((s, v) => s + (v.quantity || 0), 0);

  // Best-seller
  const productMap = {};
  all.forEach(s => {
    const k = s.wineName || 'Sin nombre';
    productMap[k] = (productMap[k] || 0) + (s.quantity || 0);
  });
  const bestSeller = Object.entries(productMap).sort((a, b) => b[1] - a[1])[0];

  // This-month sales
  const now = new Date();
  const thisMonth = all.filter(s => {
    const d = new Date(s.date || s.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthRev = thisMonth.reduce((s, v) => s + (v.totalAmount || 0), 0);

  setKPI('kpi-total-rev',    `$${totalRev.toFixed(2)}`);
  setKPI('kpi-web-rev',      `$${webRev.toFixed(2)}`);
  setKPI('kpi-mercado-rev',  `$${mercRev.toFixed(2)}`);
  setKPI('kpi-total-units',  totalUnits);
  setKPI('kpi-month-rev',    `$${monthRev.toFixed(2)}`);
  setKPI('kpi-best-seller',  bestSeller ? `${bestSeller[0]} (${bestSeller[1]} u.)` : '—');
  setKPI('kpi-web-count',    web.length);
  setKPI('kpi-mercado-count',mercado.length);

  // Progress bar web vs mercado
  const totalForBar = webRev + mercRev || 1;
  const webPct  = Math.round((webRev  / totalForBar) * 100);
  const mercPct = 100 - webPct;
  const barWeb  = document.getElementById('bar-web');
  const barMerc = document.getElementById('bar-mercado');
  if (barWeb)  barWeb.style.width  = `${webPct}%`;
  if (barMerc) barMerc.style.width = `${mercPct}%`;

  const labWeb  = document.getElementById('bar-web-label');
  const labMerc = document.getElementById('bar-mercado-label');
  if (labWeb)  labWeb.textContent  = `Web ${webPct}%`;
  if (labMerc) labMerc.textContent = `Mercado ${mercPct}%`;
}

function setKPI(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ── Filters / Sort ──────────────────────────────────────────── */
function initSalesFilters() {
  document.querySelectorAll('.sales-filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.sales-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      salesFilter = chip.dataset.filter || 'all';
      renderSalesTable();
    });
  });
}

function initSalesSort() {
  const sel = document.getElementById('sales-sort');
  if (!sel) return;
  sel.addEventListener('change', () => {
    salesSort = sel.value;
    renderSalesTable();
  });
}

/* ── Sales Table ─────────────────────────────────────────────── */
function renderSalesTable() {
  const tbody = document.querySelector('#sales-table tbody');
  if (!tbody) return;

  let data = salesFilter === 'all'
    ? [...salesCache]
    : salesCache.filter(s => s.channel === salesFilter);

  // Sort
  if (salesSort === 'newest')  data.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));
  if (salesSort === 'oldest')  data.sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt));
  if (salesSort === 'highest') data.sort((a, b) => b.totalAmount - a.totalAmount);
  if (salesSort === 'lowest')  data.sort((a, b) => a.totalAmount - b.totalAmount);

  const channelColors = {
    web:     { bg: 'rgba(69,162,158,0.15)',  color: '#45A29E', label: 'Web' },
    mercado: { bg: 'rgba(212,175,55,0.15)',  color: '#D4AF37', label: 'Mercado' },
    otro:    { bg: 'rgba(150,100,200,0.15)', color: '#9B6DD9', label: 'Otro' },
  };

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--color-text-muted);">
      No hay ventas registradas${salesFilter !== 'all' ? ' en este canal' : ''}. Agrega la primera venta.
    </td></tr>`;

    // Update count
    const cnt = document.getElementById('sales-count');
    if (cnt) cnt.textContent = '0 registros';
    return;
  }

  tbody.innerHTML = data.map(sale => {
    const ch = channelColors[sale.channel] || channelColors.otro;
    const dateStr = sale.date
      ? new Date(sale.date + 'T00:00:00').toLocaleDateString('es-NI', { day:'2-digit', month:'short', year:'numeric' })
      : new Date(sale.createdAt).toLocaleDateString('es-NI', { day:'2-digit', month:'short', year:'numeric' });

    return `<tr>
      <td style="font-size:0.75rem;color:var(--color-text-muted);">${dateStr}</td>
      <td>
        <span style="display:inline-block;padding:2px 10px;border-radius:var(--radius-full);
          background:${ch.bg};color:${ch.color};font-size:0.7rem;font-weight:700;letter-spacing:0.08em;">
          ${ch.label}
        </span>
      </td>
      <td>
        <div style="font-weight:600;font-size:0.875rem;">${sale.wineName || '—'}</div>
        ${sale.notes ? `<div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:2px;">${sale.notes}</div>` : ''}
      </td>
      <td style="text-align:center;font-weight:600;">${sale.quantity}</td>
      <td style="color:var(--color-text-secondary);">$${(sale.pricePerUnit || 0).toFixed(2)}</td>
      <td style="color:var(--color-gold);font-weight:700;">$${(sale.totalAmount || 0).toFixed(2)}</td>
      <td style="font-size:0.7rem;color:var(--color-text-muted);">${sale.registeredBy || '—'}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn--sm btn--outline" onclick="openEditSaleModal(${sale.id})" title="Editar">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button class="btn btn--sm btn--danger" onclick="deleteSaleRecord(${sale.id})" title="Eliminar">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const cnt = document.getElementById('sales-count');
  if (cnt) cnt.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''}`;
}

/* ── Modal ───────────────────────────────────────────────────── */
function initSalesModal() {
  const openBtn = document.getElementById('add-sale-btn');
  const modal   = document.getElementById('sale-modal');
  const form    = document.getElementById('sale-form');
  const cancelBtn = document.getElementById('cancel-sale-btn');

  if (!modal || !form) return;

  openBtn?.addEventListener('click', () => {
    editingSaleId = null;
    resetSaleForm();
    document.getElementById('sale-modal-title').textContent = 'Registrar Venta';
    openAdminModal(modal);
  });

  cancelBtn?.addEventListener('click', () => closeAdminModal(modal));
  modal.querySelector('.modal__backdrop')?.addEventListener('click', () => closeAdminModal(modal));
  modal.querySelector('.modal__close')?.addEventListener('click', () => closeAdminModal(modal));

  // Auto-fill price when wine selected
  const wineSelect = document.getElementById('sale-wine-id');
  const priceInput = document.getElementById('sale-price');
  const nameInput  = document.getElementById('sale-wine-name');
  const qtyInput   = document.getElementById('sale-quantity');
  const totalEl    = document.getElementById('sale-total-preview');

  function recalcTotal() {
    const qty   = parseFloat(qtyInput?.value) || 0;
    const price = parseFloat(priceInput?.value) || 0;
    if (totalEl) totalEl.textContent = `Total: $${(qty * price).toFixed(2)}`;
  }

  wineSelect?.addEventListener('change', () => {
    const id   = parseInt(wineSelect.value);
    const wine = winesForSales.find(w => w.id === id);
    if (wine) {
      if (priceInput && !priceInput.value) priceInput.value = wine.price.toFixed(2);
      if (nameInput)  nameInput.value  = `${wine.name} ${wine.vintage}`;
      recalcTotal();
    }
  });

  priceInput?.addEventListener('input', recalcTotal);
  qtyInput?.addEventListener('input', recalcTotal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSale(form, modal);
  });
}

function resetSaleForm() {
  const form = document.getElementById('sale-form');
  if (form) form.reset();
  // Set today's date
  const dateInput = document.getElementById('sale-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  // Set logged-in user
  const byInput = document.getElementById('sale-registered-by');
  if (byInput) byInput.value = window.AdminAuth?.getUser() || '';
  const totalEl = document.getElementById('sale-total-preview');
  if (totalEl) totalEl.textContent = 'Total: $0.00';
}

async function openEditSaleModal(id) {
  const sale  = salesCache.find(s => s.id === id);
  const modal = document.getElementById('sale-modal');
  if (!sale || !modal) return;

  editingSaleId = id;
  document.getElementById('sale-modal-title').textContent = 'Editar Venta';

  const fields = {
    'sale-wine-id':       sale.wineId  || '',
    'sale-wine-name':     sale.wineName || '',
    'sale-channel':       sale.channel  || 'web',
    'sale-quantity':      sale.quantity || 1,
    'sale-price':         sale.pricePerUnit || 0,
    'sale-date':          sale.date || new Date().toISOString().split('T')[0],
    'sale-notes':         sale.notes || '',
    'sale-registered-by': sale.registeredBy || '',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  const totalEl = document.getElementById('sale-total-preview');
  if (totalEl) totalEl.textContent = `Total: $${(sale.totalAmount || 0).toFixed(2)}`;

  openAdminModal(modal);
}

async function saveSale(form, modal) {
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  try {
    const wineId = document.getElementById('sale-wine-id')?.value;
    const wine   = wineId ? winesForSales.find(w => w.id === parseInt(wineId)) : null;
    const name   = document.getElementById('sale-wine-name')?.value.trim()
                   || (wine ? `${wine.name} ${wine.vintage}` : '');
    const qty    = parseFloat(document.getElementById('sale-quantity')?.value) || 0;
    const price  = parseFloat(document.getElementById('sale-price')?.value) || 0;

    const saleData = {
      wineId:       wine?.id || null,
      wineName:     name,
      channel:      document.getElementById('sale-channel')?.value || 'web',
      quantity:     qty,
      pricePerUnit: price,
      totalAmount:  Math.round(qty * price * 100) / 100,
      date:         document.getElementById('sale-date')?.value || new Date().toISOString().split('T')[0],
      notes:        document.getElementById('sale-notes')?.value.trim() || '',
      registeredBy: document.getElementById('sale-registered-by')?.value.trim()
                    || window.AdminAuth?.getUser() || '',
    };

    if (!saleData.wineName) { showToast('Ingresa el nombre del vino', 'warning'); return; }
    if (qty <= 0)           { showToast('La cantidad debe ser mayor a 0', 'warning'); return; }
    if (price < 0)          { showToast('El precio no puede ser negativo', 'warning'); return; }

    if (editingSaleId) {
      saleData.id = editingSaleId;
      saleData.createdAt = salesCache.find(s => s.id === editingSaleId)?.createdAt || new Date().toISOString();
      await window.BifrostDB.updateSale(saleData);
      const idx = salesCache.findIndex(s => s.id === editingSaleId);
      if (idx !== -1) salesCache[idx] = saleData;
      showToast('Venta actualizada', 'success');
    } else {
      const added = await window.BifrostDB.addSale(saleData);
      salesCache.push(added);
      showToast(`Venta registrada — $${saleData.totalAmount.toFixed(2)}`, 'success');
    }

    renderSalesKPIs();
    renderSalesTable();
    closeAdminModal(modal);
  } catch (err) {
    console.error('Error al guardar venta:', err);
    showToast('Error al guardar la venta', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar Venta';
  }
}

async function deleteSaleRecord(id) {
  const sale = salesCache.find(s => s.id === id);
  if (!sale) return;
  if (!confirm(`¿Eliminar la venta de "${sale.wineName}" ($${sale.totalAmount})? Esta acción no se puede deshacer.`)) return;

  try {
    await window.BifrostDB.deleteSale(id);
    salesCache = salesCache.filter(s => s.id !== id);
    renderSalesKPIs();
    renderSalesTable();
    showToast('Venta eliminada', 'info');
  } catch (err) {
    showToast('Error al eliminar la venta', 'error');
  }
}

/* ── Modal Helpers (local scope) ─────────────────────────────── */
function openAdminModal(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAdminModal(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
  editingSaleId = null;
}

/* ── Exports ─────────────────────────────────────────────────── */
window.initSalesPanel    = initSalesPanel;
window.openEditSaleModal = openEditSaleModal;
window.deleteSaleRecord  = deleteSaleRecord;
