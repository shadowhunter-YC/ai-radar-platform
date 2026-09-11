# Multi-stage Dockerfile for AI Radar Platform
# Optimized for NAS (Synology, QNAP, TrueNAS, unRAID, Linux)

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the standalone Next.js bundle
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Production runtime (minimal image)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV COLLECTION_DATA_DIR=/app/data

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Prepare persistent data directory for SQLite
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Copy built standalone server and static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure public dir exists if needed
RUN mkdir -p /app/public && chown -R nextjs:nodejs /app/public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
