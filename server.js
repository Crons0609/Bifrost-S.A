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

// ═══════════════════════════════════════════════════════
// MAESTRO DE COSTOS SIMPLIFICADO: COMANDOS BOT TELEGRAM
// ═══════════════════════════════════════════════════════

// Función Auxiliar para Seguridad
const isAdmin = (ctx) => ctx.from && ctx.from.id.toString() === process.env.ADMIN_ID;

// 1. Comando: /nueva_receta
// Ej: /nueva_receta Tamarindo 60lb 600nio destajo:100 agua:200L:50nio azucar:20lb:1100nio levadura:0.5lb:30nio canela:40nio litros_obtenidos:208
bot.hears(/^\/nueva_receta\s+(.*)/i, async (ctx) => {
  if (!db || !isAdmin(ctx)) return;

  const argsString = ctx.match[1].trim();
  const parts = argsString.split(/\s+/);
  
  if (parts.length < 4) {
    return ctx.reply("❌ *Formato incorrecto.*\nEjemplo: `/nueva_receta Tamarindo 60lb 600nio destajo:100 agua:200L:50nio litros_obtenidos:208`", { parse_mode: 'Markdown' });
  }

  try {
    const nombre = parts[0];
    const qtyMP = parts[1]; 
    const costoMPTotal = parseFloat(parts[2].replace(/[^\d.]/g, ''));

    let destajo = 0;
    let agua = 0, azucar = 0, levadura = 0;
    let insumosExtra = [];
    let litrosObtenidos = 0;

    for (let i = 3; i < parts.length; i++) {
      const p = parts[i].split(':'); 
      const key = p[0].toLowerCase();
      
      if (key === 'litros_obtenidos') {
        litrosObtenidos = parseFloat(p[p.length - 1]);
        continue;
      }
      if (key === 'destajo') {
        destajo = parseFloat(p[p.length - 1].replace(/[^\d.]/g, ''));
        continue;
      }

      const costoText = p.length === 3 ? p[2] : p[1] || '0';
      const costo = parseFloat(costoText.replace(/[^\d.]/g, '')) || 0;

      if (key === 'agua') agua = costo;
      else if (key === 'azucar') azucar = costo;
      else if (key === 'levadura') levadura = costo;
      else insumosExtra.push({ nombre: p[0], costo });
    }

    if (!litrosObtenidos) return ctx.reply("❌ Falta el parámetro obligatorio `litros_obtenidos:VALOR`", { parse_mode: 'Markdown' });

    const totalExtras = insumosExtra.reduce((acc, el) => acc + el.costo, 0);
    const costoTotalLote = costoMPTotal + destajo + agua + azucar + levadura + totalExtras;
    const costoPorLitro = costoTotalLote / litrosObtenidos;
    
    const loteId = 'LOTE-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    
    // DB: Actualizar Costos
    const recetaParams = {
        id: loteId, nombre: nombre + " (App Telegram)", fecha: new Date().toISOString().split('T')[0],
        campos: {
          'p-materia-prima': costoMPTotal, 'p-destajo': destajo, 'p-agua': agua, 
          'p-azucar': azucar, 'p-levadura': levadura, 'q-litros-finales': litrosObtenidos
        },
        res_costo_litro: costoPorLitro.toFixed(2),
        in_extras: JSON.stringify(insumosExtra)
    };

    await db.ref(`costos_recetas/${loteId}`).set(recetaParams);
    
    // DB: Actualizar Stock/Inventario
    await db.ref(`stock_lotes/${loteId}`).set({
        nombre: nombre,
        litros_disponibles: litrosObtenidos,
        botellas_terminadas: 0,
        fecha: Date.now()
    });

    let resMsg = `✅ *LOTES RECIÉN CREADOS Y GUARDADOS*\n\n`;
    resMsg += `🆔 *Lote ID:* \`${loteId}\`\n`;
    resMsg += `📦 *Cepa/Receta:* ${nombre}\n`;
    resMsg += `💧 *Mosto Obtenido:* ${litrosObtenidos} L\n`;
    resMsg += `💵 *Costo Producción:* C$ ${costoTotalLote.toFixed(2)}\n`;
    resMsg += `🔥 *Costo/Litro Real:* C$ ${costoPorLitro.toFixed(2)}\n\n`;
    resMsg += `Vender botellas:\n\`/registrar_venta ${loteId} 10 350\``;

    ctx.reply(resMsg, { parse_mode: 'Markdown' });
  } catch(e) {
    ctx.reply("❌ Error al procesar: " + e.message);
  }
});

