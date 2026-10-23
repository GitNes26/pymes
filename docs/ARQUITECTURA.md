# Arquitectura

## Flujo de una petición

```
Navegador ──► Express (server.js)
               ├─ middlewares: https forzado (si BASE_URL), compression, static /public
               ├─ /:slug                → catálogo público (views/templates, partials/cart-js)
               ├─ /:slug/admin/*        → requireAuth → can('permiso') → res.render(vista, panelData(biz))
               ├─ /maestro/*            → panel maestro (MASTER_KEY)
               └─ /health               → "ok" (healthcheck Docker)
                         │
                         ▼
               db.prepare(sql).get/all/run   (síncrono)
                         │
               db-maria-sync.js ──► worker (db-maria-worker.js) ──► mysql2 ──► MySQL 8
```

## Piezas

- **Autenticación:** PIN de dueño o empleado; empleados con permisos granulares (`productos.ver`, `productos.crear`, `productos.editar`, …). `requireAuth` carga `req.biz`; `can(perm)` bloquea con 403.
- **Datos del panel:** `panelData(biz)` arma productos, categorías, agrupadores, etc. Las vistas filtran/paginan **en el navegador** (ej. productos: `initProdFilter()` en `productos.ejs`, 8 por página).
- **Formularios del panel:** `views/admin/panel-ajax.ejs` intercepta envíos y los hace por `fetch` (SPA ligera). Por eso los `init*()` de cada vista se protegen contra doble inicialización (`data-catalog-ready`).
- **Imágenes:** `multer` → `public/uploads/<UPLOADS_PROJECT_NAME>/`, miniaturas webp en `_cache` con `sharp`. Opcional microservicio externo (`IMAGES_API_URL`, `lib/images-api.js`).
- **Catálogo público:** plantillas + constructor visual (`views/templates/constructor.ejs`, `catalog-visual-profiles.js`, `catalog-designs-expanded.js`, `giro-catalogs.js`).
- **Pagos:** pedido por WhatsApp; integración Mercado Pago (OAuth `/mp/oauth`, webhook `/webhooks/mercadopago`).
- **PWA:** `public/sw.js`, `public/pwa.js`, `/manifest.webmanifest`.

## Dónde poner código nuevo

- Lógica de negocio pura → `lib/` + prueba en `tests/unit.test.js`.
- Ruta nueva → `server.js`, junto a las rutas de su módulo.
- Estilos de una pantalla del panel → su `public/css/<pantalla>-2026.css` o `admin-workspace.css` con prefijo `body.<pantalla>-admin-page`.
