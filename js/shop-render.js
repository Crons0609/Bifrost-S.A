/* ============================================================
   BIFROST WINES — shop-render.js
   Shop page: product grid rendering, filtering, quick-view modal
   ============================================================ */

let allWines   = [];
let filtered   = [];
let activeCategory = 'all';
let activeSortKey  = 'default';
let isListView = false;
const quickViewModal = document.getElementById('quick-view-modal');

/* ── Bootstrap ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await window.BifrostDB.ready();
  await loadWines();
  initFilters();
  initSortListener();
  initViewToggle();
  initQuickViewModal();
});

/* ── Load & Render ───────────────────────────────────────────── */
async function loadWines() {
  try {
    allWines = await window.BifrostDB.getAllWines();
    applyFiltersAndSort();
  } catch (err) {
    console.error('Failed to load wines:', err);
    showErrorState();
  }
}

async function applyFiltersAndSort() {
  const settings = await window.BifrostDB.getSettings() || {};

  // Filter by category
  filtered = (activeCategory === 'all')
    ? [...allWines]
    : allWines.filter(w => w.category === activeCategory);

  // Sort
  switch (activeSortKey) {
    case 'price-asc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'vintage-desc':
      filtered.sort((a, b) => b.vintage - a.vintage);
      break;
    case 'vintage-asc':
      filtered.sort((a, b) => a.vintage - b.vintage);
      break;
    case 'name':
      filtered.sort((a, b) => a.name.localeCompare(b.name));
      break;
    default:
      break; // Keep DB order
  }

  renderGrid(filtered, settings);
  updateMeta(filtered.length, allWines.length);
  window.reinitReveal?.();
}

function renderGrid(wines, settings) {
  const grid = document.querySelector('.shop-grid') || document.getElementById('product-grid');
  if (!grid) return;

  if (wines.length === 0) {
    grid.innerHTML = `
      <div class="shop-empty">
        <div class="shop-empty__icon">
          <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="var(--color-gold)" stroke-width="1" opacity="0.4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v10.5a3.5 3.5 0 003.5 3.5v0a3.5 3.5 0 003.5-3.5V3M9 3h6M9 3H7M15 3h2M12 3v1"/>
          </svg>
        </div>
        <h3 class="shop-empty__title">No se encontraron vinos</h3>
        <p style="color:var(--color-text-muted); font-size:0.875rem;">Prueba con un filtro diferente</p>
      </div>`;
    return;
  }

  grid.innerHTML = wines.map((wine, i) => buildCard(wine, settings, i)).join('');
}

function buildCard(wine, settings, index) {
  const flashActive = settings?.flashSaleActive;
  const flashPct    = settings?.flashSaleDiscount || 0;
  const itemPct     = wine.discount || 0;
  const discountPct = flashActive ? Math.max(flashPct, itemPct) : itemPct;

  const finalPrice  = discountPct > 0
    ? wine.price * (1 - discountPct / 100)
    : wine.price;

  const stockLevel  = window.BifrostDB.constructor.stockLevel(wine.stock);
  const stockLabel  = window.BifrostDB.constructor.stockLabel(wine.stock);

  const delayClass  = index < 9 ? `reveal--delay-${(index % 5) + 1}` : '';

  return `
    <article class="product-card reveal scale-in ${delayClass}" 
             data-id="${wine.id}"
             onclick="goToProduct(${wine.id})"
             role="article"
             aria-label="${wine.name} ${wine.vintage}">

      <!-- Vortex animated bg -->
      <div class="vortex-bg" aria-hidden="true"></div>

      <!-- Insignia de Descuento -->
      ${discountPct > 0 ? `<div class="discount-badge">−${discountPct}% DESC.</div>` : ''}

      <!-- Botón Vista Rápida -->
      <div class="product-card__quick-view" onclick="openQuickView(event, ${wine.id})">
        <button class="btn btn--sm glass" aria-label="Vista rápida de ${wine.name}">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
          </svg>
          Vista Rápida
        </button>
      </div>

      <!-- Image -->
      <div class="product-card__image-wrap">
        ${wine.imageUrl
          ? `<img src="${wine.imageUrl}" alt="${wine.name}" loading="lazy">`
          : `<div class="product-card__image-placeholder">
               <span class="placeholder-icon">${wine.emoji || '🍷'}</span>
             </div>`
        }
      </div>

      <!-- Info Overlay -->
      <div class="product-card__overlay">
        <div class="product-card__vintage">${wine.vintage} · ${wine.category}</div>
        <div class="product-card__name">${wine.name}</div>
        <div class="product-card__price-row">
          <span class="product-card__price">$${finalPrice.toFixed(2)}</span>
          ${discountPct > 0 ? `<span class="product-card__price-original">$${wine.price.toFixed(2)}</span>` : ''}
          <span class="stock-indicator stock-indicator--${stockLevel}" title="${stockLabel}"></span>
        </div>
      </div>
    </article>`;
}

/* ── Filters ─────────────────────────────────────────────────── */
function initFilters() {
  const chips = document.querySelectorAll('.filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.filter || 'all';
      applyFiltersAndSort();
    });
  });
}

function initSortListener() {
  const sortEl = document.querySelector('#shop-sort');
  if (!sortEl) return;
  sortEl.addEventListener('change', () => {
    activeSortKey = sortEl.value;
    applyFiltersAndSort();
  });
}

