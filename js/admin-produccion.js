/* ============================================================
   BIFROST WINES — admin-produccion.js
   Panel de Lotes de Producción
   Trazabilidad: producido → vendido → en stock por lote
   ============================================================ */

const _PROD_LOTES_KEY = 'bifrost_lotes_produccion';

function _getLotesFromStorage() {
  try { return JSON.parse(localStorage.getItem(_PROD_LOTES_KEY) || '[]'); } catch { return []; }
}

function _getSalesFromStorage() {
  try { return JSON.parse(localStorage.getItem('bifrost_sales') || '[]'); } catch { return []; }
}

/* ── Init ─────────────────────────────────────────────────────── */
async function initProduccionPanel() {
  renderProduccionKPIs();
  await renderLotesTable();

  // Also try to pull lotes from Firebase for cross-device sync
  _syncLotesFromFirebase();

  // Listen for storage changes from costos.html (same browser, different tab)
  window.addEventListener('storage', (e) => {
    if (e.key === _PROD_LOTES_KEY || e.key === 'bifrost_sales') {
      renderProduccionKPIs();
      renderLotesTable();
    }
  });
}

/* ── Firebase Sync ────────────────────────────────────────────── */
async function _syncLotesFromFirebase() {
  try {
    const base = 'https://bifrost-sa-default-rtdb.firebaseio.com';
    const res  = await fetch(`${base}/lotes_produccion.json`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data) return;

    const fbLotes = Object.values(data).filter(Boolean);
    const local   = _getLotesFromStorage();

    // Merge: keep all local, add any fb lotes not in local
    const merged = [...local];
    fbLotes.forEach(fl => {
      if (!merged.find(l => l.id === fl.id)) merged.push(fl);
    });

    if (merged.length !== local.length) {
      localStorage.setItem(_PROD_LOTES_KEY, JSON.stringify(merged));
      renderProduccionKPIs();
      renderLotesTable();
    }
  } catch (e) { /* offline — use local */ }
}

/* ── KPI Cards ────────────────────────────────────────────────── */
function renderProduccionKPIs() {
  const lotes = _getLotesFromStorage();
  const sales = _getSalesFromStorage();

  const totalProducidas = lotes.reduce((s, l) => s + (l.totalBotellas || 0), 0);
  const totalVendidas   = sales.reduce((s, v) => s + (parseInt(v.quantity) || 0), 0);
  const totalRestantes  = Math.max(0, totalProducidas - totalVendidas);
  const totalLotes      = lotes.length;

  _setText('prod-kpi-total',    totalProducidas.toLocaleString());
  _setText('prod-kpi-vendidas', totalVendidas.toLocaleString());
  _setText('prod-kpi-stock',    totalRestantes.toLocaleString());
  _setText('prod-kpi-lotes',    totalLotes);

  // Badge en sidebar
  const badge = document.getElementById('nav-prod-badge');
  if (badge) badge.textContent = totalLotes > 0 ? totalLotes : '';
}