// 2. Comando: /registrar_venta
// Ej: /registrar_venta LOTE-XYZ 12 300
bot.hears(/^\/registrar_venta\s+(\S+)\s+(\d+)\s+([\d.]+)/i, async (ctx) => {
  if (!db || !isAdmin(ctx)) return;
  const loteId = ctx.match[1].toUpperCase();
  const botellasVenta = parseInt(ctx.match[2], 10);
  const precioUnidad = parseFloat(ctx.match[3]);

  try {
    const sRef = db.ref(`stock_lotes/${loteId}`);
    const snap = await sRef.once('value');
    if (!snap.exists()) return ctx.reply(`❌ El Lote \`${loteId}\` no existe. Usa /listar_recetas.`, { parse_mode: 'Markdown' });
    
    const lote = snap.val();
    let botsStock = lote.botellas_terminadas || 0;
    let litrosStock = lote.litros_disponibles || 0;

    let quedanLitros = litrosStock;
    let quedanBotellas = botsStock;

    if (botsStock >= botellasVenta) {
        quedanBotellas -= botellasVenta; // Venta directa de botellas hechas
    } else {
        const botsFaltantes = botellasVenta - botsStock;
        const litrosGastar = botsFaltantes * 0.75; // Asume botella 750ml
        
        if (litrosStock < litrosGastar) {
           return ctx.reply(`⚠️ *Falta Inventario.*\nStock real: ${litrosStock.toFixed(2)}L en barril y ${botsStock} botellas listas.`, { parse_mode: 'Markdown' });
        }
        quedanBotellas = 0;
        quedanLitros = litrosStock - litrosGastar;
    }

    await sRef.update({ litros_disponibles: quedanLitros, botellas_terminadas: quedanBotellas });
    await db.ref('erp/ventas').push({ loteId, qty: botellasVenta, precio: precioUnidad, total: botellasVenta * precioUnidad, timestamp: Date.now() });

    ctx.reply(`✅ *VENTA CERRADA*\n\nDescontadas: ${botellasVenta} botellas.\n*💰 Ingreso Total:* C$ ${(botellasVenta*precioUnidad).toFixed(2)}\n\n📦 *Stock Sobrante:*\n💧 Mosto: ${quedanLitros.toFixed(2)}L\n🍾 Botellas armadas: ${quedanBotellas}`, { parse_mode: 'Markdown' });
  } catch(e) {
    ctx.reply("❌ Error DB: " + e.message);
  }
});

// 3. Comando: /consultar_stock
bot.command('consultar_stock', async (ctx) => {
  if (!db || !isAdmin(ctx)) return;
  try {
    const snap = await db.ref('stock_lotes').once('value');
    if (!snap.exists()) return ctx.reply("❌ No hay lotes ni mosto registrado.");
    
    let msg = `📦 *INVENTARIO BIFROST S.A.*\n\n`;
    let tL = 0, tB = 0;
    snap.forEach(ch => {
       const v = ch.val();
       msg += `🔹 *${v.nombre}* (\`${ch.key}\`)\n💧 ${v.litros_disponibles.toFixed(2)} L | 🍾 ${v.botellas_terminadas} Bots\n\n`;
       tL += v.litros_disponibles; tB += v.botellas_terminadas;
    });
    msg += `📊 *TOTAL GLOBAL:*\n🛢️ *Líquido:* ${tL.toFixed(2)} L\n📦 *Botellas Listas:* ${tB}`;
    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch(e) { ctx.reply("❌ " + e.message); }
});

// 4. Comando: /potencial_botellas
bot.hears(/^\/potencial_botellas(?:@\S+)?(?:\s+(\S+))?/i, async (ctx) => {
  if (!db || !isAdmin(ctx)) return;
  const qId = ctx.match[1] ? ctx.match[1].toUpperCase() : null;
  try {
    let msg = `📊 *MÁXIMO TEÓRICO DE EMBOTELLADO*\n\n`;
    const snap = await db.ref('stock_lotes').once('value');
    if (!snap.exists()) return ctx.reply("No hay stock.");
    
    snap.forEach(ch => {
       const v = ch.val();
       if (!qId || ch.key === qId || qId.toLowerCase() === 'todos') {
          const bots = Math.floor(v.litros_disponibles / 0.75);
          msg += `🔹 *${v.nombre}* (\`${ch.key}\`):\nLiquido: ${v.litros_disponibles.toFixed(2)}L ➡️ Pude llenar *${bots} bots* (750ml)\n`;
       }
    });
    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch(e) { ctx.reply("❌ " + e.message); }
});

// 5. Comando: /listar_recetas
bot.command('listar_recetas', async (ctx) => {
  if (!db || !isAdmin(ctx)) return;
  try {
    const snap = await db.ref('stock_lotes').once('value');
    if (!snap.exists()) return ctx.reply("No hay registros activos.");
    let msg = `⚙️ *CÓDIGOS DE LOTES*\n\n_Copiar para usar en /registrar venta_\n\n`;
    snap.forEach(ch => { msg += `• ${ch.val().nombre}\n\`${ch.key}\`\n\n`; });
    ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch(e) { ctx.reply("❌ " + e.message); }
});

// ═══════════════════════════════════════════════════════


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