/* ── View Toggle (Grid / List) ──────────────────────────────── */
function initViewToggle() {
  const gridBtn = document.querySelector('[data-view="grid"]');
  const listBtn = document.querySelector('[data-view="list"]');
  const grid    = document.querySelector('.shop-grid');

  if (!gridBtn || !listBtn || !grid) return;

  gridBtn.addEventListener('click', () => {
    isListView = false;
    grid.classList.remove('list-view');
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  });

  listBtn.addEventListener('click', () => {
    isListView = true;
    grid.classList.add('list-view');
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
  });
}

/* ── Meta Counter ────────────────────────────────────────────── */
function updateMeta(shown, total) {
  const countEl = document.querySelector('.shop-meta__count');
  if (countEl) {
    countEl.innerHTML = `Mostrando <strong>${shown}</strong> de <strong>${total}</strong> vinos`;
  }
}

/* ── Navigation ──────────────────────────────────────────────── */
function goToProduct(id) {
  window.location.href = `product-detail.html?id=${id}`;
}

/* ── Quick View Modal ────────────────────────────────────────── */
function initQuickViewModal() {
  if (!quickViewModal) return;

  quickViewModal.querySelector('.modal__backdrop')?.addEventListener('click', closeQuickView);
  quickViewModal.querySelector('.modal__close')?.addEventListener('click', closeQuickView);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQuickView();
  });
}

async function openQuickView(e, id) {
  e.stopPropagation();
  if (!quickViewModal) return;

  const wine = allWines.find(w => w.id === id);
  if (!wine) return;

  const settings  = await window.BifrostDB.getSettings() || {};
  const flashPct  = settings.flashSaleActive ? (settings.flashSaleDiscount || 0) : 0;
  const itemPct   = wine.discount || 0;
  const discPct   = Math.max(flashPct, itemPct);
  const finalPrice = discPct > 0 ? wine.price * (1 - discPct / 100) : wine.price;

  const stockLevel = window.BifrostDB.constructor.stockLevel(wine.stock);
  const stockLabel = window.BifrostDB.constructor.stockLabel(wine.stock);

  const panel = quickViewModal.querySelector('.modal__panel');
  panel.innerHTML = `
    <button class="modal__close" id="qv-close" aria-label="Cerrar">
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>

    <div class="quick-view-grid">
      <div class="quick-view-image">
        ${wine.imageUrl
          ? `<img src="${wine.imageUrl}" alt="${wine.name}">`
          : `<svg width="80" height="80" fill="none" viewBox="0 0 24 24" stroke="var(--color-gold)" stroke-width="1" opacity="0.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v10.5a3.5 3.5 0 003.5 3.5v0a3.5 3.5 0 003.5-3.5V3M9 3h6M9 3H7M15 3h2M12 3v1"/></svg>`}
      </div>
      <div class="quick-view-info">
        <div>
          <div class="quick-view-vintage">${wine.vintage} · ${wine.category}</div>
          <h2 class="quick-view-name">${wine.name}</h2>
        </div>
        <div class="quick-view-desc">${wine.description}</div>
        ${wine.tastingNotes?.length ? `
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${wine.tastingNotes.map(n => `<span class="tasting-tag">◆ ${n}</span>`).join('')}
          </div>
        ` : ''}
        <div class="product-info__stock ${stockLevel}">
          <span class="stock-indicator stock-indicator--${stockLevel}"></span>
          ${stockLabel}
        </div>
        <div style="display:flex; align-items:baseline; gap:12px;">
          <div class="quick-view-price">$${finalPrice.toFixed(2)}</div>
          ${discPct > 0 ? `<del style="color:var(--color-text-muted);">$${wine.price.toFixed(2)}</del>` : ''}
        </div>
        <div style="display:flex; gap:12px; margin-top:4px;">
          <button class="btn btn--primary btn-ripple" style="flex:1"
            onclick="addToCartFromModal(${wine.id}); event.stopPropagation();"
            ${wine.stock <= 0 ? 'disabled' : ''}>
            ${wine.stock <= 0 ? 'Sin Stock' : 'Añadir a la Cava'}
          </button>
          <a href="product-detail.html?id=${wine.id}" class="btn btn--outline">Ver Detalles</a>
        </div>
      </div>
    </div>`;

  panel.querySelector('#qv-close')?.addEventListener('click', closeQuickView);
  quickViewModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeQuickView() {
  if (!quickViewModal) return;
  quickViewModal.classList.remove('open');
  document.body.style.overflow = '';
}

async function addToCartFromModal(wineId) {
  const wine = allWines.find(w => w.id === wineId);
  if (!wine || wine.stock <= 0) return;

  const settings  = await window.BifrostDB.getSettings() || {};
  const flashPct  = settings.flashSaleActive ? (settings.flashSaleDiscount || 0) : 0;
  const itemPct   = wine.discount || 0;
  const discPct   = Math.max(flashPct, itemPct);
  wine.finalPrice = discPct > 0 ? wine.price * (1 - discPct / 100) : wine.price;

  Cart.add(wine, 1);
  closeQuickView();
}

// Estado de error
function showErrorState() {
  const grid = document.querySelector('.shop-grid') || document.getElementById('product-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="shop-empty">
        <div class="shop-empty__icon" style="font-size:3rem;">⚠️</div>
        <h3 class="shop-empty__title">Error al cargar los vinos</h3>
        <p style="color:var(--color-text-muted); font-size:0.875rem;">Actualiza la página o intenta con un navegador moderno.</p>
      </div>`;
  }
}

// Expose for inline onclick
window.goToProduct      = goToProduct;
window.openQuickView    = openQuickView;
window.addToCartFromModal = addToCartFromModal;
