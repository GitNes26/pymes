const CACHE = 'nessik-v5';

const CORE = [
  '/css/material.css',
  '/js/material.js',
  '/img/sin-imagen.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

const CDN = [
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(CDN.map(async (u) => {
      try {
        const r = await fetch(u, { mode: 'no-cors' });
        if (r) await c.put(u, r);
      } catch (err) { /* CDN no disponible durante el install */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

function offlineHtml() {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head>' +
    '<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f1f5f9;color:#334155">' +
    '<div style="text-align:center;padding:24px"><div style="font-size:48px">📴</div>' +
    '<h1 style="font-size:20px;margin:12px 0 4px">Sin conexión</h1>' +
    '<p style="font-size:14px;opacity:.7;margin:0">Vuelve a conectarte para ver el catálogo.</p></div></body></html>';
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // No interferir con panel del dueño, maestro ni API (siempre desde la red)
  if (url.origin === self.location.origin &&
      (/^\/(maestro|api)(\/|$)/.test(url.pathname) || url.pathname.indexOf('/admin') !== -1)) {
    return;
  }

  // Navegaciones (páginas): red primero, caché (offline) como respaldo
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const copy = res.clone();
        (await caches.open(CACHE)).put(req, copy);
        return res;
      } catch (err) {
        const hit = await caches.match(req);
        if (hit) return hit;
        return new Response(offlineHtml(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Recursos propios estáticos: caché primero para que responda al instante,
  // pero siempre revalida contra la red en segundo plano (stale-while-revalidate)
  // — así una actualización de JS/CSS llega en la siguiente visita en vez de
  // quedar atascada en caché para siempre (antes era caché-primero sin revalidar).
  if (url.origin === self.location.origin && /\.(css|js|png|jpe?g|webp|svg|gif|webmanifest|woff2?|ico)$/.test(url.pathname)) {
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      const networkUpdate = fetch(req).then((res) => {
        if (res && res.status === 200) c.put(req, res.clone());
        return res;
      }).catch(() => null);
      e.waitUntil(networkUpdate);
      if (hit) return hit;
      return (await networkUpdate) || Response.error();
    })());
    return;
  }

  // Recursos externos (CDN, fotos de productos): red primero, caché de respaldo
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.status === 200) {
        try { const c = await caches.open(CACHE); c.put(req, res.clone()); } catch (err) {}
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      return hit || Response.error();
    }
  })());
});
