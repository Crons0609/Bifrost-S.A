/* ============================================================
   BIFROST WINES — database.js
   Controlador IndexedDB + Sincronización Firebase Realtime DB
   ============================================================ */

const DB_NAME    = 'BifrostWinesDB';
const DB_VERSION = 3; // v3: sales + admins stores
const STORE_NAME = 'wines';
const SETTINGS_STORE = 'settings';
const SALES_STORE    = 'sales';
const ADMINS_STORE   = 'admins';

/* ── Firebase Web SDK (modo compat CDN) ───────────────────────── */
const FB_CONFIG = {
  apiKey: "AIzaSyASoDJQqXNWupnA0DicW6sWgm-zD7xe9HA",
  authDomain: "bifrost-sa.firebaseapp.com",
  databaseURL: "https://bifrost-sa-default-rtdb.firebaseio.com",
  projectId: "bifrost-sa",
  storageBucket: "bifrost-sa.firebasestorage.app",
  messagingSenderId: "943196918782",
  appId: "1:943196918782:web:5e197c094948a6517a66af"
};

// Inicializar Firebase usando el SDK compat (no módulos ES)
let _fbApp = null;
let _fbDb  = null;

function _initFirebase() {
  try {
    if (typeof firebase === 'undefined') return null;
    if (!firebase.apps.length) {
      _fbApp = firebase.initializeApp(FB_CONFIG);
    } else {
      _fbApp = firebase.apps[0];
    }
    _fbDb = firebase.database();
    return _fbDb;
  } catch (e) {
    console.warn('⚠️ Firebase no disponible:', e.message);
    return null;
  }
}

// Helper: Escribe en Firebase si está disponible
async function _fbSet(path, data) {
  const db = _fbDb || _initFirebase();
  if (!db) return;
  try { await db.ref(path).set(data); } catch(e) { console.warn('Firebase set error:', e.message); }
}

async function _fbPush(path, data) {
  const db = _fbDb || _initFirebase();
  if (!db) return null;
  try {
    const ref = await db.ref(path).push(data);
    return ref.key;
  } catch(e) { console.warn('Firebase push error:', e.message); return null; }
}

async function _fbUpdate(path, data) {
  const db = _fbDb || _initFirebase();
  if (!db) return;
  try { await db.ref(path).update(data); } catch(e) { console.warn('Firebase update error:', e.message); }
}

async function _fbRemove(path) {
  const db = _fbDb || _initFirebase();
  if (!db) return;
  try { await db.ref(path).remove(); } catch(e) { console.warn('Firebase remove error:', e.message); }
}


// ── Rutas de imágenes PNG ──────────────────────────────────────
const IMG = {
  bottles1: '../assets/images/wines/bottles-1.png',
  bottles2: '../assets/images/wines/bottles-2.png',
  logo:     '../assets/images/ui/bifrost-logo.png',
};

