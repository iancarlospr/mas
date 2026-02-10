# MarketingAlphaScan -- Deployment Pipeline & Disaster Recovery Specification

**Version:** 1.0
**Date:** 2026-02-09
**Author:** Solo Developer
**Status:** Specification

---

## Table of Contents

1. [Git Workflow](#1-git-workflow)
2. [Vercel Deployment (Frontend)](#2-vercel-deployment-frontend)
3. [DigitalOcean Deployment (Engine)](#3-digitalocean-deployment-engine)
4. [Supabase Migration Strategy](#4-supabase-migration-strategy)
5. [CI/CD Pipeline (GitHub Actions)](#5-cicd-pipeline-github-actions)
6. [Backup & Disaster Recovery](#6-backup--disaster-recovery)
7. [Environment Management](#7-environment-management)
8. [Monitoring & Alerting](#8-monitoring--alerting)
9. [Scaling Roadmap](#9-scaling-roadmap)
10. [Security in Deployment](#10-security-in-deployment)

---

## 1. Git Workflow

### 1.1 Branching Strategy: Trunk-Based Development (Modified)

For a solo developer operating a monorepo, trunk-based development is the correct choice. Long-lived feature branches create merge debt with zero benefit when there is only one contributor. The strategy is: commit to `main` for small changes, use short-lived feature branches (< 2 days) for anything that touches multiple modules or requires a preview deployment.

```
main (trunk) ─────────────────────────────────────────────────>
    \                    /
     feat/scan-engine-m05  (short-lived, < 2 days)
```

**Rules:**

| Scenario | Branch? | Merge Strategy |
|---|---|---|
| Bug fix, config change, copy update | Direct to `main` | N/A |
| New module (M01-M45) | `feat/module-name` | Squash merge to `main` |
| Multi-day refactor | `feat/description` | Squash merge to `main` |
| Hotfix in production | Direct to `main` | N/A |
| Experimental / risky change | `experiment/description` | Squash merge or delete |

**Branch naming convention:**
```
feat/scan-engine-dns-module
feat/web-dashboard-redesign
fix/redis-connection-timeout
chore/upgrade-playwright
experiment/gemini-prompt-v2
```

### 1.2 Commit Conventions

Use Conventional Commits. This enables automated changelogs and makes the git log scannable.

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `perf`, `refactor`, `chore`, `docs`, `test`, `ci`, `build`

**Scopes** (monorepo-aware):
- `web` -- apps/web (Next.js frontend)
- `engine` -- apps/engine (Fastify scan engine)
- `types` -- packages/types (shared TypeScript types)
- `infra` -- Docker, CI/CD, deployment configs
- `db` -- Supabase migrations, RLS policies

**Examples:**
```
feat(engine): add DNS security baseline module M01
fix(web): correct scan status polling interval
perf(engine): reduce Playwright memory usage with context reuse
chore(infra): update Docker base image to node:22-slim
ci: add Trivy image scanning to deploy workflow
feat(db): add RLS policy for scan results table
```

### 1.3 Release Tagging

Tag releases when deploying a meaningful milestone to production. Use semantic versioning.

```bash
# After merging feature work and confirming production deploy
git tag -a v0.1.0 -m "Alpha: scan modules M01-M04, basic dashboard"
git push origin v0.1.0
```

**Tagging cadence:**
- `v0.x.0` -- Pre-launch milestones (alpha, beta)
- `v1.0.0` -- Public launch
- `v1.x.0` -- Feature additions post-launch
- `v1.0.x` -- Patch fixes

### 1.4 Monorepo-Aware Git Practices

**`.gitignore` (root):**
```gitignore
# Dependencies
node_modules/

# Build outputs
apps/web/.next/
apps/engine/dist/

# Environment
.env
.env.local
.env.production
!.env.example

# Supabase
supabase/.temp/

# Docker
*.log

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/settings.json
!.vscode/extensions.json
```

**Monorepo commit discipline:**
- One commit should not mix `web` and `engine` changes unless they are tightly coupled (e.g., a shared type change requires both).
- Shared type changes in `packages/types` should be committed with the consumer that requires the change.
- Migration files (`supabase/migrations/`) get their own commit with scope `db`.

---

## 2. Vercel Deployment (Frontend)

### 2.1 Git Push to Auto-Deploy Flow

```
git push origin main
       |
       v
Vercel detects push (GitHub integration)
       |
       v
Vercel checks Root Directory: apps/web
       |
       v
Runs install: npm install (from monorepo root)
       |
       v
Runs build: npm run build --workspace=apps/web
       |
       v
Deploys to production URL
       |
       v
Assigns to custom domain: marketingalphascan.com
```

### 2.2 Preview Deployments

Every push to a non-`main` branch generates a preview deployment automatically.

- URL pattern: `marketing-alpha-scan-<hash>-<team>.vercel.app`
- Preview deployments use **Preview** environment variables (separate from Production).
- PRs get a Vercel bot comment with the preview URL.

**Vercel configuration for ignored builds** (save build minutes):

Create `apps/web/vercel-ignore.sh`:
```bash
#!/bin/bash
# Only rebuild if files in apps/web or packages/types changed
echo "Checking for changes in apps/web and packages/types..."

git diff HEAD^ HEAD --quiet apps/web/ packages/types/
if [ $? -eq 0 ]; then
  echo "No changes in web app or shared types. Skipping build."
  exit 0  # Skip build
else
  echo "Changes detected. Proceeding with build."
  exit 1  # Proceed with build
fi
```

In Vercel Project Settings > Git > Ignored Build Step:
```
bash apps/web/vercel-ignore.sh
```

### 2.3 Environment Variable Management

**Vercel Dashboard > Project > Settings > Environment Variables:**

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Same | Public, safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Same | Public, RLS protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Same (or separate project) | Server-only, never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_ENGINE_URL` | `https://engine.marketingalphascan.com` | `http://localhost:3001` | Different per environment |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | Different project or same | Analytics |
| `NEXT_PUBLIC_POSTHOG_HOST` | `/ingest` (reverse proxy) | Same | Bypass adblockers |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` | CRITICAL: different keys |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `whsec_...` (test) | Different per environment |
| `RESEND_API_KEY` | `re_...` | `re_...` (test) | Email |
| `NEXT_PUBLIC_APP_URL` | `https://marketingalphascan.com` | Auto (preview URL) | For canonical URLs |

**Rule:** Any variable prefixed with `NEXT_PUBLIC_` is embedded in the client bundle. Never put secrets there.

### 2.4 Build Configuration

**Vercel Project Settings:**

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && npm run build --workspace=apps/web` |
| Output Directory | `.next` |
| Install Command | `cd ../.. && npm install` |
| Node.js Version | 22.x |

**`apps/web/next.config.ts`** (relevant deployment settings):
```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Output standalone for smaller deployment size
  output: 'standalone',

  // Transpile shared packages in monorepo
  transpilePackages: ['@marketing-alpha/types'],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // PostHog reverse proxy to bypass adblockers
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
      {
        source: '/ingest/decide',
        destination: 'https://us.i.posthog.com/decide',
      },
    ];
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 2.5 Custom Domain Setup with Cloudflare

**Step 1: Add domain in Vercel**
- Vercel Dashboard > Project > Settings > Domains
- Add `marketingalphascan.com` and `www.marketingalphascan.com`

**Step 2: Configure Cloudflare DNS**

In Cloudflare Dashboard > DNS > Records:

| Type | Name | Content | Proxy Status | TTL |
|---|---|---|---|---|
| A | `@` | `76.76.21.21` | DNS only (gray cloud) | Auto |
| CNAME | `www` | `cname.vercel-dns.com` | DNS only (gray cloud) | Auto |

**CRITICAL:** The proxy MUST be set to "DNS only" (gray cloud, not orange cloud). If Cloudflare's proxy is enabled, Vercel cannot issue SSL certificates and the deployment will fail with SSL errors.

**Step 3: Cloudflare SSL Settings**

Since traffic goes directly to Vercel (gray cloud), Cloudflare SSL settings are irrelevant for the main domain. However, if you later enable the proxy for WAF rules:
- Set SSL/TLS encryption mode to **Full (Strict)**
- This prevents redirect loops

**Step 4: Engine subdomain (DigitalOcean)**

| Type | Name | Content | Proxy Status | TTL |
|---|---|---|---|---|
| A | `engine` | `<droplet-ip>` | Proxied (orange cloud) | Auto |

The engine subdomain CAN use Cloudflare's proxy (orange cloud) for WAF protection and DDoS mitigation. Cloudflare will handle SSL termination.

### 2.6 Edge Function Considerations

Next.js 15 with App Router supports Edge Runtime for specific route handlers and middleware:

- **Use Edge for:** Middleware (geo-blocking, bot detection, rate limiting headers)
- **Do NOT use Edge for:** API routes that call Supabase with service role key, Stripe webhooks, anything needing Node.js APIs

```typescript
// middleware.ts - runs on Edge
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

// Geo-blocking restricted countries
const BLOCKED_COUNTRIES = ['IN', 'PK', 'CN', 'RU', 'PH'];

export function middleware(request: NextRequest) {
  const country = request.geo?.country;
  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return new NextResponse('Service not available in your region', { status: 451 });
  }
  return NextResponse.next();
}
```

### 2.7 Deployment Rollback Strategy

Vercel provides **Instant Rollback** on all plans (including Hobby/free):

**Via Dashboard:**
1. Vercel Dashboard > Deployments
2. Find the last known-good deployment
3. Click the three-dot menu > "Promote to Production"

**Via CLI:**
```bash
# List recent deployments
vercel ls

# Rollback to a specific deployment
vercel rollback <deployment-url-or-id>
```

**Via GitHub Actions (automated):**
```bash
# Store the current production deployment ID before deploying
PREV_DEPLOY=$(vercel ls --prod --token=$VERCEL_TOKEN | head -2 | tail -1 | awk '{print $1}')
# If health check fails after deploy, rollback
vercel rollback $PREV_DEPLOY --token=$VERCEL_TOKEN
```

**Rollback time:** Instant (< 5 seconds). No rebuild required. Vercel simply re-points the production alias to the previous deployment's immutable artifacts.

---

## 3. DigitalOcean Deployment (Engine)

### 3.1 Docker Image Build Strategy

**Decision: Build locally or in GitHub Actions, push to GitHub Container Registry (GHCR).**

Rationale: DigitalOcean Container Registry costs $5/mo for the cheapest plan. GHCR is free for public packages and has generous free storage for private packages (500MB free on GitHub Free plan). Since we are building a Docker image with Playwright (~1.2GB), we will use GHCR.

**`apps/engine/Dockerfile`:**
```dockerfile
# Stage 1: Install dependencies
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/engine/package.json ./apps/engine/
COPY packages/types/package.json ./packages/types/
RUN npm ci --workspace=apps/engine --workspace=packages/types

# Stage 2: Build TypeScript
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/engine/node_modules ./apps/engine/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .
RUN npm run build --workspace=packages/types
RUN npm run build --workspace=apps/engine

# Stage 3: Production image with Playwright
FROM node:22-slim AS runner
WORKDIR /app

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 libwayland-client0 \
    fonts-noto-color-emoji fonts-liberation \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=builder /app/apps/engine/dist ./apps/engine/dist
COPY --from=builder /app/apps/engine/package.json ./apps/engine/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/engine/node_modules ./apps/engine/node_modules
COPY package.json ./

# Install Playwright browsers (Chromium only to save space)
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.playwright
RUN npx playwright install chromium

# Security: run as non-root user
RUN addgroup --system --gid 1001 engine && \
    adduser --system --uid 1001 engine
USER engine

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "fetch('http://localhost:3001/health').then(r => { if (!r.ok) throw new Error(); })"

EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/engine/dist/server.js"]
```

### 3.2 Production docker-compose.yml

**`docker-compose.prod.yml`** (lives on the droplet at `/opt/alphascan/`):

```yaml
version: '3.8'

services:
  engine:
    image: ghcr.io/<github-username>/alphascan-engine:latest
    container_name: alphascan-engine
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - DATAFORSEO_LOGIN=${DATAFORSEO_LOGIN}
      - DATAFORSEO_PASSWORD=${DATAFORSEO_PASSWORD}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - ENGINE_API_KEY=${ENGINE_API_KEY}
      - POSTHOG_API_KEY=${POSTHOG_API_KEY}
    depends_on:
      redis:
        condition: service_healthy
    deploy:
      resources:
        limits:
          memory: 768M
        reservations:
          memory: 512M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    networks:
      - alphascan

  redis:
    image: redis:7-alpine
    container_name: alphascan-redis
    restart: unless-stopped
    command: >
      redis-server
      --maxmemory 128mb
      --maxmemory-policy allkeys-lru
      --appendonly yes
      --appendfsync everysec
      --save 900 1
      --save 300 10
      --save 60 10000
      --loglevel warning
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 160M
        reservations:
          memory: 128M
    networks:
      - alphascan
    # Redis is NOT exposed to the host network. Only engine can reach it.

volumes:
  redis-data:
    driver: local

networks:
  alphascan:
    driver: bridge
```

**`.env.production`** (on droplet at `/opt/alphascan/.env`):
```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GEMINI_API_KEY=AIza...
DATAFORSEO_LOGIN=user@email.com
DATAFORSEO_PASSWORD=...
RESEND_API_KEY=re_...
ENGINE_API_KEY=ask_prod_...  # Shared secret: Vercel frontend uses this to call engine
POSTHOG_API_KEY=phc_...
```

### 3.3 Deployment Strategy

**Chosen approach: GitHub Actions SSH deploy with docker compose pull + up.**

This is the simplest approach that works. No container registry to manage (GHCR is free), no complex orchestration. GitHub Actions builds the image, pushes to GHCR, then SSHs into the droplet and pulls + restarts.

**Zero-downtime analysis:** At 1 concurrent scan with a median scan time of 2-5 minutes, the engine will be offline for ~10-15 seconds during a restart. This is acceptable. If a scan is in progress, the BullMQ worker will lose that job. The job will sit in Redis as "active" and can be detected on startup and retried. This is the correct tradeoff for a $6/mo operation.

**Deployment flow:**
```
GitHub Actions (on push to main, if apps/engine changed):
  1. Build Docker image
  2. Push to ghcr.io
  3. SSH into droplet
  4. docker compose -f docker-compose.prod.yml pull
  5. docker compose -f docker-compose.prod.yml up -d
  6. Wait 30s, curl health endpoint
  7. If unhealthy, roll back to previous image tag
```

### 3.4 Droplet Initial Setup Script

Run this ONCE when provisioning a new droplet. Start with DigitalOcean's Docker marketplace image (Ubuntu 24.04 + Docker pre-installed).

**`scripts/droplet-init.sh`:**
```bash
#!/bin/bash
set -euo pipefail

echo "=== MarketingAlphaScan Droplet Setup ==="

# 1. System updates
apt-get update && apt-get upgrade -y

# 2. Create deploy user (not root)
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# 3. SSH Hardening
cat > /etc/ssh/sshd_config.d/hardened.conf << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
MaxAuthTries 3
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy
X11Forwarding no
EOF
systemctl restart sshd

# 4. Firewall (UFW)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     # SSH
ufw allow 3001/tcp   # Engine API (will be behind Cloudflare)
ufw --force enable

# 5. Swap (critical for 1GB RAM droplet)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Optimize swap behavior for low-memory server
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
sysctl -p

# 6. Install Docker Compose plugin (if not pre-installed)
apt-get install -y docker-compose-plugin

# 7. Create application directory
mkdir -p /opt/alphascan
chown deploy:deploy /opt/alphascan

# 8. Install DigitalOcean monitoring agent
curl -sSL https://repos.insights.digitalocean.com/install.sh | bash

# 9. Automatic security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# 10. Log rotation for Docker (global)
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
systemctl restart docker

# 11. Login to GHCR (as deploy user)
echo "=== Setup complete ==="
echo "Next steps:"
echo "1. SSH as deploy: ssh deploy@<ip>"
echo "2. Login to GHCR: echo \$GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin"
echo "3. Copy docker-compose.prod.yml and .env to /opt/alphascan/"
echo "4. Run: cd /opt/alphascan && docker compose -f docker-compose.prod.yml up -d"
```

### 3.5 Container Health Checks and Auto-Restart

Health checks are defined in both the Dockerfile (`HEALTHCHECK` instruction) and `docker-compose.prod.yml` (for Redis). The `restart: unless-stopped` policy ensures:

- Containers restart automatically after a crash
- Containers restart after a droplet reboot
- Containers do NOT restart if explicitly stopped by the developer

**Engine health endpoint** (already in the scan engine API design):
```
GET /health
Response: { status: "ok", redis: "connected", uptime: 12345 }
```

### 3.6 DigitalOcean Cloud Firewall

In addition to UFW on the droplet, create a DigitalOcean Cloud Firewall via the dashboard:

**Inbound Rules:**

| Type | Protocol | Port Range | Sources |
|---|---|---|---|
| SSH | TCP | 22 | Your home IP / trusted IPs |
| Custom | TCP | 3001 | Cloudflare IP ranges* |

*Cloudflare publishes their IP ranges at `https://www.cloudflare.com/ips/`. Since the engine subdomain uses Cloudflare proxy (orange cloud), all traffic arrives from Cloudflare IPs. This effectively hides the droplet IP.

**Outbound Rules:**

| Type | Protocol | Port Range | Destinations |
|---|---|---|---|
| All TCP | TCP | All | All |
| All UDP | UDP | All | All |
| ICMP | ICMP | All | All |

**Note on Vercel IP allowlisting:** Vercel free tier uses dynamic IP ranges for serverless functions. You CANNOT firewall the droplet to only accept Vercel IPs. Instead, use a shared API key (`ENGINE_API_KEY`) in the `Authorization` header for all requests from the Vercel frontend to the engine. Cloudflare WAF handles DDoS; the API key handles authentication.

---

## 4. Supabase Migration Strategy

### 4.1 Local Development with Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize (run once from monorepo root)
supabase init

# Start local Supabase (PostgreSQL, Auth, Storage, etc.)
supabase start

# This gives you:
# - PostgreSQL at localhost:54322
# - Supabase Studio at localhost:54323
# - API at localhost:54321
# - Anon key and service role key for local development
```

### 4.2 Migration File Management

**Directory structure:**
```
supabase/
  config.toml           # Supabase project configuration
  migrations/
    20260201000000_create_users_table.sql
    20260201000001_create_scans_table.sql
    20260201000002_create_scan_results_table.sql
    20260201000003_add_rls_policies.sql
    20260202000000_create_payments_table.sql
  seed.sql              # Development seed data
```

**Creating a new migration:**
```bash
# Option A: Write SQL directly
supabase migration new add_scan_queue_status_index

# This creates: supabase/migrations/<timestamp>_add_scan_queue_status_index.sql
# Edit the file with your SQL

# Option B: Diff from Dashboard changes (local development)
# Make changes in Supabase Studio (localhost:54323)
# Then capture them:
supabase db diff --use-migra -f add_dashboard_changes
```

**Migration file example:**
```sql
-- supabase/migrations/20260201000001_create_scans_table.sql

-- Up migration
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'scanning', 'processing', 'completed', 'failed')),
  marketing_iq_score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_scans_created_at ON public.scans(created_at DESC);

-- RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own scans
CREATE POLICY "Users can view own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create scans (insert)
CREATE POLICY "Users can create scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only service role can update scan status (engine writes results)
CREATE POLICY "Service role can update scans"
  ON public.scans FOR UPDATE
  USING (auth.role() = 'service_role');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scans_updated_at
  BEFORE UPDATE ON public.scans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 4.3 Applying Migrations to Production

**Option A: Supabase CLI (recommended for solo dev)**
```bash
# Link to production project (one-time setup)
supabase link --project-ref <project-id>

# Push all pending migrations to production
supabase db push

# This applies any migrations that haven't been applied yet.
# Supabase tracks applied migrations in supabase_migrations.schema_migrations table.
```

**Option B: GitHub Actions (automated, see Section 5)**
```yaml
# In CI/CD pipeline:
- name: Push database migrations
  run: supabase db push --linked
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

### 4.4 Seed Data

**`supabase/seed.sql`** -- for local development ONLY:
```sql
-- Seed a test user (only works with local Supabase)
-- In production, users register through the app

-- Insert test scan data for UI development
INSERT INTO public.scans (id, user_id, target_url, status, marketing_iq_score, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'https://stripe.com', 'completed', 87, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'https://vercel.com', 'scanning', NULL, now() - interval '5 minutes');
```

```bash
# Apply seed data to local instance
supabase db reset  # Drops all data, re-applies migrations + seed
```

### 4.5 Schema Diff and Drift Detection

```bash
# Compare local schema against production
supabase db diff --linked

# If output is empty: schemas are in sync
# If output shows SQL: production has drifted from your migration files

# Common causes of drift:
# - Making changes directly in Supabase Dashboard on production
# - Applying a migration manually via SQL editor
```

**Rule:** NEVER make schema changes directly in the production Supabase Dashboard. Always create a migration file, test locally, commit to git, and deploy through `supabase db push`.

### 4.6 Rollback Strategy

Supabase CLI does not have a built-in `rollback` command. Rollbacks must be manual.

**Approach: Pair each migration with a rollback script.**

```
supabase/
  migrations/
    20260201000001_create_scans_table.sql
  rollbacks/
    20260201000001_drop_scans_table.sql
```

**`supabase/rollbacks/20260201000001_drop_scans_table.sql`:**
```sql
-- Rollback: drop scans table and related objects
DROP TRIGGER IF EXISTS scans_updated_at ON public.scans;
DROP FUNCTION IF EXISTS update_updated_at();
DROP POLICY IF EXISTS "Users can view own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can create scans" ON public.scans;
DROP POLICY IF EXISTS "Service role can update scans" ON public.scans;
DROP TABLE IF EXISTS public.scans;
```

**To rollback in production:**
```bash
# Connect to production database
supabase db remote connect

# Execute the rollback SQL
\i supabase/rollbacks/20260201000001_drop_scans_table.sql

# Then remove the migration record
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260201000001';
```

### 4.7 When to Use What

| Tool | Use Case |
|---|---|
| Supabase CLI (`supabase migration new`) | Creating new migrations (always) |
| Supabase CLI (`supabase db push`) | Deploying to production |
| Supabase CLI (`supabase db diff`) | Detecting schema drift |
| Local Supabase Studio | Prototyping schema changes, then capturing via `db diff` |
| Production Dashboard SQL Editor | Emergency hotfixes ONLY (then immediately create a migration to match) |
| Raw `psql` / `pg_dump` | Backups, data exports, emergency operations |

---

## 5. CI/CD Pipeline (GitHub Actions)

### 5.1 Workflow File Structure

```
.github/
  workflows/
    ci.yml              # Lint, type-check, test (runs on all PRs and pushes)
    deploy-web.yml      # Deploy frontend to Vercel (triggered by ci.yml success on main)
    deploy-engine.yml   # Build + deploy engine to DigitalOcean (triggered by ci.yml success on main)
    db-migrate.yml      # Run database migrations (triggered on main when supabase/ changes)
    security.yml        # Weekly Trivy scan + npm audit (scheduled)
    backup-db.yml       # Weekly pg_dump backup (scheduled)
```

### 5.2 CI Workflow (ci.yml)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # Determine what changed
  changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      engine: ${{ steps.filter.outputs.engine }}
      types: ${{ steps.filter.outputs.types }}
      db: ${{ steps.filter.outputs.db }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/types/**'
            engine:
              - 'apps/engine/**'
              - 'packages/types/**'
            types:
              - 'packages/types/**'
            db:
              - 'supabase/migrations/**'

  # Lint and type-check (runs only if relevant files changed)
  lint:
    needs: changes
    if: needs.changes.outputs.web == 'true' || needs.changes.outputs.engine == 'true' || needs.changes.outputs.types == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npm run lint --workspaces --if-present

      - name: Type check
        run: npm run type-check --workspaces --if-present

  # Unit tests
  test:
    needs: changes
    if: needs.changes.outputs.web == 'true' || needs.changes.outputs.engine == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      - name: Test web
        if: needs.changes.outputs.web == 'true'
        run: npm test --workspace=apps/web -- --passWithNoTests

      - name: Test engine
        if: needs.changes.outputs.engine == 'true'
        run: npm test --workspace=apps/engine -- --passWithNoTests

  # Build web (validates the build succeeds)
  build-web:
    needs: [changes, lint, test]
    if: always() && needs.changes.outputs.web == 'true' && !contains(needs.*.result, 'failure')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      - name: Build shared types
        run: npm run build --workspace=packages/types

      - name: Build web app
        run: npm run build --workspace=apps/web
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_ENGINE_URL: ${{ secrets.NEXT_PUBLIC_ENGINE_URL }}
          NEXT_PUBLIC_POSTHOG_KEY: ${{ secrets.NEXT_PUBLIC_POSTHOG_KEY }}
          NEXT_PUBLIC_POSTHOG_HOST: /ingest
          NEXT_PUBLIC_APP_URL: https://marketingalphascan.com

      # Cache the .next/cache directory for faster subsequent builds
      - uses: actions/cache@v4
        with:
          path: apps/web/.next/cache
          key: nextjs-${{ hashFiles('apps/web/**/*.ts', 'apps/web/**/*.tsx') }}
          restore-keys: nextjs-

  # Build engine Docker image
  build-engine:
    needs: [changes, lint, test]
    if: always() && needs.changes.outputs.engine == 'true' && !contains(needs.*.result, 'failure')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build engine image (validation only, no push)
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/engine/Dockerfile
          push: false
          tags: alphascan-engine:test
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 5.3 Deploy Web Workflow (deploy-web.yml)

Vercel auto-deploys from the GitHub integration. This workflow is a fallback/notification mechanism.

```yaml
name: Deploy Web

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'
      - 'packages/types/**'

jobs:
  # Vercel handles the actual deployment via its GitHub integration.
  # This job exists to:
  # 1. Verify the deployment succeeded
  # 2. Send notifications
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Wait for Vercel deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        id: vercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
          check_interval: 10

      - name: Verify deployment health
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" ${{ steps.vercel.outputs.url }})
          if [ "$STATUS" != "200" ]; then
            echo "Deployment health check failed with status $STATUS"
            exit 1
          fi
          echo "Deployment healthy at ${{ steps.vercel.outputs.url }}"
```

### 5.4 Deploy Engine Workflow (deploy-engine.yml)

```yaml
name: Deploy Engine

on:
  push:
    branches: [main]
    paths:
      - 'apps/engine/**'
      - 'packages/types/**'
      - 'apps/engine/Dockerfile'

concurrency:
  group: deploy-engine
  cancel-in-progress: false  # Never cancel a deploy in progress

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository_owner }}/alphascan-engine

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build and push Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/engine/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Deploy to DigitalOcean
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DO_HOST }}
          username: deploy
          key: ${{ secrets.DO_SSH_PRIVATE_KEY }}
          script: |
            cd /opt/alphascan

            # Pull latest image
            docker compose -f docker-compose.prod.yml pull engine

            # Restart engine (Redis stays up)
            docker compose -f docker-compose.prod.yml up -d engine

            # Wait for health check
            echo "Waiting for engine to be healthy..."
            for i in $(seq 1 30); do
              if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
                echo "Engine is healthy!"
                exit 0
              fi
              echo "Attempt $i/30..."
              sleep 2
            done

            echo "Health check failed after 60 seconds"
            exit 1

      - name: Rollback on failure
        if: failure()
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.DO_HOST }}
          username: deploy
          key: ${{ secrets.DO_SSH_PRIVATE_KEY }}
          script: |
            cd /opt/alphascan
            # Roll back to the previous image
            PREV_SHA=$(docker inspect alphascan-engine --format='{{index .Config.Image}}' | cut -d: -f2)
            echo "Rolling back from $PREV_SHA..."
            docker compose -f docker-compose.prod.yml up -d engine
            echo "Rollback completed. Manual investigation required."
```

### 5.5 Database Migration Workflow (db-migrate.yml)

```yaml
name: Database Migrations

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Supabase project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Push migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}

      - name: Verify schema
        run: supabase db diff --linked
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
```

### 5.6 Secrets Management

**GitHub Repository > Settings > Secrets and variables > Actions:**

| Secret Name | Description |
|---|---|
| `DO_HOST` | Droplet IP address |
| `DO_SSH_PRIVATE_KEY` | SSH private key for `deploy` user |
| `SUPABASE_PROJECT_ID` | Supabase project reference ID |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from supabase.com/dashboard/account/tokens |
| `SUPABASE_DB_PASSWORD` | Database password |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_ENGINE_URL` | `https://engine.marketingalphascan.com` |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key |
| `GHCR_TOKEN` | GitHub token (auto-provided as `GITHUB_TOKEN`) |

