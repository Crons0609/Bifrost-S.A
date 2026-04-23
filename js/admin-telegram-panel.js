/**
 * ═══════════════════════════════════════════════════════════════
 *  BIFROST S.A — Admin Telegram Panel (Dashboard Integrado)
 *  Bandeja de entrada estilo WhatsApp Business en tiempo real.
 *  + Quick Replies con métricas en tiempo real de Firebase
 *  + Indicador visual de mensajes automáticos del bot
 * ═══════════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  // ── Estado del módulo ──────────────────────────────────────────
  let currentChatId   = null;
  let currentChatName = '';
  let currentInitial  = '?';
  let messagesRef     = null;
  let messagesListener = null;
  let allChats        = [];
  let tgDb            = null;
  let panelInited     = false;

  // ── IDs del DOM (todos están en admin-dashboard.html) ─────────
  const SEL = {
    chatList     : () => document.getElementById('tg-chat-list'),
    messages     : () => document.getElementById('tg-messages'),
    noChat       : () => document.getElementById('tg-no-chat'),
    chatHeader   : () => document.getElementById('tg-chat-header'),
    inputArea    : () => document.getElementById('tg-input-area'),
    headerName   : () => document.getElementById('tg-header-name'),
    headerSub    : () => document.getElementById('tg-header-sub'),
    headerAvatar : () => document.getElementById('tg-header-avatar'),
    msgInput     : () => document.getElementById('tg-msg-input'),
    sendBtn      : () => document.getElementById('tg-send-btn'),
    searchInput  : () => document.getElementById('tg-search'),
    sidebarCount : () => document.getElementById('tg-sidebar-count'),
    navBadge     : () => document.getElementById('tg-nav-badge'),
    backBtn      : () => document.getElementById('tg-back-btn'),
    sidebar      : () => document.getElementById('tg-sidebar'),
  };

  // ── Inicializar panel (llamado la primera vez que se abre) ─────
  window.initTelegramPanel = function () {
    if (panelInited) return;
    panelInited = true;

    // Obtener instancia de Firebase DB — usa la misma config que el dashboard
    tgDb = firebase.database();

    bindEvents();
    loadChatList();
  };

  // ── Cargar lista de chats en tiempo real ──────────────────────
  function loadChatList () {
    tgDb.ref('telegram_chats').on('value', snapshot => {
      allChats = [];

      if (!snapshot.exists()) {
        renderChatList([]);
        return;
      }

      snapshot.forEach(child => {
        allChats.push({ id: child.key, ...child.val() });
      });

      // Ordenar por último mensaje, más reciente arriba
      allChats.sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));

      renderChatList(allChats);
      updateNavBadge(allChats);
    });
  }

  // ── Renderizar lista de chats ──────────────────────────────────
  function renderChatList (chats) {
    const listEl = SEL.chatList();
    const countEl = SEL.sidebarCount();
    if (!listEl) return;

    // Actualizar contador
    if (countEl) countEl.textContent = chats.length;

    if (chats.length === 0) {
      listEl.innerHTML = `
        <div class="tg-empty-list">
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.223-.548.223l.188-2.85 5.18-4.68c.223-.198-.054-.31-.346-.11l-6.4 4.03-2.76-.86c-.6-.188-.612-.6.126-.89l10.814-4.167c.502-.192.934.12.756.91v.002z"/>
          </svg>
          <p>Aún no hay chats.<br>Cuando un usuario escriba al bot de Telegram, aparecerá aquí.</p>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    chats.forEach(chat => {
      const div = buildChatItem(chat);
      listEl.appendChild(div);
    });
  }

  // ── Construir elemento de la lista ────────────────────────────
  function buildChatItem (chat) {
    const initial     = chat.name ? chat.name.charAt(0).toUpperCase() : '?';
    const isUnread    = (chat.unread_count || 0) > 0;
    const isActive    = currentChatId === chat.id;
    const timeStr     = formatTime(chat.last_message_time);

    const div = document.createElement('div');
    div.className = `tg-chat-item${isActive ? ' active' : ''}`;
    div.dataset.chatId = chat.id;

    div.innerHTML = `
      <div class="tg-avatar">${escHtml(initial)}</div>
      <div class="tg-chat-info">
        <div class="tg-chat-name">${escHtml(chat.name || 'Usuario')}</div>
        <div class="tg-chat-preview">${escHtml(chat.username || 'ID: ' + chat.id)}</div>
      </div>
      <div class="tg-chat-meta">
        <span class="tg-time">${timeStr}</span>
        ${isUnread ? `<span class="tg-unread">${chat.unread_count}</span>` : ''}
      </div>`;

    div.addEventListener('click', () => {
      openChat(chat.id, chat.name || 'Usuario', chat.username || '', initial);
    });

    return div;
  }

  // ── Abrir conversación ────────────────────────────────────────
  function openChat (chatId, nombre, usuario, inicial) {
    currentChatId   = chatId;
    currentChatName = nombre;
    currentInitial  = inicial;

    // Actualizar UI del sidebar (marcar activo)
    document.querySelectorAll('.tg-chat-item').forEach(el => {
      el.classList.toggle('active', el.dataset.chatId === chatId);
    });

    // Mostrar área de chat
    const noChat    = SEL.noChat();
    const header    = SEL.chatHeader();
    const messages  = SEL.messages();
    const inputArea = SEL.inputArea();

    if (noChat)    noChat.style.display = 'none';
    if (header)  { header.classList.add('visible'); }
    if (messages){ messages.classList.add('visible'); messages.innerHTML = ''; }
    if (inputArea) inputArea.classList.add('visible');

    // Mostrar barra de atajos de respuesta
    const qrBar = document.getElementById('tg-quick-replies-bar');
    if (qrBar) qrBar.classList.add('visible');

    // Actualizar header
    const headerAvatar = SEL.headerAvatar();
    const headerName   = SEL.headerName();
    const headerSub    = SEL.headerSub();

    if (headerAvatar) headerAvatar.textContent = inicial;
    if (headerName)   headerName.textContent   = nombre;
    if (headerSub)    headerSub.innerHTML = `
      <span class="tg-id-chip" title="Copiar Telegram ID al portapapeles" onclick="navigator.clipboard.writeText('${chatId}')">
        🆔 ${chatId}
      </span>
      ${usuario ? `&nbsp;·&nbsp; <span style="color:var(--color-text-muted);">${escHtml(usuario)}</span>` : ''}`;

    // Habilitar input y quick replies
    const sendBtn  = SEL.sendBtn();
    const msgInput = SEL.msgInput();
    if (sendBtn)  sendBtn.disabled  = false;
    if (msgInput) msgInput.focus();
    // Activar botones de respuestas rápidas
    document.querySelectorAll('.tg-qr-btn').forEach(b => b.disabled = false);

    // Marcar como leído
    tgDb.ref(`telegram_chats/${chatId}`).update({ unread_count: 0 });

    // Limpiar listener anterior
    if (messagesRef && messagesListener) {
      messagesRef.off('child_added', messagesListener);
    }

    // Escuchar mensajes en tiempo real
    messagesRef    = tgDb.ref(`telegram_chats/${chatId}/messages`);
    messagesListener = messagesRef.on('child_added', snap => {
      const msg = snap.val();
      if (msg.sender === 'user') {
        // Marcar como leído si el chat está abierto
        tgDb.ref(`telegram_chats/${chatId}`).update({ unread_count: 0 });
      }
      renderMessage(msg);
      scrollToBottom();
    });

    // En móvil: esconder sidebar al abrir chat
    const sidebar = SEL.sidebar();
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.add('hidden-mobile');
    }
  }

  // ── Renderizar burbuja de mensaje ─────────────────────────────
  function renderMessage (msg) {
    const messagesEl = SEL.messages();
    if (!messagesEl) return;

    const isAdmin = msg.sender === 'admin';
    const isAuto  = !!msg.auto;  // marcado por el bot auto-responder
    const timeStr = formatTime(msg.timestamp);

    const wrap = document.createElement('div');
    wrap.className = `tg-msg-wrap ${isAdmin ? 'from-admin' : 'from-user'}`;

    if (!isAdmin) {
      // Mini avatar sólo en mensajes del usuario
      const avatar = document.createElement('div');
      avatar.className = 'tg-msg-avatar';
      avatar.textContent = currentInitial;
      wrap.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'tg-msg-bubble';
    bubble.innerHTML = `
      ${isAuto ? '<span class="tg-auto-badge">🤖 Auto</span>' : ''}
      ${escHtml(msg.text).replace(/\n/g, '<br>')}
      <span class="tg-msg-time">
        ${timeStr}
        ${isAdmin ? `<span class="tg-msg-check">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </span>` : ''}
      </span>`;

    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
  }

  // ── Enviar mensaje ────────────────────────────────────────────
  async function sendMessage () {
    const input = SEL.msgInput();
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentChatId) return;

    input.value = '';
    input.style.height = 'auto';
    input.focus();

    try {
      await tgDb.ref('telegram_outbox').push({
        chatId    : currentChatId,
        text      : text,
        timestamp : firebase.database.ServerValue.TIMESTAMP
      });
    } catch (e) {
      showToast('Error al enviar: ' + e.message, 'error');
    }
  }

  // ── Quick Replies con datos en tiempo real de Firebase ──────────
  const QUICK_REPLIES = [
    {
      id: 'qr-stock', label: '📦 Stock',
      build: async () => {
        const snap = await tgDb.ref('productos_ecommerce').once('value');
        const products = [];
        if (snap.exists()) {
          snap.forEach(c => {
            const p = c.val() || {};
            const stock = parseInt(p.stock, 10) || 0;
            if (stock > 0) {
              products.push({
                name: p.name || 'Producto Bifrost',
                vintage: p.vintage || '',
                stock
              });
            }
          });
        }
        if (!products.length) {
          return '📦 *Productos en stock actualmente*\n\nEn este momento no tenemos productos disponibles para entrega inmediata.\nSi quieres, puedo avisarte cuando entren nuevas existencias. 🍷';
        }
        products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        let msg = '📦 *Productos en stock actualmente*\n\n';
        products.forEach(p => {
          msg += `🔹 *${p.name}${p.vintage ? ` ${p.vintage}` : ''}*\n`;
          msg += `   📦 ${p.stock} disponibles\n\n`;
        });
        msg += '🛍️ Tienda online: https://bifrost-s-a.onrender.com/statics/shop.html\n\n';
        msg += 'Si quieres, también te comparto los precios. 😊';
        return msg;
      }
    },
    {
      id: 'qr-precio', label: '💰 Precios',
      build: async () => {
        const snap = await tgDb.ref('productos_ecommerce').once('value');
        let msg = '💰 *Precios Bifrost S.A.*\n\n';
        const products = [];
        if (snap.exists()) {
          snap.forEach(c => {
            const p = c.val() || {};
            const stock = parseInt(p.stock, 10) || 0;
            if (stock > 0) {
              const price = parseFloat(p.price) || 0;
              const discount = parseInt(p.discount, 10) || 0;
              const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;
              products.push({
                name: p.name || 'Producto Bifrost',
                vintage: p.vintage || '',
                stock,
                price,
                discount,
                finalPrice
              });
            }
          });
        }
        if (!products.length) return msg + 'Ahora mismo no tenemos productos en stock. Revisa luego nuestra tienda: https://bifrost-s-a.onrender.com/statics/shop.html';
        products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        products.forEach(p => {
          msg += `🔹 *${p.name}${p.vintage ? ` ${p.vintage}` : ''}*\n`;
          msg += `   📦 ${p.stock} disponibles\n`;
          if (p.discount > 0) msg += `   💸 C$${p.finalPrice.toFixed(2)} _(antes C$${p.price.toFixed(2)}, ${p.discount}% desc.)_\n\n`;
          else msg += `   💸 C$${p.finalPrice.toFixed(2)}\n\n`;
        });
        msg += '🛍️ Catálogo completo: https://bifrost-s-a.onrender.com/statics/shop.html\n\n';
        msg += 'Respóndenos con producto y cantidad para ayudarte a comprar. ✅';
        return msg;
      }
    },
    {
      id: 'qr-pedido', label: '📋 Cómo pedir',
      build: async () =>
        '📋 *¿Cómo hacer tu pedido en Bifrost S.A.?*\n\n' +
        '1️⃣ Indícanos *producto y cantidad*\n' +
        '2️⃣ Confírmanos tu *dirección* de entrega\n' +
        '3️⃣ Te enviamos la *cotización* y fecha\n' +
        '4️⃣ Coordina el *pago* y recibe tu pedido 🍷\n\n' +
        '🚚 Entregas con previo aviso | 💳 Múltiples métodos de pago'
    },
    {
      id: 'qr-contacto', label: '📞 Contacto',
      build: async () =>
        '📞 *Contacto Bifrost S.A.*\n\n' +
        'Un asesor se comunicará contigo a la brevedad.\n\n' +
        '⏰ *Horario:* Lun–Vie 8AM–6PM | Sáb 8AM–12PM\n\n' +
        '¿En qué más puedo ayudarte? 😊'
    }
  ];

  function renderQuickReplies () {
    const area = document.getElementById('tg-quick-replies');
    if (!area) return;
    area.innerHTML = '';
    QUICK_REPLIES.forEach(qr => {
      const btn = document.createElement('button');
      btn.className   = 'tg-qr-btn';
      btn.id          = qr.id;
      btn.textContent = qr.label;
      btn.title       = 'Cargar mensaje predefinido — puedes editar antes de enviar';
      btn.disabled    = !currentChatId;
      btn.addEventListener('click', async () => {
        if (!currentChatId) return;
        btn.disabled = true;
        const prev   = btn.textContent;
        btn.textContent = '⏳...';
        try {
          const text  = await qr.build();
          const input = SEL.msgInput();
          if (input) {
            input.value = text;
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            input.focus();
          }
        } catch (err) {
          console.warn('[QR] Error generando reply:', err);
        } finally {
          btn.disabled    = !currentChatId;
          btn.textContent = prev;
        }
      });
      area.appendChild(btn);
    });
  }

  // ── Filtrar lista con búsqueda ────────────────────────────────
  function filterChats (query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      renderChatList(allChats);
      return;
    }
    const filtered = allChats.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.username || '').toLowerCase().includes(q) ||
      (c.id || '').includes(q)
    );
    renderChatList(filtered);
  }

  // ── Badge de no leídos en la nav ──────────────────────────────
  function updateNavBadge (chats) {
    const total = chats.reduce((acc, c) => acc + (c.unread_count || 0), 0);
    const badge = SEL.navBadge();
    if (!badge) return;
    badge.textContent = total > 99 ? '99+' : total;
    badge.classList.toggle('has-unread', total > 0);
  }

  // ── Eventos ───────────────────────────────────────────────────
  function bindEvents () {
    renderQuickReplies(); // Crear barra de respuestas rápidas

    // Enviar con botón
    document.addEventListener('click', e => {
      if (e.target.closest('#tg-send-btn')) sendMessage();
      // Botón back en móvil
      if (e.target.closest('#tg-back-btn')) {
        const sidebar = SEL.sidebar();
        if (sidebar) sidebar.classList.remove('hidden-mobile');
      }
    });

    // Enviar con Enter (sin shift)
    document.addEventListener('keydown', e => {
      const input = SEL.msgInput();
      if (input && document.activeElement === input && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-resize del textarea
    document.addEventListener('input', e => {
      if (e.target.id === 'tg-msg-input') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
      }
      // Búsqueda en la lista
      if (e.target.id === 'tg-search') {
        filterChats(e.target.value);
      }
    });
  }

  // ── Utilidades ────────────────────────────────────────────────
  function scrollToBottom () {
    const el = SEL.messages();
    if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  function formatTime (ts) {
    if (!ts) return '';
    const d   = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
    }
    // Ayer
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';

    return d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0');
  }

  function escHtml (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast (msg, type = 'info') {
    // Usa el sistema de toast del dashboard si existe, o fallback simple
    if (window.showAdminToast) {
      window.showAdminToast(msg, type);
    } else {
      console.warn('[TG Panel]', msg);
    }
  }

})();
