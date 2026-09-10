# Polaris — Scalability Audit

Real audit against the current codebase, target stated by the product brief: comfortably
support growth from hundreds of opportunities today to thousands, then hundreds of thousands —
not massive enterprise scale immediately, but an architecture that doesn't need a rewrite to
get there.

## Current architecture (as deployed)

Cloud Run (Next.js, stateless, scale-to-zero, min 0 / max 3 instances) → Cloud SQL for
PostgreSQL (`db-f1-micro`, one instance) → Vertex AI (Gemini) for ingestion-time
classification only. No caching layer, no queue, no read replica — appropriate for the current
data volume (dozens to low hundreds of opportunities), not yet built for the next order of
magnitude. This document is about closing that gap deliberately, not pretending it's already closed.

## Gemini cost and latency — audited, already correct

**Confirmed by reading every call site** (`grep` for `extractOpportunity`/`generateStructured`
across `app/`): Gemini is called in exactly two places outside ingestion —
`extractAspiration` (once per profile save, when a user submits their goals text) and
`parseSearchQuery` (once per natural-language search request). **Gemini is never called once
per opportunity per user request** — `extractOpportunity`, the expensive per-item
classification call, only runs inside `lib/ingestion/pipeline.ts`, i.e. at ingestion time, not
at read/recommendation time. Recommendation scoring (`lib/matching/scoring.ts`) is 100%
deterministic arithmetic over already-stored structured fields — no AI call, no network call,
just JS math and string comparison. This is exactly the "ingestion-time enrichment, not
per-request AI" design the brief asked for, and it was already correct going into this pass —
verified, not assumed.

`thinkingConfig: { thinkingBudget: 0 }` (`lib/ai/provider.ts`) disables Gemini's default
reasoning pass for these structured-extraction calls — cheaper and faster, and was in fact a
real bug fix this session (the default thinking behavior was silently eating the output token
budget and truncating responses mid-JSON).

## Database performance