**Note:** Vercel manages its own environment variables separately. GitHub Secrets are for the CI/CD pipeline only.

### 5.7 Cost Optimization

**GitHub Actions free tier budget: 2,000 minutes/month**

Estimated usage per deploy cycle:

| Job | Duration | Frequency | Monthly Minutes |
|---|---|---|---|
| CI (lint + type-check + test) | ~3 min | 60 pushes/mo | 180 |
| Build web (validation) | ~4 min | 30 pushes/mo | 120 |
| Build + push engine Docker | ~8 min | 15 pushes/mo | 120 |
| Deploy engine SSH | ~2 min | 15 pushes/mo | 30 |
| DB migrations | ~1 min | 5 pushes/mo | 5 |
| Security scan (weekly) | ~5 min | 4/mo | 20 |
| DB backup (weekly) | ~2 min | 4/mo | 8 |
| **Total** | | | **~483 min** |

This is well within the 2,000-minute budget with room for 4x growth in push frequency.

**Optimizations applied:**
1. `dorny/paths-filter` -- only runs jobs for changed paths
2. `concurrency` groups -- cancels redundant CI runs on rapid pushes
3. Docker layer caching (`type=gha`) -- reduces Docker build time by 50-70%
4. npm cache (`actions/setup-node` with `cache: 'npm'`) -- saves ~30s per job
5. Next.js cache -- persistent `.next/cache` across builds