/* ── Tabla de Lotes ───────────────────────────────────────────── */
async function renderLotesTable() {
  const wrap = document.getElementById('prod-table-body');
  if (!wrap) return;

  const lotes = _getLotesFromStorage()
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const sales = _getSalesFromStorage();

  if (lotes.length === 0) {
    wrap.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center;padding:48px 20px;color:var(--color-text-muted);">
          <div style="font-size:2rem;margin-bottom:0.5rem;">📦</div>
          <div style="font-weight:600;margin-bottom:0.3rem;">Sin lotes de producción registrados</div>
          <div style="font-size:0.8rem;">Guarda una <strong>Ficha de Producción</strong> en el Maestro de Costos para verla aquí.</div>
        </td>
      </tr>`;
    return;
  }

  wrap.innerHTML = lotes.map(lote => {
    // Calcular vendidas cruzando nombre del producto con ventas
    const lNombre = (lote.nombre || '').toLowerCase();
    const vendidas = sales
      .filter(s => {
        const sNombre = (s.wineName || s.product || '').toLowerCase();
        if (!sNombre || !lNombre) return false;
        const lWords = lNombre.split(/[\s()]+/).filter(w => w.length > 3);
        return lWords.some(w => sNombre.includes(w));
      })
      .reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0);

    const total     = lote.totalBotellas || 0;
    const restantes = Math.max(0, total - vendidas);
    const pct       = total > 0 ? Math.round((vendidas / total) * 100) : 0;

    const statusColor = restantes === 0
      ? '#F44336' : restantes <= 20
      ? '#FFC107' : '#4CAF50';

    const barColor = pct > 80
      ? '#4CAF50' : pct > 40
      ? '#FFC107' : '#45A29E';

    return `
      <tr>
        <td style="font-size:0.8rem;color:var(--color-text-muted);white-space:nowrap;">${lote.fecha || '—'}</td>
        <td>
          <div style="font-weight:600;font-size:0.85rem;color:var(--color-text);">${lote.nombre}</div>
          <div style="font-size:0.7rem;color:var(--color-text-muted);margin-top:2px;">Lote #&nbsp;<code style="color:var(--color-gold);font-size:0.72rem;">${lote.loteNumero || '—'}</code></div>
        </td>
        <td style="text-align:center;">
          <span style="font-family:monospace;font-size:1rem;font-weight:700;color:#45A29E;">${total.toLocaleString()}</span>
        </td>
        <td style="text-align:center;">
          <span style="font-family:monospace;font-weight:600;color:var(--color-gold);">${vendidas.toLocaleString()}</span>
        </td>
        <td style="text-align:center;">
          <span style="font-family:monospace;font-weight:700;color:${statusColor};">${restantes.toLocaleString()}</span>
        </td>
        <td style="min-width:100px;">
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${barColor};transition:width 0.6s ease;border-radius:3px;"></div>
          </div>
          <div style="font-size:0.65rem;color:var(--color-text-muted);margin-top:4px;text-align:right;">${pct}% vendido</div>
        </td>
        <td style="font-family:monospace;font-size:0.8rem;color:var(--color-gold);white-space:nowrap;">${lote.pvp || '—'}</td>
        <td>
          <button onclick="eliminarLoteProduccion('${lote.id}')"
            style="padding:0.25rem 0.5rem;border-radius:6px;border:1px solid rgba(239,83,80,0.3);
                   background:rgba(239,83,80,0.08);color:#EF5350;font-size:0.7rem;cursor:pointer;
                   transition:background 0.2s;"
            onmouseenter="this.style.background='rgba(239,83,80,0.18)'"
            onmouseleave="this.style.background='rgba(239,83,80,0.08)'"
            title="Eliminar del registro">✕</button>
        </td>
      </tr>`;
  }).join('');
}

/* ── Eliminar Lote ────────────────────────────────────────────── */
function eliminarLoteProduccion(id) {
  const lote = _getLotesFromStorage().find(l => l.id === id);
  const nombre = lote ? lote.nombre : 'este lote';
  if (!confirm(`¿Eliminar el lote de "${nombre}" del registro de producción?\n\n¡ATENCION! Esto REDUCIRÁ automáticamente las botellas de este lote del inventario de la tienda.`)) return;

  const updated = _getLotesFromStorage().filter(l => l.id !== id);
  localStorage.setItem(_PROD_LOTES_KEY, JSON.stringify(updated));

  // Remove from Firebase
  try {
    const base = 'https://bifrost-sa-default-rtdb.firebaseio.com';
    fetch(`${base}/lotes_produccion/${id}.json`, { method: 'DELETE' }).catch(() => {});
    
    // Descontar inmediatamente el stock en el inventario Ecommerce (si tiene ID enlazado)
    if (lote && lote.mcommerceId && lote.totalBotellas > 0) {
      fetch(`${base}/productos_ecommerce/${lote.mcommerceId}.json`)
        .then(r => r.json())
        .then(data => {
          if (data) {
            const newStock = Math.max(0, (data.stock || 0) - lote.totalBotellas);
            fetch(`${base}/productos_ecommerce/${lote.mcommerceId}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stock: newStock })
            });
            // Emitir evento local para actualizar la tabla del dashboard si está abierta
            setTimeout(() => window.dispatchEvent(new Event('wines-updated')), 500);
          }
        }).catch(err => console.warn('Error descontando stock en Firebase:', err));
    } else {
      setTimeout(() => window.dispatchEvent(new Event('wines-updated')), 500);
    }
  } catch(e) {}

  renderLotesTable();
  renderProduccionKPIs();
  
  if (window.showToast) window.showToast('Lote eliminado y stock descontado', 'info');
}

/* ── Utils ────────────────────────────────────────────────────── */
function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ── Exports ──────────────────────────────────────────────────── */
window.initProduccionPanel    = initProduccionPanel;
window.eliminarLoteProduccion = eliminarLoteProduccion;