Indexes present on `Opportunity`: `opportunityType`, `status`, `deadline`,
`verificationStatus`, `fingerprint`, `geographicScope`, `organization`, `geographicDetail`,
`deadlineType` (the last three added this pass — `geographicDetail` backs the Explore map's
country aggregation `groupBy`, `deadlineType` backs the feed's lifecycle-tier sort).
`TrackedOpportunity` has a composite `(userId, status)` index plus the unique
`(userId, opportunityId)` constraint, which also serves as an index for the tracker/save
lookups. `SourceComplianceRecord` has `automatedAccessStatus` indexed.

**Not yet indexed**: `Opportunity.organization` was missing until this pass (fixed).
Education/experience/citizenship requirement fields are JSON-encoded strings, not natively
indexable in Postgres without a `GIN` index on a `jsonb` column — they're currently `String`
(JSON-encoded), not `jsonb`, matching the deliberate SQLite-compatible-at-first design
(docs/architecture.md). At meaningfully higher scale, migrating these specific fields to
native Postgres arrays or `jsonb` (now that Postgres is the only target, the SQLite
compatibility constraint that motivated the original choice no longer applies) would let
citizenship/education filtering happen in SQL instead of in-memory — see "Recommendation
scaling" below for why that matters more than the index itself.

Full-text search uses a `tsvector` column with a `GIN` index (`lib/search/fts.ts`) — this
scales well into the hundreds-of-thousands range on its own; Postgres FTS with GIN is a
proven, standard-scale technology, not something specific to this project's small current size.

## Recommendation scaling — the real bottleneck, found and documented (not yet fixed)

`lib/matching/feed.ts`'s `generateFeed()` fetches up to 500 opportunities matching a coarse
status filter into application memory, then scores every one of them in JavaScript before
sorting and truncating to the requested page size. At the current catalog size (dozens to
~100 real opportunities) this is instant and completely fine. **At "hundreds of thousands,"
this becomes the actual bottleneck** — not the database, not Gemini, this in-memory scoring
loop. This was found by reading the code, not guessed at.

**Not fixed this pass** — a proper fix means pushing more of the hard-eligibility filtering
(citizenship, geography, gender, age) into the SQL `WHERE` clause before any row reaches
application memory, which requires the JSON-encoded requirement fields to become queryable
(see the indexing note above) and is a genuinely separate, bounded piece of work, not something
to rush alongside everything else in this pass. Documented explicitly as the next real
scalability project, with the concrete mechanism (SQL-level pre-filtering + the schema change
that enables it) rather than a vague "optimize later."

Search (`lib/search/index.ts`) has the same shape — a bounded `take: 500` candidate set,
ranked in-process by blending keyword rank and embedding cosine similarity. Same finding, same
future fix.

## Duplicate detection

`lib/ingestion/dedupe.ts`'s confidence-banded matching runs against every existing opportunity
in the database per ingested item (`prisma.opportunity.findMany()` with no filter, loaded once
per ingestion run and reused across items in that run — not once per item). Fine at current
scale; at hundreds of thousands of rows this becomes the same class of problem as the
recommendation scoring above (an unbounded in-memory candidate set) and should get the same
fix (a real search index — e.g. a canonical-URL lookup table, or a pg_trgm similarity index for
the fuzzy title match — instead of loading every row).

## Ingestion concurrency and pagination

Sources are processed sequentially (`scripts/run-ingestion.ts` loops one source at a time),
which is appropriate — parallel ingestion across sources risks tripping per-source rate
limits the compliance framework is built to respect. Within a source, items are processed one
at a time in a `for` loop (`lib/ingestion/pipeline.ts`) — safe and simple, not a bottleneck at
current per-source item counts (tens to low hundreds per run). Feed/search API responses are
paginated (`page`/`pageSize` params, capped `take`) — the app never returns an unbounded result
set to a client.

## Cloud Run concurrency and connection management

Deployed with `--concurrency=40 --max-instances=3` (`cloudbuild.yaml`) — deliberately modest
for the current scale. Prisma's client is a per-process singleton (`lib/db/client.ts`, the
standard Next.js dev-mode-safe pattern), so each Cloud Run instance holds one connection pool,
not one connection per request — this avoids the classic serverless-Postgres connection
exhaustion problem at the current instance-count ceiling. **At meaningfully higher traffic**
(more instances × Cloud SQL's own max-connections limit), the standard next step is PgBouncer
or Cloud SQL's built-in connection pooling — not yet needed at `max-instances=3`, worth
revisiting before raising that ceiling.

## Caching

`lib/geo/aggregate.ts`'s `getGeoSummary()` (backs the Explore map's world view) caches its
result in-process for 5 minutes — the aggregation is a single grouped SQL query so it's cheap
even uncached, but the map is viewed far more often than the underlying catalog changes, so a
short TTL avoids repeating it every page load. This is the first cache in the app; the pattern
(module-level `{data, expiresAt}` with no external store) is fine for a single-instance
deployment but doesn't propagate across Cloud Run instances if `max-instances` is raised.

Not yet cached: `generateFeed()` results per user (a reasonable next target — the underlying
catalog doesn't change fast, so a few minutes' staleness would be an easy win), and Gemini
query-parser results for repeated/similar search strings. Not built this pass — premature at
current traffic, noted as the next caching targets when it stops being premature.

## Future scaling path (in the order it would actually become necessary)

1. Push hard-eligibility filtering into SQL (citizenship/geography/gender/age) — unblocks
   both recommendation and search scaling, the two highest-value fixes identified above.
2. Migrate JSON-string requirement fields to native Postgres `jsonb`/arrays to make (1) possible.
3. Add a short-TTL cache in front of `generateFeed()`.
4. Move duplicate-detection candidate lookup to an indexed query (canonical URL lookup table,
   `pg_trgm` for fuzzy title matching) instead of loading every existing opportunity.
5. Raise Cloud Run `max-instances` only alongside Cloud SQL connection pooling (PgBouncer or
   the Cloud SQL connector's built-in pooling).
6. Re-evaluate BigQuery for analytics once query volume against Postgres for reporting-style
   aggregate questions becomes a real workload (not yet — current volume doesn't need it,
   already noted in docs/data-architecture.md).
