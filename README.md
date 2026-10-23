# Catálogo Fácil · CataManager (Nessik)

Catálogos digitales para pymes con pedido directo por WhatsApp. Cada negocio tiene su tienda pública (`/:slug`), un panel de administración (`/:slug/admin`) y existe un panel maestro (`/maestro`) para gestionar tiendas y planes.

Producción: https://cadi.nessik.net

## Requisitos

- Node.js 22+
- MySQL 8 (o MariaDB compatible)

## Arranque rápido

```bash
cp .env.example .env      # ajusta DB_* y MASTER_KEY
npm install
npm start                 # http://localhost:3000
```

El esquema se crea/actualiza solo al arrancar (`db.js`). Para una BD nueva también puedes importar `catamanager-full.sql`.

### Con Docker (app + MySQL)

```bash
docker compose up --build
```

### En el equipo de desarrollo (Windows)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/start-mysql.ps1   # MySQL 8 en :3307
node server.js
```

Demo: `http://localhost:3000/ferreteria-demo` (admin PIN `1234`).

## Pruebas

```bash
npm test            # unitarias + integración
npm run test:unit   # solo unitarias
```

## Documentación

| Archivo | Contenido |
|---|---|
| [AGENTS.md](AGENTS.md) | Reglas y mapa del código para agentes de IA y nuevos desarrolladores |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Cómo está armada la app |
| [docs/BASE-DE-DATOS.md](docs/BASE-DE-DATOS.md) | MySQL, migraciones y scripts SQL |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Docker / Dokploy |
| [DESIGN.md](DESIGN.md) · [COMPONENTES_GUIA.md](COMPONENTES_GUIA.md) | Sistema de diseño y componentes |
| [PRODUCT.md](PRODUCT.md) | Visión de producto |
| [DOCUMENTACION.md](DOCUMENTACION.md) | Documento de entrega original (parte del stack está desactualizado: hoy es MySQL) |
| [CHANGELOG.md](CHANGELOG.md) | Historial de cambios |