---

## 6. Backup & Disaster Recovery

### 6.1 Supabase Database Backups

**Free tier limitation:** Supabase Free tier does NOT include automatic daily backups. You must implement your own backup strategy.

**Automated weekly pg_dump via GitHub Actions:**

```yaml
# .github/workflows/backup-db.yml
name: Database Backup

on:
  schedule:
    - cron: '0 4 * * 0'  # Every Sunday at 4 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: sudo apt-get install -y postgresql-client

      - name: Create backup
        run: |
          TIMESTAMP=$(date +%Y%m%d_%H%M%S)
          FILENAME="alphascan_backup_${TIMESTAMP}.sql.gz"

          pg_dump \
            "${{ secrets.SUPABASE_DB_CONNECTION_STRING }}" \
            --no-owner \
            --no-privileges \
            --clean \
            --if-exists \
            | gzip > "${FILENAME}"

          echo "Backup size: $(du -h ${FILENAME} | cut -f1)"
          echo "FILENAME=${FILENAME}" >> $GITHUB_ENV

      - name: Upload backup as artifact
        uses: actions/upload-artifact@v4
        with:
          name: db-backup-${{ github.run_id }}
          path: ${{ env.FILENAME }}
          retention-days: 30  # Keep backups for 30 days

      - name: Verify backup integrity
        run: |
          gunzip -t ${{ env.FILENAME }}
          echo "Backup integrity verified"
```

