# Despliegue

## Producción (Dokploy)

- Imagen desde `Dockerfile` (Node 22 bookworm-slim, usuario `nodejs`, `gosu` en `docker-entrypoint.sh`).
- Dominio `cadi.nessik.net` detrás de Traefik con Let's Encrypt (labels en `docker-compose.yml`, config en `dokploy.json`).
- Variables: ver `env.dokploy` / `.env.example`. `BASE_URL` debe ser `https://…` (activa el redirect http→https).
- Volúmenes persistentes: `/app/public/uploads` y `/app/backups`. `UPLOADS_PROJECT_NAME` único por despliegue.
- Healthcheck: `GET /health` → `ok`.

## Pasos de un despliegue

1. `npm run test:unit` en local.
2. Si hubo cambios de BD: respaldar y correr el script de `docs/sql/` en el MySQL del servidor.
3. `git push origin main` → redeploy en Dokploy.
4. Verificar `/health` y la tienda demo; recargar con Ctrl+Shift+R (service worker).

## Local con Docker

```bash
docker compose up --build    # MySQL 8 + app en :3000; el esquema se inicializa con catamanager-full.sql
```
