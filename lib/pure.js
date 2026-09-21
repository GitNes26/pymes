// Lógica pura (sin base de datos ni Express) para poder probarla con `npm test`.
'use strict';

// Si la promo tiene fecha de vencimiento y ya pasó, la promo deja de mostrarse.
// La comisión de Mercado Pago va DENTRO del precio que ve el cliente (un solo precio final, sin cargos aparte):
// precio mostrado = (precio base + cargo fijo con IVA) / (1 - comisión% * (1 + IVA%)), redondeado hacia arriba al peso.
// Solo aplica si la tienda cobra en línea. El cobro en efectivo del mostrador usa el precio base.
function priceMarkupFactor(biz) {
  if (!biz || !biz.mp_enabled || !biz.mp_access_token || biz.mp_fee_on === 0 || biz.mp_fee_on === '0') return null;
  const pct = Math.max(0, Math.min(30, Number(biz.mp_fee_pct == null ? 3.49 : biz.mp_fee_pct)));
  const fixed = Math.max(0, Math.min(100, Number(biz.mp_fee_fixed == null ? 4 : biz.mp_fee_fixed)));
  const iva = Math.max(0, Math.min(30, Number(biz.mp_fee_iva == null ? 16 : biz.mp_fee_iva)));
  const k = 1 + iva / 100;
  const denom = 1 - (pct / 100) * k;
  if (denom <= 0.2) return null;
  // cobro = (neto + fijo*(1+IVA)) / (1 - pct*(1+IVA))  ->  cobro = neto*m + b
  return { m: 1 / denom, b: (fixed * k) / denom };
}

function markupAmount(v, f) {
  const n = Number(v);
  if (!f || !(n > 0) || isNaN(n)) return v;
  return Math.ceil(n * f.m + f.b - 1e-9);
}

function applyMarkup(p, f) {
  if (!p || !f) return p;
  p.price_base = p.price; // precio sin comisión (para el cobro en efectivo del mostrador)
  p.price = markupAmount(p.price, f);
  if (p.old_price) p.old_price = markupAmount(p.old_price, f);
  let raw = p.variants, obj = null, wasStr = false;
  if (typeof raw === 'string') { wasStr = true; try { obj = JSON.parse(raw); } catch (e) { obj = null; } }
  else if (raw && typeof raw === 'object') obj = raw;
  if (obj && !Array.isArray(obj) && obj.prices && typeof obj.prices === 'object') {
    const np = {};
    Object.keys(obj.prices).forEach(k => { const v = obj.prices[k]; np[k] = (v === '' || v == null || isNaN(Number(v))) ? v : markupAmount(v, f); });
    const out = Object.assign({}, obj, { prices: np, baseprices: obj.prices });
    p.variants = wasStr ? JSON.stringify(out) : out;
  }
  return p;
}

// Comisión de Mercado Pago que se suma al cliente para que el negocio reciba el precio completo:
// cobro = (neto + fijo*(1+IVA)) / (1 - porcentaje*(1+IVA)); cargo = cobro - neto.
function mpCardFee(biz, net) {
  if (!biz || biz.mp_fee_on === 0 || biz.mp_fee_on === '0') return 0;
  const pct = Math.max(0, Math.min(30, Number(biz.mp_fee_pct == null ? 3.49 : biz.mp_fee_pct)));
  const fixed = Math.max(0, Math.min(100, Number(biz.mp_fee_fixed == null ? 4 : biz.mp_fee_fixed)));
  const iva = Math.max(0, Math.min(30, Number(biz.mp_fee_iva == null ? 16 : biz.mp_fee_iva)));
  const k = 1 + iva / 100;
  const denom = 1 - (pct / 100) * k;
  if (!(net > 0) || denom <= 0.2) return 0;
  return Math.round(((net + fixed * k) / denom - net) * 100) / 100;
}

// Etiquetas personalizadas de un producto: hasta 3, texto corto y color propio (JSON en products.custom_tags)
function parseCustomTags(raw) {
  let a;
  try { a = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw; } catch (e) { return []; }
  if (!Array.isArray(a)) return [];
  return a.slice(0, 3).map(x => ({
    t: String((x && x.t) || '').trim().slice(0, 24),
    c: /^#[0-9a-fA-F]{6}$/.test(String((x && x.c) || '')) ? String(x.c) : '#2c2c2e'
  })).filter(x => x.t);
}

function customTagsJson(raw) {
  const a = parseCustomTags(raw);
  return a.length ? JSON.stringify(a) : '';
}

function parseSpecs(raw) {
  // products.specs = una característica por línea, "Clave: Valor"
  return String(raw || '').split(/\r?\n/).map(l => {
    const i = l.indexOf(':');
    return i > 0 ? { n: l.slice(0, i).trim().slice(0, 30), v: l.slice(i + 1).trim().slice(0, 60) } : null;
  }).filter(x => x && x.n && x.v).slice(0, 8);
}

// Precio real de una línea: el del producto, o el de la variante elegida (la etiqueta llega como "A / B")
// ===== Stock de los pedidos: se descuenta al PAGARSE (tarjeta aprobada, efectivo en caja, transferencia marcada
// pagada) o al ENTREGARSE, una sola vez por pedido (orders.stock_applied); si se cancela, se devuelve. =====
function orderLines(order) {
  return String(order.items || '').split(/[\n|]/).map(l => {
    const m = l.match(/^\s*•\s*(\d+)\s*x\s+(.+?)\s*=\s*[^=]*$/);
    if (!m) return null;
    const qty = parseInt(m[1], 10) || 1;
    let name = m[2].trim(), variant = '';
    return { qty, name, variant };
  }).filter(Boolean);
}

module.exports = { priceMarkupFactor, markupAmount, applyMarkup, mpCardFee, parseCustomTags, customTagsJson, parseSpecs, orderLines };