**Alternative: Supabase CLI backup:**
```bash
# Manual backup from local machine
supabase db dump --linked -f backup_$(date +%Y%m%d).sql
```

**Backup storage locations:**
1. GitHub Actions Artifacts (30-day retention, free)
2. Local machine (manual pg_dump when doing schema changes)
3. Optionally: Supabase Storage bucket (store the .sql.gz file in a private bucket)

### 6.2 Redis Persistence

**Configuration in docker-compose.prod.yml (already defined above):**
```
--appendonly yes          # Enable AOF
--appendfsync everysec    # Fsync every second (recommended by BullMQ)
--save 900 1              # RDB snapshot: after 900s if 1 key changed
--save 300 10             # RDB snapshot: after 300s if 10 keys changed
--save 60 10000           # RDB snapshot: after 60s if 10000 keys changed
```

**What data is in Redis:**
- BullMQ job queue: scan jobs (queued, active, completed, failed)
- BullMQ job data: scan configuration, target URL, user ID
- Potentially: rate limiting counters, temporary cache

**Analysis of Redis data criticality:**

| Data | Criticality | Recovery |
|---|---|---|
| Queued jobs | Low | Users re-submit scan. Frontend shows "try again" |
| Active/in-progress jobs | Medium | BullMQ marks stalled jobs. Engine retries on startup |
| Completed job metadata | Low | Results are in Supabase, not Redis |
| Failed job records | Low | Logged elsewhere. Can be reconstructed |
| Rate limit counters | None | Reset is actually fine |

