/* ============================================================
   BIFROST WINES — main.js
   Navbar, Mobile Menu, Cart Logic, Toast, Utility Helpers
   ============================================================ */

/* ── Cart State ─────────────────────────────────────────────── */
const Cart = {
  _key: 'bifrost_cart',

  get items() {
    return JSON.parse(sessionStorage.getItem(this._key) || '[]');
  },

  save(items) {
    sessionStorage.setItem(this._key, JSON.stringify(items));
    this.updateUI();
    this.dispatchChange();
  },

  add(wine, quantity = 1) {
    const items = this.items;
    const existing = items.find(i => i.id === wine.id);

    if (existing) {
      const newQty = existing.qty + quantity;
      // Respect stock
      existing.qty = Math.min(newQty, wine.stock);
      if (existing.qty !== newQty) {
        showToast(`Límite de stock alcanzado para ${wine.name}`, 'warning');
      }
    } else {
      items.push({
        id:       wine.id,
        name:     wine.name,
        vintage:  wine.vintage,
        price:    wine.finalPrice || wine.price,
        emoji:    wine.emoji || '🍷',
        imageUrl: wine.imageUrl || '',
        stock:    wine.stock,
        qty:      Math.min(quantity, wine.stock),
      });
    }

    this.save(items);
    showToast(`${wine.name} añadido a tu cava`, 'success');
    openCart();
  },

  remove(id) {
    const items = this.items.filter(i => i.id !== id);
    this.save(items);
  },

  updateQty(id, qty) {
    const items = this.items;
    const item  = items.find(i => i.id === id);
    if (!item) return;

    if (qty <= 0) {
      this.remove(id);
      return;
    }

    item.qty = Math.min(qty, item.stock || 999);
    this.save(items);
  },

  get total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  get count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  },

  clear() {
    this.save([]);
  },

  updateUI() {
    // Badge
    const badge = document.querySelector('.cart-badge');
    if (badge) {
      const count = this.count;
      badge.textContent = count > 99 ? '99+' : count;
      badge.classList.toggle('visible', count > 0);
    }
    // Re-render sidebar if open
    if (document.querySelector('.cart-sidebar.open')) {
      renderCartSidebar();
    }
  },

  dispatchChange() {
    window.dispatchEvent(new CustomEvent('bifrost:cart:update', { detail: { cart: this } }));
  }
};

