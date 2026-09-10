# Polaris — Opportunity Intelligence Pipeline Roadmap

Supersedes the earlier `docs/ingestion-roadmap.md` (written during the initial MVP build).
That version staged ingestion breadth against a SQLite/local-only architecture. This version
does two additional things the product now needs: (1) a hard, auditable **compliance gate**
that every source must pass before any adapter touches it, and (2) an explicit **Google
Cloud target architecture**, since the original Polaris roadmap specifies Cloud Run +
BigQuery + Gemini/Vertex AI, and the current local build was always meant to be an MVP
substitution, not the destination (see `docs/architecture.md` §0).

This document is planning only — see `docs/source-compliance.md` for the researched
candidate sources and §16 below for the sequenced migration plan. Nothing described here has
been implemented yet; implementation starts only after the priority list at the end is
approved, one item at a time, matching how the recommendation-engine work was sequenced.

## Part 1 — Audit of the current ingestion system

Read directly from `lib/ingestion/*`, `prisma/schema.prisma`, `app/admin/sources/*`,
`docs/architecture.md`, `docs/product-spec.md`, and `docs/backend-roadmap.md` — not from
memory of intent.

### What currently works (production-quality enough — do not rewrite)

- **Pipeline orchestration** (`lib/ingestion/pipeline.ts`): `runIngestion(sourceId)` runs
  fetch → normalize → validate → dedupe → AI-extract → embed → store → FTS-index, records
  one `IngestionJob` row per run with real counts (`itemsFound/Stored/Updated/Duplicate/
  Failed`) and an error list. This orchestration shape is sound and the new
  compliance-check stage (Part 4 below) slots in as one more step at the front of it, not a
  rewrite.
