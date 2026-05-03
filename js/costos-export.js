/* ============================================================
   BIFROST WINES — costos-export.js
   Exportación PDF del Maestro de Costos
   ============================================================ */

(function () {
  function buildReportHtml(contentHtml, logoUrl, fecha, hora) {
    return `<!DOCTYPE html>
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
      --page: #ffffff;
      --panel: #ffffff;
      --shadow: rgba(0, 0, 0, 0.04);
      --font-heading: Georgia, "Times New Roman", serif;
      --font-body: Arial, Helvetica, sans-serif;
      --font-mono: "Courier New", monospace;
    }

    * { box-sizing: border-box; }
    @page { size: A4 portrait; margin: 12mm; }

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

    .report-shell { width: 100%; }

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

    .card, .pvp-hero {
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

    .card__title, .section-label {
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
    }

    .cost-block, .pvp-badge {
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

    .cost-block__sub, .pvp-hero__desc, .text-muted, .tag {
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

    .table-responsive { overflow: visible !important; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr, td, th { break-inside: avoid; page-break-inside: avoid; }

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

    .chart-wrap, .eq-summary, .pvp-hero, img {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .chart-wrap {
      height: auto !important;
      min-height: 0 !important;
    }

    .chart-wrap img, canvas, img {
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

    .table-actions, .theme-toggle-btn {
      display: none !important;
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
    <main class="content">${contentHtml}</main>
  </div>
</body>
</html>`;
  }

  function cloneContentForPrint(sourceContent) {
    const clone = sourceContent.cloneNode(true);

    clone.querySelectorAll('button').forEach(btn => btn.remove());
    clone.querySelectorAll('[onclick]').forEach(el => el.removeAttribute('onclick'));

    const sourceCanvases = sourceContent.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');

    cloneCanvases.forEach((canvas, index) => {
      const originalCanvas = sourceCanvases[index];
      if (!originalCanvas) {
        canvas.remove();
        return;
      }

      try {
        const img = document.createElement('img');
        img.src = originalCanvas.toDataURL('image/png', 1.0);
        img.alt = 'Grafico de costos';
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.display = 'block';
        img.style.borderRadius = '10px';
        canvas.replaceWith(img);
      } catch (err) {
        canvas.remove();
      }
    });

    return clone.innerHTML;
  }

  function exportCostosPDF() {
    const sourceContent = document.querySelector('.content');
    if (!sourceContent) {
      alert('No se encontró el contenido para exportar.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert('Tu navegador bloqueó la ventana de impresión. Permite popups para exportar el PDF.');
      return;
    }

    const logoUrl = new URL('../assets/images/ui/bifrost-logo.png', window.location.href).href;
    const now = new Date();
    const fecha = now.toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' });
    const contentHtml = cloneContentForPrint(sourceContent);
    const reportHtml = buildReportHtml(contentHtml, logoUrl, fecha, hora);

    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.warn('No se pudo abrir la impresión del reporte:', err);
        }
      }, 250);
    };
  }

  window.exportCostosPDF = exportCostosPDF;
})();
