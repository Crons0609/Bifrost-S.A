/* ============================================================
   BIFROST WINES — admin-costos-simple.js
   Maestro de Costos Simplificado
   Lógica: cálculo en tiempo real, guardado/carga de recetas,
   sincronización con Firebase Realtime Database.
   ============================================================ */

'use strict';

/* ── Estado: insumos extras dinámicos ─────────────────────── */
let insumosExtra = [];
let insumosCounter = 0;

/* ── Helpers ─────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const val = (id) => parseFloat($( id)?.value) || 0;
const str = (id) => $( id)?.value?.trim() || '';

function fmt(n) {
  return 'C$ ' + n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(msg, type = 'info') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `show ${type}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3000);
}

/* ── Cálculo Principal ──────────────────────────────────── */
function calcular() {
  // PASO 1: Materia Prima
  const costoMP     = val('mp-costo-total');
  const destajoUnit = val('destajo-por-saco');
  const destajoNum  = val('destajo-unidades');
  const costoDest   = destajoUnit * destajoNum;

  // PASO 2: Insumos
  const costoAgua     = val('agua-costo');
  const costoAzucar   = val('azucar-cantidad') * val('azucar-precio');
  const costoLevadura = val('levadura-cantidad') * val('levadura-precio');

  // Insumos extra
  let costoExtras = 0;
  insumosExtra.forEach(ins => {
    costoExtras += ins.costoTotal;
  });

  // TOTAL MASA
  const costoTotal = costoMP + costoDest + costoAgua + costoAzucar + costoLevadura + costoExtras;

  // PASO 3: Rendimiento
  const litros = val('litros-obtenidos');

  // PASO 4: Envasado
  const costoEmbotPorMil = val('costo-embotellado-mil');
  const costoEnvaseUnd   = val('costo-envase-und');

  // ── Resultados ──
  $('r-costo-total').textContent = fmt(costoTotal);
  $('r-costo-detalle').textContent =
    `MP: ${fmt(costoMP)} · Destajo: ${fmt(costoDest)} · Agua: ${fmt(costoAgua)} ·` +
    ` Azúcar: ${fmt(costoAzucar)} · Levadura: ${fmt(costoLevadura)} · Extras: ${fmt(costoExtras)}`;

  if (litros > 0) {
    const costoPorLitro  = costoTotal / litros;
    const costoPor750ml  = costoPorLitro * 0.75;

    $('r-costo-litro').textContent  = fmt(costoPorLitro);
    $('r-litros-sub').textContent   = `${litros} litros obtenidos del lote`;
    $('r-costo-botella').textContent = fmt(costoPor750ml);
    $('r-botella-sub').textContent  = 'Sin envase externo';

    // Envasado condicional
    const hayEnvasado = costoEmbotPorMil > 0 || costoEnvaseUnd > 0;
    let costoBaseFijarPrecio = costoPor750ml;

    if (hayEnvasado) {
      const embotPorLitro     = costoEmbotPorMil / 1000;
      const embotPorBotella   = embotPorLitro * 0.75;
      const costoConEnvase    = costoPor750ml + embotPorBotella + costoEnvaseUnd;
      $('r-costo-con-envase').textContent = fmt(costoConEnvase);
      $('r-bloque-envase').style.display  = '';
      costoBaseFijarPrecio = costoConEnvase;
    } else {
      $('r-bloque-envase').style.display = 'none';
      costoBaseFijarPrecio = costoPor750ml;
    }

    const margen = val('margen-ganancia') || 50;
    const precioSugerido = costoBaseFijarPrecio * (1 + (margen / 100));
    if ($('r-precio-mercado')) {
      $('r-precio-mercado').textContent = fmt(precioSugerido);
    }
  } else {
    $('r-costo-litro').textContent   = 'C$ —';
    $('r-litros-sub').textContent    = 'Ingresa los litros obtenidos';
    $('r-costo-botella').textContent = 'C$ —';
    $('r-botella-sub').textContent   = 'Sin embotellar';
    $('r-bloque-envase').style.display = 'none';
    if ($('r-precio-mercado')) $('r-precio-mercado').textContent = 'C$ —';
  }

  // ── Desglose visual ──
  const mpNombre = str('mp-nombre') || 'Materia Prima';
  const mpCant   = val('mp-cantidad');
  const mpUnidad = str('mp-unidad');
  const azCant   = val('azucar-cantidad');
  const azUnidad = str('azucar-unidad');
  const levCant  = val('levadura-cantidad');
  const levUnidad= str('levadura-unidad');
  const aguaL    = val('agua-litros');

  let rows = [
    { label: `${mpNombre} (${mpCant} ${mpUnidad})`,     val: costoMP,      color: 'var(--teal)' },
    { label: `Destajo/Preparación (${destajoNum} und)`, val: costoDest,    color: 'var(--gold)' },
    { label: `Agua (${aguaL} L)`,                       val: costoAgua,    color: '#64B5F6' },
    { label: `Azúcar (${azCant} ${azUnidad})`,          val: costoAzucar,  color: 'var(--gold)' },
    { label: `Levadura (${levCant} ${levUnidad})`,       val: costoLevadura,color: 'var(--orange)' },
  ];

  insumosExtra.forEach(ins => {
    if (ins.costoTotal > 0) {
      rows.push({ label: `${ins.nombre} (${ins.cantidad} ${ins.unidad})`, val: ins.costoTotal, color: '#CE93D8' });
    }
  });

  const desgloseHtml = rows.map(r => `
    <div style="display:flex; justify-content:space-between; padding:0.15rem 0; border-bottom:1px solid rgba(255,255,255,0.04);">
      <span style="color:var(--text-2);">${r.label}</span>
      <span style="font-family:var(--font-mono); color:${r.color};">${fmt(r.val)}</span>
    </div>
  `).join('') +
  `<div style="display:flex; justify-content:space-between; padding:0.4rem 0; border-top:1px solid rgba(212,175,55,0.3); margin-top:0.3rem; font-weight:700;">
    <span style="color:var(--text);">TOTAL MASA</span>
    <span style="font-family:var(--font-mono); color:var(--gold);">${fmt(costoTotal)}</span>
  </div>`;

  $('r-desglose').innerHTML = desgloseHtml;
}

