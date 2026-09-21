// Capa de datos: MySQL 8 vía adaptador síncrono (db-maria-sync.js, driver mysql2).
// El mismo adaptador habló MariaDB antes de la migración a MySQL; es motor-agnóstico.
// Para volver a SQLite: git checkout -- db.js (o copiar db.js.sqlite.bak).
const db = require('./db-maria-sync');

db.exec(`
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  description TEXT DEFAULT '',
  logo TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  pin TEXT DEFAULT '1234',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing('businesses', 'template', "TEXT DEFAULT 'clasica'");
addColumnIfMissing('businesses', 'color', "TEXT DEFAULT 'blue'");
addColumnIfMissing('businesses', 'color_hex', "TEXT DEFAULT '#2563eb'");
addColumnIfMissing('businesses', 'show_network', 'INTEGER DEFAULT 0');
addColumnIfMissing('businesses', 'giro', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'estilo', "TEXT DEFAULT 'moderno'");
addColumnIfMissing('businesses', 'color_hex2', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'color_mode', "TEXT DEFAULT 'degradado'");
addColumnIfMissing('businesses', 'grid_cols', 'INTEGER DEFAULT 3');
addColumnIfMissing('businesses', 'plan', "TEXT DEFAULT 'free'");
addColumnIfMissing('businesses', 'import_map', "TEXT DEFAULT ''"); // memoria del último mapeo de carga masiva
addColumnIfMissing('businesses', 'wa_message', "TEXT DEFAULT ''"); // mensaje personalizado de WhatsApp (vacio = por defecto)
addColumnIfMissing('businesses', 'currency', "TEXT DEFAULT 'MXN'"); // código ISO 4217 de la moneda de la tienda
addColumnIfMissing('businesses', 'giros', "TEXT DEFAULT ''"); // giros múltiples (JSON array), el primero es el principal
addColumnIfMissing('businesses', 'plan_price', 'REAL DEFAULT 0'); // precio del plan contratado
addColumnIfMissing('businesses', 'plan_ends_at', "TEXT DEFAULT ''"); // fecha de vencimiento del plan (YYYY-MM-DD)
addColumnIfMissing('businesses', 'suspended', 'INTEGER DEFAULT 0'); // tienda suspendida por el administrador
addColumnIfMissing('businesses', 'ads_enabled', 'INTEGER DEFAULT 1'); // esta tienda se muestra como anuncio en otros catálogos (activado por defecto)
// Ajustes finos de diseño ('' = seguir el estilo visual elegido)
addColumnIfMissing('businesses', 'bg', "TEXT DEFAULT ''");      // fondo de la tienda
addColumnIfMissing('businesses', 'card', "TEXT DEFAULT ''");    // color de tarjetas de producto
addColumnIfMissing('businesses', 'text', "TEXT DEFAULT ''");    // color de texto
addColumnIfMissing('businesses', 'muted', "TEXT DEFAULT ''");   // texto secundario
addColumnIfMissing('businesses', 'border', "TEXT DEFAULT ''");  // borde de tarjetas
addColumnIfMissing('businesses', 'radius', "TEXT DEFAULT ''");  // esquinas de tarjetas
addColumnIfMissing('businesses', 'font', "TEXT DEFAULT ''");    // fuente personalizada
addColumnIfMissing('businesses', 'accent', "TEXT DEFAULT ''");      // color de botones/acento ('' = seguir el estilo o modo de color)
addColumnIfMissing('businesses', 'accent2', "TEXT DEFAULT ''");     // segundo color del degradado de botones
addColumnIfMissing('businesses', 'header', "TEXT DEFAULT ''");      // fondo de la cabecera (arriba, donde va el título)
addColumnIfMissing('businesses', 'header_text', "TEXT DEFAULT ''"); // color del texto de la cabecera
addColumnIfMissing('businesses', 'sections', "TEXT DEFAULT ''"); // secciones visibles y su orden (JSON)
addColumnIfMissing('businesses', 'demo', "TEXT DEFAULT ''"); // contenido de ejemplo para la vista previa (JSON)
addColumnIfMissing('businesses', 'pin_hash', "TEXT DEFAULT ''"); // hash del PIN (scrypt), vacío = legado sin migrar
addColumnIfMissing('businesses', 'horario', "TEXT DEFAULT ''"); // horario de atención (JSON [{d:1..7,o:'HH:MM',c:'HH:MM'}])
addColumnIfMissing('businesses', 'horario_msg', "TEXT DEFAULT ''"); // mensaje cuando la tienda está cerrada
// Pago en línea con Mercado Pago (Checkout Pro): cada tienda usa su propia
// cuenta — pega su Access Token de producción en Configuración. mp_enabled
// controla si el botón de pago aparece en el catálogo (el token puede quedar
// guardado pero desactivado sin borrarlo).
addColumnIfMissing('businesses', 'mp_access_token', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'mp_enabled', 'INTEGER DEFAULT 0');
addColumnIfMissing('businesses', 'mp_public_key', "TEXT DEFAULT ''"); // clave pública de Mercado Pago (formulario de tarjeta dentro de la app)
addColumnIfMissing('businesses', 'mp_refresh_token', "TEXT DEFAULT ''"); // OAuth de Mercado Pago (Marketplace)
addColumnIfMissing('businesses', 'mp_user_id', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'mp_connected', 'INTEGER DEFAULT 0'); // 1 = cuenta conectada con el botón (no con token pegado)
addColumnIfMissing('businesses', 'mp_token_expires', "TEXT DEFAULT ''");
// Transferencia bancaria: el dueño publica su cuenta y el cliente transfiere
// por su cuenta y manda el comprobante por WhatsApp — sin pasarela, sin
// comisión, es como ya operan la mayoría de estas tiendas. transfer_enabled
// controla si se muestra en el catálogo (los datos pueden quedar guardados
// y desactivados sin borrarlos, igual que mp_enabled).
addColumnIfMissing('businesses', 'transfer_bank', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'transfer_account', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'transfer_holder', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'transfer_enabled', 'INTEGER DEFAULT 0');
// Secciones extra del catálogo (JSON): about {title,text}, envios, pagos[], pagos_nota,
// testimonios[{name,text,stars}] y los interruptores showNew / showTop / showHow.
// Las de texto salen solas cuando el dueño las llena; las automáticas se prenden aquí.
addColumnIfMissing('businesses', 'extras', "TEXT DEFAULT ''");
addColumnIfMissing('products', 'show_stock', 'INTEGER DEFAULT 1'); // 1 = el catálogo muestra el stock (Quedan X / N disponibles); 0 = lo oculta
addColumnIfMissing('products', 'custom_tags', "TEXT DEFAULT ''"); // etiquetas personalizadas: JSON [{"t":"Mayoreo","c":"#7c3aed"}]

// Sesiones con token aleatorio (el dueño y el maestro). Ya no se usa cookie estática.
db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  biz_id INTEGER,
  kind TEXT DEFAULT 'owner',
  created_at TEXT DEFAULT (datetime('now'))
);
`);
addColumnIfMissing('sessions', 'emp_id', 'INTEGER');
addColumnIfMissing('sessions', 'expires_at', 'TEXT');

