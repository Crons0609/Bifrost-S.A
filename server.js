require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
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

// ── CORS: solo permitir dominio de producción y localhost en dev ──
const allowedOrigins = [
  'https://bifrost-sa.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];
app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sin origin (Postman, curl, server-to-server) en dev
    if (!origin || allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error('CORS: origen no permitido — ' + origin));
  },
  methods: ['GET', 'POST'],
  optionsSuccessStatus: 200
}));

// ── Rate Limit: máx 20 checkouts cada 15 minutos por IP ──
const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' }
});

app.use(express.json({ limit: '1mb' }));

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

// Función Auxiliar para Seguridad
const isAdmin = (ctx) => {
  if (!ctx.from) return false;
  const idStr = ctx.from.id.toString();
  return idStr === ADMIN_ID || idStr === process.env.ADMIN_ID;
};

bot.start((ctx) => {
  if (isAdmin(ctx)) {
    ctx.reply("🍷 Bienvenido al ERP de Bifrost S.A.\n\nComandos:\n/stock - Ver inventario\n/listar_recetas - Ver lotes activos\n+gasto [monto] [motivo] - Añadir gasto de producción\n/responder [ID_Mensaje] [Texto] - Para contestar al cliente");
  } else {
    const nombre = ctx.from.first_name || '';
    ctx.reply(`¡Hola ${nombre}! 👋 Bienvenido a Bifrost S.A. 🍷\nSoy el asistente virtual de la bodega.\nPuedes consultarme sobre nuestro stock disponible, precios o enviarnos un mensaje y te atenderemos a la brevedad.`);
  }
});

