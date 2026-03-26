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

# Bust cache when source changes (ARG change invalidates all layers below)
ARG CACHE_BUST=dev
# Copy engine source
COPY apps/engine/src/ apps/engine/src/

# Build types first (engine imports from @marketing-alpha/types/dist/)
RUN npm run build --workspace=@marketing-alpha/types

# Build engine TypeScript
RUN npm run build --workspace=@marketing-alpha/engine

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-slim AS production

# Install system dependencies + real Google Chrome (genuine JA3/JA4 TLS fingerprint
# that DataDome/Cloudflare/Akamai won't flag as automation — bundled Chromium gets caught)
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
    wget \
    gnupg \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends google-chrome-stable \
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

# Install Patchright Chromium browser (patched Playwright — bypasses CDP detection)
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN ./node_modules/.bin/patchright install chromium

# Copy built JavaScript from build stage
COPY --from=builder /app/packages/types/dist/ packages/types/dist/
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
