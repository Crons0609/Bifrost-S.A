let currentChatId = null;
let messagesRef = null;
let messagesListener = null;

const db = firebase.database();
const chatListEl = document.getElementById('chat-list');
const messagesContainer = document.getElementById('messages-container');
const inputWrapper = document.getElementById('input-area');
const chatHeader = document.getElementById('chat-header');
const noChatView = document.getElementById('no-chat');
const msgInput = document.getElementById('msg-input');
const btnSend = document.getElementById('btn-send');

const avatarName = document.getElementById('active-avatar');
const activeTitle = document.getElementById('active-name');
const activeSub = document.getElementById('active-username');

// 1. CARGAR LISTA DE CHATS
db.ref('telegram_chats').on('value', (snapshot) => {
  chatListEl.innerHTML = '';
  if (!snapshot.exists()) {
    chatListEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.85rem;">No hay chats iniciados.</div>`;
    return;
  }

  const chats = [];
  snapshot.forEach(child => {
    chats.push({ id: child.key, ...child.val() });
  });

  // Ordenar por último mensaje (descendente)
  chats.sort((a, b) => (b.last_message_time || 0) - (a.last_message_time || 0));

  chats.forEach(chat => {
    const isUnread = chat.unread_count > 0;
    const initial = chat.name ? chat.name.charAt(0).toUpperCase() : '?';
    
    // Obtener la hora legible
    let timeStr = '';
    if (chat.last_message_time) {
      const date = new Date(chat.last_message_time);
      timeStr = date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
    }

    const div = document.createElement('div');
    div.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
    div.innerHTML = `
      <div class="chat-avatar">${initial}</div>
      <div class="chat-info">
        <div class="chat-name">${chat.name || 'Usuario'}</div>
        <div class="chat-username">${chat.username || 'N/A'}</div>
      </div>
      <div class="chat-meta">
        <span>${timeStr}</span>
        ${isUnread ? `<span class="unread-badge">${chat.unread_count}</span>` : ''}
      </div>
    `;

    div.addEventListener('click', () => openChat(chat.id, chat.name, chat.username, initial));
    chatListEl.appendChild(div);
  });
});

// 2. ABRIR UN CHAT
function openChat(chatId, nombre, usuario, inicial) {
  // UI Switch
  currentChatId = chatId;
  noChatView.style.display = 'none';
  chatHeader.style.display = 'flex';
  messagesContainer.style.display = 'flex';
  inputWrapper.style.display = 'flex';

  // Info Header
  avatarName.textContent = inicial;
  activeTitle.textContent = nombre || 'Usuario De Telegram';
  activeSub.textContent = usuario || 'ID: ' + chatId;
  
  // Limpiar Mensajes Antiguos
  messagesContainer.innerHTML = '';
  
  // Limpiar Listeners Anteriores
  if (messagesRef && messagesListener) {
    messagesRef.off('child_added', messagesListener);
  }

  // Activar botón de envío
  btnSend.disabled = false;
  msgInput.focus();

  // Marcar como leído
  db.ref(`telegram_chats/${chatId}`).update({ unread_count: 0 });

  // Poner los items del sidebar activos o inactivos visualmente (se hará con reload automático, pero forzaremos visual rápido)
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  // Almacenamos lógica en onValue del sidebar

  // Escuchar Nuevos Mensajes
  messagesRef = db.ref(`telegram_chats/${chatId}/messages`);
  messagesListener = messagesRef.on('child_added', (snap) => {
    const msg = snap.val();
    
    // Si el chat abierto ya fue leído, volver a forzar lectura si entra mje
    if (msg.sender === 'user') {
      db.ref(`telegram_chats/${chatId}`).update({ unread_count: 0 });
    }

    renderMessage(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
}

function renderMessage(msg) {
  const isMe = msg.sender === 'admin';
  const div = document.createElement('div');
  div.className = `msg-wrap ${isMe ? 'msg-admin' : 'msg-user'}`;
  
  const d = new Date(msg.timestamp || Date.now());
  const time = d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');

  div.innerHTML = `
    <div class="msg-bubble">
      ${escapeHtml(msg.text)}
      <span class="msg-time">${time}</span>
    </div>
  `;
  messagesContainer.appendChild(div);
}

// 3. ENVIAR MENSAJE
async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || !currentChatId) return;

  msgInput.value = '';
  msgInput.focus();

  // Se lanza hacia "telegram_outbox", el servidor Node se encarga del resto
  try {
    await db.ref('telegram_outbox').push({
      chatId: currentChatId,
      text: text,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    });
  } catch(e) {
    alert("Error enviando: " + e.message);
  }
}

// Event Listeners Input
btnSend.addEventListener('click', sendMessage);
msgInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}