**Conclusion:** Redis data is ephemeral. Loss of Redis data means:
- Queued scans are lost (users need to re-submit)
- In-progress scans fail (BullMQ stalled job detection handles this)
- No permanent data loss (all results persist to Supabase)

AOF persistence is still enabled to survive container restarts without losing the queue, but Redis data loss is NOT a disaster.

### 6.3 DigitalOcean Droplet Backups

**Option A: DigitalOcean Automated Backups ($1.20/mo)**
- Weekly snapshots, 4 retained
- Enable via Dashboard > Droplet > Backups > Enable
- Backup includes the full disk image
- Restore: Create new droplet from backup image

**Option B: Manual Snapshots (free, but requires downtime)**
```bash
# Power off droplet first for consistent snapshot
doctl compute droplet-action shutdown <droplet-id>
# Wait for power off
doctl compute droplet-action snapshot <droplet-id> --snapshot-name "alphascan-$(date +%Y%m%d)"
# Power back on
doctl compute droplet-action power-on <droplet-id>
```

**Recommendation:** Pay the $1.20/mo for automated backups. This is the single most valuable insurance for a $6/mo droplet. The automated backups run without downtime using live snapshotting.

### 6.4 Code Backup

Git is the backup. The GitHub repository is the single source of truth. Additional redundancy:

```bash
# Optional: Mirror to a second Git host (e.g., GitLab or Bitbucket)
git remote add mirror https://gitlab.com/<username>/alphascan.git
git push mirror main --tags
```

This is optional paranoia. GitHub has >99.9% uptime and stores data across multiple data centers.

### 6.5 Secrets/Environment Variables Backup

**Where to store backup copies of all API keys:**

1. **1Password / Bitwarden vault** (primary) -- a password manager with a dedicated "MarketingAlphaScan" vault containing every API key, database password, and secret.

2. **Encrypted local file** (secondary):
```bash
# Create an encrypted backup of all secrets
cat > /tmp/secrets.txt << 'EOF'
# MarketingAlphaScan Secrets - Last Updated: 2026-02-09
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_PASSWORD=...
SUPABASE_DB_CONNECTION_STRING=postgresql://...
GEMINI_API_KEY=AIza...
DATAFORSEO_LOGIN=...
DATAFORSEO_PASSWORD=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
ENGINE_API_KEY=ask_prod_...
POSTHOG_API_KEY=phc_...
DO_HOST=...
DO_SSH_PRIVATE_KEY_PATH=~/.ssh/alphascan_deploy
VERCEL_TOKEN=...
SUPABASE_ACCESS_TOKEN=sbp_...
GHCR_TOKEN=ghp_...
CLOUDFLARE_API_TOKEN=...
EOF

# Encrypt with GPG
gpg --symmetric --cipher-algo AES256 /tmp/secrets.txt
# Store secrets.txt.gpg in a safe location (USB drive, separate cloud storage)
rm /tmp/secrets.txt
```

**Rule:** Every time you add or rotate a secret, update both the password manager and the encrypted backup.

### 6.6 Recovery Procedures

#### Scenario A: Droplet Dies Completely

**RTO: 15-30 minutes | RPO: 1 week (last automated backup)**

```bash
# Step 1: Create new droplet from backup (DigitalOcean Dashboard)
# Backups > Select most recent > Create Droplet from Backup
# This restores the full disk including Docker, docker-compose, env files

# Step 2: Update DNS (if IP changed)
# Cloudflare Dashboard > DNS > Update A record for engine.marketingalphascan.com

# Step 3: Verify services
ssh deploy@<new-ip>
cd /opt/alphascan
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50

# Step 4: Update GitHub Secrets with new IP
# GitHub > Settings > Secrets > Update DO_HOST

# Step 5: Verify end-to-end
curl https://engine.marketingalphascan.com/health
```

**If no backup exists (fresh rebuild):**
```bash
# Step 1: Create new $6 droplet with Docker marketplace image
# Step 2: Run droplet-init.sh
# Step 3: SSH as deploy user, login to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u <username> --password-stdin
# Step 4: Copy docker-compose.prod.yml and .env from local machine / repo
scp docker-compose.prod.yml deploy@<ip>:/opt/alphascan/
scp .env.production deploy@<ip>:/opt/alphascan/.env
# Step 5: Start services
ssh deploy@<ip> "cd /opt/alphascan && docker compose -f docker-compose.prod.yml up -d"
# Step 6: Update DNS + GitHub Secrets
```

#### Scenario B: Redis Data Lost

**RTO: 0 (auto-recovery) | RPO: N/A (ephemeral data)**

Impact:
- Queued scans are gone. Users see "scan not found" if they check status.
- In-progress scans fail. BullMQ marks them as "stalled" after the stall interval.
- No completed scan data is lost (it is in Supabase).

Recovery:
```bash
# Redis restarts with empty database
# BullMQ workers automatically reconnect
# No manual intervention needed

# Optional: check for stalled jobs on engine startup
# The engine should implement a startup routine that:
# 1. Queries Supabase for scans with status='scanning' that are > 10 minutes old
# 2. Updates them to status='failed' with message 'interrupted by system restart'
# 3. Notifies the user they can re-submit
```

#### Scenario C: Supabase Outage

**RTO: Dependent on Supabase | RPO: 0 (Supabase handles)**

Impact:
- Engine cannot write scan results. Scans complete in Playwright but results cannot be saved.
- Frontend cannot load dashboards, scan history, or user data.
- Auth is down (Supabase Auth), so users cannot log in.

Graceful degradation:
```typescript
// Frontend: show maintenance banner when Supabase is unreachable
// apps/web/lib/supabase-health.ts
export async function checkSupabaseHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.from('health_check').select('count').single();
    return !error;
  } catch {
    return false;
  }
}

// Engine: queue results locally if Supabase is down
// Save to a local JSON file, retry writing to Supabase when it comes back
// apps/engine/lib/resilient-writer.ts
async function writeResults(scanId: string, results: ScanResults) {
  try {
    await supabase.from('scan_results').upsert(results);
  } catch (error) {
    // Write to local fallback file
    const fallbackPath = `/tmp/failed-writes/${scanId}.json`;
    await fs.writeFile(fallbackPath, JSON.stringify(results));
    // A background job retries these every 5 minutes
  }
}
```

#### Scenario D: Vercel Outage

**RTO: Dependent on Vercel | RPO: 0**

Impact:
- Frontend is completely down. Users cannot access the website.
- Engine continues processing scans normally (it does not depend on Vercel).
- Stripe webhooks still hit the Vercel API routes -- these will fail. See Scenario F.

Mitigation:
- Vercel has historically >99.99% uptime. Outages are typically < 30 minutes.
- There is nothing actionable to do except wait.
- The engine will complete any in-progress scans. Users will see results when Vercel recovers.

#### Scenario E: Cloudflare Outage

**RTO: Dependent on Cloudflare | RPO: 0**

Impact:
- If DNS is proxied (orange cloud): Everything is unreachable.
- If DNS is DNS-only (gray cloud): Traffic goes direct, still works.

Current configuration:
- `marketingalphascan.com` -- DNS only (gray cloud) -> Vercel handles directly. Cloudflare outage does NOT affect this, unless Cloudflare's DNS infrastructure itself is down.
- `engine.marketingalphascan.com` -- Proxied (orange cloud) -> Cloudflare outage means engine API is unreachable.

Mitigation:
- Cloudflare has one of the most resilient DNS networks globally. Full outages are extremely rare.
- For the engine, if Cloudflare is down, temporarily switch DNS to "DNS only" mode and point directly at the droplet IP (requires manually opening port 3001 in DO firewall).

