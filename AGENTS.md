# AGENTS.md — Guía para agentes de IA (Claude, Codex, Cursor, Freebuff…)

Proyecto **CataManager / Catálogo Fácil (Nessik)**: catálogos digitales multi-tienda para pymes de La Laguna, con pedido por WhatsApp. Producción: `https://cadi.nessik.net`. Repo: `GitNes26/pymes` (rama `main`).

Lee esto antes de tocar código. Para más detalle: `README.md`, `docs/ARQUITECTURA.md`, `docs/BASE-DE-DATOS.md`, `DESIGN.md`, `COMPONENTES_GUIA.md`.

## Stack (real, actual)

- **Node.js 22 + Express 4**, vistas **EJS** server-side, **Tailwind** (`public/vendor/tailwind.js`) + CSS propio, JS vanilla en el navegador.
- **MySQL 8** vía `db-maria-sync.js` (adaptador **síncrono** sobre `mysql2` con worker + `Atomics.wait`). Expone la API estilo better-sqlite3: `db.prepare(sql).get/all/run`, `db.exec`, `db.pragma`. El SQL se escribe en dialecto SQLite y `translate()` lo convierte a MySQL.
  - Ya **no** se usa SQLite (`data.db` es legado). Documentos viejos (`DOCUMENTACION.md`, `PRODUCT.md`) aún dicen SQLite: están desactualizados en ese punto.
- `sharp` (imágenes), `fluent-ffmpeg` (video), `exceljs`/`xlsx` (importación), `qrcode`, `multer`.

## Comandos

```bash
npm install
npm start                 # node server.js → http://localhost:3000
npm test                  # unit + integración (node --test)
npm run test:unit         # solo unitarias (lib/pure.js), no requiere BD
```

Local en este equipo (Windows): MySQL 8 corre en **127.0.0.1:3307** (el 3306 es MariaDB de otros proyectos).
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/start-mysql.ps1
node server.js
```
Tienda demo: `http://localhost:3000/ferreteria-demo` · admin: `/ferreteria-demo/admin` (PIN 1234) · maestro: `/maestro`.

- Cambios en `.ejs` y CSS: basta refrescar (usa **Ctrl+Shift+R**, hay service worker `public/sw.js` que cachea).
- Cambios en `server.js` / `db.js` / `lib/`: hay que **reiniciar** Node.

## Mapa del código

| Ruta | Qué es |
|---|---|
| `server.js` | Casi toda la app (~350 KB): middlewares, auth, ~120 rutas, helpers. Busca con `grep -n "app.get('/:slug/admin/..."` en vez de leerlo entero. |
| `db.js` | Esquema + migraciones idempotentes (`CREATE TABLE IF NOT EXISTS`, `addColumnIfMissing`). Corre al arrancar. |
| `db-maria-sync.js`, `db-maria-worker.js` | Adaptador síncrono MySQL. No tocar sin necesidad. |
| `lib/` | Lógica pura testeable (`pure.js`: precios/markup/comisiones; `reportes.js`, `mascara.js`, `images-api.js`). Prefiere poner lógica nueva aquí y testearla. |
| `views/*.ejs` | Pantallas. `productos.ejs` (~270 KB) es la más grande: tabla, filtros, paginación y el stepper de alta/edición. |
| `views/admin/` | `head`, `sidebar`, `panel-ajax` (envío de formularios por fetch), `toast`. |
| `views/partials/cart-js.ejs` | Lógica del catálogo público (carrito, filtros, variantes, WhatsApp). |
| `views/templates/` | Plantillas/constructor del catálogo público. |
| `public/css/` | `material.css` (base), `admin-workspace.css` (rediseño del panel), `*-2026.css` por pantalla. Catálogo público: capas `premium-catalog` → `catalog-refine/motion/media/hero` → `catalog-themes` (por mundo/apariencia) → `catalog-craft` → **`catalog-pro.css` (capa final)**. |
| `tools/` | Migraciones de BD y scripts de arranque. |
| `tests/` | `unit.test.js`, `integration.test.js`. |

Rutas: catálogo público `/:slug`, panel `/:slug/admin/*` (protegido con `requireAuth` + `can('permiso.accion')`), maestro `/maestro/*`, salud `/health`.

## Reglas al hacer cambios

1. **Base de datos:** todo cambio de esquema va en **dos lugares**:
   - en `db.js` (migración idempotente con `addColumnIfMissing` / `CREATE TABLE IF NOT EXISTS`), y
   - **un script SQL de MySQL 8 listo para correr en el servidor**, entregado al usuario y guardado en `docs/sql/AAAA-MM-DD-descripcion.sql`. Actualiza también `catamanager-full.sql` (esquema limpio que usa docker-compose).
2. **Permisos:** toda ruta nueva del panel usa `requireAuth` y `can('modulo.accion')`; en la vista, revisa `perms.includes(...)`.
3. **Multi-tienda:** toda consulta filtra por `business_id` del `req.biz`. Nunca devuelvas datos de otra tienda.
4. **CSS del catálogo público:** los cambios visuales generales van en `catalog-pro.css` (última capa, prefijo `html[data-style][data-world] body`) y usan solo los tokens de la apariencia (`--bg`, `--bg-card`, `--text`, `--accent`, `--font-heading`, `--radius`…); nada de colores fijos salvo WhatsApp/descuento. Revisa en claro y oscuro (`data-tone`) y a 390 px.
5. **CSS del panel:** `admin-workspace.css` usa selectores `body.products-admin-page …` con `!important`. Si una regla tuya con `.hidden` o similar "no funciona", casi seguro es especificidad (ver CHANGELOG 2026-10-20). Usa el mismo prefijo `body.<pagina>-admin-page` para ganar.
6. **Precios:** los inputs llegan con separador de miles (`public/js/masks.js`); limpia comas antes de `parseFloat` (ver `parsePrices`).
7. **Textos de UI en español (México)**, moneda MXN por defecto, pensando en un dueño no técnico que usa el celular.
8. **No versionar** `.env`, dumps con datos (`catamanager-con-datos.sql`), `public/uploads/`, `backups/`, `*.db`. Revisa `.gitignore`.
9. **No escribir secretos** en archivos versionados (ni en docs). Usa `.env.example` como plantilla.
10. Cambios pequeños y enfocados; no reformatees archivos grandes completos (`productos.ejs`, `server.js`) — genera diffs enormes.
11. Verifica antes de terminar: `npm run test:unit`, abre la pantalla tocada en escritorio y a 390 px de ancho.

## Commits

- Mensajes en español, en imperativo y con prefijo: `Fix:`, `Feat:`, `Refactor:`, `Estilo:`, `BD:`, `Docs:`.
- Agrega una línea en `CHANGELOG.md` por cada cambio visible para el usuario.
- Rama `main`; para cambios grandes usa una rama `feat/...` y PR.

## Despliegue

Docker (`Dockerfile`, `docker-compose.yml`) en **Dokploy** con Traefik (`dokploy.json`, `env.dokploy`). Ver `docs/DESPLIEGUE.md`.