// Registrar Gasto en Firebase
bot.hears(/^\+gasto\s+(\d+(?:\.\d+)?)\s+(.+)/i, async (ctx) => {
  if (!isAdmin(ctx)) return;
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
  if (!isAdmin(ctx)) return;
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
// SISTEMA DE AUTO-RESPUESTAS INTELIGENTES CON MÉTRICAS
// ═══════════════════════════════════════════════════════

/**
 * Detecta la intención del mensaje del cliente.
 * Retorna una clave de intención o null si no se detecta.
 */
function detectarIntencion(texto) {
  const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const intenciones = {
    stock: [
      'stock', 'inventario', 'disponible', 'tienen', 'hay', 'queda', 'quedan',
      'cuanto tienen', 'cuantos tienen', 'que tienen', 'que venden', 'productos',
      'litros', 'botellas', 'mosto', 'lote', 'existencia'
    ],
    precio: [
      'precio', 'precios', 'cuanto cuesta', 'cuanto vale', 'cuanto es',
      'cuanto cobran', 'costo', 'costos', 'valor', 'tarifa', 'cuanto',
      'venta', 'comprar', 'adquirir', 'cotizacion', 'cotizar'
    ],
    catalogo: [
      'catalogo', 'vinos', 'tipos', 'variedades', 'opciones', 'que vinos',
      'lista', 'que tienen disponible', 'menu', 'carta', 'seleccion',
      'cepa', 'cepas', 'sabor', 'presentacion'
    ],
    contacto: [
      'contacto', 'telefono', 'llamar', 'whatsapp', 'ubicacion', 'direccion',
      'donde estan', 'horario', 'horarios', 'atencion', 'hablar con', 'humano',
      'persona', 'asesor'
    ],
    pedido: [
      'pedido', 'pedir', 'ordenar', 'compra', 'comprar', 'hacer pedido',
      'quiero', 'necesito', 'entregan', 'delivery', 'envio', 'envios',
      'domicilio', 'despacho'
    ],
    saludo: [
      'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
      'hey', 'hi', 'buen dia', 'saludos', 'que tal', 'como estan'
    ]
  };

  for (const [intencion, palabras] of Object.entries(intenciones)) {
    if (palabras.some(p => t.includes(p))) return intencion;
  }
  return null;
}

async function getEcommerceProductsInStock() {
  const snap = await db.ref('productos_ecommerce').once('value');
  if (!snap.exists()) return [];

  const products = [];
  snap.forEach((child) => {
    const product = child.val() || {};
    const stock = parseInt(product.stock, 10) || 0;
    if (stock > 0) {
      products.push({
        id: child.key,
        name: product.name || 'Producto Bifrost',
        vintage: product.vintage || '',
        stock,
        price: parseFloat(product.price) || 0,
        discount: parseInt(product.discount, 10) || 0,
      });
    }
  });

  products.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return products;
}

function formatProductPrice(product) {
  const finalPrice = product.discount > 0
    ? product.price * (1 - product.discount / 100)
    : product.price;

  return {
    finalPrice,
    originalPrice: product.price,
    discount: product.discount
  };
}

/**
 * Genera respuesta automática basada en datos reales de Firebase.
 * Retorna el texto de la respuesta o null si no aplica auto-respuesta.
 */
async function generarAutoRespuesta(intencion, userName) {
  if (!db) return null;

  const nombre = userName.split(' ')[0]; // Solo primer nombre

  switch (intencion) {

    case 'saludo':
      return `¡Hola, ${nombre}! 👋 Bienvenido a *Bifrost S.A.* 🍷\n\n` +
             `Soy el asistente virtual de la bodega. Puedo ayudarte con:\n\n` +
             `📦 *¿Qué tenemos disponible?* — Pregunta por el stock\n` +
             `💰 *¿Cuánto cuesta?* — Consulta precios por lote\n` +
             `📋 *¿Cómo hacer un pedido?* — Te explico el proceso\n` +
             `📞 *¿Hablar con alguien?* — Te conecto con un asesor\n\n` +
             `_¿En qué puedo ayudarte hoy?_ 😊`;

    case 'stock':
    case 'catalogo': {
      const products = await getEcommerceProductsInStock();
      if (!products.length) {
        return `Hola ${nombre} 👋 Lamentablemente en este momento no contamos con stock disponible.\n` +
               `Déjanos tu contacto y te avisamos cuando tengamos producción lista. 📬`;
      }

      let respuesta = `¡Hola, ${nombre}! 🍷 Estos son los *productos que tenemos en stock ahora mismo*:\n\n`;
      products.forEach((product) => {
        respuesta += `🔹 *${product.name}${product.vintage ? ` ${product.vintage}` : ''}*\n`;
        respuesta += `   📦 ${product.stock} disponibles\n\n`;
      });

      respuesta += `🛍️ Ver tienda: https://bifrost-s-a.onrender.com/statics/shop.html\n\n`;
      respuesta += `_Si quieres, te paso precios o te ayudo a elegir uno._ 😊`;
      return respuesta;
    }

    case 'precio': {
      const products = await getEcommerceProductsInStock();
      if (!products.length) {
        return `Hola ${nombre}! Para enviarte los precios actualizados, ` +
               `por favor escríbenos directamente y un asesor te atenderá. 📞`;
      }

      let respuesta = `💰 *Precios Bifrost S.A.*\n\n`;
      products.forEach((product) => {
        const { finalPrice, originalPrice, discount } = formatProductPrice(product);
        respuesta += `🔹 *${product.name}${product.vintage ? ` ${product.vintage}` : ''}*\n`;
        respuesta += `   📦 ${product.stock} disponibles\n`;
        if (discount > 0) {
          respuesta += `   💸 C$${finalPrice.toFixed(2)} _(antes C$${originalPrice.toFixed(2)}, ${discount}% desc.)_\n\n`;
        } else {
          respuesta += `   💸 C$${finalPrice.toFixed(2)}\n\n`;
        }
      });

      respuesta += `🛍️ Ver catálogo completo: https://bifrost-s-a.onrender.com/statics/shop.html\n\n`;
      respuesta += `Si me dices cuál te interesa, también te ayudo con la compra. 🍷`;
      return respuesta;
    }

    case 'pedido':
      return `¡Hola, ${nombre}! 📦 *¿Cómo hacer tu pedido en Bifrost S.A.?*\n\n` +
             `Es muy sencillo:\n\n` +
             `1️⃣ *Consulta el stock disponible* — Pregunta "¿qué tienen disponible?"\n` +
             `2️⃣ *Indícanos el producto y cantidad* que deseas\n` +
             `3️⃣ *Confirma tu dirección* de entrega o punto de retiro\n` +
             `4️⃣ *Un asesor te confirma* el total y coordina la entrega\n\n` +
             `🚚 Realizamos entregas coordinadas con previo aviso.\n` +
             `💳 Aceptamos distintos métodos de pago.\n\n` +
             `_¿Deseas ver nuestro stock disponible ahora?_ 🍷`;

    case 'contacto':
      return `¡Hola, ${nombre}! 📞 *Contacto Bifrost S.A.*\n\n` +
             `Un asesor humano ha sido notificado y se comunicará contigo.\n\n` +
             `⏰ *Horario de atención:*\n` +
             `Lunes a Viernes: 8:00 AM – 6:00 PM\n` +
             `Sábados: 8:00 AM – 12:00 PM\n\n` +
             `Mientras esperas, puedes preguntarme sobre:\n` +
             `📦 Stock disponible · 🍷 Catálogo · 📋 Cómo pedir`;

    default:
      return null; // Sin auto-respuesta, el admin responde manualmente
  }
}

// ═══════════════════════════════════════════════════════
// CHATS DIRECTOS TELEGRAM (WHATSAPP BUSINESS STYLE)
// ═══════════════════════════════════════════════════════

// 1. Listener Bot -> Firebase (Clientes escriben al bot)
bot.on('text', async (ctx) => {
  // Evitar procesar comandos o mensajes del admin hacia sí mismo aquí
  if (ctx.message.text.startsWith('/') || isAdmin(ctx)) return;

  const chatId   = ctx.from.id.toString();
  const userName = ctx.from.first_name || 'Desconocido';
  const usernameStr = ctx.from.username ? `@${ctx.from.username}` : '';
  const text     = ctx.message.text;

  try {
    const chatRef = db.ref(`telegram_chats/${chatId}`);

    // ── Actualizar metadatos del chat ──────────────────────────
    await chatRef.update({
      userId:            chatId,
      name:              userName,
      username:          usernameStr,
      last_message_time: Date.now(),
    });

    // Incrementar no leídos
    const unreadSnap = await chatRef.child('unread_count').once('value');
    await chatRef.child('unread_count').set((unreadSnap.val() || 0) + 1);

    // Guardar mensaje del usuario en historial
    await chatRef.child('messages').push({
      sender:    'user',
      text:      text,
      timestamp: Date.now()
    });

    // ── Auto-Responder Inteligente ─────────────────────────────
    const intencion = detectarIntencion(text);
    if (intencion) {
      const autoRespuesta = await generarAutoRespuesta(intencion, userName);
      if (autoRespuesta) {
        // Pequeña pausa para que se sienta natural (no instantáneo)
        await new Promise(r => setTimeout(r, 900));

        // Enviar al cliente via Telegram
        await ctx.reply(autoRespuesta, { parse_mode: 'Markdown' });

        // Guardar en historial (marcado como [auto] para distinguirlo)
        await chatRef.child('messages').push({
          sender:    'admin',
          text:      autoRespuesta,
          auto:      true,   // flag para mostrar indicador "Automático" en el dashboard
          timestamp: Date.now()
        });

        // Actualizar preview del chat con el eco de la auto-respuesta
        await chatRef.update({
          last_message_time: Date.now(),
          unread_count:      0
        });

        console.log(`🤖 Auto-respuesta [${intencion}] enviada a ${userName} (${chatId})`);
      }
    }

  } catch(e) { console.error('Error en handler de chat Telegram:', e); }
});

// 2. Listener Firebase -> Telegram Bot (Cuando el Admin responde desde la Web)
if (db && BOT_TOKEN) {
  db.ref('telegram_outbox').on('child_added', async (snapshot) => {
    const msgData = snapshot.val();
    const msgKey = snapshot.key;
    
    // Si ya tuvo un fallo crítico, evitar bucle infinito
    if (msgData.failed) return; 

    try {
      await bot.telegram.sendMessage(msgData.chatId, msgData.text);
      
      await db.ref(`telegram_chats/${msgData.chatId}/messages`).push({
        sender: 'admin',
        text: msgData.text,
        timestamp: Date.now()
      });
      
      await db.ref(`telegram_outbox/${msgKey}`).remove();
      // Reseteamos el unread_count ya que le respondió
      await db.ref(`telegram_chats/${msgData.chatId}`).update({ unread_count: 0 });
      
    } catch(e) {
      console.error("Error re-enviando mensaje a Telegram:", e);
      await db.ref(`telegram_outbox/${msgKey}`).update({ failed: true, error: e.message });
    }
  });
}

// ── Listener Firebase -> Telegram Bot (Cuando un Cliente Nuevo pregunta) ──
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
  bot.launch().then(() => console.log('🤖 Bot de Telegram inicializado y escuchando cambios.'));
  // Graceful shutdown — evita que el bot quede zombie en Render al reiniciar
  process.once('SIGINT',  () => { bot.stop('SIGINT');  console.log('Bot detenido (SIGINT).'); });
  process.once('SIGTERM', () => { bot.stop('SIGTERM'); console.log('Bot detenido (SIGTERM).'); });
}

// ── 3. ENDPOINTS API OPCIONALES (RENDER) ──
app.get('/api/ping', (req, res) => res.send("ERP Backend Alive"));

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
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

    // Descontar Stock de E-Commerce Global
    if (db && items) {
      for (const item of items) {
        const prodRef = db.ref(`productos_ecommerce/${item.id}/stock`);
        await prodRef.transaction((currentStock) => {
          if (currentStock === null) return currentStock;
          return Math.max(0, currentStock - item.qty);
        });
      }
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