/* ── Lista dinámica de insumos extra ──────────────────────── */
function agregarInsumo() {
  const id = `ins_${++insumosCounter}`;
  insumosExtra.push({ id, nombre: '', cantidad: 0, unidad: 'und', costoTotal: 0 });
  renderInsumosExtra();
  // Focus on the new name input
  setTimeout(() => {
    const el = document.querySelector(`[data-ins-nombre="${id}"]`);
    if (el) el.focus();
  }, 50);
}

function eliminarInsumo(id) {
  insumosExtra = insumosExtra.filter(i => i.id !== id);
  renderInsumosExtra();
  calcular();
}

function updateInsumo(id, field, value) {
  const ins = insumosExtra.find(i => i.id === id);
  if (!ins) return;
  if (field === 'costoTotal' || field === 'cantidad') {
    ins[field] = parseFloat(value) || 0;
  } else {
    ins[field] = value;
  }
  calcular();
}

function renderInsumosExtra() {
  const container = $('insumos-extra-container');
  const empty     = $('insumos-empty');
  if (!container) return;

  if (insumosExtra.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }

  if (empty) empty.style.display = 'none';

  container.innerHTML = insumosExtra.map(ins => `
    <div class="insumo-row" data-ins-id="${ins.id}">
      <input
        type="text"
        class="form-input"
        data-ins-nombre="${ins.id}"
        placeholder="Ej: Canela, Clavo…"
        value="${ins.nombre}"
        oninput="updateInsumo('${ins.id}','nombre',this.value)"
      >
      <input
        type="number"
        class="form-input input-gold col-qty"
        placeholder="Cant."
        value="${ins.cantidad || ''}"
        min="0"
        step="0.01"
        oninput="updateInsumo('${ins.id}','cantidad',this.value)"
      >
      <input
        type="text"
        class="form-input col-unit"
        placeholder="und"
        value="${ins.unidad}"
        oninput="updateInsumo('${ins.id}','unidad',this.value)"
      >
      <input
        type="number"
        class="form-input input-gold"
        placeholder="Costo total (NIO)"
        value="${ins.costoTotal || ''}"
        min="0"
        step="0.01"
        oninput="updateInsumo('${ins.id}','costoTotal',this.value)"
      >
      <button class="btn-remove" onclick="eliminarInsumo('${ins.id}')" title="Eliminar insumo">✕</button>
    </div>
  `).join('');
}