// Empleados por tienda (cada uno con su PIN y permisos)
db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT DEFAULT '',
  perms TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);

// Migración única: las tiendas preexistentes conservan plan pro
if (db.pragma('user_version', { simple: true }) < 2) {
  db.prepare(`UPDATE businesses SET plan = 'pro' WHERE plan = 'free'`).run();
  db.pragma('user_version = 2');
}

// Migración única: todas las tiendas se publicitan por defecto (antes era opt-in desde el panel maestro)
if (db.pragma('user_version', { simple: true }) < 3) {
  db.prepare(`UPDATE businesses SET ads_enabled = 1`).run();
  db.pragma('user_version = 3');
}

// Migración de ids de color antiguos → nuevos (con degradado)
const COLOR_MAP = { blue: 'azul', emerald: 'esmeralda', violet: 'violeta', rose: 'rosa', amber: 'ambar' };
const rows = db.prepare('SELECT id, color, color_hex FROM businesses').all();
rows.forEach(r => {
  if (COLOR_MAP[r.color]) {
    db.prepare('UPDATE businesses SET color = ? WHERE id = ?').run(COLOR_MAP[r.color], r.id);
  }
  if (!r.color_hex) {
    db.prepare('UPDATE businesses SET color_hex = ? WHERE id = ?').run('#2563eb', r.id);
  }
});

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  category_id INTEGER,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Catálogo de atributos reutilizables por tienda (talla, color, presentación…)
CREATE TABLE IF NOT EXISTS attribute_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  vals TEXT NOT NULL DEFAULT '[]',  -- JSON array de valores
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Historial de precios y promociones (para reportes)
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  product_id INTEGER,
  name TEXT DEFAULT '',
  price REAL DEFAULT 0,
  old_price REAL,
  promo_type TEXT DEFAULT '',
  promo_gift TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);

