// Pruebas de integración contra el servidor en marcha (por defecto http://localhost:3000).
// Crean una tienda temporal "test-auto-*" con sus productos y sesión, prueban carrito, pagos y stock,
// y al final la borran. Si el servidor o la base no están disponibles, se omiten.
//
//   1) arranca el servidor (npm start)   2) npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Cargar .env como lo hace el servidor
try {
  fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const i = l.indexOf('=');
    if (i > 0 && l[0] !== '#') process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  });
} catch (e) { /* sin .env */ }

const BASE = process.env.TEST_BASE || 'http://localhost:3000';
const slug = 'test-auto-' + crypto.randomBytes(3).toString('hex');
const csrf = 'csrf' + crypto.randomBytes(8).toString('hex');
let db = null, ready = false, biz = null, sid = '';
const prod = {};

async function up() {
  try { const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(4000) }); return r.status < 500; } catch (e) { return false; }
}
const http = (p, opts = {}) => fetch(BASE + p, Object.assign({ redirect: 'manual' }, opts, {
  headers: Object.assign({ Cookie: 'csrf=' + csrf + '; sid=' + sid, 'x-csrf-token': csrf, 'Content-Type': 'application/json' }, opts.headers || {})
}));
const admin = (p, body) => http('/' + slug + '/admin/' + p, { method: 'POST', body: JSON.stringify(body || {}) });
const stock = (id) => Number(db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock);
const order = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
const lastOrder = () => db.prepare('SELECT * FROM orders WHERE business_id = ? ORDER BY id DESC LIMIT 1').get(biz.id);

function addProduct(name, price, stockN, extra) {
  const cols = Object.assign({ business_id: biz.id, name, price, stock: stockN, active: 1 }, extra || {});
  const k = Object.keys(cols);
  return Number(db.prepare('INSERT INTO products (' + k.join(',') + ') VALUES (' + k.map(() => '?').join(',') + ')').run(...k.map((x) => cols[x])).lastInsertRowid);
}

test.before(async () => {
  if (!(await up())) return;
  try {
    db = require('../db');
    db.prepare("INSERT INTO businesses (slug, name, whatsapp, pin, plan, active) VALUES (?, ?, ?, ?, 'free', 1)").run(slug, 'Tienda Prueba Auto', '8710000000', 'x');
    biz = db.prepare('SELECT * FROM businesses WHERE slug = ?').get(slug);
    sid = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO sessions (token, biz_id, kind, emp_id, expires_at) VALUES (?, ?, ?, ?, ?)').run(sid, biz.id, 'owner', null, new Date(Date.now() + 3600e3).toISOString());
    prod.a = addProduct('Reloj Prueba', 1000, 10);
    prod.b = addProduct('Anillo Prueba', 500, 5);
    prod.dup = addProduct('Reloj Prueba', 1000, 100); // mismo nombre, otro id
    ready = true;
  } catch (e) { console.error('No se pudo preparar la tienda de prueba:', e.message); }
});

test.after(() => {
  if (!db || !biz) return;
  try {
    db.prepare('DELETE FROM orders WHERE business_id = ?').run(biz.id);
    db.prepare('DELETE FROM products WHERE business_id = ?').run(biz.id);
    db.prepare('DELETE FROM customers WHERE business_id = ?').run(biz.id);
    db.prepare('DELETE FROM sessions WHERE token = ?').run(sid);
    db.prepare('DELETE FROM businesses WHERE id = ?').run(biz.id);
  } catch (e) { console.error('Limpieza:', e.message); }
  setTimeout(() => process.exit(0), 200).unref();
});

const t = (name, fn) => test(name, async (ctx) => { if (!ready) return ctx.skip('servidor o base no disponibles'); await fn(ctx); });

t('el catálogo carga con el producto y sin anuncios ni "También te puede interesar"', async () => {
  const h = await (await http('/' + slug)).text();
  assert.match(h, /Reloj Prueba/);
  assert.doesNotMatch(h, /También te puede interesar/);
  assert.doesNotMatch(h, /<section class="sponsored-section"/);
});

t('sin métodos activos el carrito avisa que no hay formas de pago', async () => {
  const h = await (await http('/' + slug)).text();
  assert.match(h, /const MP_ENABLED = false/);
  assert.match(h, /const TRANSFER = null/);
});

t('efectivo en caja: registra pagado a precio base y baja el stock', async () => {
  const r = await (await admin('venta-efectivo', { items: [{ id: prod.a, qty: 3, variant: '' }], nombre: 'Cliente Caja' })).json();
  assert.equal(r.ok, true);
  assert.equal(r.total, 3000);
  const o = order(r.orderId);
  assert.equal(o.paid, 1);
  assert.equal(o.status, 'pagado');
  assert.equal(o.stock_applied, 1);
  assert.equal(stock(prod.a), 7);
});

t('no se puede vender más de lo que hay', async () => {
  const res = await admin('venta-efectivo', { items: [{ id: prod.a, qty: 99, variant: '' }] });
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /No hay suficiente stock/);
  assert.equal(stock(prod.a), 7);
});

t('cancelar una venta ya descontada devuelve el stock, y solo una vez', async () => {
  const r = await (await admin('venta-efectivo', { items: [{ id: prod.b, qty: 2, variant: '' }], nombre: 'Cancelar' })).json();
  assert.equal(stock(prod.b), 3);
  await admin('order/' + r.orderId + '/cancelado');
  assert.equal(stock(prod.b), 5);
  await admin('order/' + r.orderId + '/cancelado');
  assert.equal(stock(prod.b), 5);
});

