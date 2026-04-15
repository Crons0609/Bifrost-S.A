require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ── 1. CONFIGURACIÓN FIREBASE ADMIN ──
// Busca la llave generada en la configuración del proyecto Firebase -> Cuentas de Servicio
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');

let db = null;
if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Asegúrate de definir FIREBASE_DATABASE_URL en tu .env o hardcodearla
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://tu-proyecto.firebaseio.com"
  });
  db = admin.database();
  console.log("🔥 Firebase Admin inicializado.");
} else {
  console.warn("⚠️ ALERTA: No se encontró 'firebase-service-account.json'. Firebase no sincronizará.");
}

const app = express();
app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ERP Node.js corriendo en el puerto ${PORT}`);
});