/* ── Guardar Receta ────────────────────────────────────────── */
function guardarReceta() {
  const nombre = str('receta-nombre');
  if (!nombre) {
    showToast('⚠️  Escribe un nombre para la receta', 'error');
    $('receta-nombre').focus();
    return;
  }

  const receta = {
    id:               `rec_${Date.now()}`,
    nombre,
    fecha:            new Date().toISOString().split('T')[0],
    mp_nombre:        str('mp-nombre'),
    mp_cantidad:      val('mp-cantidad'),
    mp_unidad:        str('mp-unidad'),
    mp_costo_total:   val('mp-costo-total'),
    destajo_por_saco: val('destajo-por-saco'),
    destajo_unidades: val('destajo-unidades'),
    agua_litros:      val('agua-litros'),
    agua_costo:       val('agua-costo'),
    azucar_cantidad:  val('azucar-cantidad'),
    azucar_unidad:    str('azucar-unidad'),
    azucar_precio:    val('azucar-precio'),
    levadura_cantidad:val('levadura-cantidad'),
    levadura_unidad:  str('levadura-unidad'),
    levadura_precio:  val('levadura-precio'),
    insumos_extra:    JSON.parse(JSON.stringify(insumosExtra)),
    litros_obtenidos: val('litros-obtenidos'),
    costo_embotellado_mil: val('costo-embotellado-mil'),
    costo_envase_und:      val('costo-envase-und'),
    margen_ganancia:       val('margen-ganancia'),
    costo_total_lote: _calcCostoTotal(),
    costo_por_litro:  _calcCostoPorLitro(),
  };

  // Guardar en localStorage
  const recetas = _getLocalRecetas();
  // Evitar nombre duplicado — actualizar si existe
  const existIdx = recetas.findIndex(r => r.nombre === nombre);
  if (existIdx !== -1) {
    receta.id = recetas[existIdx].id; // preserve id
    recetas[existIdx] = receta;
    showToast(`✅ Receta "${nombre}" actualizada`, 'success');
  } else {
    recetas.push(receta);
    showToast(`✅ Receta "${nombre}" guardada`, 'success');
  }
  localStorage.setItem('bifrost_cost_recetas', JSON.stringify(recetas));

  // Sync a Firebase si está disponible
  _syncRecetaFirebase(receta);

  $('receta-nombre').value = '';
  cargarHistorial();
  _populateRecipeSelector();
}

function _calcCostoTotal() {
  const costoMP     = val('mp-costo-total');
  const costoDest   = val('destajo-por-saco') * val('destajo-unidades');
  const costoAgua   = val('agua-costo');
  const costoAz     = val('azucar-cantidad') * val('azucar-precio');
  const costoLev    = val('levadura-cantidad') * val('levadura-precio');
  const costoExtras = insumosExtra.reduce((s, i) => s + i.costoTotal, 0);
  return costoMP + costoDest + costoAgua + costoAz + costoLev + costoExtras;
}

function _calcCostoPorLitro() {
  const litros = val('litros-obtenidos');
  if (!litros) return 0;
  return _calcCostoTotal() / litros;
}

/* ── Cargar Receta (SOLO cantidades, NO precios) ──────────── */
function cargarReceta() {
  const sel = str('sel-recipe');
  if (!sel) {
    showToast('Selecciona una receta primero', 'error');
    return;
  }

  const recetas = _getLocalRecetas();
  const receta  = recetas.find(r => r.id === sel);
  if (!receta) {
    showToast('Receta no encontrada', 'error');
    return;
  }

  // Cargar todos los datos (cantidades y precios) para mantener un historial exacto
  _setVal('mp-nombre',         receta.mp_nombre);
  _setVal('mp-cantidad',       receta.mp_cantidad);
  _setVal('mp-unidad',         receta.mp_unidad);
  _setVal('mp-costo-total',    receta.mp_costo_total);

  _setVal('destajo-por-saco',  receta.destajo_por_saco);
  _setVal('destajo-unidades',  receta.destajo_unidades);

  _setVal('agua-litros',       receta.agua_litros);
  _setVal('agua-costo',        receta.agua_costo);

  _setVal('azucar-cantidad',   receta.azucar_cantidad);
  _setVal('azucar-unidad',     receta.azucar_unidad);
  _setVal('azucar-precio',     receta.azucar_precio);

  _setVal('levadura-cantidad', receta.levadura_cantidad);
  _setVal('levadura-unidad',   receta.levadura_unidad);
  _setVal('levadura-precio',   receta.levadura_precio);

  _setVal('litros-obtenidos',  receta.litros_obtenidos);

  _setVal('costo-embotellado-mil', receta.costo_embotellado_mil);
  _setVal('costo-envase-und',      receta.costo_envase_und);
  _setVal('margen-ganancia',       receta.margen_ganancia !== undefined ? receta.margen_ganancia : 50);

  // Insumos extra: cargar todo, incluyendo precios (costoTotal)
  insumosExtra = (receta.insumos_extra || []).map((ins, i) => ({
    id:         `ins_${Date.now()}_${i}`,
    nombre:     ins.nombre,
    cantidad:   ins.cantidad,
    unidad:     ins.unidad || 'und',
    costoTotal: ins.costoTotal,
  }));
  insumosCounter = insumosExtra.length;
  renderInsumosExtra();

  calcular();
  showToast(`📂 Receta "${receta.nombre}" cargada — actualiza los precios`, 'info');
}

