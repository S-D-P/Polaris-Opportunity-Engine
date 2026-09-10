# Polaris — Data Architecture

Real state as of the Google Cloud migration (docs/implementation-status.md), not a plan.

## Database: Cloud SQL for PostgreSQL — IMPLEMENTED

- Instance `polaris-db`, PostgreSQL 16, `db-f1-micro` (ENTERPRISE edition — the only edition
  that supports the shared-core tier; `ENTERPRISE_PLUS`, the project default, requires a
  `db-perf-optimized-N-*` tier and would have meant a materially more expensive instance for
  no benefit at this scale), zonal (not HA), 10GB SSD, `us-central1`. Cost-conscious per the
  build's explicit instruction — this is a demo-scale instance, not a production-sized one.
- Two databases on the instance: `polaris` (application) and `polaris_test` (the automated
  test suite's dedicated database — see "Testing" below).
- Migrated from the original SQLite MVP via a straight `datasource provider` change in
  `prisma/schema.prisma` — the schema was deliberately designed Postgres-compatible from the
  start (JSON stored as `String`, arrays as JSON-encoded strings, no SQLite-only column
  types), so this was genuinely a one-line datasource swap, not a schema rewrite.
- Connection: **Cloud SQL Auth Proxy** locally (IAM-authenticated, no public-IP password auth
  needed for the dev machine); Cloud Run connects via its native Cloud SQL integration
  (`--add-cloudsql-instances`) in production, same IAM-based path, no proxy binary needed
  inside the container.
- **The one genuinely SQLite-specific code path** (identified by a full-repo grep for raw
  SQL — `$executeRaw`/`$queryRaw` — before any migration work started): `lib/search/fts.ts`,
  the keyword search index. Rewritten for Postgres native full-text search — see below.

## Search: PostgreSQL native full-text search — IMPLEMENTED

Replaces the SQLite FTS5 virtual table. Design:

- A `search_vector tsvector` column added directly to `Opportunity` via raw SQL (not
  Prisma-modeled — Prisma has no native `tsvector` type), with a GIN index for fast lookup.
- Weighted: title ('A', highest), organization ('B'), description ('C'), AI tags ('D') —
  mirrors the relative importance each field should have in a keyword match.
- `upsertFtsRow`/`searchFts`/`deleteFtsRow` — same exported function signatures as the SQLite
  version, so `lib/ingestion/pipeline.ts` and every other caller needed zero changes.
  `deleteFtsRow` is now a no-op (the vector lives on the row itself and is removed when the
  row is deleted — no separate cleanup step needed, unlike the old separate-virtual-table
  design).
- Hybrid search (`lib/search/index.ts`) is unaffected structurally: SQL filters narrow the
  candidate set, keyword rank (`ts_rank`) and embedding cosine similarity are blended for
  final order — exactly the same architecture as before, just a different keyword-ranking
  backend.

## Firestore — evaluated, NOT implemented (deliberate)

Per the explicit instruction to make this an engineering decision, not add Firestore because
it sounds impressive: **PostgreSQL remains the sole database.** User profiles, preferences,
and saved/tracked opportunities all already live in Postgres via Prisma (`User`, `Profile`,
`TrackedOpportunity` models) and work correctly today — splitting them into a second database
with its own consistency model, its own client library, and its own query patterns would add
real integration risk (two sources of truth to keep in sync, e.g. a user's tracked-opportunity
count needing a join across two databases) for no concrete benefit at this data volume and
time budget. A simpler, fully-working single-database architecture beats an incomplete
multi-database one, exactly as instructed. Revisit if/when Firestore's specific strengths
(offline-first mobile sync, extremely high write concurrency) become an actual product need.

## Authentication — NextAuth retained (Firebase Auth deferred)

NextAuth v5 continues to handle signup/login/logout/session/protected-routes/admin-role
gating — all real, working, and exercised by the E2E suite before and after the database
migration. Firebase Authentication was not migrated to in this pass: the existing system
works, and swapping the entire auth layer during the same window as a live database migration
would combine two high-risk changes at once. If Firebase Auth is a hard submission
requirement, it's the next scoped piece of work, done on its own — not bundled into the
database migration's blast radius. Documented explicitly per instruction: **Firebase Auth was
evaluated but the existing authentication was retained for stability. It is not deployed.**

## Testing — Postgres end-to-end

- `tests/global-setup.ts` runs `prisma db push` against `polaris_test` once before the suite,
  same pattern as the old SQLite-file approach, different connection string.
- `tests/setup.ts` derives the test database URL from `DATABASE_URL`/`TEST_DATABASE_URL` and
  — importantly — **explicitly unsets `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_LOCATION`** so
  tests never make live Gemini calls. This was a real bug caught during the migration: once
  Vertex AI became genuinely reachable, tests started making real network calls to Gemini,
  turning a ~10 second suite into 5+ minutes and causing real timeouts. Restoring the
  "AI unavailable, degrade gracefully" test posture (which was already every test's actual
  expected behavior) fixed it — tests were never supposed to depend on a live model.
- `vitest.config.mts` now explicitly loads `.env` (vitest doesn't do this automatically the
  way Next.js does) — needed once tests started depending on `DATABASE_URL` pointing at a
  real external database rather than a fixed local file path.

## A real bug found and fixed during the migration: unfiltered job postings

Once Gemini extraction started genuinely running (previously always degraded — no API key),
it correctly classified 5 real ingested items as `JOB` — MyGov.in's RSS feed turned out to mix
citizen-engagement contests with genuine hiring listings ("Video Editor (5-10Yrs)", "Graphic
Designer"). The pipeline had no enforcement step acting on that classification. Fixed in
`lib/ingestion/pipeline.ts`: any item Gemini classifies as `opportunityType: "JOB"` is now
counted as filtered (not stored), enforcing the product's non-negotiable "no jobs" rule at the
one point it can actually be enforced — after AI classification, since only that can tell a
job apart from a program on a source that isn't job-only. The 5 already-stored rows were
deleted. A source with no AI available at all still can't be checked this way — same honest
limitation as every other AI-dependent field.
