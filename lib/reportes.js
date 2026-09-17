function dateKey(value) {
  return String(value || '').slice(0, 10);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function reportPeriod(query, now = new Date()) {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 29);
  const defaultFrom = start.toISOString().slice(0, 10);
  const defaultTo = end.toISOString().slice(0, 10);
  const from = validDate(query.desde) ? query.desde : defaultFrom;
  const to = validDate(query.hasta) ? query.hasta : defaultTo;
  return { from, to, error: from > to ? 'La fecha inicial debe ser anterior o igual a la final.' : null };
}

function buildReport(period, orders, payments, tracking) {
  const inRange = value => dateKey(value) >= period.from && dateKey(value) <= period.to;
  const activeOrders = orders.filter(o => o.status !== 'cancelado');
  const periodOrders = orders.filter(o => inRange(o.created_at));
  const paymentOrders = new Map(activeOrders.map(o => [o.id, o]));
  const ordersWithPayments = new Set(payments.filter(p => paymentOrders.has(p.order_id)).map(p => p.order_id));
  const daily = new Map();
  const day = key => {
    if (!daily.has(key)) daily.set(key, { date: key, orders: 0, sales: 0, revenue: 0, visits: 0 });
    return daily.get(key);
  };
  let sales = 0;
  let revenue = 0;
  let pending = 0;
  for (const o of periodOrders) {
    const row = day(dateKey(o.created_at));
    row.orders++;
    if (o.status !== 'cancelado') { row.sales += Number(o.total) || 0; sales += Number(o.total) || 0; }
    if (o.status !== 'cancelado' && !o.paid) pending++;
  }
  for (const o of activeOrders) {
    if (!o.paid || ordersWithPayments.has(o.id)) continue;
    const date = dateKey(o.paid_at || o.created_at);
    if (!inRange(date)) continue;
    const amount = Number(o.total) || 0;
    day(date).revenue += amount;
    revenue += amount;
  }
  for (const p of payments) {
    if (!paymentOrders.has(p.order_id) || !inRange(p.created_at)) continue;
    const amount = Number(p.amount) || 0;
    day(dateKey(p.created_at)).revenue += amount;
    revenue += amount;
  }
  let visits = 0;
  let waClicks = 0;
  for (const event of tracking) {
    if (!inRange(event.created_at)) continue;
    if (event.type === 'visit') { visits++; day(dateKey(event.created_at)).visits++; }
    if (event.type === 'wa') waClicks++;
  }
  const byDay = [...daily.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { orders: periodOrders, count: periodOrders.length, sales, revenue, pending, visits, waClicks, byDay };
}

function csvCell(value) {
  let text = String(value == null ? '' : value);
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

module.exports = { reportPeriod, buildReport, csvCell };