addColumnIfMissing('products', 'old_price', 'REAL');
addColumnIfMissing('products', 'featured', 'INTEGER DEFAULT 0');
addColumnIfMissing('products', 'stock', 'INTEGER');  // NULL = sin control de stock
addColumnIfMissing('products', 'made_to_order', 'INTEGER DEFAULT 0'); // se vende por pedido, sin límite de stock
addColumnIfMissing('products', 'variants', "TEXT DEFAULT ''");  // JSON array, ej: ["Chica","Mediana","Grande"]
addColumnIfMissing('products', 'promo_ends_at', "TEXT DEFAULT ''"); // vencimiento de la promoción (YYYY-MM-DD)
addColumnIfMissing('products', 'galeria', "TEXT DEFAULT ''"); // fotos extra (JSON array de URLs)
addColumnIfMissing('products', 'promo_type', "TEXT DEFAULT ''"); // '' | descuento | porcentaje | 2x1 | 3x2 | regalo
addColumnIfMissing('products', 'promo_value', 'REAL DEFAULT 0'); // % de descuento (para porcentaje)
addColumnIfMissing('products', 'promo_gift', "TEXT DEFAULT ''"); // producto/texto de regalo (para regalo)
addColumnIfMissing('products', 'sku', "TEXT DEFAULT ''"); // código interno
addColumnIfMissing('products', 'tags', "TEXT DEFAULT ''"); // etiquetas separadas por coma (búsqueda)
addColumnIfMissing('products', 'video', "TEXT DEFAULT ''"); // URL de video (limitado, 1 por producto)
addColumnIfMissing('products', 'specs', "TEXT DEFAULT ''"); // características (una por línea: Clave: Valor)
addColumnIfMissing('products', 'barcode', "TEXT DEFAULT ''"); // código de barras (opcional)
addColumnIfMissing('products', 'allow_installments', 'INTEGER DEFAULT 0'); // 1 = permite abonos
addColumnIfMissing('products', 'installment_count', 'INTEGER DEFAULT 6'); // número de abonos sugeridos
addColumnIfMissing('products', 'installment_min_down', 'REAL DEFAULT 0'); // enganche mínimo (monto)
addColumnIfMissing('products', 'installment_frequency', "TEXT DEFAULT 'semanal'"); // semanal | quincenal | mensual

