# CataManager - Dockerfile multi-stage

# ---- Etapa 1: dependencias (cache de npm ci) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production


# ---- Etapa 2: build (genera Prisma + compila Next) ----
FROM node:22-bookworm-slim AS build
WORKDIR /app


# ---- Etapa 3: runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 && apk add --no-cache su-exec

COPY --from=builder /app/node_modules ./node_modules
COPY . .

RUN mkdir -p public/uploads backups && chown -R nodejs:nodejs /app && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