// ── Datos de Semilla ──────────────────────────────────────────
const SEED_WINES = [
  {
    id: 1,
    name: 'Vortex Nebula',
    vintage: 2019,
    category: 'Vino Tinto',
    description: 'Un tinto celestial nacido de suelos volcánicos ancestrales. Rubí profundo con destellos violáceos que evocan el nacimiento de una nebulosa estelar. Complejo, estructurado y eternamente cautivador. Elaborado con Tempranillo de viñedos en ladera a 900 metros de altitud.',
    tastingNotes: ['Cereza Negra', 'Cedro Ahumado', 'Pimienta Negra', 'Grafito', 'Violeta'],
    price: 189.00,
    discount: 0,
    stock: 24,
    featured: true,
    imageUrl: '../assets/images/wines/bottles-1.png',
    emoji: '🍷',
    region: 'Ribera del Duero, España',
    alcohol: '14.5%',
    pairing: 'Lomo de res añejado, Manchego curado, Chocolate negro',
  },
  {
    id: 2,
    name: 'Vortex Eclipse',
    vintage: 2020,
    category: 'Vino Tinto',
    description: 'Elaborado durante el eclipse solar de 2020. Un Cabernet Sauvignon de profundidad extraordinaria — taninos de terciopelo, riqueza cósmica y un final que perdura más que las estrellas. La añada del siglo en Napa Valley.',
    tastingNotes: ['Grosella Negra', 'Espresso', 'Cuero', 'Tabaco en Hoja', 'Ciruela Oscura'],
    price: 245.00,
    discount: 15,
    stock: 8,
    featured: true,
    imageUrl: '../assets/images/wines/bottles-1.png',
    emoji: '🍾',
    region: 'Napa Valley, California',
    alcohol: '15.2%',
    pairing: 'Wagyu, Pasta con trufa negra, Queso Époisses',
  },
  {
    id: 3,
    name: 'Bifrost Aurora',
    vintage: 2021,
    category: 'Vino Blanco',
    description: 'Inspirado en las luces del norte — un Chardonnay que reluce y danza en la copa. Acidez cristalina equilibrada con la profundidad de la fermentación en barrica. Oro líquido puro. La encarnación del aurora boreal en forma de vino.',
    tastingNotes: ['Melocotón Blanco', 'Avellana Tostada', 'Brioche', 'Crème Brûlée', 'Jazmín'],
    price: 142.00,
    discount: 0,
    stock: 35,
    featured: true,
    imageUrl: '../assets/images/wines/bottles-1.png',
    emoji: '🥂',
    region: 'Borgoña, Francia',
    alcohol: '13.8%',
    pairing: 'Bisque de langosta, Pescado en beurre blanc, Queso triple crema',
  },
  {
    id: 4,
    name: 'Vortex Obsidian',
    vintage: 2018,
    category: 'Vino Tinto',
    description: 'Del lecho volcánico de Sicilia — un Nero d\'Avola de oscuridad obsidiana. Criado 36 meses en roble francés, este vino tiene proporciones míticas. El alma de los flujos de lava ancestrales, embotellada en Etna.',
    tastingNotes: ['Higo Negro', 'Cacao en Polvo', 'Regaliz', 'Mineral Ferroso', 'Rosa Seca'],
    price: 320.00,
    discount: 0,
    stock: 5,
    featured: false,
    imageUrl: '../assets/images/wines/bottles-2.png',
    emoji: '🫙',
    region: 'Sicilia, Italia',
    alcohol: '15.8%',
    pairing: 'Ragú de jabalí, Parmigiano Reggiano añejado, Ragú de cordero',
  },
  {
    id: 5,
    name: 'Frost Meridian',
    vintage: 2022,
    category: 'Rosado',
    description: 'El aliento de los gigantes de escarcha de Bifrost — un rosado provenzal de elegancia etérea. Salmón pálido luminiscente, imposiblemente delicado, con un crescendo de precisión mineral fresca. La Provenza en una copa.',
    tastingNotes: ['Fresa Silvestre', 'Sal Marina', 'Grosella Blanca', 'Flor de Cítrico', 'Mineralidad Calcárea'],
    price: 98.00,
    discount: 10,
    stock: 42,
    featured: false,
    imageUrl: '../assets/images/wines/bottles-2.png',
    emoji: '🌸',
    region: 'Provenza, Francia',
    alcohol: '12.5%',
    pairing: 'Ensalada Niçoise, Lubina a la plancha, Burrata',
  },
  {
    id: 6,
    name: 'Vortex Singularity',
    vintage: 2017,
    category: 'Vino de Postre',
    description: 'La expresión más rara de la colección Vortex. Un Sauternes de cosecha tardía de incomparable riqueza — como oro líquido congelado en el horizonte de sucesos de un agujero negro. Bébelo una vez. Recuérdalo para siempre.',
    tastingNotes: ['Panal de Miel', 'Jengibre Confitado', 'Azafrán', 'Mermelada de Albaricoque', 'Roble Caramelizado'],
    price: 480.00,
    discount: 0,
    stock: 3,
    featured: false,
    imageUrl: '../assets/images/wines/bottles-2.png',
    emoji: '✨',
    region: 'Sauternes, Burdeos, Francia',
    alcohol: '13.5%',
    pairing: 'Foie gras, Roquefort, Tarta Tatin clásica',
  }
];

const DEFAULT_SETTINGS = {
  flashSaleActive: false,
  flashSaleDiscount: 20,
};

/* ============================================================
   Clase BifrostDB
   ============================================================ */
