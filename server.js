require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Inicializar DB
const dbFile = path.join(__dirname, 'bifrost_erp.db');
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error("Error abriendo la BD:", err);
  else {
    db.run(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      description TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  }
});

const app = express();
app.use(cors());
app.use(express.json());

// Telegram Bot Config
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

if (!BOT_TOKEN) {
  console.warn("⚠️ ALERTA: No se encontró TELEGRAM_BOT_TOKEN en el archivo .env.");
  console.warn("         El servidor funcionará, pero el bot no se conectará.");
}

const bot = new Telegraf(BOT_TOKEN || "MODO_SEGURO");

// Middleware de seguridad: Filtrar que solo el administrador controle el ERP
bot.use((ctx, next) => {
  if (ctx.from && ctx.from.id.toString() === ADMIN_ID) return next();
  if (ctx.from) {
    ctx.reply("⛔ Sistema Administrativo Bifrost S.A.\nAcceso Denegado. Este intento ha sido registrado.");
  }
});

// Comandos del Bot
bot.start((ctx) => {
  ctx.reply("🍷 Bienvenido al ERP de Bifrost S.A.\nComandos disponibles:\n/stock - Ver inventario\n+gasto [monto] [motivo] - Añadir gasto de producción\n/estadisticas - Informe financiero");
});

bot.command('stock', (ctx) => {
  ctx.reply("📊 Estado del Stock:\n(Conecta tu inventario web pronto aquí)");
});

bot.command('estadisticas', (ctx) => {
  db.all(`SELECT SUM(amount) as totalGastos FROM logs WHERE type='gasto'`, [], (err, rows) => {
    if (err) return ctx.reply("Error leyendo la base de datos.");
    const gastos = rows[0]?.totalGastos || 0;
    ctx.reply(`📈 Estadísticas de Bifrost S.A:\n\n💸 Gastos Registrados: $${gastos.toFixed(2)}\n\n(Las ventas se conectarán próximamente).`);
  });
});

bot.hears(/^\+gasto\s+(\d+(?:\.\d+)?)\s+(.+)/i, (ctx) => {
  const monto = parseFloat(ctx.match[1]);
  const motivo = ctx.match[2];
  
  db.run(`INSERT INTO logs (type, amount, description) VALUES (?, ?, ?)`, ['gasto', monto, motivo], function(err) {
    if (err) {
      return ctx.reply("❌ Error al guardar el gasto.");
    }
    ctx.reply(`✅ Gasto Registrado con éxito:\n\n💵 Monto: $${monto.toFixed(2)}\n📝 Concepto: ${motivo}\n🆔 Ref: #${this.lastID}`);
  });
});

// Lanzar el bot solo si tenemos token
if (BOT_TOKEN) {
  bot.launch().then(() => console.log("🤖 Bot de Telegram inicializado y operativo."));
}

// ── ENDPOINTS DE LA API (WEB <-> SERVIDOR) ──
app.post('/api/notify/sale', (ctx_req, res) => {
  const body = ctx_req.body;
  if (!BOT_TOKEN || !ADMIN_ID) return res.status(500).send("Falta configuración del Bot");

  let msg = `🔔 *NUEVA VENTA REGISTRADA*\nSe procesó una venta en línea:\n\n`;
  body.items.forEach(i => {
    msg += `• ${i.qty}x ${i.name} ($${i.price})\n`;
  });
  msg += `\n💰 *Total Facturado: $${body.total}*`;

  bot.telegram.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' })
    .then(() => res.send({ success: true }))
    .catch(e => res.status(500).send({ error: e.message }));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 Servidor ERP Bifrost S.A. corriendo en el puerto ${PORT}`);
  console.log(`===========================================\n`);
});
