# CataManager - Dockerfile multi-stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine

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