/* ── Toast Notification System ──────────────────────────────── */
function showToast(message, type = 'info', duration = 3500) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`,
    warning: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`,
    error:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info:    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
  };

  const colors = { success: '#4CAF50', warning: '#FFC107', error: '#F44336', info: '#45A29E' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon" style="color:${colors[type] || colors.info}">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

/* ── Cart Sidebar ────────────────────────────────────────────── */
function openCart() {
  const sidebar  = document.querySelector('.cart-sidebar');
  const backdrop = document.querySelector('.overlay-backdrop');
  if (!sidebar) return;

  renderCartSidebar();
  sidebar.classList.add('open');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  const sidebar  = document.querySelector('.cart-sidebar');
  const backdrop = document.querySelector('.overlay-backdrop');
  if (!sidebar) return;

  sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

function renderCartSidebar() {
  const itemsEl = document.querySelector('.cart-sidebar__items');
  const totalEl = document.querySelector('.cart-total-value');
  if (!itemsEl) return;

  const items = Cart.items;

  if (items.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-sidebar__empty">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <p>Tu cava está vacía.</p>
        <a href="../statics/shop.html" class="btn btn--outline btn--sm">Explorar Colección</a>
      </div>
    `;
    if (totalEl) totalEl.textContent = '$0.00';
    return;
  }

  itemsEl.innerHTML = items.map(item => `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item__image">
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" loading="lazy">` : item.emoji || '🍷'}
      </div>
      <div class="cart-item__info">
        <div class="cart-item__name">${item.name}</div>
        <div class="cart-item__vintage">${item.vintage}</div>
        <div class="cart-item__controls">
          <button class="qty-btn" onclick="Cart.updateQty(${item.id}, ${item.qty - 1})">−</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn" onclick="Cart.updateQty(${item.id}, ${item.qty + 1})">+</button>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
        <span class="cart-item__price">$${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-item__remove" onclick="Cart.remove(${item.id})" title="Eliminar">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  if (totalEl) totalEl.textContent = `$${Cart.total.toFixed(2)}`;
}

/* ── Navbar & Mobile Menu ────────────────────────────────────── */
function initNavbar() {
  const hamburger  = document.querySelector('.navbar__hamburger');
  const mobileMenu = document.querySelector('.mobile-menu');
  const backdrop   = document.querySelector('.overlay-backdrop');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  // Cart toggle
  document.addEventListener('click', (e) => {
    const cartBtn = e.target.closest('[data-cart-toggle]');
    if (cartBtn) {
      const sidebar = document.querySelector('.cart-sidebar');
      if (sidebar?.classList.contains('open')) {
        closeCart();
      } else {
        openCart();
      }
    }
  });

  // Close cart via backdrop
  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeCart();
      if (mobileMenu) {
        mobileMenu.classList.remove('open');
        if (hamburger) hamburger.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // Cart close button
  const cartClose = document.querySelector('.cart-sidebar__close');
  if (cartClose) cartClose.addEventListener('click', closeCart);

  // Mobile menu links close menu
  document.querySelectorAll('.mobile-menu__link').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu) mobileMenu.classList.remove('open');
      if (hamburger)  hamburger.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Highlight active nav link
  const currentPath = window.location.pathname.split('/').pop();
  document.querySelectorAll('.navbar__link, .mobile-menu__link').forEach(link => {
    const href = link.getAttribute('href')?.split('/').pop();
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Init badge
  Cart.updateUI();
}

/* ── Format Currency ─────────────────────────────────────────── */
window.formatPrice = function(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

/* ── Resolve relative paths ───────────────────────────────────── */
window.resolvePath = function(path) {
  const isStatics = window.location.pathname.includes('/statics/');
  return isStatics ? `../${path}` : path;
};

/* ── Checkout "Inquiry" ─────────────────────────────────────── */
function showInquiryChoiceModal(message) {
  const existing = document.getElementById('inquiry-modal');
  if(existing) existing.remove();

  const encodedMsg = encodeURIComponent(message);
  
  // Resolve base urls from CSS variables or fallback
  const waBase = getComputedStyle(document.documentElement).getPropertyValue('--link-whatsapp').replace(/"/g,'').trim() || 'https://wa.me/50576060334';
  const tgBase = getComputedStyle(document.documentElement).getPropertyValue('--link-telegram').replace(/"/g,'').trim() || 'https://t.me/bifrostwines';
  
  const waLink = `${waBase}?text=${encodedMsg}`;
  const tgLink = `${tgBase}?text=${encodedMsg}`;

  // Build and insert modal
  const modalHtml = `
    <div class="overlay-backdrop active" id="inquiry-modal" style="z-index: 10000; display:flex; align-items:center; justify-content:center; opacity:0; animation: fadeIn 0.3s forwards;">
      <div class="glass" style="padding: 2.5rem 2rem; max-width: 400px; width: 90%; text-align: center; position: relative;">
        <button onclick="document.getElementById('inquiry-modal').remove()" aria-label="Cerrar" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding:0.5rem;">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <h3 style="font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--color-gold);">Enviar Consulta</h3>
        <p style="color: var(--color-text-muted); margin-bottom: 2rem; font-size: 0.95rem; line-height:1.5;">Selecciona la plataforma para enviarnos los detalles de tu cotización.</p>
        
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <a href="${waLink}" target="_blank" onclick="Cart.clear(); closeCart(); document.getElementById('inquiry-modal').remove();" class="btn btn--primary" style="background: #25D366; color: white; border-color: #25D366; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z M12.004 2C6.477 2 2 6.477 2 12.004a9.965 9.965 0 001.367 5.02L2 22l5.134-1.345A9.97 9.97 0 0012.004 22C17.53 22 22 17.523 22 12.004S17.53 2 12.004 2z"/></svg>
            WhatsApp
          </a>
          <a href="${tgLink}" target="_blank" onclick="Cart.clear(); closeCart(); document.getElementById('inquiry-modal').remove();" class="btn btn--outline" style="border-color: #2AABEE; color: #2AABEE; display: flex; align-items: center; justify-content: center; gap: 0.5rem; border-width: 2px;">
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </a>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function initCheckoutBtn() {
  const btns = document.querySelectorAll('[data-checkout]');
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.Cart.count === 0) {
        window.showToast('Tu cava está vacía', 'warning');
        return;
      }

      // Generate invoice-style message
      let msg = "Hola Bifrost S.A, me gustaría solicitar una cotización para los siguientes vinos:\n\n";
      window.Cart.items.forEach(item => {
        msg += `• ${item.qty}x ${item.name} - ${item.vintage} (${formatPrice(item.price)}/u)\n`;
      });
      msg += `\nSubtotal estimado: ${formatPrice(window.Cart.total)}\n`;
      msg += "\nEspero su respuesta para conocer detalles sobre envío y pago. ¡Gracias!";

      showInquiryChoiceModal(msg);
    });
  });
}

/* ── DOMContentLoaded ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // Wait for DB
  if (window.BifrostDB) {
    await window.BifrostDB.ready();
  }

  initNavbar();
  renderCartSidebar();
  initCheckoutBtn();
});

// Expose helpers globally
window.Cart      = Cart;
window.showToast = showToast;
window.openCart  = openCart;
window.closeCart = closeCart;