#### Scenario F: Stripe Webhook Missed

**RTO: Minutes | RPO: 0 (eventual consistency)**

Impact:
- Payment completed (Stripe processed it), but the user's tier is not upgraded in Supabase.
- User paid $2.99 but does not see the premium report.

Recovery:
```typescript
// Approach 1: Stripe webhook retry
// Stripe automatically retries failed webhooks for up to 3 days
// with exponential backoff. If Vercel was down for < 1 hour,
// Stripe will retry and the webhook will eventually succeed.

// Approach 2: Client-side verification (belt and suspenders)
// When user accesses the paid report, check Stripe directly:
// apps/web/app/api/verify-payment/route.ts
export async function GET(request: NextRequest) {
  const scanId = request.nextUrl.searchParams.get('scanId');
  const userId = /* from session */;

  // Check Supabase first (fast path)
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('scan_id', scanId)
    .eq('user_id', userId)
    .single();

  if (payment?.status === 'completed') {
    return NextResponse.json({ paid: true });
  }

  // Fallback: Check Stripe directly
  const sessions = await stripe.checkout.sessions.list({
    customer_email: /* user email */,
    limit: 10,
  });

  const matchingSession = sessions.data.find(
    s => s.metadata?.scan_id === scanId && s.payment_status === 'paid'
  );

  if (matchingSession) {
    // Stripe says paid, but our DB missed it. Fix the drift.
    await supabase.from('payments').upsert({
      scan_id: scanId,
      user_id: userId,
      stripe_session_id: matchingSession.id,
      status: 'completed',
      amount: matchingSession.amount_total,
    });
    return NextResponse.json({ paid: true });
  }

  return NextResponse.json({ paid: false });
}
```

### 6.7 RTO/RPO Targets

| Component | RTO Target | RPO Target | Realistic Expectation |
|---|---|---|---|
| Frontend (Vercel) | N/A (managed) | 0 | Vercel manages. < 5 min outages rare. |
| Engine (Droplet) | 30 min | 1 week | Rebuild from backup or re-deploy from GHCR |
| Database (Supabase) | N/A (managed) | 24 hours (manual pg_dump) | Weekly backups mean up to 7 days of data loss in worst case |
| Redis (Queue) | 5 min | ~1 second (AOF) | Auto-restarts. Queue data is ephemeral. |
| DNS (Cloudflare) | N/A (managed) | 0 | Cloudflare manages. Rarely fails. |

**Honest assessment for a $6/mo operation:** The weakest link is the database backup. Weekly pg_dump means worst-case 7 days of data loss. This is acceptable pre-launch and during early growth. Once revenue starts flowing, upgrade to Supabase Pro ($25/mo) for daily automated backups and PITR.

**Priority upgrade path:**
1. **$1.20/mo** -- DigitalOcean automated backups (do this immediately)
2. **$0/mo** -- Weekly pg_dump via GitHub Actions (implement at launch)
3. **$25/mo** -- Supabase Pro for daily backups + PITR (implement when revenue > $100/mo)

---

## 7. Environment Management

### 7.1 Local Development Setup

**`docker-compose.dev.yml`** (at monorepo root):
```yaml
version: '3.8'

# Local development: Redis only (Supabase runs via CLI, Next.js runs natively)
services:
  redis:
    image: redis:7-alpine
    container_name: alphascan-redis-dev
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 64mb --maxmemory-policy allkeys-lru
    # No persistence needed for development
```

**Local development startup:**
```bash
# Terminal 1: Start local infrastructure
supabase start                               # PostgreSQL + Auth + Storage + Studio
docker compose -f docker-compose.dev.yml up   # Redis

# Terminal 2: Start engine in development
npm run dev --workspace=apps/engine           # Fastify with hot reload

# Terminal 3: Start frontend
npm run dev --workspace=apps/web              # Next.js dev server

# Access points:
# Frontend:       http://localhost:3000
# Engine:         http://localhost:3001
# Supabase Studio: http://localhost:54323
# Supabase API:   http://localhost:54321
# Redis:          localhost:6379
```

### 7.2 Environment Parity

| Aspect | Local Dev | Production |
|---|---|---|
| Frontend | Next.js dev server (localhost:3000) | Vercel (marketingalphascan.com) |
| Engine | Node.js with tsx/nodemon (localhost:3001) | Docker container on droplet |
| Database | Supabase local (Docker) | Supabase cloud (free tier) |
| Redis | Docker (no persistence) | Docker (AOF + RDB) |
| Auth | Supabase local Auth | Supabase cloud Auth |
| Storage | Supabase local Storage | Supabase cloud Storage |
| Stripe | Test mode (`sk_test_`) | Live mode (`sk_live_`) |
| Email | Resend test mode / console logs | Resend production |
| AI | Gemini API (same key, low quota) | Gemini API (production quota) |

### 7.3 Do We Need Staging?

**No. Not at launch.**

Cost analysis:
- Staging Supabase project: Free (but managing two projects adds overhead)
- Staging droplet: $6/mo (doubles infrastructure cost)
- Staging Vercel: Free (preview deployments serve this purpose)

**Vercel preview deployments ARE the staging environment for the frontend.** For the engine, test locally with Docker. The risk of skipping a full staging environment is acceptable when:
- There is one developer
- Scan processing is idempotent (re-running a scan produces the same result)
- The engine can be quickly rolled back via GHCR image tags

**When to add staging:** When hiring a second developer, or when the cost of a production bug exceeds the cost of staging ($12/mo).

### 7.4 .env File Management

**Monorepo root `.env.example`:**
```bash
# =============================================================================
# MarketingAlphaScan - Environment Variables
# Copy to .env and fill in values for local development
# =============================================================================

# --- Supabase (local development uses supabase start output) ---
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# --- Engine ---
REDIS_URL=redis://localhost:6379
ENGINE_API_KEY=ask_dev_local_key_change_me
ENGINE_PORT=3001

# --- Frontend ---
NEXT_PUBLIC_ENGINE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Stripe (test mode) ---
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# --- Email ---
RESEND_API_KEY=re_...

# --- AI ---
GEMINI_API_KEY=AIza...

# --- Market Data ---
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=

# --- Analytics ---
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=http://localhost:3000/ingest
```

**How `.env` files work across the monorepo:**

The monorepo root `.env` file is loaded by both `apps/web` (Next.js reads `.env` from project root, which is `apps/web`, but also walks up to monorepo root) and `apps/engine` (using `dotenv` configured to read from monorepo root).

```typescript
// apps/engine/src/config.ts
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from monorepo root
config({ path: resolve(__dirname, '../../../.env') });

export const env = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  engine: {
    port: parseInt(process.env.ENGINE_PORT || '3001'),
    apiKey: process.env.ENGINE_API_KEY!,
  },
  // ...
} as const;
```

### 7.5 Environment Variable Sync Strategy

When adding a new environment variable:

1. Add to `.env.example` with a comment
2. Add to your local `.env`
3. Add to Vercel Dashboard (if frontend needs it)
4. Add to droplet `.env` at `/opt/alphascan/.env` (if engine needs it)
5. Add to GitHub Secrets (if CI/CD needs it)
6. Update password manager vault

**Checklist (add to PR template):**
```markdown
## Environment Variables
- [ ] Added to `.env.example`
- [ ] Added to Vercel (production + preview)
- [ ] Added to droplet `/opt/alphascan/.env`
- [ ] Added to GitHub Secrets
- [ ] Updated password manager
```

---

## 8. Monitoring & Alerting

### 8.1 Vercel Deployment Notifications

Vercel sends deployment notifications via:
- GitHub commit status checks (automatic)
- Vercel Dashboard activity feed
- Optional: Vercel Slack/Discord/Email integrations

**Configure in Vercel Dashboard > Project > Settings > Notifications:**
- Enable email notifications for failed deployments

### 8.2 DigitalOcean Monitoring

**Built-in monitoring agent** (installed in droplet-init.sh):
- CPU, Memory, Disk, Bandwidth graphs in DO Dashboard
- No additional cost

**Alert policies (DO Dashboard > Monitoring > Create Alert):**

