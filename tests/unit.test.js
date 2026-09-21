// Pruebas de la lógica pura: comisión de Mercado Pago, precios, etiquetas, atributos y líneas de pedido.
// Se corren con:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  priceMarkupFactor, markupAmount, applyMarkup, mpCardFee,
  parseCustomTags, customTagsJson, parseSpecs, orderLines
} = require('../lib/pure');

const biz = (extra) => Object.assign({ mp_enabled: 1, mp_access_token: 'APP_USR-x', mp_fee_on: 1, mp_fee_pct: 3.49, mp_fee_fixed: 4, mp_fee_iva: 16 }, extra || {});
const cobro = (f, base) => base * f.m + f.b; // lo que paga el cliente sin redondear

test('comisión incluida: $180 se cobra $192.43 y al negocio le quedan $180 netos', () => {
  const f = priceMarkupFactor(biz());
  assert.ok(f);
  const pagado = cobro(f, 180);
  assert.equal(pagado.toFixed(2), '192.43');
  const retenido = (pagado * 0.0349 + 4) * 1.16; // comisión variable + fija, más IVA
  assert.equal((pagado - retenido).toFixed(2), '180.00');
});

test('el precio mostrado se redondea siempre hacia arriba al peso y nunca queda por debajo del cobro exacto', () => {
  const f = priceMarkupFactor(biz());
  for (const base of [1, 10, 49.9, 100, 180, 999, 1000, 5890]) {
    const mostrado = markupAmount(base, f);
    assert.ok(Number.isInteger(mostrado), 'entero: ' + base);
    assert.ok(mostrado >= cobro(f, base) - 1e-6, 'cubre la comisión: ' + base);
    assert.ok(mostrado - cobro(f, base) < 1, 'no cobra más de un peso de más: ' + base);
  }
});

test('sin Mercado Pago activo, apagado o sin token no hay ajuste de precio', () => {
  assert.equal(priceMarkupFactor(biz({ mp_enabled: 0 })), null);
  assert.equal(priceMarkupFactor(biz({ mp_access_token: '' })), null);
  assert.equal(priceMarkupFactor(biz({ mp_fee_on: 0 })), null);
  assert.equal(priceMarkupFactor(null), null);
  assert.equal(markupAmount(500, null), 500);
});

test('applyMarkup ajusta precio, precio anterior y precios de variantes, y guarda los base', () => {
  const f = priceMarkupFactor(biz());
  const p = { price: 100, old_price: 150, variants: JSON.stringify({ attrs: [{ name: 'Talla', values: ['S', 'M'] }], prices: { S: 100, M: '' } }) };
  applyMarkup(p, f);
  assert.equal(p.price_base, 100);
  assert.equal(p.price, markupAmount(100, f));
  assert.equal(p.old_price, markupAmount(150, f));
  const v = JSON.parse(p.variants);
  assert.equal(v.prices.S, markupAmount(100, f));
  assert.equal(v.prices.M, '');           // vacío se respeta
  assert.equal(v.baseprices.S, 100);      // el base queda para el cobro en efectivo
});

test('applyMarkup sin factor no toca nada', () => {
  const p = { price: 100, variants: '' };
  applyMarkup(p, null);
  assert.equal(p.price, 100);
  assert.equal(p.price_base, undefined);
});

test('mpCardFee: cargo exacto y cero cuando está apagado', () => {
  assert.equal(mpCardFee(biz(), 180), 12.43);
  assert.equal(mpCardFee(biz({ mp_fee_on: 0 }), 180), 0);
  assert.equal(mpCardFee(biz(), 0), 0);
});

test('etiquetas personalizadas: máximo 3, texto corto y color válido', () => {
  const t = parseCustomTags([{ t: 'Mayoreo', c: '#7c3aed' }, { t: 'x'.repeat(40), c: 'rojo' }, { t: 'C' }, { t: 'D' }, { t: 'E' }]);
  assert.equal(t.length, 3);
  assert.equal(t[0].c, '#7c3aed');
  assert.equal(t[1].t.length, 24);
  assert.equal(t[1].c, '#2c2c2e');
  assert.equal(customTagsJson([]), '');
  assert.equal(parseCustomTags('no es json').length, 0);
});

test('atributos: una línea "Clave: Valor" por atributo, hasta 8', () => {
  const l = parseSpecs('Medida: 500 ml\nColor: Azul\nsin dos puntos\nMarca:\n: vacío');
  assert.deepEqual(l, [{ n: 'Medida', v: '500 ml' }, { n: 'Color', v: 'Azul' }]);
  assert.equal(parseSpecs('').length, 0);
  assert.equal(parseSpecs(Array.from({ length: 12 }, (_, i) => 'A' + i + ': v').join('\n')).length, 8);
});

test('líneas de pedido: cantidad y nombre, ignora textos que no son producto', () => {
  const l = orderLines({ items: '• 2 x Reloj Dama Champagne = $9980.00 | • 1 x Argollas (par) = $8900.00 | Cobrado con tarjeta: $19,000 | 💵 Pago en efectivo' });
  assert.equal(l.length, 2);
  assert.equal(l[0].qty, 2);
  assert.equal(l[0].name, 'Reloj Dama Champagne');
  assert.equal(l[1].name, 'Argollas (par)');
});