class BifrostDB {
  constructor() {
    this.db = null;
    this._ready = this._init();
  }

  _init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB no disponible. Usando localStorage.');
        this._initLocalStorage();
        resolve(this);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        this._initLocalStorage();
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const wineStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          wineStore.createIndex('category', 'category', { unique: false });
          wineStore.createIndex('featured', 'featured', { unique: false });
          wineStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }

        // v3: sales store
        if (!db.objectStoreNames.contains(SALES_STORE)) {
          const salesStore = db.createObjectStore(SALES_STORE, { keyPath: 'id', autoIncrement: true });
          salesStore.createIndex('channel', 'channel', { unique: false });
          salesStore.createIndex('date',    'date',    { unique: false });
          salesStore.createIndex('wineId',  'wineId',  { unique: false });
        }

        // v3: admins store
        if (!db.objectStoreNames.contains(ADMINS_STORE)) {
          const adminsStore = db.createObjectStore(ADMINS_STORE, { keyPath: 'id', autoIncrement: true });
          adminsStore.createIndex('username', 'username', { unique: true });
        }
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        this.useIndexedDB = true;

        const count = await this.count();
        if (count === 0) {
          await this._seedData();
        }

        const settings = await this.getSettings();
        if (!settings) {
          await this.saveSettings(DEFAULT_SETTINGS);
        }

        // Seed default superadmin if no admins exist
        const adminCount = await this._countStore(ADMINS_STORE);
        if (adminCount === 0) {
          await this._seedDefaultAdmin();
        }

        resolve(this);
      };
    });
  }

  _initLocalStorage() {
    this.useIndexedDB = false;
    const wines = JSON.parse(localStorage.getItem('bifrost_wines') || 'null');
    if (!wines) {
      localStorage.setItem('bifrost_wines', JSON.stringify(SEED_WINES));
    }
    const settings = JSON.parse(localStorage.getItem('bifrost_settings') || 'null');
    if (!settings) {
      localStorage.setItem('bifrost_settings', JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem('bifrost_sales')) {
      localStorage.setItem('bifrost_sales', '[]');
    }
    if (!localStorage.getItem('bifrost_admins')) {
      localStorage.setItem('bifrost_admins', JSON.stringify([{
        id: 1, username: 'bifrost@admin', password: 'vortex2024',
        role: 'superadmin', active: true,
        createdAt: new Date().toISOString()
      }]));
    }
  }

  _seedData() {
    return new Promise((resolve) => {
      if (!this.useIndexedDB) {
        localStorage.setItem('bifrost_wines', JSON.stringify(SEED_WINES));
        resolve();
        return;
      }

      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      SEED_WINES.forEach(wine => store.add(wine));
      tx.oncomplete = resolve;
    });
  }

  async ready() { return this._ready; }

  getAllWines() {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        resolve(JSON.parse(localStorage.getItem('bifrost_wines') || '[]'));
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror  = () => reject(request.error);
    });
  }

  getWineById(id) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        const wines = JSON.parse(localStorage.getItem('bifrost_wines') || '[]');
        resolve(wines.find(w => w.id === Number(id)) || null);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(Number(id));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror  = () => reject(request.error);
    });
  }

  async getFeaturedWines() {
    const all = await this.getAllWines();
    return all.filter(w => w.featured);
  }

  addWine(wine) {
    return new Promise(async (resolve, reject) => {
      if (!this.useIndexedDB) {
        const wines = JSON.parse(localStorage.getItem('bifrost_wines') || '[]');
        wine.id = Date.now();
        wines.push(wine);
        localStorage.setItem('bifrost_wines', JSON.stringify(wines));
        resolve(wine);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.add(wine);
      request.onsuccess = () => { wine.id = request.result; resolve(wine); };
      request.onerror = () => reject(request.error);
    });
  }

  updateWine(wine) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        const wines = JSON.parse(localStorage.getItem('bifrost_wines') || '[]');
        const idx = wines.findIndex(w => w.id === wine.id);
        if (idx !== -1) wines[idx] = wine;
        localStorage.setItem('bifrost_wines', JSON.stringify(wines));
        resolve(wine);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(wine);
      request.onsuccess = () => resolve(wine);
      request.onerror  = () => reject(request.error);
    });
  }

  deleteWine(id) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        let wines = JSON.parse(localStorage.getItem('bifrost_wines') || '[]');
        wines = wines.filter(w => w.id !== Number(id));
        localStorage.setItem('bifrost_wines', JSON.stringify(wines));
        resolve();
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(Number(id));
      request.onsuccess = () => resolve();
      request.onerror  = () => reject(request.error);
    });
  }

  count() {
    return new Promise((resolve) => {
      if (!this.useIndexedDB) {
        const wines = JSON.parse(localStorage.getItem('bifrost_wines') || '[]');
        resolve(wines.length);
        return;
      }
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(0);
    });
  }

  getSettings() {
    return new Promise((resolve) => {
      if (!this.useIndexedDB) {
        resolve(JSON.parse(localStorage.getItem('bifrost_settings') || 'null'));
        return;
      }
      const tx = this.db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get('global');
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror   = () => resolve(null);
    });
  }

  saveSettings(settings) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        localStorage.setItem('bifrost_settings', JSON.stringify(settings));
        resolve(settings);
        return;
      }
      const tx = this.db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.put({ key: 'global', value: settings });
      req.onsuccess = () => resolve(settings);
      req.onerror   = () => reject(req.error);
    });
  }

  async calculatePrice(wine) {
    const settings = await this.getSettings() || DEFAULT_SETTINGS;
    let discountApplied = wine.discount || 0;
    if (settings.flashSaleActive && settings.flashSaleDiscount > discountApplied) {
      discountApplied = settings.flashSaleDiscount;
    }
    const finalPrice = discountApplied > 0
      ? wine.price * (1 - discountApplied / 100)
      : wine.price;
    return {
      original: wine.price,
      final: Math.round(finalPrice * 100) / 100,
      discountPct: discountApplied,
    };
  }

  static stockLevel(qty) {
    if (qty <= 0) return 'out';
    if (qty <= 5) return 'low';
    return 'in';
  }

  static stockLabel(qty) {
    if (qty <= 0) return 'Sin Stock';
    if (qty <= 5) return `Stock Bajo (${qty} disponibles)`;
    return 'En Stock';
  }

  /* ══════════════════════════════════════════════════
     VENTAS (Sales)
  ═══════════════════════════════════════════════════ */

  getAllSales() {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        resolve(JSON.parse(localStorage.getItem('bifrost_sales') || '[]'));
        return;
      }
      const tx    = this.db.transaction(SALES_STORE, 'readonly');
      const store = tx.objectStore(SALES_STORE);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  addSale(sale) {
    return new Promise((resolve, reject) => {
      sale.createdAt = sale.createdAt || new Date().toISOString();
      if (!this.useIndexedDB) {
        const sales = JSON.parse(localStorage.getItem('bifrost_sales') || '[]');
        sale.id = Date.now();
        sales.push(sale);
        localStorage.setItem('bifrost_sales', JSON.stringify(sales));
        resolve(sale);
        return;
      }
      const tx    = this.db.transaction(SALES_STORE, 'readwrite');
      const store = tx.objectStore(SALES_STORE);
      const req   = store.add(sale);
      req.onsuccess = () => { sale.id = req.result; resolve(sale); };
      req.onerror   = () => reject(req.error);
    });
  }

  deleteSale(id) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        let sales = JSON.parse(localStorage.getItem('bifrost_sales') || '[]');
        sales = sales.filter(s => s.id !== Number(id));
        localStorage.setItem('bifrost_sales', JSON.stringify(sales));
        resolve();
        return;
      }
      const tx    = this.db.transaction(SALES_STORE, 'readwrite');
      const store = tx.objectStore(SALES_STORE);
      const req   = store.delete(Number(id));
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  updateSale(sale) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        const sales = JSON.parse(localStorage.getItem('bifrost_sales') || '[]');
        const idx   = sales.findIndex(s => s.id === sale.id);
        if (idx !== -1) sales[idx] = sale;
        localStorage.setItem('bifrost_sales', JSON.stringify(sales));
        resolve(sale);
        return;
      }
      const tx    = this.db.transaction(SALES_STORE, 'readwrite');
      const store = tx.objectStore(SALES_STORE);
      const req   = store.put(sale);
      req.onsuccess = () => resolve(sale);
      req.onerror   = () => reject(req.error);
    });
  }

  /* ══════════════════════════════════════════════════
     ADMINISTRADORES
  ═══════════════════════════════════════════════════ */

  async _seedDefaultAdmin() {
    await this.addAdmin({
      username:  'bifrost@admin',
      password:  'vortex2024',
      role:      'superadmin',
      active:    true,
      createdAt: new Date().toISOString(),
    });
  }

  _countStore(storeName) {
    return new Promise((resolve) => {
      if (!this.useIndexedDB) { resolve(0); return; }
      const tx = this.db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(0);
    });
  }

  getAllAdmins() {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        resolve(JSON.parse(localStorage.getItem('bifrost_admins') || '[]'));
        return;
      }
      const tx    = this.db.transaction(ADMINS_STORE, 'readonly');
      const store = tx.objectStore(ADMINS_STORE);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  addAdmin(admin) {
    return new Promise((resolve, reject) => {
      admin.createdAt = admin.createdAt || new Date().toISOString();
      if (!this.useIndexedDB) {
        const admins = JSON.parse(localStorage.getItem('bifrost_admins') || '[]');
        admin.id = Date.now();
        admins.push(admin);
        localStorage.setItem('bifrost_admins', JSON.stringify(admins));
        // Sync to Firebase
        _fbPush('erp/admins', { ...admin }).catch(() => {});
        resolve(admin);
        return;
      }
      const tx    = this.db.transaction(ADMINS_STORE, 'readwrite');
      const store = tx.objectStore(ADMINS_STORE);
      const req   = store.add(admin);
      req.onsuccess = () => {
        admin.id = req.result;
        // Sync to Firebase (use id as key)
        _fbSet(`erp/admins/${admin.id}`, { ...admin }).catch(() => {});
        resolve(admin);
      };
      req.onerror = () => reject(req.error);
    });
  }

  deleteAdmin(id) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        let admins = JSON.parse(localStorage.getItem('bifrost_admins') || '[]');
        admins = admins.filter(a => a.id !== Number(id));
        localStorage.setItem('bifrost_admins', JSON.stringify(admins));
        _fbRemove(`erp/admins/${id}`).catch(() => {});
        resolve();
        return;
      }
      const tx    = this.db.transaction(ADMINS_STORE, 'readwrite');
      const store = tx.objectStore(ADMINS_STORE);
      const req   = store.delete(Number(id));
      req.onsuccess = () => {
        _fbRemove(`erp/admins/${id}`).catch(() => {});
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  updateAdmin(admin) {
    return new Promise((resolve, reject) => {
      if (!this.useIndexedDB) {
        const admins = JSON.parse(localStorage.getItem('bifrost_admins') || '[]');
        const idx    = admins.findIndex(a => a.id === admin.id);
        if (idx !== -1) admins[idx] = admin;
        localStorage.setItem('bifrost_admins', JSON.stringify(admins));
        _fbUpdate(`erp/admins/${admin.id}`, { ...admin }).catch(() => {});
        resolve(admin);
        return;
      }
      const tx    = this.db.transaction(ADMINS_STORE, 'readwrite');
      const store = tx.objectStore(ADMINS_STORE);
      const req   = store.put(admin);
      req.onsuccess = () => {
        _fbUpdate(`erp/admins/${admin.id}`, { ...admin }).catch(() => {});
        resolve(admin);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async verifyAdmin(username, password) {
    const admins = await this.getAllAdmins();
    return admins.find(a => a.username === username && a.password === password && a.active) || null;
  }
}

// Cargar Firebase SDK compat antes de instanciar BifrostDB
function _loadFirebaseSDK() {
  const scripts = [
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
  ];
  let chain = Promise.resolve();
  scripts.forEach(src => {
    chain = chain.then(() => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = res; // no bloquear si falla
      document.head.appendChild(s);
    }));
  });
  return chain;
}

_loadFirebaseSDK().then(() => {
  _initFirebase();
  console.log('🔥 Firebase SDK compat cargado y listo.');
}).catch(() => {});

const DB = new BifrostDB();
window.BifrostDB = DB;