| Metric | Threshold | Window | Action |
|---|---|---|---|
| CPU | > 80% | 5 min | Email |
| Memory | > 90% | 5 min | Email |
| Disk | > 80% | 15 min | Email |
| CPU | > 95% | 1 min | Email (critical) |

### 8.3 Uptime Monitoring

**UptimeRobot (free tier: 50 monitors, 5-minute checks):**

| Monitor | URL | Type | Interval |
|---|---|---|---|
| Frontend | `https://marketingalphascan.com` | HTTP(S) | 5 min |
| Engine Health | `https://engine.marketingalphascan.com/health` | HTTP(S) | 5 min |
| Engine API | `https://engine.marketingalphascan.com/api/v1/status` | Keyword (check for "ok") | 5 min |

**UptimeRobot alert contacts:**
- Email (primary)
- SMS via UptimeRobot Pro ($7/mo, add later if needed)

### 8.4 Health Endpoint Design

The engine already exposes a health endpoint. Design it to be comprehensive:

```typescript
// apps/engine/src/routes/health.ts
import { FastifyInstance } from 'fastify';
import { redis } from '../lib/redis';
import { supabase } from '../lib/supabase';

export async function healthRoutes(fastify: FastifyInstance) {
  // Public health check (for uptime monitors and load balancers)
  fastify.get('/health', async (request, reply) => {
    const checks = {
      status: 'ok' as 'ok' | 'degraded' | 'down',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      redis: 'unknown' as string,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    // Check Redis
    try {
      await redis.ping();
      checks.redis = 'connected';
    } catch {
      checks.redis = 'disconnected';
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });

  // Admin health check (detailed, requires API key)
  fastify.get('/admin/health', {
    preHandler: async (request, reply) => {
      const apiKey = request.headers['x-api-key'];
      if (apiKey !== process.env.ENGINE_API_KEY) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    },
  }, async (request, reply) => {
    const [redisInfo, queueStats] = await Promise.allSettled([
      redis.info('memory'),
      getQueueStats(),
    ]);

    return reply.send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      node: process.version,
      memory: process.memoryUsage(),
      redis: redisInfo.status === 'fulfilled' ? parseRedisInfo(redisInfo.value) : 'error',
      queue: queueStats.status === 'fulfilled' ? queueStats.value : 'error',
    });
  });
}
```

### 8.5 Alert Escalation

For a solo developer, the alert chain is simple:

```
Level 1 (Information):
  - Vercel deploy succeeded/failed → Email
  - GitHub Actions workflow completed → GitHub notification

Level 2 (Warning):
  - UptimeRobot detects downtime → Email
  - DO CPU > 80% for 5 min → Email
  - DO Memory > 90% for 5 min → Email

Level 3 (Critical):
  - UptimeRobot: site down > 10 min → Email + Push notification (UptimeRobot mobile app)
  - DO CPU > 95% for 1 min → Email
  - Engine health returns 503 → Email
```

**PostHog for application-level monitoring:**
- Track scan completion rate (scans started vs completed)
- Track scan duration (P50, P95, P99)
- Track error rates by module
- Set up PostHog alerts for anomalies (e.g., completion rate drops below 80%)

---

## 9. Scaling Roadmap

### 9.1 Droplet Upgrade Path

| Trigger | Action | Cost | Benefit |
|---|---|---|---|
| Memory > 85% sustained | $6 -> $12/mo (2 vCPU, 2GB) | +$6/mo | 2x memory for Playwright |
| > 5 concurrent scans | $12 -> $24/mo (2 vCPU, 4GB) | +$12/mo | Comfortable for 10 concurrent scans |
| > 20 concurrent scans | Add second $24 droplet | +$24/mo | Horizontal scaling with BullMQ |
| > 50 concurrent scans | Managed Kubernetes | ~$50+/mo | Auto-scaling, but adds complexity |

**Decision framework:** Upgrade when the P95 scan duration exceeds 2x the P50 due to resource contention, NOT when the average is slow.

### 9.2 When to Add a Second Worker

BullMQ makes this straightforward:

```bash
# On a second droplet, run ONLY the engine (no Redis)
# docker-compose.worker.yml
services:
  engine:
    image: ghcr.io/<username>/alphascan-engine:latest
    environment:
      - REDIS_URL=redis://<primary-droplet-ip>:6379
      # ... other env vars
```

**Trigger:** When scan queue depth consistently > 5 AND users are waiting > 10 minutes. This is a good problem to have -- it means there is demand.

**Prerequisite:** Expose Redis port on primary droplet (currently internal only). Use Redis AUTH password and restrict via firewall to the second droplet's IP.

### 9.3 When to Move Redis to Managed Service

**Trigger:** When Redis data becomes critical (e.g., you start caching scan results in Redis for faster repeat lookups, or storing session data).

**Options:**
- DigitalOcean Managed Redis: $15/mo (1GB, 1 node)
- Upstash Redis: Free tier (10,000 commands/day), then $10/mo
- Redis Cloud: Free tier (30MB), then $7/mo

**Recommendation:** Upstash is the best cost-optimized choice. Their free tier is sufficient for early growth, and their serverless pricing model means you only pay for what you use.

### 9.4 When to Upgrade Supabase

| Trigger | Action | Cost |
|---|---|---|
| Need daily backups / PITR | Upgrade to Pro | $25/mo |
| > 500MB database | Upgrade to Pro | $25/mo |
| > 200 concurrent connections | Upgrade to Pro (more connections + Supavisor) | $25/mo |
| Need phone auth / SSO | Upgrade to Pro | $25/mo |
| Revenue > $100/mo | Upgrade to Pro (invest in reliability) | $25/mo |

### 9.5 Database Connection Pooling (Supavisor)

Supabase includes Supavisor connection pooling on all plans. Use the pooled connection string for the engine:

```bash
# Direct connection (bypasses pooler, for migrations)
postgresql://postgres.[project-ref]:[password]@aws-0-[region].supabase.co:5432/postgres

# Pooled connection (through Supavisor, for application code)
postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.co:6543/postgres?pgbouncer=true
```

**In engine configuration:**
```typescript
// Use the pooled connection for all application queries
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,  // Server-side: no session persistence
    },
  }
);
// The Supabase JS client uses the REST API (PostgREST), which
// already goes through Supavisor. No additional configuration needed.
```

### 9.6 CDN Caching for Static Scan Results

Once a scan is complete, the results are immutable. Cache aggressively:

```typescript
// apps/web/app/scan/[id]/page.tsx
// For completed scans, set aggressive cache headers
export async function generateMetadata({ params }: Props) {
  const scan = await getScan(params.id);

  if (scan.status === 'completed') {
    // Completed scans never change
    return {
      other: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      },
    };
  }

  // In-progress scans should not be cached
  return {
    other: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  };
}
```

**Cloudflare Page Rules** (when engine subdomain is proxied):
```
URL: engine.marketingalphascan.com/api/v1/scans/*/results
Cache Level: Cache Everything
Edge Cache TTL: 1 day
```

---

## 10. Security in Deployment

### 10.1 SSH Key Management

```bash
# Generate a dedicated deploy key (not your personal SSH key)
ssh-keygen -t ed25519 -C "alphascan-deploy" -f ~/.ssh/alphascan_deploy

# Add the public key to the droplet's deploy user
ssh-copy-id -i ~/.ssh/alphascan_deploy.pub deploy@<droplet-ip>

# Add the private key to GitHub Secrets as DO_SSH_PRIVATE_KEY
# NEVER commit SSH keys to the repository
```

**Key rotation schedule:** Every 6 months, or immediately if compromised.

```bash
# Rotation procedure:
# 1. Generate new key pair
ssh-keygen -t ed25519 -C "alphascan-deploy-$(date +%Y%m)" -f ~/.ssh/alphascan_deploy_new

# 2. Add new public key to droplet
ssh deploy@<ip> "cat >> ~/.ssh/authorized_keys" < ~/.ssh/alphascan_deploy_new.pub

# 3. Update GitHub Secret DO_SSH_PRIVATE_KEY with new private key

# 4. Test deployment with new key

# 5. Remove old public key from droplet
ssh deploy@<ip> "nano ~/.ssh/authorized_keys"  # Remove old key line

# 6. Delete old private key locally
rm ~/.ssh/alphascan_deploy
```