// Proveedores y pedidos de compra
db.exec(`
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  supplier_id INTEGER,
  items TEXT DEFAULT '',
  total REAL DEFAULT 0,
  received INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);
addColumnIfMissing('purchase_orders', 'received', 'INTEGER DEFAULT 0');
addColumnIfMissing('suppliers', 'email', "TEXT DEFAULT ''");
addColumnIfMissing('orders', 'customer_phone', "TEXT DEFAULT ''");
addColumnIfMissing('orders', 'is_installment', 'INTEGER DEFAULT 0'); // 1 = pedido a abonos
addColumnIfMissing('orders', 'installment_paid', 'REAL DEFAULT 0'); // total ya abonado
addColumnIfMissing('orders', 'installment_count', 'INTEGER DEFAULT 0'); // abonos configurados
addColumnIfMissing('orders', 'installment_frequency', "TEXT DEFAULT 'semanal'"); // semanal | quincenal | mensual (para calcular las fechas de pago)
// Costo de compra (lo que le costó al dueño, no lo que cobra) — para poder
// calcular margen/ganancia real en vez de solo ingresos brutos. Con
// variantes, el costo vive por combinación dentro del JSON de variants
// (igual que precio/stock/sku), este campo es solo para productos sin variantes.
addColumnIfMissing('products', 'cost', 'REAL DEFAULT 0');

// Historial de abonos (pagos parciales)
db.exec(`
CREATE TABLE IF NOT EXISTS abonos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
`);

// Clientes (mini-CRM): contactos frecuentes con su historial de pedidos
db.exec(`
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  items TEXT DEFAULT '',
  total REAL NOT NULL,
  customer_name TEXT DEFAULT '',
  status TEXT DEFAULT 'nuevo',
  paid INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  detail TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);
`);
// Cuándo se cobró/liquidó el pedido (para calcular ingresos reales por periodo: abonos + contado cobrado)
addColumnIfMissing('orders', 'paid_at', 'TEXT');
db.prepare("UPDATE orders SET paid_at = created_at WHERE paid = 1 AND (paid_at IS NULL OR paid_at = '')").run();
// Pago en línea con Mercado Pago: id de pago y estado que reporta su API,
// para no volver a marcar pagado un pedido ya confirmado (webhook duplicado)
// y para poder mostrar "pendiente/rechazado" en vez de solo pagado/no pagado.
addColumnIfMissing('orders', 'mp_payment_id', "TEXT DEFAULT ''");
addColumnIfMissing('orders', 'mp_status', "TEXT DEFAULT ''");

// ================= PLANES (creados por el administrador maestro) =================
db.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price REAL DEFAULT 0,
  days INTEGER DEFAULT 30,
  max_products INTEGER DEFAULT -1,
  ads INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1
);
`);

// El plan decide si la tienda puede personalizar el diseño de su catálogo
addColumnIfMissing('plans', 'design', 'INTEGER DEFAULT 0');

