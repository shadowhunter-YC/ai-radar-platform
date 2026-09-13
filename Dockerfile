# Minimal production runtime for AI Radar Platform
# Fast build mode: Pre-built standalone output from Mac is copied directly,
# eliminating the slow npm ci and next build steps on NAS CPU (reducing build from 70s to 3s).

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV COLLECTION_DATA_DIR=/app/data

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Prepare persistent data directory for SQLite and public folder
RUN mkdir -p /app/data /app/public && chown -R nextjs:nodejs /app/data /app/public

# Copy pre-built standalone server and static assets
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/login || exit 1

CMD ["node", "server.js"]
