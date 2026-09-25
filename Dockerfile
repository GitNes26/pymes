# CataManager - Dockerfile multi-stage
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:22-bookworm-slim

WORKDIR /app

# gosu es el equivalente en Debian del su-exec de Alpine (arranca como root
# para poder ajustar el dueño de los volúmenes montados, y luego baja
# privilegios al usuario nodejs antes de ejecutar la app — ver docker-entrypoint.sh).
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid 1001 --no-create-home nodejs \
  && apt-get update -y && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public/uploads/catamanager backups && chown -R nodejs:nodejs /app && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production \
    UPLOADS_ROOT=/app/public/uploads \
    UPLOADS_PROJECT_NAME=catamanager

# bookworm-slim no trae wget/curl por defecto (a diferencia de Alpine);
# se usa el fetch nativo de Node para no tener que instalar nada extra.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
