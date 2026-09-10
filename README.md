# Polaris — AI-Powered Opportunity Discovery Engine

> **Live deployment**: [https://polaris-ka4pyersra-uc.a.run.app](https://polaris-ka4pyersra-uc.a.run.app)

Polaris discovers scholarships, fellowships, internships, hackathons, research programs, and
other opportunities scattered across hundreds of websites and matches them to you — based on
your education, citizenship, skills, experience, and goals. No endless form or manual search
needed. (Polaris is opportunity discovery, not a jobs board — regular job listings are
intentionally excluded from the user-facing product; see `docs/personalization.md`.)

---

## What it does

- **Personalized feed** — after a short profile setup, Polaris runs a deterministic
  eligibility engine + weighted scoring to surface the opportunities most relevant to *you*,
  with a match score and a clear "why this matches you" explanation for every result.
- **Natural-language search** — Gemini parses your free-text query into structured filters
  (type, location, remote, free-only) and retrieves results from a hybrid keyword + semantic
  index, then applies your profile to re-rank them.
- **World map explore** — an SVG-based globe (d3-geo, Natural Earth data) showing where
  opportunities are located, with click-through to filtered views.
- **Opportunity tracker** — save, mark interested, applied, and completed for any opportunity.
- **Compliance-first ingestion** — 29 active data sources, each with a researched
  `SourceComplianceRecord` (robots.txt + ToS verified) before any fetch ever runs.
  71 real opportunities in the database (42 currently visible in discovery).
- **Automated freshness** — Cloud Scheduler triggers a daily sweep that re-derives
  `OPEN`/`CLOSING_SOON`/`EXPIRED` status from each opportunity's actual deadline.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript |
| Database | PostgreSQL via Cloud SQL, Prisma 6 ORM |
| AI | Google Gemini 2.5 Flash via Vertex AI (`@google/genai`) |
| Auth | NextAuth v5, Credentials provider, bcrypt |
| Deployment | Google Cloud Run (containerized, `--allow-unauthenticated`) |
| Container | Docker, built via Google Cloud Build |
| Secrets | Google Secret Manager |
| Scheduling | Google Cloud Scheduler |
| Registry | Google Artifact Registry |
| Map | d3-geo + world-atlas (no external tile server) |
| Tests | Vitest (206 unit + integration tests), Playwright (4 E2E tests) |

---

## Google Cloud services in use

| Service | Status |
|---|---|
| Cloud Run | ✅ Live — `polaris-ka4pyersra-uc.a.run.app` |
| Cloud SQL (PostgreSQL) | ✅ Live — connected via Cloud SQL Auth Connector |
| Secret Manager | ✅ Live — `polaris-database-url`, `polaris-auth-secret`, `polaris-scheduler-secret` |
| Artifact Registry | ✅ Live — `us-central1-docker.pkg.dev/polaris-opportunity-engine/polaris/app` |
| Cloud Build | ✅ Build + push working (deploy step has an IAM/mirror issue — see `docs/ANTIGRAVITY_HANDOFF.md §9`) |
| Cloud Scheduler | ✅ Live — `polaris-freshness-sweep`, daily at 03:00 UTC |
| Gemini / Vertex AI | ✅ Live — query parsing + ingestion classification via `gemini-2.5-flash` |

---

## Running locally

**Prerequisites**: Node 20+, PostgreSQL, [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) (for the real DB), `gcloud auth application-default login` (for Gemini).

```bash
cp .env.example .env       # fill in your values
npm install
npx prisma db push         # sync the schema to your database
npm run db:seed            # optional: load seed/demo data
npm run dev                # start dev server at http://localhost:3000
```

See `.env.example` for all required environment variables and their descriptions.

---

## Running tests

```bash
npm run typecheck          # TypeScript — must be clean
npm run lint               # ESLint — must be clean
npm test                   # Vitest unit + integration (requires polaris_test DB)
npm run test:e2e           # Playwright E2E (requires dev server + live DB)
npm run eval:baseline      # Regenerate recommendation quality baseline
```

All of these were passing at submission time. See `docs/ANTIGRAVITY_HANDOFF.md §7` for notes
on test execution (DB concurrency, E2E timing).

---

## Architecture and documentation

| Document | Contents |
|---|---|
| [`docs/ANTIGRAVITY_HANDOFF.md`](docs/ANTIGRAVITY_HANDOFF.md) | Full state-of-the-project summary at handoff — read this first |
| [`docs/architecture.md`](docs/architecture.md) | System architecture, component map, design decisions |
| [`docs/agent-architecture.md`](docs/agent-architecture.md) | Why the Gemini query-parser + deterministic-retrieval pipeline satisfies agent-pattern requirements |
| [`docs/data-architecture.md`](docs/data-architecture.md) | Database schema, Cloud SQL setup, migration notes |
| [`docs/security-audit.md`](docs/security-audit.md) | Route-by-route security audit, auth model, SSRF mitigations |
| [`docs/source-compliance.md`](docs/source-compliance.md) | Per-source robots.txt/ToS compliance records (77 orgs researched) |
| [`docs/recommendation-baseline.md`](docs/recommendation-baseline.md) | Eligibility engine accuracy metrics, before/after bug-fix results |
| [`docs/scalability.md`](docs/scalability.md) | Known scale ceilings and documented next steps |
| [`docs/personalization.md`](docs/personalization.md) | Profile model, matching logic, opportunity-type filtering |

---

## Key design principles

- **Gemini interprets, never decides** — the recommendation engine's hard eligibility gate is
  deterministic TypeScript (`lib/matching/eligibility.ts`). Gemini parses queries and
  classifies ingested content; it never overrides or replaces the eligibility logic.
- **Compliance-first** — no source is fetched without a `SourceComplianceRecord` with
  `ALLOWED` or `ALLOWED_WITH_RESTRICTIONS` status. The gate is structural, not advisory.
- **Graceful AI degradation** — if Gemini is unavailable, search falls back to keyword-only
  retrieval; ingestion stores items as `NEEDS_REVIEW` rather than fabricating classifications.
- **Demo data is isolated** — `isSeedData: true` rows are excluded from all discovery
  surfaces (feed, search, map) via explicit filter conditions in every query.
