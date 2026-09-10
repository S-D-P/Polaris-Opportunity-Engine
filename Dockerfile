# Polaris — Cloud Run production image. Built remotely via `gcloud builds submit`
# (Cloud Build), no local Docker required (docs/implementation-status.md).
#
# Debian-based (not Alpine) throughout, deliberately — the STATIC_PAGE adapter's JS-render
# mode (lib/ingestion/adapters/static-page.ts) needs a real headless Chromium via
# playwright-core, which requires glibc and cannot run on musl/Alpine.

FROM node:20-bookworm-slim AS base

# ---- deps: install once, reused by both the build and chromium-install stages ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- chromium: downloads the headless browser binary the ingestion pipeline needs ----
FROM deps AS chromium
RUN npx playwright-core install --with-deps chromium

# ---- build: generate the Prisma client and produce the Next.js standalone bundle ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- runtime: minimal final image ----
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Prisma's query engine needs OpenSSL at runtime — node:20-bookworm-slim doesn't include it
# by default (discovered via a live deploy: Prisma logged a warning and DB calls were at risk
# of failing silently without it).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Non-root user, matching Cloud Run's expectation of not running as root.
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Next.js standalone output: a self-contained server.js plus only the node_modules it needs.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Headless Chromium for the STATIC_PAGE adapter's JS-render mode.
COPY --from=chromium /root/.cache/ms-playwright /home/nextjs/.cache/ms-playwright
ENV PLAYWRIGHT_BROWSERS_PATH=/home/nextjs/.cache/ms-playwright

RUN chown -R nextjs:nodejs /app /home/nextjs/.cache
USER nextjs

# Cloud Run injects PORT — Next.js's standalone server.js reads it directly.
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
