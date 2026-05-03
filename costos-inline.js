    // HELPERS
    // ──────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const num = id => parseFloat($(id)?.value) || 0;
    const fmt = (n, dec = 2) => (n || 0).toLocaleString('es-NI', { minimumFractionDigits: dec, maximumFractionDigits: dec });

    let pvpReal = 0;
    let unitariosData = [
      { id: 'u1', nombre: 'Agua', unit: 'L', precio: 5.29 },
      { id: 'u2', nombre: 'Clavo de olor', unit: 'pieza', precio: 0.16 },
      { id: 'u3', nombre: 'Canela', unit: 'g', precio: 0.8818 }, // 400 NIO per L (lb) / 453.59g
      { id: 'u4', nombre: 'Tamarindo', unit: 'lb', precio: 80 },
      { id: 'u5', nombre: 'Azúcar', unit: 'lb', precio: 13.60 },
      { id: 'u6', nombre: 'Levadura', unit: 'g', precio: 0.3539 }, // 40 NIO / 113g
      { id: 'u7', nombre: 'Leña', unit: 'pieza', precio: 2.5 } // 48 used = 120
    ];
    let mpData = [];
    let cifData = [];
    let activosData = [
      { id: 'a1', nombre: 'Barril de Roble', categoria: 'Fermentación', cantidad: 1, precioUnit: 0 },
      { id: 'a2', nombre: 'Báscula Digital', categoria: 'Medición', cantidad: 1, precioUnit: 0 },
      { id: 'a3', nombre: 'Medidor de Gramos', categoria: 'Medición', cantidad: 1, precioUnit: 0 },
      { id: 'a4', nombre: 'Garrafón 20L', categoria: 'Contenedores', cantidad: 1, precioUnit: 0 },
    ];
    const ACTIVOS_CATEGORIAS = ['Fermentación','Medición','Contenedores','Herramientas','Infraestructura','Otro'];

    function guardarUnitarios() {
      localStorage.setItem('bifrost_unitarios_db', JSON.stringify(unitariosData));
      _lujo_showToast('✅ Base de datos de costos unitarios guardada');
    }

    function cargarUnitarios() {
      try {
        const saved = localStorage.getItem('bifrost_unitarios_db');
        if (saved) unitariosData = JSON.parse(saved);
      } catch (e) { }
    }

    // ──────────────────────────────────────────────────
    // RENDERS
    // ──────────────────────────────────────────────────
    function renderUnitarios() {
      const tbody = $('lista-unitarios');
      tbody.innerHTML = '';
      unitariosData.forEach((u, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="text" class="form-input" style="padding:0.2rem;font-size:0.75rem;" value="${u.nombre}" onchange="updateU(${i},'nombre',this.value)"></td>
      <td><input type="text" class="form-input" style="padding:0.2rem;font-size:0.75rem;text-align:center;" value="${u.unit}" onchange="updateU(${i},'unit',this.value)"></td>
      <td><input type="number" class="insumo-price-input" value="${u.precio}" oninput="updateU(${i},'precio',this.value)"></td>
      <td style="text-align:center;"><button class="btn btn--danger" style="padding:0.1rem 0.3rem;" onclick="removeU(${i})">✕</button></td>
    `;
        tbody.appendChild(tr);
      });
      renderMP(); // Refresh MP selects
    }

    function updateU(index, field, val) {
      if (field === 'precio') unitariosData[index].precio = parseFloat(val) || 0;
      else unitariosData[index][field] = val;
      calcular();
    }

    function addUnitarioRow() {
      unitariosData.push({ id: 'u' + Date.now(), nombre: 'Nuevo Insumo', unit: 'und', precio: 0 });
      renderUnitarios();
    }
    function removeU(i) { unitariosData.splice(i, 1); renderUnitarios(); calcular(); }

    function renderMP(skipSync = false) {
      const tbody = $('lista-mp');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (!skipSync) {
        // Auto-sync mpData with unitariosData so names appear automatically
        const newMpData = [];
        unitariosData.forEach(u => {
          let existing = mpData.find(mp => mp.unitId === u.id);
          if (existing) {
            newMpData.push(existing);
          } else {
            newMpData.push({ unitId: u.id, usado: 0 });
          }
        });
        mpData.forEach(mp => {
          if (!unitariosData.find(u => u.id === mp.unitId)) {
            newMpData.push(mp);
          }
        });
        mpData = newMpData;
      }

      mpData.forEach((mp, i) => {
        const tr = document.createElement('tr');
        // Generar opciones y precálculo
        const options = unitariosData.map(u => `<option value="${u.id}" ${u.id === mp.unitId ? 'selected' : ''}>${u.nombre} (${u.precio}/${u.unit})</option>`).join('');

        // Si unitId es 'custom', quiere decir que se cargó del Maestro Simplificado y no tiene unidad estricta
        let customOpt = mp.unitId === 'custom' ? `<option value="custom" selected>${mp.nombreCustom} (Costo Fijo)</option>` : '';

        const refU = unitariosData.find(u => u.id === mp.unitId);
        let totalLine = 0;
        if (refU) {
          totalLine = refU.precio * mp.usado;
        } else if (mp.unitId === 'custom') {
          totalLine = mp.usado; // Aquí usado funciona como valor absoluto
        }

        let nameDisplay = '';
        let btnDisplay = '';

        if (mp.unitId === 'custom' || !refU) {
          nameDisplay = `
        <select class="form-select" style="padding:0.2rem;font-size:0.75rem;" onchange="updateMP(${i},'unitId',this.value)">
          <option value="">-- Seleccionar --</option>
          ${options}
          ${customOpt}
        </select>
      `;
          btnDisplay = `<button class="btn btn--danger" style="padding:0.1rem 0.3rem;" onclick="removeMP(${i})">✕</button>`;
        } else {
          nameDisplay = `<div style="padding:0.2rem;font-size:0.8rem;font-weight:600;color:var(--text);">${refU.nombre}</div>`;
          btnDisplay = ``;
        }

        tr.innerHTML = `
      <td>${nameDisplay}</td>
      <td style="position:relative;">
        <input type="number" class="insumo-price-input" style="padding-right:1.3rem;" value="${mp.usado}" oninput="updateMP(${i},'usado',this.value)">
        ${refU ? `<span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:0.65rem; color:var(--text-muted); pointer-events:none;">${refU.unit}</span>` : ''}
      </td>
      <td style="text-align:right;">
        <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--teal);font-weight:600;">${fmt(totalLine)}</span>
        ${refU ? `<div style="font-size:0.6rem;color:var(--text-muted);line-height:1.2;margin-top:0.15rem;white-space:nowrap;">${refU.nombre}: ${fmt(refU.precio)}/${refU.unit} &middot; usado ${mp.usado}</div>` : ''}
      </td>
      <td style="text-align:center;">${btnDisplay}</td>
    `;
        tbody.appendChild(tr);
      });
    }

    function updateMP(index, field, val) {
      if (field === 'usado') mpData[index].usado = parseFloat(val) || 0;
      else mpData[index][field] = val;

      // Actualizar solo la celda de total de esta fila (sin re-renderizar toda la tabla)
      const tbody = $('lista-mp');
      if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        const row = rows[index];
        if (row) {
          const mp = mpData[index];
          const refU = unitariosData.find(u => u.id === mp.unitId);
          let totalLine = 0;
          if (refU) {
            totalLine = refU.precio * mp.usado;
          } else if (mp.unitId === 'custom') {
            totalLine = mp.usado;
          }
          // Celda de total es la tercera columna (index 2)
          const totalCell = row.cells[2];
          if (totalCell) {
            totalCell.innerHTML = `
          <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--teal);font-weight:600;">${fmt(totalLine)}</span>
          ${refU ? `<div style="font-size:0.6rem;color:var(--text-muted);line-height:1.2;margin-top:0.15rem;white-space:nowrap;">${refU.nombre}: ${fmt(refU.precio)}/${refU.unit} &middot; usado ${mp.usado}</div>` : ''}
        `;
          }
        }
      }

      // Solo recalcular totales globales (CPT, etc.)
      calcular();
    }
    function addMPRow() { mpData.push({ unitId: '', usado: 1 }); renderMP(); }
    function removeMP(i) { mpData.splice(i, 1); renderMP(); calcular(); }

    function renderCIF() {
      const tbody = $('lista-cif');
      tbody.innerHTML = '';
      cifData.forEach((cif, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td><input type="text" class="form-input" style="padding:0.2rem;font-size:0.75rem;" value="${cif.concepto}" onchange="updateCIF(${i},'concepto',this.value)"></td>
      <td><input type="number" class="insumo-price-input" value="${cif.total}" oninput="updateCIF(${i},'total',this.value)"></td>
      <td style="text-align:center;"><button class="btn btn--danger" style="padding:0.1rem 0.3rem;" onclick="removeCIF(${i})">✕</button></td>
    `;
        tbody.appendChild(tr);
      });
    }
    function updateCIF(index, field, val) {
      if (field === 'total') cifData[index].total = parseFloat(val) || 0;
      else cifData[index][field] = val;
      calcular();
    }
    function addCIFRow() { cifData.push({ concepto: 'Nuevo CIF', total: 0 }); renderCIF(); }
    function removeCIF(i) { cifData.splice(i, 1); renderCIF(); calcular(); }

    // ──────────────────────────────────────────────────
    // ACTIVOS FIJOS — CRUD
    // ──────────────────────────────────────────────────
    function renderActivos() {
      const tbody = $('lista-activos');
      if (tbody) {
        tbody.innerHTML = '';
        activosData.forEach((a, i) => {
          const tr = document.createElement('tr');
          const catOpts = ACTIVOS_CATEGORIAS.map(c => `<option value="${c}" ${c === a.categoria ? 'selected' : ''}>${c}</option>`).join('');
          const total = (parseFloat(a.cantidad) || 0) * (parseFloat(a.precioUnit) || 0);
          tr.innerHTML = `
            <td><input type="text" class="form-input" style="padding:0.2rem;font-size:0.75rem;min-width:90px;" value="${a.nombre}" onchange="updateActivo(${i},'nombre',this.value)"></td>
            <td><select class="form-select" style="padding:0.2rem;font-size:0.72rem;" onchange="updateActivo(${i},'categoria',this.value)">${catOpts}</select></td>
            <td style="text-align:center;"><input type="number" class="insumo-price-input" style="width:52px;" value="${a.cantidad}" min="1" oninput="updateActivo(${i},'cantidad',this.value)"></td>
            <td><input type="number" class="insumo-price-input" value="${a.precioUnit}" min="0" step="0.01" oninput="updateActivo(${i},'precioUnit',this.value)"></td>
            <td style="text-align:right;font-family:var(--font-mono);font-size:0.8rem;color:var(--teal);" id="activo-total-${i}">${fmt(total)}</td>
            <td style="text-align:center;"><button class="btn btn--danger" style="padding:0.1rem 0.3rem;" onclick="removeActivo(${i})">✕</button></td>
          `;
          tbody.appendChild(tr);
        });
      }
      renderActivosPanel();
    }

    function renderActivosPanel() {
      const body = $('activos-registry-body');
      if (!body) return;

      let grandTotal = 0;
      let rows = '';

      activosData.forEach((a) => {
        const qty = parseFloat(a.cantidad) || 0;
        const price = parseFloat(a.precioUnit) || 0;
        const total = qty * price;
        grandTotal += total;

        const catColor = {
          'Fermentación': 'rgba(156,39,176,0.15)', 'Medición': 'rgba(69,162,158,0.15)',
          'Contenedores': 'rgba(255,152,0,0.15)', 'Herramientas': 'rgba(76,175,80,0.15)',
          'Infraestructura': 'rgba(33,150,243,0.15)', 'Otro': 'rgba(255,255,255,0.07)'
        }[a.categoria] || 'rgba(255,255,255,0.07)';

        rows += `
          <tr>
            <td style="font-weight:600;color:var(--text);">${a.nombre || '—'}</td>
            <td><span style="display:inline-block;padding:0.12rem 0.5rem;border-radius:99px;font-size:0.62rem;font-weight:600;background:${catColor};color:var(--text-secondary);">${a.categoria || 'Otro'}</span></td>
            <td style="text-align:center;font-family:var(--font-mono);color:var(--text-secondary);">${qty}</td>
            <td style="text-align:right;font-family:var(--font-mono);color:var(--text-secondary);">C$ ${fmt(price)}</td>
            <td style="text-align:right;font-family:var(--font-mono);color:var(--teal);font-weight:600;">C$ ${fmt(total)}</td>
          </tr>`;
      });

      if (activosData.length === 0) {
        body.innerHTML = `<tr id="activos-empty-row"><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem 0;font-size:0.82rem;">No hay activos registrados. Usa el panel izquierdo para agregar equipos.</td></tr>`;
      } else {
        body.innerHTML = rows;
      }

      // Actualizar hero
      const displayEl = $('activos-total-display');
      const countEl = $('activos-count-display');
      const grandCell = $('activos-grand-total-cell');
      const badgeEl = $('activos-sidebar-badge');

      if (displayEl) displayEl.textContent = 'C$ ' + fmt(grandTotal);
      if (countEl) countEl.textContent = activosData.length;
      if (grandCell) grandCell.textContent = 'C$ ' + fmt(grandTotal);
      if (badgeEl) badgeEl.textContent = 'C$ ' + fmt(grandTotal);
    }

    function updateActivo(index, field, val) {
      if (field === 'cantidad') activosData[index].cantidad = parseFloat(val) || 0;
      else if (field === 'precioUnit') activosData[index].precioUnit = parseFloat(val) || 0;
      else activosData[index][field] = val;

      // Actualizar celda de total en sidebar sin re-renderizar toda la tabla
      const totalEl = $('activo-total-' + index);
      if (totalEl) {
        const total = (activosData[index].cantidad || 0) * (activosData[index].precioUnit || 0);
        totalEl.textContent = fmt(total);
      }
      renderActivosPanel();
    }

    function addActivoRow() {
      activosData.push({ id: 'a' + Date.now(), nombre: 'Nuevo Activo', categoria: 'Herramientas', cantidad: 1, precioUnit: 0 });
      if (!document.getElementById('acc-activos').classList.contains('open')) {
        toggleAccordion('acc-activos');
      }
      renderActivos();
      // Scroll al panel de activos
      setTimeout(() => { const p = $('activos-panel'); if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    }

    function removeActivo(i) { activosData.splice(i, 1); renderActivos(); }

    function guardarActivos() {
      localStorage.setItem('bifrost_activos_fijos', JSON.stringify(activosData));
      _fb_syncActivosToFirebase();
      _lujo_showToast('✅ Activos fijos guardados correctamente');
    }

    function cargarActivos() {
      try {
        const saved = localStorage.getItem('bifrost_activos_fijos');
        if (saved) activosData = JSON.parse(saved);
      } catch(e) { /* usar defaults */ }
    }

    // ──────────────────────────────────────────────────
    // CÁLCULO PRINCIPAL
    // ──────────────────────────────────────────────────
    function calcular() {
      // ─ MATERIA PRIMA (DINÁMICA) ─
      let totalMP = 0;
      mpData.forEach(mp => {
        if (mp.unitId === 'custom') {
          totalMP += mp.usado;
        } else {
          const ref = unitariosData.find(u => u.id === mp.unitId);
          if (ref) totalMP += (ref.precio * mp.usado);
        }
      });

      // ─ MANO DE OBRA ─
      const totalMOD = num('m-h-cosecha') * num('m-p-cosecha');

      // ─ CIF (DINÁMICO) ─
      let totalCIF = 0;
      cifData.forEach(c => totalCIF += c.total);

      // ─ CPT ─
      const CPT = totalMP + totalMOD + totalCIF;

      // ─ LITROS ─
      const litroBrutos = num('lote-kg'); // Ahora asumimos que Lote KG es directamente L obtenidos como pidió
      const rendimiento = 1; //num('rendimiento');
      const pctLias = num('merma-lias') / 100;
      const litrosMermaLias = litroBrutos * pctLias;
      const litrosTrasLias = litroBrutos - litrosMermaLias;

      // Ángel de Evaporación
      const meses = num('meses-barrica');
      const angelPctMensual = num('angel-pct') / 100;
      const litrosPostAngel = litrosTrasLias * Math.pow(1 - angelPctMensual, meses);
      const litrosPerdidosAngel = litrosTrasLias - litrosPostAngel;
      const litrosNetos = litrosPostAngel;
      const botVol = parseFloat($('botella-vol')?.value || 0.75);

      // Guard: si no hay litros, mostrar ceros y salir
      if (litrosNetos <= 0 || CPT === 0) {
        const zeroFields = ['r-litros-brutos', 'r-litros-angel', 'r-litros-lias', 'r-litros-netos',
          'r-botellas', 'r-cpt', 'r-costo-litro', 'r-costo-vino', 'r-envasado', 'r-caja-prorr',
          'r-ex-works', 'r-mkt', 'r-costo-com', 'r-pvp-antes', 'r-isc', 'r-iva-item',
          'r-costo-total-sin-pvp', 'r-pvp-final', 'r-venta-total-lote', 'r-ganancia-total-lote', 'r-pvp-usd', 'eq-botellas-min',
          'eq-botellas-total', 'eq-botellas-util'];
        zeroFields.forEach(id => { if ($(id)) $(id).textContent = '0'; });
        if ($('r-litros-brutos')) $('r-litros-brutos').textContent = fmt(litroBrutos, 1) + ' L';
        if ($('r-cpt')) $('r-cpt').textContent = fmt(CPT) + ' NIO';
        if ($('eq-summary') && litrosNetos <= 0 && litroBrutos > 0)
          $('eq-summary').innerHTML = '<span style="color:var(--orange);">⚠️ Con los datos actuales no quedan litros netos para embotellar. Revisa los porcentajes de merma.</span>';
        return;
      }

      const totalBotellas = Math.floor((litrosNetos / botVol) * 10) / 10;

      // ─ COSTOS POR BOTELLA ─
      const costoLitro = (litrosNetos > 0) ? (CPT / litrosNetos) : 0;
      const costoVinoBot = costoLitro * botVol;
      const envasado = num('e-botella') + num('e-corcho') + num('e-capsula') +
        num('e-etiq-front') + num('e-etiq-back') + num('e-medallon');
      const cajaProrr = num('e-caja') / 6;
      const exWorks = costoVinoBot + envasado + cajaProrr;

      // ─ PVP ─
      const pctMkt = num('pct-marketing') / 100;
      const pctMargen = num('pct-margen') / 100;
      const pctISC = num('pct-isc') / 100;
      const pctIVA = num('pct-iva') / 100;
      const tc = num('tc-usd') || 36.5;

      const mkting = exWorks * pctMkt;
      const costoCom = exWorks + mkting;
      const pvpAntesImp = pctMargen < 1 ? (costoCom / (1 - pctMargen)) : 0;
      const iscVal = pvpAntesImp * pctISC;
      const pvpConISC = pvpAntesImp + iscVal;
      const ivaVal = pvpConISC * pctIVA;
      const pvpFinal = pvpConISC + ivaVal;
      pvpReal = pvpFinal;
      const pvpUSD = pvpFinal / tc;
      const margenReal = pvpFinal > 0 ? ((pvpFinal - exWorks) / pvpFinal * 100) : 0;
      const ventaTotalLote = pvpFinal * totalBotellas;
      const gananciaTotalLote = ventaTotalLote - CPT;

      // ─ PUNTO DE EQUILIBRIO ─
      const varUnit = exWorks;
      const contribucionUnit = pvpFinal - varUnit;
      const breakEven = contribucionUnit > 0 ? Math.ceil(CPT / contribucionUnit) : 0;
      const botellasPuro = Math.floor(totalBotellas) - breakEven;
      const pctBreakEven = totalBotellas > 0 ? Math.min((breakEven / totalBotellas) * 100, 100) : 0;

      // ─────── ACTUALIZAR DOM ───────
      if ($('r-mp')) $('r-mp').textContent = fmt(totalMP) + ' NIO';
      if ($('r-mp-pct') && CPT > 0) $('r-mp-pct').textContent = fmt(totalMP / CPT * 100, 1) + '% del CPT';
      if ($('r-mod')) $('r-mod').textContent = fmt(totalMOD) + ' NIO';
      if ($('r-mod-pct') && CPT > 0) $('r-mod-pct').textContent = fmt(totalMOD / CPT * 100, 1) + '% del CPT';
      if ($('r-cif')) $('r-cif').textContent = fmt(totalCIF) + ' NIO';
      if ($('r-cif-pct') && CPT > 0) $('r-cif-pct').textContent = fmt(totalCIF / CPT * 100, 1) + '% del CPT';

      if ($('r-litros-brutos')) $('r-litros-brutos').textContent = fmt(litroBrutos, 1) + ' L';
      if ($('r-angel-pct-display')) $('r-angel-pct-display').textContent = meses;
      if ($('r-angel-mpct-display')) $('r-angel-mpct-display').textContent = num('angel-pct');
      if ($('merma-lias-display')) $('merma-lias-display').textContent = num('merma-lias');
      if ($('botella-vol-display')) $('botella-vol-display').textContent = (botVol * 1000);

      if ($('r-litros-angel')) $('r-litros-angel').textContent = '-' + fmt(litrosPerdidosAngel, 1) + ' L';
      if ($('r-litros-lias')) $('r-litros-lias').textContent = '-' + fmt(litrosMermaLias, 1) + ' L';
      if ($('r-litros-netos')) $('r-litros-netos').textContent = fmt(litrosNetos, 1) + ' L';
      if ($('r-botellas')) $('r-botellas').textContent = fmt(totalBotellas, 0) + ' u';
      if ($('r-cpt')) $('r-cpt').textContent = fmt(CPT) + ' NIO';
      if ($('r-costo-litro')) $('r-costo-litro').textContent = fmt(costoLitro) + ' NIO/L';
      if ($('r-costo-vino')) $('r-costo-vino').textContent = fmt(costoVinoBot) + ' NIO';
      if ($('r-envasado')) $('r-envasado').textContent = fmt(envasado) + ' NIO';
      if ($('r-caja-prorr')) $('r-caja-prorr').textContent = fmt(cajaProrr) + ' NIO';
      if ($('r-ex-works')) $('r-ex-works').textContent = fmt(exWorks) + ' NIO';
      if ($('r-mkt')) $('r-mkt').textContent = '+' + fmt(mkting) + ' NIO';
      if ($('r-costo-com')) $('r-costo-com').textContent = fmt(costoCom) + ' NIO';
      if ($('r-margen-label')) $('r-margen-label').textContent = num('pct-margen') + '%';
      if ($('r-pvp-antes')) $('r-pvp-antes').textContent = fmt(pvpAntesImp) + ' NIO';
      if ($('r-isc')) $('r-isc').textContent = '+' + fmt(iscVal) + ' NIO (' + num('pct-isc') + '%)';
      if ($('r-iva-item')) $('r-iva-item').textContent = '+' + fmt(ivaVal) + ' NIO (' + num('pct-iva') + '%)';

      if ($('r-costo-total-sin-pvp')) $('r-costo-total-sin-pvp').textContent = fmt(costoCom) + ' NIO';
      if ($('r-pvp-final')) $('r-pvp-final').textContent = fmt(pvpFinal) + ' NIO';
      if ($('r-venta-total-lote')) $('r-venta-total-lote').textContent = fmt(ventaTotalLote) + ' NIO';
      if ($('r-ganancia-total-lote')) $('r-ganancia-total-lote').textContent = fmt(gananciaTotalLote) + ' NIO';

      if ($('hero-pvp-nio')) $('hero-pvp-nio').textContent = fmt(pvpFinal) + ' NIO';
      if ($('hero-pvp-usd')) $('hero-pvp-usd').textContent = '≈ USD $' + fmt(pvpUSD);
      if ($('hero-ex-works')) $('hero-ex-works').textContent = fmt(exWorks);
      if ($('hero-margen-real')) $('hero-margen-real').textContent = fmt(margenReal, 1) + '%';
      if ($('hero-botellas')) $('hero-botellas').textContent = fmt(totalBotellas, 0);

      if ($('eq-botellas-min')) $('eq-botellas-min').textContent = breakEven;
      if ($('eq-botellas-total')) $('eq-botellas-total').textContent = fmt(totalBotellas, 0);
      if ($('eq-botellas-util')) $('eq-botellas-util').textContent = Math.max(botellasPuro, 0);
      if ($('eq-bar')) $('eq-bar').style.width = pctBreakEven + '%';
      if ($('eq-marker')) $('eq-marker').style.left = pctBreakEven + '%';
      if ($('eq-marker-label')) $('eq-marker-label').textContent = 'Equilibrio: bot. #' + breakEven;
      if ($('eq-total-label')) $('eq-total-label').textContent = fmt(totalBotellas, 0) + ' total';
      if ($('eq-summary')) {
        if (contribucionUnit <= 0 && totalBotellas > 0) {
          $('eq-summary').innerHTML = `<span style="color:var(--red);">⚠️ <strong>Atención:</strong> Tus porcentajes actuales no generan margen de utilidad.</span> El PVP sugerido es igual al costo variable, por lo tanto <strong>nunca recuperarás el costo del lote completo de ${fmt(CPT)} NIO</strong>. Ajusta el "Margen Utilidad" en el panel derecho.`;
        } else {
          $('eq-summary').innerHTML = `Necesitas vender <strong>${breakEven} botellas</strong> (${fmt(pctBreakEven, 1)}% del lote) para cubrir el <strong>Costo Total del Lote de ${fmt(CPT)} NIO</strong>. Las botellas restantes representan <strong>utilidad pura de ${fmt(Math.max(botellasPuro, 0) * contribucionUnit)} NIO</strong>.`;
        }
      }

      // Actualizar tabla MP mostrando totales actualizados en cada fila (sin re-renderizar)
      const tbody = $('lista-mp');
      if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        mpData.forEach((mp, i) => {
          const row = rows[i];
          if (!row) return;
          const refU = unitariosData.find(u => u.id === mp.unitId);
          let totalLine = 0;
          if (refU) totalLine = refU.precio * mp.usado;
          else if (mp.unitId === 'custom') totalLine = mp.usado;
          const totalCell = row.cells[2];
          if (totalCell) {
            totalCell.innerHTML = `
          <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--teal);font-weight:600;">${fmt(totalLine)}</span>
          ${refU ? `<div style="font-size:0.6rem;color:var(--text-muted);line-height:1.2;margin-top:0.15rem;white-space:nowrap;">${refU.nombre}: ${fmt(refU.precio)}/${refU.unit} &middot; usado ${mp.usado}</div>` : ''}
        `;
          }
        });
      }
    }

    // ──────────────────────────────────────────────────
    // SISTEMA DE RECETAS (HÍBRIDO LUJO Y SIMPLE)
    // ──────────────────────────────────────────────────
    const _LUJO_KEY = 'bifrost_cost_recetas_lujo';
    const _SIMPLE_KEY = 'bifrost_cost_historico';

    const _SCALAR_FIELDS = [
      'lote-nombre', 'lote-numero', 'lote-kg', 'rendimiento', 'botella-vol', 'meses-barrica', 'angel-pct', 'merma-lias',
      'e-botella', 'e-corcho', 'e-capsula', 'e-etiq-front', 'e-etiq-back', 'e-medallon', 'e-caja',
      'm-h-cosecha', 'm-p-cosecha',
      'pct-marketing', 'pct-margen', 'pct-isc', 'pct-iva', 'tc-usd'
    ];

    function generarNuevoLote() {
      const d = new Date();
      const dias = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return dias[d.getDay()] + dd + mm + yyyy;
    }
    function actualizarLote() {
      const el = document.getElementById('lote-numero');
      if (!el.value) { el.value = generarNuevoLote(); }
    }

    function _lujo_getRecetas() {
      try { return JSON.parse(localStorage.getItem(_LUJO_KEY) || '[]'); } catch { return []; }
    }

    function _simple_getRecetas() {
      try { return JSON.parse(localStorage.getItem(_SIMPLE_KEY) || '[]'); } catch { return []; }
    }

    function _lujo_showToast(msg, ok = true) {
      const existing = document.getElementById('lujo-toast');
      const t = existing || (() => {
        const el = document.createElement('div');
        el.id = 'lujo-toast';
        el.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;padding:0.65rem 1.1rem;border-radius:10px;font-size:0.82rem;font-weight:600;opacity:0;transition:opacity 0.25s ease;pointer-events:none;max-width:320px;';
        document.body.appendChild(el);
        return el;
      })();
      t.textContent = msg;
      t.style.background = ok ? 'rgba(76,175,80,0.18)' : 'rgba(239,83,80,0.18)';
      t.style.border = ok ? '1px solid rgba(76,175,80,0.35)' : '1px solid rgba(239,83,80,0.35)';
      t.style.color = ok ? '#81C784' : '#EF9A9A';
      t.style.opacity = '1';
      clearTimeout(t._t);
      t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
    }

    let _ecommerceWinesCache = [];

    async function _cargarVinosEcommerce() {
      try {
        const res = await fetch(`${_FB_BASE}/productos_ecommerce.json`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;
        _ecommerceWinesCache = Object.values(data).filter(Boolean);
        const sel = $('lote-nombre-sel');
        if (sel) {
          const existingIds = Array.from(sel.options).map(o => o.value);
          _ecommerceWinesCache.forEach(w => {
            if (!existingIds.includes(String(w.id))) {
              const opt = document.createElement('option');
              opt.value = w.id;
              opt.textContent = `${w.emoji || '🍷'} ${w.name}`;
              opt.setAttribute('data-name', w.name);
              sel.appendChild(opt);
            }
          });
        }
      } catch (e) { console.warn('No se pudo cargar vinos:', e); }
    }

    function handleProductSelect() {
      const sel = $('lote-nombre-sel');
      let name = '';
      if (sel.selectedIndex >= 0) {
        name = sel.options[sel.selectedIndex].getAttribute('data-name') || sel.options[sel.selectedIndex].text;
      }
      $('lote-nombre').value = name;
      actualizarLote();
    }

    function guardarRecetaLujo() {
      let nombre = "";
      let mcommerceId = "";
      let skipInitialFirebaseDelta = false;

      const selEl = $('lote-nombre-sel');
      const pvp = $('r-pvp-final')?.textContent || '—';
      const parsedPvp = parseFloat(pvp.replace(/[^\d.-]/g, '')) || 0;
      const bots = $('r-botellas')?.textContent || '—';
      const parsedBots = parseInt(bots.replace(/[^\d.-]/g, '')) || 0;

      mcommerceId = selEl.value;
      if (selEl.selectedIndex >= 0) {
        const opt = selEl.options[selEl.selectedIndex];
        nombre = opt.getAttribute('data-name') || opt.textContent;
      }

      if (!nombre || nombre === "— Sin enlazar a tienda —" || !mcommerceId) {
        _lujo_showToast('⚠️ Debes enlazar un producto existente del catálogo', false);
        return;
      }
      $('lote-nombre').value = nombre;

      const campos = {};
      _SCALAR_FIELDS.forEach(id => {
        const el = $(id);
        if (el) campos[id] = el.value;
      });

      const exw = $('r-ex-works')?.textContent || '—';
      const cpt = $('r-cpt')?.textContent || '—';

      const recetas = _lujo_getRecetas();
      const existIdx = recetas.findIndex(r => r.nombre === nombre);
      const receta = {
        id: existIdx !== -1 ? recetas[existIdx].id : `lujo_${Date.now()}`,
        nombre,
        fecha: new Date().toISOString().split('T')[0],
        campos,
        unitarios: JSON.parse(JSON.stringify(unitariosData)),
        mp: JSON.parse(JSON.stringify(mpData)),
        cif: JSON.parse(JSON.stringify(cifData)),
        res_pvp: pvp,
        res_exw: exw,
        res_bots: bots,
        res_cpt: cpt,
      };

      if (existIdx !== -1) { recetas[existIdx] = receta; }
      else { recetas.push(receta); }

      localStorage.setItem(_LUJO_KEY, JSON.stringify(recetas));
      _fb_syncRecetaToFirebase(receta);

      if (bots && bots !== '—') {
        const loteNum = campos['lote-numero'] || '';
        _registrarLoteProduccion({ nombre, mcommerceId, parsedBots, loteNum, pvp, exw, recetaId: receta.id, skipDelta: skipInitialFirebaseDelta });
      }

      _lujo_populateSelector();
      renderHistorialLujo();
      _lujo_showToast(`✅ Proyecto "${nombre}" guardado exitosamente`);
    }

    // ─────────────────────────────────────────────────────────────
    // FIREBASE SYNC — Recetas Históricas + Fichas de Producción
    // ─────────────────────────────────────────────────────────────
    const _FB_BASE = 'https://bifrost-sa-default-rtdb.firebaseio.com';

    // Guarda/actualiza una receta en Firebase bajo /recetas_lujo/{id}
    function _fb_syncRecetaToFirebase(receta) {
      fetch(`${_FB_BASE}/recetas_lujo/${receta.id}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(receta)
      }).catch(err => console.warn('Firebase sync receta failed:', err));
    }

    // Elimina una receta de Firebase
    function _fb_deleteRecetaFromFirebase(id) {
      fetch(`${_FB_BASE}/recetas_lujo/${id}.json`, {
        method: 'DELETE'
      }).catch(() => { });
    }

    // ─ Sync activos a Firebase
    function _fb_syncActivosToFirebase() {
      const payload = Object.fromEntries(activosData.map(a => [a.id, a]));
      fetch(`${_FB_BASE}/activos_fijos.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Firebase sync activos failed:', err));
    }

    // ─ Carga activos desde Firebase
    async function _fb_loadActivosFromFirebase() {
      try {
        const res = await fetch(`${_FB_BASE}/activos_fijos.json`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;
        const fbActivos = Object.values(data).filter(Boolean);
        if (fbActivos.length > 0) {
          activosData = fbActivos;
          localStorage.setItem('bifrost_activos_fijos', JSON.stringify(activosData));
          renderActivos();
        }
      } catch(e) { /* offline — usar localStorage */ }
    }

    // Descarga todas las recetas desde Firebase y las fusiona con localStorage
    async function _fb_loadRecetasFromFirebase() {
      try {
        const res = await fetch(`${_FB_BASE}/recetas_lujo.json`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data) return;

        const fbRecetas = Object.values(data).filter(Boolean);

        // Firebase es la única fuente de la verdad. Hacemos un reemplazo estricto.
        // Cualquier receta que se haya borrado en Firebase o en otra pestaña, se borrará aquí.
        const merged = fbRecetas;


        localStorage.setItem(_LUJO_KEY, JSON.stringify(merged));
        _lujo_populateSelector();
        renderHistorialLujo();
      } catch (e) { /* offline — usar localStorage */ }
    }

    // ─────────────────────────────────────────────────────────────
    // HELPER: Registro inteligente de Lote de Producción
    // Mismo lote-numero → ajuste delta | Nuevo lote → suma total
    // ─────────────────────────────────────────────────────────────
    const _LOTES_PROD_KEY = 'bifrost_lotes_produccion';

    function _getLotesProduccion() {
      try { return JSON.parse(localStorage.getItem(_LOTES_PROD_KEY) || '[]'); } catch { return []; }
    }

    function _registrarLoteProduccion({ nombre, mcommerceId, parsedBots, loteNum, pvp, exw, recetaId, skipDelta }) {
      const lotes = _getLotesProduccion();
      const today = new Date().toISOString().split('T')[0];
      // Convertir pvp string ("C$ 50.00") a número para pasarla a Firebase
      const parsedPvp = parseFloat((pvp || '0').replace(/[^\d.-]/g, '')) || 0;

      if (loteNum) {
        const existing = lotes.find(l => l.loteNumero === loteNum);
        if (existing) {
          // Mismo número de lote → corrección (delta)
          const delta = parsedBots - (existing.totalBotellas || 0);
          existing.totalBotellas = parsedBots;
          existing.pvp = pvp;
          existing.exw = exw;
          existing.fecha = today;
          existing.recetaId = recetaId;
          if (mcommerceId && delta !== 0 && !skipDelta) {
            _pushDeltaStockToFirebase(mcommerceId, delta, parsedPvp);
            if (delta !== 0) _lujo_showToast(`📦 Lote #${loteNum} ajustado: ${delta > 0 ? '+' : ''}${delta} bot.`, delta >= 0);
          }
        } else {
          // Número de lote diferente → nuevo lote, suma completa
          lotes.push({
            id: `lote_${Date.now()}`,
            loteNumero: loteNum,
            fecha: today,
            nombre,
            mcommerceId,
            totalBotellas: parsedBots,
            pvp,
            exw,
            recetaId
          });
          if (mcommerceId && parsedBots > 0 && !skipDelta) _pushDeltaStockToFirebase(mcommerceId, parsedBots, parsedPvp);
        }
      } else {
        // Sin número de lote → registrar como nuevo lote genérico
        lotes.push({
          id: `lote_${Date.now()}`,
          loteNumero: `auto_${Date.now()}`,
          fecha: today,
          nombre,
          mcommerceId,
          totalBotellas: parsedBots,
          pvp,
          exw,
          recetaId
        });
        if (mcommerceId && parsedBots > 0 && !skipDelta) _pushDeltaStockToFirebase(mcommerceId, parsedBots, parsedPvp);
      }

      localStorage.setItem(_LOTES_PROD_KEY, JSON.stringify(lotes));

      // Sync lotes + receta_cpt a Firebase bajo /lotes_produccion
      const fbLotes = Object.fromEntries(lotes.map(l => [l.id, l]));
      fetch(`${_FB_BASE}/lotes_produccion.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbLotes)
      }).catch(() => { });
    }

    // HELPER: Aplica un delta (positivo o negativo) al stock en Firebase
    // También actualiza precio si se proporciona pvpValue > 0
    function _pushDeltaStockToFirebase(mcommerceId, delta, pvpValue) {
      if (!mcommerceId || delta === 0) return;
      fetch(`${_FB_BASE}/productos_ecommerce/${mcommerceId}.json`)
        .then(r => r.json())
        .then(data => {
          if (data) {
            const newStock = Math.max(0, (data.stock || 0) + delta);
            const patch = { stock: newStock };
            const parsedPvpValue = parseFloat(pvpValue) || 0;
            if (parsedPvpValue > 0) patch.price = parsedPvpValue;
            fetch(`${_FB_BASE}/productos_ecommerce/${mcommerceId}.json`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(patch)
            });
          }
        }).catch(err => console.warn('Error actualizando stock Firebase:', err));
    }

    function _lujo_populateSelector() {
      const sel = $('sel-recipe-lujo');
      if (!sel) return;
      const lujos = _lujo_getRecetas().map(r => `<option value="l_${r.id}">👑 ${r.nombre} (${r.fecha || '?'})</option>`);
      const simples = _simple_getRecetas().map(s => `<option value="s_${s.id}">📝 ${s.nombre} (Simplificado)</option>`);

      sel.innerHTML = '<option value="">— Seleccionar —</option>' +
        '<optgroup label="Proyectos Bifrost">' + lujos.join('') + '</optgroup>' +
        '<optgroup label="Recetas Simplificadas">' + simples.join('') + '</optgroup>';
    }

    function cargarRecetaLujo() {
      const selVal = $('sel-recipe-lujo')?.value;
      if (!selVal) { _lujo_showToast('Selecciona una receta', false); return; }

      const isLujo = selVal.startsWith('l_');
      const idRaw = selVal.substring(2);

      if (isLujo) {
        const receta = _lujo_getRecetas().find(r => r.id === idRaw);
        if (!receta) return;

        // 1. Restaurar todos los campos escalares (inputs, selects, numbers)
        Object.entries(receta.campos || {}).forEach(([fieldId, val]) => {
          const el = $(fieldId);
          if (!el) return;
          el.value = val;
        });

        if (receta.campos && receta.campos['lote-nombre']) {
          const loadedName = receta.campos['lote-nombre'];
          const sel = $('lote-nombre-sel');
          let found = false;
          Array.from(sel.options).forEach(opt => {
              const optName = (opt.getAttribute('data-name') || '').toLowerCase();
              const optText = (opt.text || '').toLowerCase();
              const reqName = loadedName.toLowerCase();
              if (optName === reqName || optText.includes(reqName) || reqName.includes(optName.replace(/[^\w\s()]/gi, '').trim())) {
                  sel.value = opt.value;
                  found = true;
              }
          });
          if (!found && sel.options.length > 0) {
              sel.selectedIndex = 0; // Si no se encuentra, seleccionar el primero por defecto
          }
        }

        // 2. Restaurar unitariosData (base de precios unitarios)
        if (receta.unitarios) unitariosData = JSON.parse(JSON.stringify(receta.unitarios));

        // 3. Restaurar mpData y cifData ANTES de renderizar para que el sync los encuentre
        if (receta.mp) mpData = JSON.parse(JSON.stringify(receta.mp));
        if (receta.cif) cifData = JSON.parse(JSON.stringify(receta.cif));

        // 4. Renderizar unitarios (internamente llama renderMP con sync normal)
        //    El sync encontrará los mpData restaurados y mantendrá sus cantidades
        renderUnitarios();

        // 5. Pero renderUnitarios->renderMP puede haber mezclado datos — restaurar de nuevo
        //    y renderizar MP sin sync (skipSync=true) para respetar exactamente los datos guardados
        if (receta.mp) mpData = JSON.parse(JSON.stringify(receta.mp));
        if (receta.cif) cifData = JSON.parse(JSON.stringify(receta.cif));
        renderMP(true);   // skipSync: no sobreescribir cantidades
        renderCIF();

        // 6. Calcular inmediatamente + con delay para garantizar que el DOM esté listo
        calcular();
        setTimeout(calcular, 50);

        _lujo_showToast(`📂 Proyecto "${receta.nombre}" cargado — listo para editar`);

      } else {
        // Importar desde Simplificado
        const recetaS = _simple_getRecetas().find(r => r.id === idRaw);
        if (!recetaS) return;

        if ($('lote-nombre')) $('lote-nombre').value = recetaS.nombre;
        if ($('lote-kg')) $('lote-kg').value = recetaS.litros_obtenidos || 208;

        mpData = [];
        cifData = [];

        if (parseFloat(recetaS.mp_costo_total) > 0)
          mpData.push({ unitId: 'custom', nombreCustom: `MP: ${recetaS.mp_nombre || 'Fruta Base'}`, usado: parseFloat(recetaS.mp_costo_total) });
        if (parseFloat(recetaS.agua_costo) > 0)
          mpData.push({ unitId: 'custom', nombreCustom: 'Agua Lote', usado: parseFloat(recetaS.agua_costo) });
        if (parseFloat(recetaS.azucar_precio) > 0 && parseFloat(recetaS.azucar_cantidad) > 0)
          mpData.push({ unitId: 'custom', nombreCustom: 'Azúcar Lote', usado: parseFloat(recetaS.azucar_precio) * parseFloat(recetaS.azucar_cantidad) });
        if (parseFloat(recetaS.levadura_precio) > 0 && parseFloat(recetaS.levadura_cantidad) > 0)
          mpData.push({ unitId: 'custom', nombreCustom: 'Levadura Lote', usado: parseFloat(recetaS.levadura_precio) * parseFloat(recetaS.levadura_cantidad) });

        (recetaS.insumos_extra || []).forEach(ins =>
          mpData.push({ unitId: 'custom', nombreCustom: ins.nombre || 'Extra', usado: parseFloat(ins.costoTotal) || 0 })
        );

        if (parseFloat(recetaS.destajo_por_saco) > 0)
          cifData.push({ concepto: 'Destajo MP', total: parseFloat(recetaS.destajo_por_saco) * parseFloat(recetaS.destajo_unidades || 1) });

        renderMP();
        renderCIF();
        calcular();
        _lujo_showToast(`🔄 Importado de Simplificado: "${recetaS.nombre}"`);
      }
    }

    function eliminarRecetaLujo(id) {
      const recetas = _lujo_getRecetas().filter(r => r.id !== id);
      localStorage.setItem(_LUJO_KEY, JSON.stringify(recetas));
      _fb_deleteRecetaFromFirebase(id);  // ─ eliminar también de Firebase
      _lujo_populateSelector();
      renderHistorialLujo();
      _lujo_showToast('Proyecto eliminado', false);
    }

    function renderHistorialLujo() {
      const wrap = $('history-lujo-wrap');
      if (!wrap) return;
      const recetas = [..._lujo_getRecetas()].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

      if (recetas.length === 0) {
        wrap.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);text-align:center;padding:1.5rem 0;">No hay proyectos Bifrost guardados todavía.</p>';
        return;
      }

      wrap.innerHTML = `
    <div class="table-responsive">
    <table class="breakdown-table" style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);padding:0.5rem 0.6rem;text-align:left;border-bottom:1px solid var(--glass-border);">Nombre</th>
          <th style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);padding:0.5rem 0.6rem;text-align:left;border-bottom:1px solid var(--glass-border);">Botellas</th>
          <th style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);padding:0.5rem 0.6rem;text-align:left;border-bottom:1px solid var(--glass-border);">PVP</th>
          <th style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);padding:0.5rem 0.6rem;text-align:left;border-bottom:1px solid var(--glass-border);">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${recetas.map(r => `
          <tr>
            <td style="padding:0.6rem 0.6rem;font-size:0.8rem;font-weight:600;color:var(--text);border-bottom:1px solid rgba(255,255,255,0.03);">${r.nombre}</td>
            <td style="padding:0.6rem 0.6rem;font-size:0.78rem;font-family:var(--font-mono);color:var(--teal);border-bottom:1px solid rgba(255,255,255,0.03);">${r.res_bots || '—'}</td>
            <td style="padding:0.6rem 0.6rem;font-size:0.78rem;font-family:var(--font-mono);color:var(--gold);border-bottom:1px solid rgba(255,255,255,0.03);">${r.res_pvp || '—'}</td>
            <td style="padding:0.6rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.03);">
              <button onclick="eliminarRecetaLujo('${r.id}')"
                style="padding:0.3rem 0.5rem;border-radius:6px;border:1px solid rgba(239,83,80,0.25);background:rgba(239,83,80,0.08);color:var(--red);font-size:0.72rem;cursor:pointer;">
                ✕ Eliminar
              </button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
    }

    function exportCostosPDF() {
      const sourceContent = document.querySelector('.content');
      if (!sourceContent) return;

      const printWindow = window.open('', '_blank', 'width=1280,height=900');
      if (!printWindow) {
        alert('No se pudo abrir la ventana de exportacion. Revisa si tu navegador bloqueó la ventana emergente.');
        return;
      }

      const clone = sourceContent.cloneNode(true);

      clone.querySelectorAll('button').forEach(btn => btn.remove());
      clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

      const sourceCanvases = sourceContent.querySelectorAll('canvas');
      const cloneCanvases = clone.querySelectorAll('canvas');
      cloneCanvases.forEach((canvas, index) => {
        const originalCanvas = sourceCanvases[index];
        if (!originalCanvas) return;
        try {
          const img = printWindow.document.createElement('img');
          img.src = originalCanvas.toDataURL('image/png', 1.0);
          img.alt = 'Grafico de costos';
          img.style.width = '100%';
          img.style.height = 'auto';
          img.style.display = 'block';
          img.style.borderRadius = '10px';
          canvas.replaceWith(img);
        } catch (e) {
          canvas.remove();
        }
      });

      const logoUrl = new URL('../assets/images/ui/bifrost-logo.png', window.location.href).href;
      const now = new Date();
      const fecha = now.toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' });
      const hora = now.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });

      printWindow.document.open();
      printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Maestro de Costos - Bifrost S.A</title>
  <style>
    :root {
      --gold: #b48811;
      --gold-soft: #f6eed0;
      --ink: #161616;
      --muted: #616161;
      --line: #d7d7d7;
      --soft-line: #ececec;
      --teal: #2f8d8a;
      --orange: #d98324;
      --page: #ffffff;
      --panel: #ffffff;
      --shadow: rgba(0, 0, 0, 0.04);
      --font-heading: Georgia, "Times New Roman", serif;
      --font-body: Arial, Helvetica, sans-serif;
      --font-mono: "Courier New", monospace;
    }

    * { box-sizing: border-box; }

    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--page);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 11px;
      line-height: 1.42;
    }

    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .report-shell {
      width: 100%;
    }

    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 10px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--line);
    }

    .report-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .report-logo {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      border: 1px solid #dbc57a;
      background: #fff8e4;
      padding: 6px;
      flex-shrink: 0;
    }

    .report-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    .report-title {
      font-family: var(--font-heading);
      font-size: 20px;
      font-weight: 700;
      color: var(--gold);
      margin: 0;
    }

    .report-subtitle {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 11px;
    }

    .report-meta {
      text-align: right;
      color: var(--muted);
      font-size: 10px;
      flex-shrink: 0;
    }

    .content {
      display: block !important;
      padding: 0 !important;
      overflow: visible !important;
    }

    .animate-in {
      animation: none !important;
      transform: none !important;
      opacity: 1 !important;
    }

    .card,
    .pvp-hero {
      background: var(--panel) !important;
      border: 1px solid var(--line) !important;
      border-radius: 14px !important;
      box-shadow: 0 2px 8px var(--shadow) !important;
      padding: 14px !important;
      margin: 0 0 12px 0 !important;
      break-inside: auto;
      page-break-inside: auto;
    }

    .card__header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--soft-line);
      break-after: avoid-page;
      page-break-after: avoid;
    }

    .card__icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--gold-soft) !important;
      border: 1px solid #e6d69a;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .card__title,
    .section-label {
      color: var(--ink) !important;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 700;
    }

    .cascade-grid {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 10px !important;
      break-inside: auto;
      page-break-inside: auto;
    }

    .cost-block,
    .pvp-badge {
      background: #fff !important;
      border: 1px solid var(--soft-line) !important;
      border-radius: 10px !important;
      padding: 10px !important;
      min-height: 0 !important;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .cost-block__label {
      color: var(--muted) !important;
      font-size: 10px;
      margin-bottom: 4px;
    }

    .cost-block__value {
      font-family: var(--font-mono) !important;
      font-size: 15px !important;
      font-weight: 700;
    }

    .cost-block__sub,
    .pvp-hero__desc,
    .text-muted,
    .tag {
      color: var(--muted) !important;
    }

    .pvp-hero {
      display: grid !important;
      grid-template-columns: 1fr 180px;
      gap: 12px;
      align-items: center;
      background: #fffaf0 !important;
      border-color: #e6d69a !important;
    }

    .pvp-hero__label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted) !important;
      margin-bottom: 4px;
    }

    .pvp-hero__main {
      font-family: var(--font-heading) !important;
      font-size: 28px !important;
      color: var(--gold) !important;
      line-height: 1.05;
    }

    .pvp-hero__secondary {
      font-family: var(--font-mono) !important;
      font-size: 14px !important;
      margin-top: 2px;
    }

    .table-responsive {
      overflow: visible !important;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      display: table-header-group;
    }

    tbody {
      display: table-row-group;
    }

    tr, td, th {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .breakdown-table td,
    .breakdown-table th,
    .sb-table td,
    .sb-table th,
    .activos-registry-table td,
    .activos-registry-table th {
      padding: 6px 7px !important;
      font-size: 10.5px !important;
      vertical-align: top;
      word-break: normal;
      overflow-wrap: break-word;
    }

    .breakdown-table td:last-child,
    .sb-table td:last-child,
    .activos-registry-table td:last-child {
      font-family: var(--font-mono);
    }

    .breakdown-table .section-header td {
      background: #faf7ec !important;
      color: #7f6420 !important;
      border-top: 1px solid #eadca8;
      border-bottom: 1px solid #eadca8;
      font-size: 10px !important;
    }

    .breakdown-table .total-row td {
      background: #fffaf0 !important;
      color: var(--gold) !important;
      font-weight: 700;
    }

    .breakdown-table .subtotal-row td {
      color: #4c4c4c !important;
      font-style: normal !important;
    }

    .chart-wrap,
    .eq-summary,
    .pvp-hero,
    img {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .chart-wrap {
      height: auto !important;
      min-height: 0 !important;
    }

    .chart-wrap img,
    .chart-wrap canvas,
    canvas,
    img {
      max-width: 100%;
      height: auto !important;
      display: block;
    }

    .tag {
      border: 1px solid var(--soft-line);
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-block;
    }

    .table-actions,
    .theme-toggle-btn {
      display: none !important;
    }

    .page-break-before {
      break-before: page;
      page-break-before: always;
    }

    @media print {
      .report-shell {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="report-shell">
    <header class="report-header">
      <div class="report-brand">
        <div class="report-logo">
          <img src="${logoUrl}" alt="Bifrost logo">
        </div>
        <div>
          <h1 class="report-title">Maestro de Costos Bifrost</h1>
          <p class="report-subtitle">Sistema ERP Contable · Bodega de Lujo</p>
        </div>
      </div>
      <div class="report-meta">
        <div>Fecha: ${fecha}</div>
        <div>Hora: ${hora}</div>
      </div>
    </header>
    <main class="content">${clone.innerHTML}</main>
  </div>
</body>
</html>`);
      printWindow.document.close();

      const runPrint = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 400);
      };

      if (printWindow.document.readyState === 'complete') runPrint();
      else printWindow.onload = runPrint;
    }

    document.addEventListener('DOMContentLoaded', async () => {
      cargarUnitarios();
      cargarActivos();
      actualizarLote();
      renderUnitarios();
      renderMP();
      renderCIF();
      renderActivos();
      calcular();
      _lujo_populateSelector();
      renderHistorialLujo();
      _cargarVinosEcommerce();
      // Sincronizar desde Firebase (en background, no bloquea UI)
      _fb_loadRecetasFromFirebase();
      _fb_loadActivosFromFirebase();

      // Update historial badge when selector changes
      const sel = document.getElementById('sel-recipe-lujo');
      if (sel) {
        const badge = document.getElementById('sb-receta-badge');
        sel.addEventListener('change', () => {
          const opt = sel.options[sel.selectedIndex];
          if (badge) badge.textContent = opt?.text?.replace(/^[📝🍶] /, '').substring(0, 22) || 'Cargar receta';
        });
      }
    });

    // ─────────────────────────────────────────────────
    // ACCORDION TOGGLE
    // ─────────────────────────────────────────────────
    function toggleAccordion(id) {
      const block = document.getElementById(id);
      if (!block) return;
      block.classList.toggle('open');
    }
