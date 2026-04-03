# Admin Service Dockerfile (Nuxt)
# Multi-stage build for smaller production image

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Builder stage
FROM deps AS builder
COPY . .
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxt

COPY --from=builder --chown=nuxt:nodejs /app/.output /app/.output
COPY --from=deps --chown=nuxt:nodejs /app/node_modules /app/node_modules

USER nuxt

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", ".output/server/index.mjs"]