- **`SourceAdapter` interface** (`lib/ingestion/types.ts`): a clean `fetchRaw`/`normalize`
  contract, decoupled from orchestration. Adding a new adapter (Part 5's tiers) is additive.
- **RSS adapter** (`lib/ingestion/adapters/rss.ts`): genuinely real, verified against a live
  external feed during the original build, and already correctly propagates fetch errors to
  the pipeline (a bug — silently swallowing errors — was found and fixed earlier this
  project). This is the one adapter ready to point at more real sources today, with no
  changes needed.
- **Manual adapter** (`lib/ingestion/adapters/manual.ts`): does exactly one honest job
  (load curated JSON) correctly. Stays as-is; useful for Tier-1-unavailable sources an admin
  curates by hand (see Part 5).
- **Deduplication core algorithm** (`lib/ingestion/dedupe.ts`): fingerprint exact-match +
  Jaro-Winkler fuzzy title match, tested, with a real bug (`&`/`and` normalization) found and
  fixed. The *algorithm* is sound; Part 9 upgrades its *output* from binary to a confidence
  score — the string-similarity math itself doesn't need to change.
- **AI provider layer's failure discipline** (`lib/ai/provider.ts`): never throws to
  callers, never fabricates on failure, validates every response against a Zod schema. This
  exact discipline — not the exact provider — is what Part 8's Gemini integration reuses.
- **Admin review queue and job history UI** (`app/admin/sources/*`, `app/admin/
  opportunities/*`): functional today for the two real adapters; needs new fields displayed
  (Part 3/12), not a rebuild.

### What is stubbed (interface exists, implementation doesn't)

- `SourceType.JSON_API` and `SourceType.STATIC_PAGE` are modeled in the schema and
  selectable in the admin "add source" UI. `runIngestion` fails the job loudly and clearly
  for both (`"No adapter implemented for source type ..."`) — correct, honest behavior, not
  a bug — but no adapter exists for either yet.

### What is fragile (works today, will break under real-world source diversity)

- **Date extraction** (`lib/ingestion/date-extract.ts`) is a fixed English label-regex list
  (`"deadline"`, `"apply by"`, etc.). Real source text will use phrasings this doesn't
  recognize (confirmed pattern risk, not yet confirmed against real diverse text since only
  one real RSS source — general NASA news, not an opportunity feed — has been ingested).
- **Dedup only compares titles within an exact-match organization string.** A genuine
  duplicate posted under a slightly different org name string is invisible to it — a real
  risk the moment more than one source covers overlapping organizations (e.g., a fellowship
  cross-posted by both the sponsoring org and an aggregator).
- **Experience/education hard-gate parsing** (`lib/matching/eligibility.ts`, not ingestion
  proper, but downstream of extraction quality) was proven fragile by
  `docs/recommendation-baseline.md` — a "0-3 years" range is misparsed as "3+ years,"
  and stage-matching uses substring containment (`"undergraduate".includes("graduate")` is
  a false positive). These are matching-engine bugs, but they're triggered by exactly the
  kind of free-text requirement phrasing that broader, more diverse ingestion will produce
  more of — worth remembering that ingestion breadth will surface more of these, not fewer.

### What is missing entirely

- **Compliance framework** — no `SourceComplianceRecord` concept, no gate preventing an
  adapter from running against a source whose access status hasn't been reviewed. This is
  the highest-priority gap per this request and Part 4 below.
- **Freshness/lifecycle automation** — nothing ever transitions `Opportunity.status` after
  creation; a passed deadline doesn't exclude an opportunity unless a human also flips
  `status` to `CLOSED` (confirmed as a live bug by the recommendation baseline: "AI Bootcamp"
  wrongly stayed eligible for every persona).
- **Scheduling** — trigger-only today (admin button, or `scripts/run-ingestion.ts` run by
  hand). No cron, no per-source frequency.
- **Retry/backoff** — a single fetch failure fails the whole job immediately; no bounded
  retry, no exponential backoff.
- **Source quality/reliability scoring** — every source trusted equally today.
- **Per-field extraction provenance** (`EXPLICITLY_STATED`/`NOT_STATED`/`INFERRED`) — the
  schema has one whole-record `verificationStatus`, not a per-field distinction.
- **Discovery** — every source today is a single fixed URL (an RSS feed URL, or a manual
  JSON payload); there's no mechanism to discover new opportunity URLs from a category page,
  sitemap, or pagination.
- **Any Google Cloud integration at all** — confirmed by direct repo inspection: no GCP SDK
  dependency in `package.json`, no service account config, no `BIGQUERY_*`/`GEMINI_*`/
  `GOOGLE_*` environment variables in `.env.example`, no Terraform/Cloud Build/Dockerfile,
  no mention of Google Cloud in any existing doc prior to this one. This is a clean-slate
  gap, not a partially-started one — see Part 2/Step 2 readiness audit below.

### What should change vs. stay unchanged (summary)

| Keep as-is | Change |
|---|---|
| `SourceAdapter` interface shape | Add a compliance-gate check *before* `fetchRaw` is ever called |
| RSS + manual adapters' internals | Add JSON-API and static-page adapters (new, additive) |
| `IngestionJob` bookkeeping shape | Extend with retry/backoff fields (Part 11) |
| Dedup's string-similarity math | Upgrade its output from binary to a confidence band (Part 9) |
| AI provider's never-throw/never-fabricate discipline | Add Gemini as a provider option alongside/behind the same interface (Part 8) |
| `Opportunity` core fields | Add per-field provenance + compliance/source-quality references |

## Part 2 — Google Cloud readiness audit

Direct findings, not aspirational: `package.json` has zero `@google-cloud/*` or
`@google/generative-ai` / `@google-cloud/vertexai` dependencies; `.env.example` has no
Google-prefixed variables; there is no `Dockerfile`, `cloudbuild.yaml`, Terraform, or any
other deployment/infra config in the repo; no existing doc mentions Google Cloud. **Polaris
is currently 100% local/SQLite/Anthropic with zero Google Cloud footprint.** This isn't a
partial migration to finish — it's a target architecture to design and move toward
deliberately, per the sequencing in Part 16.

## Part 3 — Target Google Cloud architecture

Component-by-component, with rationale — matching the request's "explain why" requirement
for anything mapped, and deliberately *not* introducing services beyond what's asked for.

| Component | Google Cloud service | Why this service, specifically |
|---|---|---|
| Backend API + ingestion workers | **Cloud Run** | Stateless, scales to zero, pay-per-use — right fit for a Next.js API layer and for per-source ingestion adapter runs that are short-lived and bursty, not constantly-on. No need for GKE-level orchestration at this scale. |
| Opportunity data, source metadata, ingestion history, evaluation datasets | **BigQuery** | The product's own priorities (recommendation evaluation, source quality scoring, ingestion metrics) are fundamentally analytical/aggregate queries over structured records — BigQuery's columnar analytics fit that better than a transactional store once volume grows past what Postgres/SQLite comfortably analyzes. Also directly matches the original roadmap's Phase 2 target. |
| Structured extraction, classification, eligibility interpretation, summarization | **Gemini API / Vertex AI** | Replaces the current Anthropic provider behind the *same* `AIProvider`-shaped interface (`lib/ai/provider.ts`'s discipline — schema-validated, never-fabricate, graceful degradation — carries over unchanged). Vertex AI specifically (over the raw Gemini API) gives IAM-based auth consistent with the rest of the GCP stack, rather than a separate API-key secret to manage. |
| Raw source artifacts needed for provenance/re-processing | **Cloud Storage** | Only for what's actually needed for verification/re-extraction — see the explicit minimization rule below. Not a general-purpose dump of everything fetched. |
| Scheduled ingestion runs | **Cloud Scheduler** (triggering Cloud Run jobs) | Matches the existing per-source `updateFrequency` design in `docs/backend-roadmap.md` Part 10 — Cloud Scheduler's cron-style triggers map directly onto "daily/weekly/high-frequency" tiers without needing a custom scheduler process. |
| Ingestion failures, source health, latency, extraction errors, AI failures, alerts | **Cloud Logging + Cloud Monitoring** | Structured logs already exist (`lib/logger.ts`'s consistent `{level, scope, message, meta}` shape) — this is a sink change (write to Cloud Logging instead of / in addition to stdout), not a logging-strategy rewrite. Cloud Monitoring alerting policies then read from the same log-based metrics. |

**Explicitly not introduced**: Pub/Sub or a dedicated message queue (Cloud Run + Cloud
Scheduler's direct HTTP triggers are sufficient at this pipeline's throughput — a queue adds
operational complexity that isn't earning its keep yet, matching backend-roadmap.md's "avoid
unnecessary infrastructure" principle), Dataflow (no streaming-scale transform need exists
yet — batch ingestion via Cloud Run jobs is enough), GKE (Cloud Run's simpler scale-to-zero
model fits ingestion's bursty, source-triggered workload better than always-on cluster
capacity), Firestore (BigQuery already covers the analytical need; adding a second database
for the same data would be redundant, not complementary).

**Cloud Storage minimization, specifically** (per the explicit "do not store unnecessary
copies of copyrighted material" requirement): store only (a) the minimum raw payload needed
to re-run extraction if the AI/parsing logic improves later (e.g., the fetched RSS item XML
or the specific HTML fragment an extraction was based on — not a full-page snapshot when a
fragment suffices), and (b) only for a bounded retention window, not indefinitely. Never
store a full-page HTML snapshot when the adapter only reads a specific feed item or a
specific structured API response. This is a provenance/debugging aid, not an archive.

## Part 4 — The compliance gate (hard requirement, before any other stage)

A new pipeline stage, first in the sequence:

```
SOURCE → COMPLIANCE CHECK → DISCOVERY → FETCH → EXTRACT → NORMALIZE → VALIDATE
       → DEDUPLICATE → AI ENRICH → STORE → INDEX → MONITOR
```

**The rule, stated precisely**: `runIngestion(sourceId)` must read that source's compliance
status *before* calling the adapter's `fetchRaw`. If the status is `NOT_ALLOWED`, the job
fails immediately with a clear reason and never fetches anything. If the status is
`UNCLEAR_REQUIRES_REVIEW`, the job also refuses to run automatically — such a source can only
be exercised via an explicit, logged, admin-initiated manual review action, never by the
scheduler (Part 13) or a routine trigger. Only `ALLOWED` and `ALLOWED_WITH_RESTRICTIONS`
sources run automatically, and `ALLOWED_WITH_RESTRICTIONS` sources additionally carry a
rate-limit/frequency ceiling the scheduler must respect (Part 11/13).

**Proposed data shape** — a new `SourceComplianceRecord` (one-to-one with `Source`, kept
separate from the `Source` model itself so a compliance re-review can be logged as a new
record without losing history):

```
SourceComplianceRecord {
  id
  sourceId                    -> Source
  sourceUrl
  robotsTxtStatus              // found / not-found / error
  robotsTxtCrawlPermission      // allowed / disallowed / partial / unknown
  robotsTxtCheckedAt
  tosReviewed                  // boolean
  tosUrl
  tosSummary                   // what was actually found, human-written, with citations
  apiAvailable                 // boolean
  apiPreferred                 // boolean — is an official API the recommended path
  apiDocsUrl
  rssAvailable
  rssUrl
  sitemapAvailable
  sitemapUrl
  automatedAccessStatus        // ALLOWED / ALLOWED_WITH_RESTRICTIONS / UNCLEAR_REQUIRES_REVIEW / NOT_ALLOWED
  rateLimit                    // e.g. "1 req/sec", "unspecified — default to conservative"
  permittedAdapterType          // official_api / rss / sitemap_static_html / manual / none
  complianceNotes               // free text, must cite what was checked
  lastPolicyCheckAt
  reviewRequired                // boolean — true whenever automatedAccessStatus is UNCLEAR or restrictions changed
  reviewedBy                    // admin user, once a human has confirmed the record
}
```

This is documentation/design in this pass — see `docs/source-compliance.md` for populated
records against real researched candidate sources, and Part 16 for when this becomes an
actual Prisma model.

## Part 5 — Source registry

Extends `docs/backend-roadmap.md` Part 4's proposed `Source` fields with the
compliance/category/geography fields this request adds:

| Field | Notes |
|---|---|
| `name`, `organization`, `url` | Existing |
| `sourceType` | Existing enum, extended per Part 6 below |
| `adapter` | Which adapter implementation handles this source — already implicit via `sourceType`, made explicit as its own field once more than one adapter can serve a type (e.g. two different JSON-API sources needing different field mappings) |
| `categoryCoverage` | e.g. `["AI/ML", "Public Policy"]` — which of Polaris's opportunity categories this source is expected to feed, set at source-creation time, used for coverage-gap analysis |
| `geographicCoverage` | e.g. `["United States"]` or `["global"]` |
| `reliabilityScore` | Proposed in `backend-roadmap.md` Part 4, unchanged here |
| `complianceStatus` | Denormalized copy of the current `SourceComplianceRecord.automatedAccessStatus`, for fast filtering (source of truth stays the compliance record) |
| `crawlFrequency`, `rateLimit` | Drives Cloud Scheduler cadence (Part 13) |
| `lastPolicyCheckAt`, `lastSuccessfulIngestionAt`, `lastFailureAt` | Health/audit fields |
| `isActive` | Existing |
| `extractionMethod` | official_api / rss / sitemap_html / manual — mirrors the compliance record's `permittedAdapterType`, since a source should never use a *more* invasive method than its compliance record permits |
| `config` | Existing JSON adapter-specific config |

## Part 6 — Source prioritization tiers

1. **Tier 1 — official APIs, official RSS/Atom, official sitemaps, official public
   datasets.** Always preferred when available — see `docs/source-compliance.md` for which
   researched candidates qualify.
2. **Tier 2 — public static HTML where automated access is confirmed permitted** (robots.txt
   allows it, no ToS prohibition found). Uses the new generic selector-driven
   `StaticPageAdapter` (Part 8's "extraction" section), not a bespoke scraper per site.
3. **Tier 3 — organization-specific adapters**, only when Tier 1-2's generic approaches
   genuinely can't handle a specific high-value source's structure, and only when that
   source's compliance status is `ALLOWED` or `ALLOWED_WITH_RESTRICTIONS`.
4. **Tier 4 — dynamic/browser-based collection**, only when technically necessary *and*
   clearly permitted by both robots.txt and ToS. Not planned for any currently-researched
   candidate (see `docs/source-compliance.md` — none of the researched sources both need
   this and permit it). Explicitly out of scope until a concrete, compliant, technically-
   necessary case exists — this document does not propose building it speculatively.

Adding a new compliant source should never require touching pipeline orchestration
(`pipeline.ts`) — only a new `Source` row plus, if needed, a new adapter file matching the
existing `SourceAdapter` interface. This property already holds for Tier 1 (RSS/manual) and
is a design constraint carried into Tier 2/3's new adapters.

### Where the 19 researched candidates land

Full records with citations are in `docs/source-compliance.md`; the practical read for this
roadmap:

- **Immediately buildable, Tier 1, no follow-up needed**: USAJobs.gov (official API, clean
  terms), NSF.gov (official RSS feeds for exactly the funding-opportunity content Polaris
  needs — and reuses the existing, already-proven `rssAdapter` unmodified), HigherEdJobs
  (official per-category RSS, same adapter reuse), Grants.gov (official API, attribution
  required). Data.gov is buildable but serves as a *discovery* layer (Part 7 below), not a
  direct opportunity feed.
- **Buildable but requires an API partnership application first (not purely technical)**:
  Idealist.org (Volunteer Match API, application-gated), Kaggle and Eventbrite (both have
  clean official APIs but real usage restrictions — Eventbrite specifically prohibits
  retaining past-event data without permission, which has to be encoded into that adapter's
  own freshness logic, not just noted as a compliance caveat).
- **Genuinely unclear, needs a human decision, not more research**: EU Funding & Tenders
  Portal (favorable licensing signal, technical access mechanism unconfirmed), MLH and DAAD
  (both need an actual legal/product judgment call on ambiguous terms, not further fetching).
- **Explicitly blocked, not pursued**: 8 of 19 — LinkedIn, Devpost, Wellfound, YC Work at a
  Startup, IIE/Fulbright, ResearchGate, UN Careers, and unjobs.org. All would be valuable
  (LinkedIn and Devpost especially), but every one has an explicit Terms-of-Service
  prohibition on automated collection, several with robots.txt files that look permissive
  enough to have tempted a less careful build. Several of these are realistic targets for a
  direct partnership/licensing conversation later — a business development question, not an
  engineering one, and out of scope for this roadmap.

This gives Polaris **4 sources ready to implement with zero remaining compliance questions**
(USAJobs.gov, NSF.gov, HigherEdJobs, Grants.gov) as the concrete Part 5-Tier-1 starting
set — enough to meaningfully grow past the current 2-source, 11-opportunity baseline without
building anything the compliance gate wouldn't approve.

## Part 7 — Discovery, scaled deliberately

Today every source is one fixed URL. Discovery needs to grow toward the brief's own
progression (10 → 100 → 1,000 → 10,000+) without overbuilding ahead of real need:

- **Now (10s-100s)**: fixed seed URLs per source — an RSS feed URL, an API endpoint, a
  manual batch. This is what exists today and is sufficient for Part 5 Tier 1 sources.
- **Next (100s-1,000s)**: sitemap-driven discovery for Tier 1/2 sources that publish a
  `sitemap.xml` — parse the sitemap, filter to URLs matching an opportunity-listing pattern
  (source-specific config, same pattern as the manual adapter's JSON config), fetch each.
  Category-page + pagination discovery for sources whose sitemap doesn't exist but whose
  listing pages are simple and permitted to crawl (Tier 2 only).
- **Later (1,000s-10,000+)**: links-from-trusted-source-pages discovery (a Tier 1 source's
  own page linking to a related opportunity elsewhere) — deliberately deferred, since it
  starts to resemble general crawling and needs its own compliance re-evaluation per
  discovered domain, not inherited from the source that linked to it. Not designed further
  in this pass; flagged as a P2-tier future decision, consistent with the priority list.

## Part 8 — Extraction, with per-field provenance

Full target field list (already mapped 1:1 onto the existing `Opportunity` schema in
`docs/backend-roadmap.md` Part 6 — restated here grouped as the brief requests, with the one
schema gap unchanged from that audit: `genderRequirement` exists on `Opportunity` but isn't
in the AI extraction schema yet):

- **Core**: title, organization, description, opportunity type, categories, fields, skills.
- **Eligibility**: age, education level, academic status, degree requirements, field
  requirements, work experience, citizenship, residency, location restrictions, gender
  requirement (only if explicitly stated), professional background, other requirements.
- **Timing**: deadline, start date, end date, duration, timezone where relevant (timezone is
  a genuine schema gap today — `Opportunity.deadline` is a plain `DateTime`; worth adding an
  explicit timezone field only once a real source demonstrates it matters, not speculatively).
- **Logistics**: online/in-person/hybrid, location, time commitment, cost, application fee,
  funding, stipend, scholarship, benefits.
- **Application**: application URL, application method, required materials (the last two are
  a schema gap — `Opportunity` has `applicationUrl` but no structured "how to apply"/
  "required materials" fields yet; propose adding both as nullable string/JSON fields
  alongside the provenance work below, since they're natural companions to the fields that
  already exist).

**Per-field provenance — the critical design piece**: every extracted field must be taggable
`EXPLICITLY_STATED` / `NOT_STATED` / `INFERRED`, not just present-or-absent. Proposed shape,
extending the same repurposed `Opportunity.aiExtractedRequirements` JSON field this project
already proposed reusing for confidence (`docs/backend-roadmap.md` Part 6):

```json
{
  "deadline": { "value": "2026-10-14", "status": "EXPLICITLY_STATED", "confidence": 0.96, "evidence": "\"Applications close October 14, 2026\"" },
  "citizenshipRequirements": { "value": [], "status": "NOT_STATED", "confidence": null },
  "eligibilitySummary": { "value": "Open to early-career professionals", "status": "INFERRED", "confidence": 0.7, "evidence": "Inferred from target-audience language elsewhere in the listing, not a direct eligibility statement" }
}
```

`NOT_STATED` fields are stored as `null`/empty on the `Opportunity` row itself (matching the
existing "absence of a field = not a stated constraint" principle already correctly
implemented in `checkEligibility`) — the provenance record exists so an admin (or a future
re-extraction) can distinguish "we checked and it's genuinely not there" from "we haven't
looked carefully." `INFERRED` fields should be visually distinguished in the (frozen, not
touched this pass) admin UI once implemented, so a reviewer can tell judgment-call fields
apart from directly-quoted ones — noted for a future UI pass, not built now.

## Part 9 — Gemini enrichment

Design mirrors the current `lib/ai/extraction.ts`/`provider.ts` split exactly, swapping the
model call, not the discipline:

- A `GeminiProvider` implementing the same `generateStructured`-shaped contract
  `lib/ai/provider.ts` already defines (schema-validated via Zod, returns `null` — never a
  guess — on any failure: missing credentials, malformed response, schema mismatch).
- Used for the same five things the current Anthropic-based layer already scopes AI to:
  classification, structured extraction, summarization, tagging, and (new, per this request)
  eligibility *interpretation* specifically — turning free-text eligibility prose into the
  structured per-field shape above, still bounded by "never invent," with the model
  explicitly instructed (as the current Anthropic prompt already is) to leave a field
  `NOT_STATED` rather than infer confidently.
- **Retry policy**: bounded retries (e.g. 2 retries with backoff) *only* for transient
  failures (rate limit, timeout, 5xx) — never retried for a schema-validation failure, since
  retrying an already-malformed prompt/response pair won't fix a structural mismatch; that
  case goes straight to `NEEDS_REVIEW` with the failure logged, exactly as today's
  `extractOpportunity` already does for its single-attempt failures.
- **On failure**: the item is still stored (never dropped) with `verificationStatus:
  NEEDS_REVIEW` and no fabricated field values — identical behavior to today, just backed by
  Gemini instead of (or configurably alongside) Anthropic. The provider choice should be
  config-driven (an env var), not a hardcoded swap, so Anthropic remains available as a
  fallback/comparison path during migration (Part 16).

## Part 10 — Deduplication upgrade

Replaces the binary skip-or-store decision with a confidence classification:

| Signal | Tier |
|---|---|
| Canonical/normalized application URL exact match | Strong |
| Organization match + title similarity (Jaro-Winkler, existing algorithm) + deadline match | High confidence |
| Application URL domain match (same org's site, different specific URL) | High confidence |
| Semantic similarity (existing embedding), description similarity, organization *name* similarity (not exact match — closes the current "different org string" blind spot) | Possible |

Classification:
- **`HIGH_CONFIDENCE_DUPLICATE`** (canonical URL match, or organization+title+deadline all
  agree): automatically skip/merge, preserving the *first-seen* or *highest-source-quality*
  (Part 12) record's provenance, and linking the new record via the already-existing-but-
  unused `Opportunity.duplicateOfId` self-relation instead of silently discarding it —
  closes the current gap where a skipped duplicate leaves no trace it was ever seen.
- **`POSSIBLE_DUPLICATE`** (only weaker/possible-tier signals agree, or signals conflict):
  **stored as a separate row**, linked via `duplicateOfId` as a *candidate*, surfaced in the
  admin review queue. Never auto-merged — matches the explicit "never silently merge when
  confidence is insufficient" requirement.
- **`NOT_DUPLICATE`**: stored normally, no linkage.

This is the same design already proposed in `docs/backend-roadmap.md` Part 8, restated here
with the exact three-tier naming this request specifies.

## Part 11 — Freshness / lifecycle

Status set: `DISCOVERED → ACTIVE → EXPIRING_SOON → EXPIRED`, with `ARCHIVED` (manual
end-state) and `NEEDS_REVIEW` (low-confidence extraction) as documented in
`docs/backend-roadmap.md` Part 9 — unchanged here. What this pass adds, specific to
ingestion (not just scoring exclusion):

- **`last_verified_at`** — distinct from `lastCheckedAt` (today's field, bumped on every
  re-fetch regardless of outcome): `last_verified_at` should only update when a re-fetch
  *confirms* the listing is still live and matches (or the diff was applied), not merely
  attempted. This distinction matters for a source that's down temporarily — `lastCheckedAt`
  moves, `last_verified_at` doesn't, and the gap between them is itself a staleness signal.
- **Changed/extended deadlines**: on a re-detected duplicate/re-fetch, diff the mutable
  fields (deadline, status, description) against the stored record and update them —
  currently the pipeline only bumps `lastCheckedAt` on a duplicate hit and never touches
  content, which is the exact mechanism that let a stale "AI Bootcamp" deadline slip through
  in the recommendation baseline.
- **Reopened applications**: a `status: EXPIRED` or `CLOSED` record whose re-fetch shows a
  new, future deadline should transition back toward `ACTIVE` — not blocked by any
  one-way-only status transition, since real programs do reopen for new cycles.
- **Removed pages / source 404s**: treated as a fetch failure for that specific item (not
  the whole source) — mark the opportunity `NEEDS_REVIEW` after N consecutive verification
  failures rather than immediately archiving on one blip.
- **Recurring opportunities** (e.g. an annual fellowship): out of scope for this pass as a
  first-class modeled concept (no "recurrence" field proposed) — a recurring program's new
  cycle is just a new `Opportunity` row that the upgraded dedup (Part 10) should correctly
  treat as `NOT_DUPLICATE` from last year's (different deadline, different application URL)
  while still benefiting from `duplicateOfId`-style linkage if useful later. Not solved now;
  noted so it isn't accidentally mishandled by an overly aggressive dedup threshold.

## Part 12 — Retry / failure handling

- **Bounded retries with exponential backoff** for transient errors (timeout, 5xx, rate-limit
  response) at the adapter's `fetchRaw` level — e.g. up to 3 attempts, backoff 2s/8s/32s.
  Non-transient errors (404, malformed content, schema validation failure) fail immediately
  without retry, since retrying won't change a structural problem.
  it, since retrying an unavailable resource is exactly what a courteous rate limit /
  backoff should already prevent from happening too aggressively.
- **Source-level rate limiting**: enforced against the compliance record's `rateLimit` field
  (Part 4) — a source with no explicit published rate limit defaults to a conservative
  built-in ceiling, not "as fast as possible."
- **Job status/failure reason/retry count**: extends the existing `IngestionJob` model with
  `retryCount` and a structured `failureReason` (currently just a free-text `errors` JSON
  array) — additive fields, not a schema rewrite.
- **Isolation**: one source's failure must never stop another source's scheduled run — this
  is already true today (each `runIngestion(sourceId)` call is independent), and stays true
  once Cloud Scheduler triggers per-source Cloud Run invocations independently (Part 13).

## Part 13 — Source quality scoring

Signals (as proposed in `docs/backend-roadmap.md` Part 5, restated with this request's
explicit list): official-source flag, historical reliability (extraction success rate over
time), freshness (how current the source's content actually stays), extraction success rate,
stale-data frequency, duplicate frequency (does this source frequently re-publish things
already known from elsewhere), update frequency, and compliance status itself (a source under
`UNCLEAR_REQUIRES_REVIEW` or with restrictions contributes to a lower trust ceiling even once
cleared for `ALLOWED_WITH_RESTRICTIONS`). Feeds into (not built yet, sequenced per Part 16):
opportunity-level trust display, a small ranking signal in the recommendation engine (already
identified as a currently-missing signal in `docs/recommendation-roadmap.md`), and source
prioritization for where to invest further ingestion effort.

## Part 14 — Scheduling

Cloud Scheduler triggers a Cloud Run ingestion job per source (or per batch of same-frequency
sources), cadence driven by each `Source.crawlFrequency`/`SourceComplianceRecord.rateLimit`.
Every job records: source, start time, end time, opportunities discovered, new, updated,
duplicate, expired, failed, and AI-enrichment failures specifically broken out from
extraction/fetch failures — extends the existing `IngestionJob` counters
(`itemsFound/Stored/Updated/Duplicate/Failed`) with an `itemsExpired` and an
`aiEnrichmentFailures` counter. "Do not crawl sources unnecessarily often" is enforced at the
compliance-record level (Part 4's `rateLimit`) and the scheduler must treat that as a ceiling
it cannot be configured to exceed, not merely a default.

## Part 15 — Testing

Extends the existing real-database integration test pattern (`tests/integration/
ingestion.test.ts`) rather than replacing it:

- **Fixture-based unit tests** (new): malformed HTML, missing required fields, a changed
  page layout (selector no longer matches), duplicate opportunities within one run, the same
  opportunity appearing across two different sources, an expired-but-not-closed opportunity,
  an extended/changed deadline on re-fetch, incomplete eligibility text, conflicting
  information between two source mentions of the same opportunity, a Gemini failure
  (schema-invalid response, timeout), an API failure (4xx/5xx), a request timeout, a rate-
  limit response, a source that stops resolving (DNS/connection failure), and an invalid/
  malformed URL in source config.
- **Compliance-gate tests** (new, directly testing Part 4): a source with
  `automatedAccessStatus: ALLOWED` proceeds to fetch; `ALLOWED_WITH_RESTRICTIONS` proceeds
  but respects the recorded rate limit; `UNCLEAR_REQUIRES_REVIEW` refuses to run
  automatically and requires an explicit manual-review trigger; `NOT_ALLOWED` refuses
  unconditionally, with no fetch call ever made (assert the mock/fetch layer was never
  invoked, not just that the job failed).
- **A small set of real-source integration tests** (extends what exists): the current live
  RSS-adapter test against a real feed stays; add one real-source smoke test per newly-added
  Tier 1 adapter once implemented (Part 16), kept deliberately small in number since these
  are slower and network-dependent — fixtures carry the bulk of coverage.

## Part 16 — Google Cloud migration plan

Explicit current → target mapping, sequenced by dependency (each row assumes the ones above
it are either done or don't block it):

| # | Current | Target | Depends on |
|---|---|---|---|
| 1 | No compliance framework | `SourceComplianceRecord` model + gate in `pipeline.ts` (Part 4) | Nothing — pure addition, works identically on SQLite or BigQuery |
| 2 | SQLite (`prisma/schema.prisma`, `provider = "sqlite"`) | **BigQuery** for opportunity/source/ingestion-history data | A concrete need for analytical-scale queries (source quality scoring, evaluation-dataset queries) — do this once Part 12/13's scoring work is actually built, not preemptively; until then SQLite continues to work fine at current volume |
| 3 | Local hashed embedding (`lib/ai/embeddings.ts`) | **Gemini/Vertex AI embeddings** where semantic quality genuinely requires it | The recommendation baseline's finding that the local embedding is synonym-blind — worth revisiting once real (non-seed) opportunity volume exists to evaluate against, per `docs/recommendation-roadmap.md` Version 3's sequencing |
| 4 | Anthropic (`lib/ai/provider.ts`) | **Gemini API / Vertex AI** for extraction/classification/summarization | A GCP project + service account, done as a provider-swap behind the existing interface (Part 9) — can happen independently of #2/#3 |
| 5 | `scripts/run-ingestion.ts` run by hand / admin button | **Cloud Scheduler + Cloud Run** | #1 (compliance gate must exist before anything runs on an automatic schedule) and enough real sources (Part 5/Step 3) to be worth scheduling at all |
| 6 | `console.log`-based structured logging (`lib/logger.ts`) | **Cloud Logging + Cloud Monitoring** sink | Deployment onto Cloud Run (#1 of the "where does this run" question) — the logger's shape doesn't need to change, only its sink |
| 7 | No artifact storage | **Cloud Storage** for the minimal raw-payload retention described in Part 3 | Only once a concrete re-extraction/provenance need justifies it — not built speculatively |

**Sequencing logic, stated plainly**: compliance (#1) has no infrastructure dependency and
should exist regardless of where anything runs, so it comes first and works identically
whether the database is SQLite or BigQuery. The AI provider swap (#4) is independently
valuable (matches the original roadmap's own Phase 3) and doesn't require the data layer to
have moved first. The data-layer migration (#2) and embeddings upgrade (#3) are explicitly
sequenced *after* there's real volume/quality signal to justify them — migrating an
11-opportunity SQLite database to BigQuery before Part 5/6's source expansion has produced
real volume would be infrastructure for its own sake, which this document's own product
principle (compliance > coverage, quality > quantity, and by extension *right-sized
infrastructure over speculative infrastructure*) argues against.

---

## Priority order for this document's scope

Matches the P0/P1/P2 structure given in the request, unchanged — see the accompanying chat
summary for the recommended first implementation item once this plan is approved.

## Implementation status

- **P0 #1 — Source compliance framework: DONE.** `SourceComplianceRecord` model (Part 4's
  exact field set), the gate wired into `lib/ingestion/pipeline.ts` before any adapter's
  `fetchRaw` is called, `NOT_ALLOWED` unconditionally blocked (no override exists),
  `UNCLEAR_REQUIRES_REVIEW` blocked from automatic/scheduled runs but runnable via an
  explicit, logged `manualReview` flag on the admin run-ingestion route, and a missing
  compliance record treated identically to `UNCLEAR_REQUIRES_REVIEW` (fail closed). All 19
  researched compliance records from `docs/source-compliance.md` are seeded into the
  database, plus records for the 2 existing demo sources — every `Source` row now has a
  linked compliance record. Verified with 13 new tests (6 unit on the pure gate logic, 7
  integration proving the adapter's `fetchRaw` is never invoked for a blocked source) —
  97/97 total tests and 4/4 E2E pass, typecheck and lint clean.
- **P0 #2 — Source registry extensions: DONE.** `Source` now carries the full field set from
  Part 5: `organization`, `categoryCoverage`, `geographicCoverage`, `reliabilityScore`
  (neutral default, not yet computed — that's P1 #12), a denormalized `complianceStatus`/
  `lastPolicyCheckAt` snapshot of the linked compliance record, `crawlFrequency`, `rateLimit`,
  `extractionMethod`, and — wired live into the pipeline, not left as dead columns —
  `lastSuccessfulIngestionAt`/`lastFailureAt`, updated on every job completion including
  compliance-gate blocks. The admin "add source" API accepts all of these as optional fields
  (the existing frozen UI form still works unmodified, since it doesn't send them). Verified
  via a real end-to-end run through the live admin dashboard. Found and fixed a second
  instance of the earlier fingerprint-normalization drift (a duplicate "AI & Machine Learning
  Scholarship" row kept recurring on seed re-runs because the surviving row's stored
  fingerprint predated the `&`→`and` fix) — corrected the stored fingerprint so seeding is
  idempotent again.
- **P0 #3 — Wire up the 4 zero-follow-up sources: DONE, with a real finding.** All 4 sources
  from Part 6 (NSF.gov, HigherEdJobs, USAJobs.gov, Grants.gov) are registered in
  `prisma/seed-sources.ts`, each linked to its compliance record from
  `docs/source-compliance.md`:
  - **NSF.gov (RSS)** — fully active, reuses the existing `rssAdapter` unmodified. Run for
    real against the live feed: 15 real funding-opportunity items fetched, normalized,
    deduplicated, and stored end-to-end.
  - **HigherEdJobs (RSS)** — registered active but the live run failed: the feed URL
    returned an **Incapsula anti-bot/WAF block page** instead of RSS XML, confirmed by
    direct browser inspection. No bypass was attempted, per the standing anti-circumvention
    rule. The source has been set `isActive: false` and its compliance record flagged
    `reviewRequired: true`; see `docs/source-compliance.md`'s HigherEdJobs section for the
    full writeup. This is the compliance framework doing its job — a real technical
    protection was hit and respected rather than worked around.
  - **USAJobs.gov (JSON API)** — a new generic, config-driven `jsonApiAdapter`
    (`lib/ingestion/adapters/json-api.ts`) was built to support arbitrary REST JSON shapes
    (dot-path field mapping, header/query-param API-key injection, POST bodies, id→URL
    `linkTemplate`). Registered `isActive: false` pending `USAJOBS_API_KEY`, which this
    environment does not have (requires a human applying via developer.usajobs.gov). The
    field mapping is verified against a fixture shaped like USAJobs' documented response
    (`tests/unit/json-api-adapter.test.ts`), not a live call.
  - **Grants.gov (JSON API)** — same adapter, registered `isActive: false` pending
    `GRANTS_GOV_API_KEY`. Field mapping is best-effort from Grants.gov's public API guide
    and explicitly flagged as unverified against a live response.
  Verified with 7 new unit tests on the JSON API adapter (missing-key guard, header
  injection, non-ok response, structured-deadline preference, missing-field rejection,
  linkTemplate construction, wrong-itemsPath error).
- **P0 #4 — Freshness / lifecycle: DONE.** `lib/ingestion/freshness.ts` adds two pure
  functions: `deriveDeadlineStatus` (date-only inference between OPEN/CLOSING_SOON/EXPIRED,
  used by the new `scripts/refresh-freshness.ts` maintenance sweep — the common case, since
  most deadlines pass quietly between ingestion runs rather than being caught by a re-fetch)
  and `computeRefetchUpdate` (used when a re-fetch matches an existing opportunity: diffs
  deadline/description against the stored record, sets `verifiedAt` distinct from
  `lastCheckedAt`, and — since the source itself is new evidence, not just the calendar —
  reopens a CLOSED/EXPIRED record back to OPEN if the source now shows a new future
  deadline). Wired into `lib/ingestion/pipeline.ts`'s duplicate-hit branch, which now
  actually populates `itemsUpdated` instead of leaving it permanently 0.
  `lib/matching/eligibility.ts` now excludes EXPIRED alongside CLOSED. Verified with 9 unit
  tests plus 2 integration tests exercising the real Prisma-backed re-fetch/reopen path.
- **P0 #5 — Dedup confidence banding: DONE.** `lib/ingestion/dedupe.ts` adds
  `computeDuplicateConfidence` (0-1 score) and `classifyDuplicateConfidence` (the Part 10
  three-tier classification) using canonical-URL exact match (Strong), organization+title+
  deadline agreement or same-domain+organization (High confidence), and a blended
  title/organization-name/semantic-embedding score for the weaker `POSSIBLE_DUPLICATE`
  tier — closing the previous exact-organization-string blind spot. Wired into the pipeline:
  `HIGH_CONFIDENCE_DUPLICATE` merges in place as before — a deliberate simplification of
  Part 10's fuller "always create a linked trace row" design: at this tier we're sure enough
  it's the same listing that a second row would just be duplicate-row bloat with no review
  value, so the existing record is updated instead (freshness diff included) and no new row
  is created. `POSSIBLE_DUPLICATE` now stores a real
  new row linked via the already-existing `duplicateOfId`/`duplicateConfidence` fields with
  `duplicateReviewStatus: "needs_review"` rather than being silently merged or silently
  duplicated. Verified with 11 new unit tests.
- **P0 #6 — Ingestion robustness tests: DONE.** Added fixture-based coverage for cases the
  existing suite didn't hit: malformed-XML/DNS-failure/timeout propagation from the RSS
  adapter (mocking `rss-parser` directly, no network), rate-limit (429) and 5xx propagation
  plus missing/invalid-config guards on the JSON API adapter, a duplicate appearing twice
  within a single ingestion run (not just across runs), the same opportunity ingested from
  two different sources, a malformed application URL rejected rather than stored, and an
  EXPIRED opportunity excluded from eligibility the same as CLOSED. 143/143 unit+integration
  tests and 4/4 E2E pass; typecheck and lint clean.
- **Corporate opportunity expansion — research + first-wave implementation DONE.**
  32 companies/organizations investigated for non-job opportunities via live
  robots.txt/ToS/RSS/sitemap checks (`docs/source-compliance.md`'s "Corporate Opportunity
  Sources (Batch 2)"; prioritization: `docs/corporate-opportunity-sources.md`). Built the
  missing adapter type identified by that research — `lib/ingestion/adapters/static-page.ts`
  (config-driven single-program-page fetch, `og:title`/`og:description`-preferred extraction,
  optional headless-Chromium rendering via `playwright-core` for JS-rendered pages like
  Salesforce Trailhead) — plus `lib/ingestion/relevance-filter.ts`, a deterministic keyword
  pre-filter built after discovering Hugging Face's blog RSS is ~99% non-opportunity content
  (711 junk items on the first live run, 4 genuine ones after the filter). All 9 first-wave
  sources (Hugging Face, IBM SkillsBuild, JPMorganChase, BCG, EY, Google DeepMind, Deloitte,
  Accenture, Salesforce Trailhead) ran live and succeeded, producing 12 real, provenance-backed
  corporate opportunities — full measurement, including two live bugs found and fixed (a 404'd
  Deloitte URL, a Trailhead render timeout) and the honest field-completeness gap (structured
  fields are `NOT_STATED` pending either AI extraction or per-source selector tuning):
  `docs/corporate-ingestion-baseline.md`. 159/159 unit+integration tests and 4/4 E2E pass;
  typecheck and lint clean.
- **India + global demo dataset expansion — DONE.** Added `Opportunity.geographicScope`/
  `geographicDetail` (`docs/geographic-model.md`) — an explicit, source-evidenced-only
  eligibility classification, never inferred from an organization. Researched 16 India/global
  candidates (`docs/source-compliance.md`'s "India + Global Sources (Batch 3)"); extended
  `static-page.ts` with a `listingPages` mode (discover links from an index page via a CSS
  selector, fetch+extract each, capped at a small `itemLimit`) to handle platform sources
  (Unstop, Devfolio, MLH) rather than single hand-picked pages. Implemented and ran 7 sources
  live: MyGov.in, Atal Innovation Mission, Smart India Hackathon, Unstop, Devfolio, HackerEarth,
  MLH — 44 new opportunities (82 total in the database, up from 38). HackerEarth was blocked by
  bot-fingerprint detection on the first live run (headless-Chromium-specific 403, distinct
  from the robots.txt/ToS question already cleared) — deactivated and flagged, not bypassed,
  same pattern as HigherEdJobs. A real-content-driven E2E test locator ambiguity was found and
  fixed (`tests/e2e/critical-journey.spec.ts`). Full report: `docs/demo-dataset-plan.md`.
  164/164 unit+integration tests and 4/4 E2E pass; typecheck and lint clean.
