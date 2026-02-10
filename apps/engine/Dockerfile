# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Copy workspace root config files
COPY package.json turbo.json tsconfig.base.json ./

# Copy the types package
COPY packages/types/ packages/types/

# Copy the engine package
COPY apps/engine/package.json apps/engine/tsconfig.json apps/engine/

# Install all dependencies (workspace-aware)
RUN npm install --workspace=@marketing-alpha/engine --include-workspace-root

# Copy engine source
COPY apps/engine/src/ apps/engine/src/

# Build TypeScript
RUN npm run build --workspace=@marketing-alpha/engine

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-slim AS production

# Install Playwright system dependencies for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libatspi2.0-0 \
    libwayland-client0 \
    fonts-noto-color-emoji \
    fonts-liberation \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace root files
COPY package.json turbo.json tsconfig.base.json ./

# Copy types package (source, since it uses direct TS imports)
COPY packages/types/ packages/types/

# Copy engine package.json for dependency installation
COPY apps/engine/package.json apps/engine/

# Install production dependencies only
RUN npm install --workspace=@marketing-alpha/engine --include-workspace-root --omit=dev

# Install Playwright Chromium browser
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npx playwright install chromium

# Copy built JavaScript from build stage
COPY --from=builder /app/apps/engine/dist/ apps/engine/dist/

# Copy data files (fingerprints, domain databases)
COPY apps/engine/src/data/ apps/engine/dist/data/

# Create non-root user
RUN groupadd -r engine && useradd -r -g engine -m engine
RUN chown -R engine:engine /app /ms-playwright

USER engine

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/engine/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Use dumb-init to handle PID 1 and signal forwarding
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/engine/dist/server.js"]