const planCount = db.prepare('SELECT COUNT(*) AS c FROM plans').get().c;
if (planCount === 0) {
  db.prepare('INSERT INTO plans (key, name, price, days, max_products, ads) VALUES (?, ?, ?, ?, ?, ?)')
    .run('free', 'Gratis', 0, 0, 3, 1);
  db.prepare('INSERT INTO plans (key, name, price, days, max_products, ads) VALUES (?, ?, ?, ?, ?, ?)')
    .run('pro', 'Pro', 199, 30, -1, 0);
}

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM businesses').get().c;
  if (existing > 0) return;

  const insertBiz = db.prepare(`
    INSERT INTO businesses (slug, name, whatsapp, description, pin, plan)
    VALUES (?, ?, ?, ?, ?, 'demo')
  `);
  const biz = insertBiz.run(
    'ferreteria-demo',
    'Ferretería El Toro',
    '528719920338',
    'Todo para tu obra y hogar en Torreón. Envíos a toda La Laguna.',
    '1234'
  );
  const businessId = biz.lastInsertRowid;

  const insertCat = db.prepare(`
    INSERT INTO categories (business_id, name, sort) VALUES (?, ?, ?)
  `);
  const catHerramientas = insertCat.run(businessId, 'Herramientas', 1).lastInsertRowid;
  const catPintura = insertCat.run(businessId, 'Pintura', 2).lastInsertRowid;
  const catPlomeria = insertCat.run(businessId, 'Plomería', 3).lastInsertRowid;

  const insertProd = db.prepare(`
    INSERT INTO products (business_id, category_id, name, price, description, image)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const products = [
    [catHerramientas, 'Martillo de uña 16oz', 189, 'Mango de fibra, cabeza forjada.', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400'],
    [catHerramientas, 'Desarmador plano set 6 piezas', 249, 'Set profesional con mango antiderrapante.', 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=400'],
    [catHerramientas, 'Cinta métrica 5m', 129, 'Con freno y clip de bolsillo.', 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400'],
    [catPintura, 'Pintura vinílica blanca 19L', 899, 'Cubriente, lavable, interior/exterior.', 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400'],
    [catPintura, 'Brocha 3 pulgadas', 69, 'Cerda sintética, durabilidad alta.', 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400'],
    [catPlomeria, 'Tubo PVC 1/2 pulgada 6m', 149, 'Cédula 40, uso hidráulico.', 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400'],
    [catPlomeria, 'Llave de paso 1/2', 119, 'Latón pulido, rosca estándar.', 'https://images.unsplash.com/photo-1586864387734-d2ce3a8efa9e?w=400'],
    [catPlomeria, 'Sellador de tuberías 250ml', 85, 'Resistente a presión y temperatura.', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400']
  ];

  for (const [cat, name, price, desc, img] of products) {
    insertProd.run(businessId, cat, name, price, desc, img);
  }
}

seed();

// Plan 'demo': muestra publicidad cruzada (como gratis) pero sin límite de productos,
// para que las tiendas de demostración se vean completas. ferreteria-demo lo usa.
db.prepare("INSERT OR IGNORE INTO plans (key, name, price, days, max_products, ads) VALUES ('demo', 'Demo', 0, 0, -1, 1)").run();
db.prepare("UPDATE businesses SET plan = 'demo' WHERE slug = 'ferreteria-demo'").run();

// Los planes de pago (pro) y la demo incluyen personalización de diseño; el gratis no.
db.prepare("UPDATE plans SET design = 1 WHERE key IN ('pro', 'demo')").run();

// ================= PÁGINAS Y PUBLICACIONES (tipo WordPress) =================
db.exec(`
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'personalizada',
  icon TEXT DEFAULT '',
  blocks TEXT DEFAULT '[]',
  visible_menu INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  sort INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE(business_id, slug)
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  page_id INTEGER,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  image TEXT DEFAULT '',
  published_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE SET NULL
);
`);

// El negocio guarda qué preset eligió en el Modo fácil (para re-sugerir después)
addColumnIfMissing('businesses', 'giro_preset', "TEXT DEFAULT ''");
// Si el dueño ya pasó por el asistente del Modo fácil al menos una vez
addColumnIfMissing('businesses', 'onboarding_done', 'INTEGER DEFAULT 0');
// Bloques de contenido del catálogo (banner, texto, destacados…) ordenables con drag&drop
addColumnIfMissing('businesses', 'blocks', "TEXT DEFAULT '[]'");
addColumnIfMissing('businesses', 'page_bg', "TEXT DEFAULT ''");
addColumnIfMissing('businesses', 'redes', "TEXT DEFAULT '{}'");
// Patrón visual del catálogo público (mismo contenido, distinto acomodo):
// 'catalogo' = patrón base de venta por catálogo; 'joyeria' = patrón elegante tipo boutique.
addColumnIfMissing('businesses', 'catalog_design', "TEXT DEFAULT 'catalogo'");

// Si aparece o no en el directorio público de nessik.net (landing → "Tiendas").
// Por defecto sí: solo se desmarca a mano para tiendas de prueba/demo internas
// que no deben verse como parte del catálogo de negocios reales.
addColumnIfMissing('businesses', 'listed', 'INTEGER DEFAULT 1');

// ============ Plantillas personalizadas del equipo ============
db.exec(`
CREATE TABLE IF NOT EXISTS custom_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  emoji TEXT DEFAULT '📄',
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  giro TEXT DEFAULT '',
  blocks_json TEXT DEFAULT '[]',
  colors_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1
);
`);
addColumnIfMissing('custom_templates', 'is_default', 'INTEGER DEFAULT 0');
db.exec("CREATE TABLE IF NOT EXISTS site_config (key TEXT PRIMARY KEY, value TEXT)");
db.exec("INSERT OR IGNORE INTO site_config (key, value) VALUES ('default_template_id', '')");
// Giro personalizados registrados por usuarios; se ofrecen como autocompletado a los demás
db.exec("CREATE TABLE IF NOT EXISTS giros (name VARCHAR(80) PRIMARY KEY, used INTEGER DEFAULT 0)");

function crearPaginasSugeridas(businessId, paginasSugeridas) {
  if (!Array.isArray(paginasSugeridas) || !paginasSugeridas.length) return;
  const insertPage = db.prepare('INSERT OR IGNORE INTO pages (business_id, slug, title, type, icon, sort) VALUES (?, ?, ?, ?, ?, ?)');
  paginasSugeridas.forEach((p, i) => {
    if (!p || !p.slug || !p.title) return;
    insertPage.run(businessId, String(p.slug), String(p.title), String(p.type || 'personalizada'), String(p.icon || ''), i);
  });
}

// Cuestionario de bienvenida: categorías sugeridas según el giro elegido.
// No pisa nada si el negocio ya tiene categorías propias (evita duplicar o sobrescribir trabajo real).
function crearCategoriasSugeridas(businessId, categoryNames) {
  if (!Array.isArray(categoryNames) || !categoryNames.length) return;
  const current = db.prepare('SELECT name, sort FROM categories WHERE business_id = ?').all(businessId);
  const existingNames = new Set(current.map(row => String(row.name || '').trim().toLocaleLowerCase('es')));
  let nextSort = current.reduce((max, row) => Math.max(max, Number(row.sort) || 0), -1) + 1;
  const insert = db.prepare('INSERT INTO categories (business_id, name, sort) VALUES (?, ?, ?)');
  categoryNames.forEach(name => {
    const cleanName = String(name || '').trim().slice(0, 60);
    const key = cleanName.toLocaleLowerCase('es');
    if (!cleanName || existingNames.has(key)) return;
    insert.run(businessId, cleanName, nextSort++);
    existingNames.add(key);
  });
}

// Cuestionario de bienvenida: plantillas de atributos (talla, color…) sugeridas según el giro.
// Agrega solo las plantillas faltantes; nunca reemplaza las que el negocio ya personalizó.
function crearAtributosSugeridos(businessId, attrsMap) {
  if (!attrsMap || typeof attrsMap !== 'object') return;
  const current = db.prepare('SELECT name FROM attribute_templates WHERE business_id = ?').all(businessId);
  const existingNames = new Set(current.map(row => String(row.name || '').trim().toLocaleLowerCase('es')));
  const insert = db.prepare('INSERT INTO attribute_templates (business_id, name, vals) VALUES (?, ?, ?)');
  Object.keys(attrsMap).forEach(name => {
    const cleanName = String(name || '').trim().slice(0, 60);
    const key = cleanName.toLocaleLowerCase('es');
    if (!cleanName || existingNames.has(key)) return;
    insert.run(businessId, cleanName, JSON.stringify(attrsMap[name]));
    existingNames.add(key);
  });
}

module.exports = db;
module.exports.crearPaginasSugeridas = crearPaginasSugeridas;
module.exports.crearCategoriasSugeridas = crearCategoriasSugeridas;
module.exports.crearAtributosSugeridos = crearAtributosSugeridos;
require('./seed-demo');
