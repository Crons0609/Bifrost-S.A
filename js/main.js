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
    if (totalEl) totalEl.textContent = 'C$0.00';
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
        <span class="cart-item__price">C$${(item.price * item.qty).toFixed(2)}</span>
        <button class="cart-item__remove" onclick="Cart.remove(${item.id})" title="Eliminar">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  if (totalEl) totalEl.textContent = `C$${Cart.total.toFixed(2)}`;
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
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency: 'NIO',
    minimumFractionDigits: 2,
  }).format(amount);
};

/* ── Resolve relative paths ───────────────────────────────────── */
window.resolvePath = function(path) {
  const isStatics = window.location.pathname.includes('/statics/');
  return isStatics ? `../${path}` : path;
};

/* ── Checkout Flow con Backend ──────────────────────────────── */
window.submitBifrostCheckout = async function(event) {
  event.preventDefault();
  
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  
  const nombre = form.nombre.value.trim();
  const telefono = form.telefono.value.trim();
  const direccion = form.direccion.value.trim();
  
  if (!nombre || !telefono) {
    window.showToast("Ciertos campos son obligatorios", "warning");
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = `<span style="opacity: 0.7;">Procesando...</span>`;
  
  try {
    const payload = {
      items: window.Cart.items,
      total: window.Cart.total,
      cliente: { nombre, telefono, direccion }
    };
    
    // Resolvemos el path relativo si estamos en statics/
    const baseUrl = window.location.pathname.includes('/statics/') ? '../' : '';
    // Como baseUrl puede ser '' desde index, agregamos la barra a la API
    const apiUrl = baseUrl ? \`\${baseUrl}/api/checkout\` : '/api/checkout';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      window.Cart.clear();
      window.closeCart();
      document.getElementById('checkout-modal').remove();
      window.showToast("¡Pedido recibido exitosamente!", "success");
      
      // Mostrar modal final de agradecimiento
      const successModalHtml = \`
        <div class="overlay-backdrop active" id="success-modal" style="z-index: 10000; display:flex; align-items:center; justify-content:center; opacity:0; animation: fadeIn 0.3s forwards;">
          <div class="glass" style="padding: 2.5rem 2rem; max-width: 400px; width: 90%; text-align: center; position: relative;">
            <div style="color: #4CAF50; margin-bottom: 1rem;"><svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
            <h3 style="font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--color-gold);">Pedido Confirmado</h3>
            <p style="color: var(--color-text-muted); font-size: 0.95rem; line-height:1.5; margin-bottom:1.5rem;">Tu pedido ha sido recibido exitosamente (ID: #\${data.pedidoId || 'N/A'}). Un sumiller se pondrá en contacto pronto para gestionar tu orden.</p>
            <button onclick="document.getElementById('success-modal').remove()" class="btn btn--primary" style="width:100%; justify-content:center;">Cerrar</button>
          </div>
        </div>
      \`;
      document.body.insertAdjacentHTML('beforeend', successModalHtml);
    } else {
      throw new Error(data.error || "Error del servidor");
    }
  } catch (error) {
    console.error(error);
    window.showToast("Fallo al enviar el pedido. Intenta nuevamente.", "error");
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

function showCheckoutModal() {
  const existing = document.getElementById('checkout-modal');
  if(existing) existing.remove();

  const modalHtml = \`
    <div class="overlay-backdrop active" id="checkout-modal" style="z-index: 10000; display:flex; align-items:center; justify-content:center; opacity:0; animation: fadeIn 0.3s forwards;">
      <div class="glass" style="padding: 2.5rem 2rem; max-width: 420px; width: 90%; text-align: left; position: relative;">
        <button onclick="document.getElementById('checkout-modal').remove()" aria-label="Cerrar" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding:0.5rem;">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
        <h3 style="font-family: var(--font-heading); font-size: 1.5rem; margin-bottom: 0.2rem; color: var(--color-gold); text-align: center;">Confirmar Pedido</h3>
        <p style="color: var(--color-text-muted); margin-bottom: 1.5rem; font-size: 0.9rem; line-height:1.5; text-align: center;">Completa tus datos para enviar la orden al sistema de Bifrost.</p>
        
        <form onsubmit="window.submitBifrostCheckout(event)" style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="display:block; font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:0.3rem;">Nombre Completo *</label>
            <input type="text" name="nombre" required style="width:100%; padding:0.8rem; border-radius: var(--radius-md); border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.5); color:#fff; font-family:inherit;">
          </div>
          <div>
            <label style="display:block; font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:0.3rem;">Teléfono / WhatsApp *</label>
            <input type="tel" name="telefono" required style="width:100%; padding:0.8rem; border-radius: var(--radius-md); border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.5); color:#fff; font-family:inherit;">
          </div>
          <div>
            <label style="display:block; font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:0.3rem;">Dirección o Notas (Opcional)</label>
            <textarea name="direccion" rows="3" style="width:100%; padding:0.8rem; border-radius: var(--radius-md); border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.5); color:#fff; font-family:inherit; resize:vertical;"></textarea>
          </div>
          
          <div style="margin-top: 0.5rem;">
            <button type="submit" class="btn btn--primary" style="width:100%; justify-content:center;">Enviar Pedido • \${window.formatPrice(window.Cart.total)}</button>
          </div>
        </form>
      </div>
    </div>
  \`;
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
      showCheckoutModal();
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
