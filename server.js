require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── 1. CONFIGURACIÓN FIREBASE ADMIN ──
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

let serviceAccount = null;

// En Producción (Render) leeremos la clave en formato texto desde las Variables de Entorno
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (err) {
    console.error("⚠️ Error leyendo FIREBASE_SERVICE_ACCOUNT_KEY:", err.message);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = require(serviceAccountPath);
}

let db = null;
if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      // En Render puedes declarar FIREBASE_DATABASE_URL también
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://bifrost-sa-default-rtdb.firebaseio.com"
    });
    db = admin.database();
    console.log("🔥 Firebase Admin inicializado.");
  } catch (err) {
    console.error("⚠️ Error inicializando Firebase:", err.message);
  }
} else {
  console.warn("⚠️ ALERTA: No se encontró 'firebase-service-account.json' ni la variable 'FIREBASE_SERVICE_ACCOUNT_KEY'. Firebase no sincronizará.");
}

const app = express();
app.use(cors());
app.use(express.json());

// ── SERVIR EL FRONTEND (Web Service) ──
// Servimos explícitamente las carpetas estáticas para no exponer archivos del backend y clave secretas
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/statics', express.static(path.join(__dirname, 'statics')));

// Ruta principal para servir la página de inicio
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── 2. CONFIGURACIÓN TELEGRAM BOT ──
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

const bot = new Telegraf(BOT_TOKEN || "MODO_SEGURO_DUMMY");

bot.use((ctx, next) => {
  if (ctx.from && ctx.from.id.toString() === ADMIN_ID) return next();
  if (ctx.from) {
    ctx.reply("⛔ Bifrost S.A ERP: Acceso Denegado.");
  }
});

bot.start((ctx) => {
  ctx.reply("🍷 Bienvenido al ERP de Bifrost S.A.\n\nComandos:\n/stock - Ver inventario\n+gasto [monto] [motivo] - Añadir gasto de producción\n/responder [ID_Mensaje] [Texto] - Para contestar al cliente");
});

// Registrar Gasto en Firebase
bot.hears(/^\+gasto\s+(\d+(?:\.\d+)?)\s+(.+)/i, async (ctx) => {
  if (!db) return ctx.reply("❌ Error: Firebase no configurado.");
  const monto = parseFloat(ctx.match[1]);
  const motivo = ctx.match[2];
  
  try {
    const ref = db.ref('erp/gastos').push();
    await ref.set({
      amount: monto,
      description: motivo,
      timestamp: admin.database.ServerValue.TIMESTAMP
    });
    ctx.reply(`✅ Gasto Registrado en Firebase:\n\n💵 Monto: $${monto.toFixed(2)}\n📝 Concepto: ${motivo}`);
  } catch(e) {
    ctx.reply("❌ Error al guardar en Firebase: " + e.message);
  }
});

// Comando de respuesta a un mensaje de cliente
// Formato: /responder [numero O ID] [mensaje...]
bot.hears(/^\/responder\s+(\S+)\s+(.+)/i, async (ctx) => {
  if (!db) return;
  const msgId = ctx.match[1];
  const respuesta = ctx.match[2];
  
  try {
    const chatRef = db.ref(`mensajes/${msgId}`);
    const snapshot = await chatRef.once('value');
    if (!snapshot.exists()) return ctx.reply("❌ Ese ticket de chat no existe.");

    chatRef.update({
      respuestaAdmin: respuesta,
      contestada: true,
      timestamp_respuesta: admin.database.ServerValue.TIMESTAMP
    });
    ctx.reply(`✅ Respuesta enviada al ticket #${msgId}. El cliente lo verá en su pantalla.`);
  } catch(e) {
    ctx.reply("❌ Error de sistema: " + e.message);
  }
});

// Listener Firebase -> Telegram Bot (Cuando un Cliente Nuevo pregunta)
if (db && BOT_TOKEN && ADMIN_ID) {
  db.ref('mensajes').on('child_added', (snapshot) => {
    const msg = snapshot.val();
    if (msg.contestada) return; // Si ya fue contestada (historial), ignorar.

    const tId = snapshot.key;
    const txt = `🔔 *NUEVA CONSULTA DE CLIENTE*\n\n*Recibido:* ${msg.texto}\n*Detalle del Carrito:* ${msg.carritoResumen || "Ninguno"}\n\nPara responder, usa el comando:\n\`/responder ${tId} Hola, te habla el sumiller...\``;

    bot.telegram.sendMessage(ADMIN_ID, txt, { parse_mode: 'Markdown' }).catch(console.error);
  });
}

if (BOT_TOKEN) {
  bot.launch().then(() => console.log("🤖 Bot de Telegram inicializado y escuchando cambios."));
}

// ── 3. ENDPOINTS API OPCIONALES (RENDER) ──
app.get('/api/ping', (req, res) => res.send("ERP Backend Alive"));

app.post('/api/checkout', async (req, res) => {
  try {
    const { items, total, cliente } = req.body;
    
    if (!items || items.length === 0 || !cliente || !cliente.nombre || !cliente.telefono) {
      return res.status(400).json({ error: "Faltan datos del pedido o de contacto del cliente." });
    }

    let pedidoId = "PENDIENTE";
    // 1. Guardar en Firebase
    if (db) {
      const ref = db.ref('erp/pedidos').push();
      pedidoId = ref.key;
      await ref.set({
        items,
        total,
        cliente,
        estado: 'pendiente',
        timestamp: admin.database.ServerValue.TIMESTAMP
      });
    }

    // 2. Avisar por Telegram
    if (BOT_TOKEN && ADMIN_ID) {
      let msg = `🔔 *NUEVO PEDIDO WEB*\n\n`;
      msg += `👤 *Cliente:* ${cliente.nombre}\n`;
      msg += `📱 *Teléfono:* ${cliente.telefono}\n`;
      if (cliente.direccion) msg += `📍 *Dirección/Notas:* ${cliente.direccion}\n`;
      msg += `\n🛒 *Resumen del Pedido:*\n`;
      
      items.forEach(item => {
        msg += `• ${item.qty}x ${item.name} (-$${(item.price * item.qty).toFixed(2)})\n`;
      });
      
      msg += `\n💰 *Total Pagar:* $${total.toFixed(2)}\n`;
      msg += `*(ID: ${pedidoId})*`;
      
      bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' }).catch(console.error);
    }
    
    res.json({ success: true, pedidoId, message: "Pedido procesado." });
  } catch (error) {
    console.error("Error en /api/checkout:", error);
    res.status(500).json({ error: "Error interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ERP Node.js corriendo en el puerto ${PORT}`);
});