function _setVal(id, val) {
  const el = $(id);
  if (!el || val === undefined || val === null) return;
  el.value = val;
}

/* ── Historial ───────────────────────────────────────────── */
function cargarHistorial() {
  const recetas = _getLocalRecetas();
  const wrap    = $('history-wrap');
  if (!wrap) return;

  if (recetas.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">📭</div>
        <div class="empty-state__text">No hay recetas guardadas todavía.<br>Llena el formulario y haz clic en <strong>Guardar Receta</strong>.</div>
      </div>`;
    return;
  }

  // Ordenar por fecha descendente
  const sorted = [...recetas].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  wrap.innerHTML = `
    <div class="table-responsive">
    <table class="history-table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Fecha</th>
          <th>MP Principal</th>
          <th>Litros</th>
          <th>Costo Total</th>
          <th>C$/Litro</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(r => `
          <tr>
            <td style="font-weight:600; color:var(--text);">${r.nombre}</td>
            <td style="color:var(--text-muted); white-space:nowrap;">${r.fecha || '—'}</td>
            <td style="color:var(--teal);">${r.mp_nombre || '—'}</td>
            <td style="font-family:var(--font-mono); color:var(--text-2);">${r.litros_obtenidos || '—'} L</td>
            <td style="font-family:var(--font-mono); color:var(--gold);">${r.costo_total_lote ? 'C$ ' + r.costo_total_lote.toFixed(2) : '—'}</td>
            <td style="font-family:var(--font-mono); color:var(--teal);">${r.costo_por_litro ? 'C$ ' + r.costo_por_litro.toFixed(2) : '—'}</td>
            <td>
              <div style="display:flex; gap:0.35rem; align-items:center;">
                <button class="btn btn--teal btn--sm" onclick="cargarRecetaById('${r.id}')" title="Cargar esta receta">
                  📂 Cargar
                </button>
                <button class="btn btn--danger btn--sm" onclick="eliminarReceta('${r.id}')" title="Eliminar">
                  ✕
                </button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

function cargarRecetaById(id) {
  _setVal('sel-recipe', id);
  $('sel-recipe').value = id;
  cargarReceta();
}

function eliminarReceta(id) {
  const recetas = _getLocalRecetas().filter(r => r.id !== id);
  localStorage.setItem('bifrost_cost_recetas', JSON.stringify(recetas));
  _deleteRecetaFirebase(id);
  cargarHistorial();
  _populateRecipeSelector();
  showToast('Receta eliminada', 'info');
}

/* ── Selector de recetas ────────────────────────────────── */
function _populateRecipeSelector() {
  const sel     = $('sel-recipe');
  const recetas = _getLocalRecetas();
  if (!sel) return;

  sel.innerHTML = '<option value="">— Seleccionar receta —</option>' +
    [...recetas]
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))
      .map(r => `<option value="${r.id}">${r.nombre} (${r.fecha || '?'})</option>`)
      .join('');
}

/* ── Reset Formulario ───────────────────────────────────── */
function resetFormulario() {
  if (!confirm('¿Limpiar todo el formulario para una nueva producción?')) return;
  const inputs = document.querySelectorAll('.form-input, .form-select');
  inputs.forEach(el => { el.value = el.tagName === 'SELECT' ? el.options[0]?.value : ''; });
  insumosExtra = [];
  insumosCounter = 0;
  renderInsumosExtra();
  calcular();
}

/* ── Firebase Sync ─────────────────────────────────────── */
function _syncRecetaFirebase(receta) {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps?.length) {
      firebase.database().ref(`costos_recetas/${receta.id}`).set(receta)
        .catch(() => {}); // silencioso — localStorage es el primary
    } else if (window.BifrostDB?._fbDb) {
      window.BifrostDB._fbDb.ref(`costos_recetas/${receta.id}`).set(receta)
        .catch(() => {});
    }
  } catch(e) { /* Firebase puede no estar disponible en standalone */ }
}

function _deleteRecetaFirebase(id) {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps?.length) {
      firebase.database().ref(`costos_recetas/${id}`).remove().catch(() => {});
    }
  } catch(e) {}
}

/* ── localStorage helpers ──────────────────────────────── */
function _getLocalRecetas() {
  try {
    return JSON.parse(localStorage.getItem('bifrost_cost_recetas') || '[]');
  } catch {
    return [];
  }
}

/* ── Bootstrap ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  cargarHistorial();
  _populateRecipeSelector();
  calcular();
});
