# Redirect Engine Dockerfile (Hono/Node)
# Multi-stage build for smaller production image

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Dependencies stage
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Builder stage (for TypeScript compilation if needed)
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
    adduser --system --uid 1001 engine

# For development mode: copy source and tsx
# For production: uncomment the build lines and use compiled output
COPY --from=deps --chown=engine:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=engine:nodejs /app/dist /app/dist
COPY package.json tsconfig.json runtimes/ /app/

USER engine

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Production start
CMD ["node", "dist/runtimes/node/index.js"]

# For development with tsx (uncomment above and comment this):
# CMD ["npx", "tsx", "runtimes/node/index.ts"]