### 10.2 Docker Image Scanning (Trivy)

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 6 AM UTC
  push:
    paths:
      - 'apps/engine/Dockerfile'
      - 'package-lock.json'
  workflow_dispatch:

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build engine image for scanning
        run: docker build -t alphascan-engine:scan -f apps/engine/Dockerfile .

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@0.28.0
        with:
          image-ref: 'alphascan-engine:scan'
          format: 'table'
          exit-code: '1'           # Fail on HIGH/CRITICAL
          severity: 'HIGH,CRITICAL'
          ignore-unfixed: true     # Only report vulnerabilities with fixes available

      - name: Run Trivy for SARIF output (GitHub Security tab)
        uses: aquasecurity/trivy-action@0.28.0
        if: always()
        with:
          image-ref: 'alphascan-engine:scan'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'HIGH,CRITICAL'

      - name: Upload Trivy scan results to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=high
        continue-on-error: true  # Don't fail the build, but report

      - name: Check for known vulnerabilities
        run: npx audit-ci --high
```

### 10.3 Dependency Vulnerability Scanning

**Dependabot configuration** (`.github/dependabot.yml`):
```yaml
version: 2
updates:
  # npm dependencies
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    labels:
      - "dependencies"
    groups:
      # Group minor/patch updates to reduce PR noise
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "ci"

  # Docker
  - package-ecosystem: "docker"
    directory: "/apps/engine"
    schedule:
      interval: "weekly"
    labels:
      - "docker"
```

### 10.4 Secret Rotation Schedule

| Secret | Rotation Frequency | How to Rotate |
|---|---|---|
| SSH deploy key | Every 6 months | Generate new key, update droplet + GitHub |
| ENGINE_API_KEY | Every 3 months | Generate new UUID, update Vercel + droplet |
| Supabase service role key | Only if compromised | Regenerate in Supabase Dashboard |
| Stripe API keys | Only if compromised | Regenerate in Stripe Dashboard, update Vercel |
| GHCR token | Automatic (GITHUB_TOKEN) | N/A |
| Gemini API key | Only if compromised | Regenerate in Google AI Studio |
| DataForSEO credentials | Only if compromised | Regenerate in DataForSEO dashboard |
| Resend API key | Only if compromised | Regenerate in Resend dashboard |

**ENGINE_API_KEY rotation procedure:**
```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)
echo "New ENGINE_API_KEY: ask_prod_${NEW_KEY}"

# 2. Update droplet .env (add new key, keep old temporarily)
ssh deploy@<ip> 'sed -i "s/ENGINE_API_KEY=.*/ENGINE_API_KEY=ask_prod_<new>/" /opt/alphascan/.env'

# 3. Restart engine
ssh deploy@<ip> 'cd /opt/alphascan && docker compose -f docker-compose.prod.yml restart engine'

# 4. Update Vercel environment variable (Vercel Dashboard)

# 5. Trigger a Vercel redeploy (so the frontend picks up the new key)

# 6. Verify end-to-end by submitting a test scan

# 7. The old key is now invalid (single key, not dual-key rotation)
```

### 10.5 Cloudflare WAF Rules

**Free tier Cloudflare WAF rules (up to 5 custom rules):**

**Rule 1: Block malicious bots on engine**
```
Field: URI Path
Operator: starts with
Value: /api/

AND

Field: Known Bots
Operator: equals
Value: true

Action: Block
```

**Rule 2: Rate limit scan submissions**
```
Field: URI Path
Operator: equals
Value: /api/v1/scans

AND

Field: Request Method
Operator: equals
Value: POST

Action: Rate Limit (10 requests per minute per IP)
```

**Rule 3: Block restricted countries**
```
Field: Country
Operator: is in
Value: IN, PK, CN, RU, PH

Action: Block
```

**Rule 4: Challenge suspicious requests**
```
Field: Threat Score
Operator: greater than
Value: 14

Action: Managed Challenge
```

### 10.6 Network Isolation

**Docker network isolation** (already configured in docker-compose.prod.yml):

```
Host Network
├── Port 22 (SSH) ── restricted by UFW + DO Firewall
├── Port 3001 (Engine API) ── restricted to Cloudflare IPs
│
Docker Bridge Network: alphascan
├── engine container ── can reach Redis via DNS name "redis"
└── redis container ── NOT exposed to host network
                       Only accessible from within Docker network
```

Redis is never exposed to the internet. It has no port mapping to the host. Only the engine container can reach it via Docker's internal DNS resolution.

**Additional Docker hardening:**
```yaml
# In docker-compose.prod.yml, add to engine service:
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /app/.playwright  # Playwright needs write access for browser data
```

---

## Appendix A: Complete GitHub Secrets Inventory

| Secret | Example Value | Used By |
|---|---|---|
| `DO_HOST` | `167.99.123.45` | deploy-engine.yml |
| `DO_SSH_PRIVATE_KEY` | (ed25519 private key) | deploy-engine.yml |
| `SUPABASE_PROJECT_ID` | `abcdefghijklmnop` | db-migrate.yml |
| `SUPABASE_ACCESS_TOKEN` | `sbp_...` | db-migrate.yml |
| `SUPABASE_DB_PASSWORD` | (password) | db-migrate.yml, backup-db.yml |
| `SUPABASE_DB_CONNECTION_STRING` | `postgresql://postgres...` | backup-db.yml |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc.supabase.co` | ci.yml (build validation) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | ci.yml (build validation) |
| `NEXT_PUBLIC_ENGINE_URL` | `https://engine.marketingalphascan.com` | ci.yml (build validation) |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_...` | ci.yml (build validation) |

## Appendix B: Cost Summary

| Service | Monthly Cost | Notes |
|---|---|---|
| DigitalOcean Droplet | $6.00 | 1 vCPU, 1GB RAM, 25GB SSD |
| DO Automated Backups | $1.20 | Weekly snapshots, 4 retained |
| Vercel | $0.00 | Hobby/free tier |
| Supabase | $0.00 | Free tier (500MB DB, 1GB storage) |
| Cloudflare | $0.00 | Free tier (DNS, basic WAF) |
| GitHub | $0.00 | Free tier (2,000 CI minutes, GHCR) |
| UptimeRobot | $0.00 | Free tier (50 monitors) |
| **Total** | **$7.20/mo** | |

## Appendix C: First Deploy Checklist

```markdown
### One-Time Setup
- [ ] Create GitHub repository (private)
- [ ] Create Supabase project (free tier)
- [ ] Create DigitalOcean droplet ($6/mo Docker image)
- [ ] Run droplet-init.sh
- [ ] Create Vercel project, link to GitHub repo
- [ ] Configure Vercel: root directory, build command, env vars
- [ ] Configure Cloudflare DNS records
- [ ] Generate SSH deploy key, add to droplet + GitHub Secrets
- [ ] Add all secrets to GitHub repository settings
- [ ] Add all env vars to Vercel project settings
- [ ] Copy docker-compose.prod.yml + .env to droplet
- [ ] Login to GHCR on droplet
- [ ] Enable DO automated backups ($1.20/mo)
- [ ] Set up UptimeRobot monitors
- [ ] Set up DO monitoring alerts
- [ ] Configure Dependabot (merge dependabot.yml)
- [ ] Run initial Supabase migrations: supabase db push
- [ ] Verify GitHub Actions workflows run successfully
- [ ] Submit test scan end-to-end
- [ ] Verify Stripe test payment flow
- [ ] Store all secrets in password manager

### Verify
- [ ] Frontend loads at https://marketingalphascan.com
- [ ] Engine health check: https://engine.marketingalphascan.com/health
- [ ] Scan submission works end-to-end
- [ ] Stripe webhook processes payment
- [ ] Email sends via Resend
- [ ] PostHog receives events
- [ ] UptimeRobot shows all green
- [ ] GitHub Actions CI passes
```

---

*This specification is designed for a solo developer operating at near-$0 cost. Every decision optimizes for simplicity, reliability, and cost-effectiveness. There is no Kubernetes, no Terraform, no multi-region redundancy. But every component has a backup plan, every secret has a rotation procedure, and every failure scenario has a documented recovery path. This is production-grade for the scale.*