t('pedido del carrito (transferencia/WhatsApp) aparta el stock al crearse y no descuenta dos veces', async () => {
  const before = stock(prod.b);
  const r = await http('/api/pedir', { method: 'POST', body: JSON.stringify({ items: [{ store: slug, id: prod.b, qty: 2, variant: '' }], nombre: 'Auto Pedido', telefono: '8710000001' }) });
  assert.equal(r.status, 200);
  const o = lastOrder();
  assert.equal(o.status, 'nuevo');
  assert.equal(o.stock_applied, 1);
  assert.deepEqual(JSON.parse(o.items_json), [{ id: prod.b, qty: 2, variant: '' }]);
  assert.equal(stock(prod.b), before - 2);
  await admin('order/' + o.id + '/pagado');
  await admin('order/' + o.id + '/entregado');
  await admin('order/' + o.id + '/entregado');
  assert.equal(stock(prod.b), before - 2);
  await admin('order/' + o.id + '/cancelado');
  assert.equal(stock(prod.b), before);
});

t('productos con el mismo nombre: se descuenta el producto correcto por id', async () => {
  const dupAntes = stock(prod.dup), aAntes = stock(prod.a);
  const r = await (await admin('venta-efectivo', { items: [{ id: prod.a, qty: 1, variant: '' }], nombre: 'Dup' })).json();
  assert.equal(r.ok, true);
  assert.equal(stock(prod.a), aAntes - 1);
  assert.equal(stock(prod.dup), dupAntes);
});

t('pedido antiguo (antes del control de stock) no vuelve a descontar', async () => {
  const oid = Number(db.prepare("INSERT INTO orders (business_id, items, total, customer_name, status, paid, stock_applied) VALUES (?, ?, ?, ?, 'nuevo', 0, 1)").run(biz.id, '• 1 x Reloj Prueba = $1000.00', 1000, 'Viejo').lastInsertRowid);
  const antes = stock(prod.a);
  await admin('order/' + oid + '/entregado');
  assert.equal(stock(prod.a), antes);
});

t('pago con tarjeta sin Mercado Pago activo se rechaza y no toca el stock', async () => {
  const antes = stock(prod.a), pedidos = db.prepare('SELECT COUNT(*) c FROM orders WHERE business_id = ?').get(biz.id).c;
  const r = await http('/' + slug + '/pagar-tarjeta', { method: 'POST', body: JSON.stringify({ items: [{ id: prod.a, qty: 1, variant: '' }], formData: { token: 'x', payment_method_id: 'master', transaction_amount: 1000 } }) });
  assert.equal(r.status, 400);
  assert.match((await r.json()).error, /no tiene el pago con tarjeta/i);
  assert.equal(stock(prod.a), antes);
  assert.equal(db.prepare('SELECT COUNT(*) c FROM orders WHERE business_id = ?').get(biz.id).c, pedidos);
});

t('transferencia: solo aparece con Mercado Pago apagado y datos puestos', async () => {
  db.prepare("UPDATE businesses SET transfer_enabled = 1, transfer_bank = 'BBVA', transfer_account = '012345678901234567', transfer_holder = 'Prueba' WHERE id = ?").run(biz.id);
  let h = await (await http('/' + slug)).text();
  assert.match(h, /const TRANSFER = \{"bank":"BBVA"/);
  assert.match(h, /const MP_ENABLED = false/);
  db.prepare("UPDATE businesses SET mp_enabled = 1, mp_access_token = 'APP_USR-test', mp_public_key = 'APP_USR-pub' WHERE id = ?").run(biz.id);
  h = await (await http('/' + slug)).text();
  assert.match(h, /const MP_ENABLED = true/);
  assert.match(h, /const TRANSFER = null/);
});

t('con Mercado Pago activo el precio incluye la comisión y el apagado la quita', async () => {
  // (Mercado Pago quedó activo en la prueba anterior)
  let h = await (await http('/' + slug)).text();
  const precio = Number((h.match(/class="prod-price">\$([\d,]+)/) || [])[1].replace(/,/g, ''));
  assert.ok(precio > 500 && precio < 1100, 'precio ajustado: ' + precio);
  db.prepare('UPDATE businesses SET mp_enabled = 0 WHERE id = ?').run(biz.id);
  h = await (await http('/' + slug)).text();
  assert.match(h, /class="prod-price">\$500\.00/); // el primero en el catálogo es el de 500
  assert.match(h, /const MP_PUBLIC_KEY = ""/);      // sin clave pública no hay botón de tarjeta
});

t('la página del pedido muestra a nombre de quién es y su WhatsApp', async () => {
  const h = await (await http('/' + slug + '/pedido?ids=' + prod.a + '&q=1&n=Luis%20Garcia&t=8710000000')).text();
  assert.match(h, /Pedido a nombre de/);
  assert.match(h, /Luis Garcia/);
  assert.match(h, /wa\.me\/528710000000/);
  const sin = await (await http('/' + slug + '/pedido?ids=' + prod.a + '&q=1')).text();
  assert.doesNotMatch(sin, /class="cli"/);
});

t('las páginas del panel responden', async () => {
  for (const p of ['panel', 'productos', 'config', 'reportes', 'clientes']) {
    const r = await http('/' + slug + '/admin/' + p, { method: 'GET' });
    assert.equal(r.status, 200, p);
  }
});

t('sin sesión el panel no se abre', async () => {
  const r = await fetch(BASE + '/' + slug + '/admin/productos', { redirect: 'manual' });
  assert.notEqual(r.status, 200);
});
