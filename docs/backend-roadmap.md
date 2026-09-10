# Polaris — Backend Roadmap

Phase 0 deliverable: a from-the-code audit (not from memory of intent) of every backend
subsystem, a target architecture for the two core pillars (opportunity intelligence
pipeline, recommendation engine), and an adjusted, evidence-based priority order. No code
changes in this document — implementation starts only after Part 16 is reviewed and one
priority is approved.

This builds directly on `docs/product-gap-analysis.md`, `docs/recommendation-roadmap.md`,
and `docs/ingestion-roadmap.md` from the earlier product audit; it doesn't repeat them, it
sharpens them into a backend-only execution plan and adds the pieces those docs didn't cover
(source registry schema, extraction provenance, dedup confidence bands, freshness lifecycle,
scheduling, and a recommendation evaluation framework).

---

## PART 1 — Current backend assessment

Classification, file-referenced, not aspirational.

| Subsystem | Classification | Why |
|---|---|---|
| **Data model** (`prisma/schema.prisma`) | **MVP-quality, needs improvement** | Structurally covers nearly every field the product needs (eligibility, cost, dates, provenance). Gaps: no per-field extraction confidence/provenance, no source reliability metrics, no dedup confidence score (only a binary skip-or-store decision), `OpportunityStatus` has no `EXPIRING_SOON`/`ARCHIVED`/`DISCOVERED` distinction, `genderRequirement` exists but nothing populates or enforces it. |
| **Eligibility hard gate** (`lib/matching/eligibility.ts`) | **Production-quality enough** | Correct, deterministic, tested (11 unit tests). Citizenship/age/experience/education/closed-status gating works and is genuinely a hard exclusion, not a scoring input — matches the product requirement exactly. One real correctness gap: `genderRequirement` is never checked here. |
| **Recommendation scoring** (`lib/matching/scoring.ts`, `weights.ts`) | **Prototype** | The *shape* is right (weighted sub-scores, capped at 100, reasons traceable to real signals) but it's not yet a defensible ranking system: `eligibilitySoftScore` has a correctness bug (credits any stated stage, not a matching one), several onboarding fields (`timeCommitment`, `goalTags`, `industry`, `fieldOfStudy`) are collected and never scored, `targetAudience` is extracted and never scored, reason selection is positional (first 4 in a fixed order) not top-4-by-contribution, and weights are hardcoded constants with no experimentation mechanism. This is the single most important subsystem to harden — see Part 11. |
| **Opportunity extraction** (`lib/ai/extraction.ts`) | **Prototype** | Real, working, Zod-schema-validated structured output (not fragile string parsing) — the mechanism is right. But it returns one overall `confidence` for the whole record, not per-field confidence/provenance; `genderRequirement` isn't even in the extraction schema; and there's no evidence yet (because there isn't enough real source data) of how well it performs against messy real-world text vs. the clean seed/demo descriptions it's only been exercised against. |
| **Deduplication** (`lib/ingestion/dedupe.ts`) | **MVP-quality, needs improvement** | Real algorithm (fingerprint exact-match + Jaro-Winkler ≥0.92), tested, with a real bug found and fixed (`&`/`and` normalization) during initial build. But it's a binary decision (duplicate → skip, else → store) with one fixed threshold — no confidence banding, no review queue for the ambiguous middle, and it only compares titles *within an exact-match organization string*, so a duplicate posted under a slightly different org name is invisible to it. |
| **Freshness / lifecycle** | **Missing** | Nothing in the codebase ever transitions an opportunity's status after creation. A `deadline` that passes does not flip `status` to `CLOSED`. A re-ingested duplicate only bumps `lastCheckedAt`; it never diffs and updates changed content. The eligibility hard gate does exclude `status: CLOSED` opportunities, so an expired-but-never-updated record with a *future-looking* `status` can still be recommended as if live. |
| **Semantic search / embeddings** (`lib/ai/embeddings.ts`) | **MVP-quality, needs improvement** | Fully local (no external dependency), real (not mocked), tested, with one genuine bug found and fixed this session (a hash-collision false-positive for single-token queries, fixed by raising `DIMENSIONS` to 2048 and adding a token-count trust guard). It's a bag-of-hashed-words model, not true semantic understanding — synonym/paraphrase-blind by construction. Good enough to separate topically distinct text, not good enough to catch "ships navigating safely" ≈ "maritime autonomous systems." |
| **Hybrid search** (`lib/search/index.ts`) | **MVP-quality, needs improvement** | Real SQLite FTS5 keyword ranking + embedding similarity blend, filters as hard SQL constraints (correct architecture). Confirmed broken: `sort=match` and `sort=popular` are accepted by the schema and silently do nothing server-side (always falls back to `dateDiscovered desc`); `SearchQueryLog` is written on every query and never read by anything; the NL query parser's `audience` field is extracted and then dropped before reaching `SearchFilters`; ranking re-sorts a 500-candidate in-process window rather than ranking at the index level (invisible today, a real ceiling once the catalog grows). |
| **RSS ingestion** (`lib/ingestion/adapters/rss.ts`) | **Production-quality enough** | Genuinely real — verified against a live external feed (NASA) during build, not a mock. Correctly propagates fetch errors to the pipeline (a fixed bug: it used to swallow errors and report a broken feed as "0 items found, succeeded"). This is the one adapter that's actually ready to point at more real sources today. |
| **Manual ingestion** (`lib/ingestion/adapters/manual.ts`) | **Production-quality enough** | Does exactly one honest job — load curated JSON — and does it correctly. Used by seed data and admin-curated batches. |
| **API/JSON source adapter** | **Missing** | `SourceType.JSON_API` is modeled and selectable in the admin UI; `runIngestion` fails the job loudly (correct behavior for an unimplemented type — not a bug), but there is no adapter. |
| **Static-page adapter** | **Missing** | Same situation as JSON_API — modeled, selectable, fails loudly, not implemented. |
| **Adapter interface** (`lib/ingestion/types.ts`, `pipeline.ts`) | **Production-quality enough** | Clean `fetchRaw`/`normalize` contract, orchestration decoupled from adapters, per-run `IngestionJob` bookkeeping. Adding a real new adapter is additive, not a rewrite — this doesn't need to change to support Parts 3–4 below. |
| **Admin ingestion UI** (`app/admin/sources/*`) | **MVP-quality, needs improvement** | Functional: create source, trigger run, see job history. Missing everything Part 4/9/10 need to expose: reliability score, last-successful vs. last-attempted fetch, response time, per-source error rate, update frequency, freshness status counts. |
| **AI integration layer** (`lib/ai/provider.ts`) | **Production-quality enough** | Never throws to callers, never fabricates on failure, validates every response against a Zod schema, degrades to `null` (caller decides the fallback) rather than guessing. This is the right foundation for Part 7 and doesn't need to change structurally. |
| **Background jobs / scheduling** | **Missing** | Ingestion is trigger-only (admin button or `scripts/run-ingestion.ts` run by hand). No cron, no retry/backoff, no scheduled re-check of existing sources. `IngestionJob` already has the right shape to be the audit trail for a real scheduler once one exists. |
| **Environment configuration** (`.env.example`, `lib/rate-limit.ts`) | **MVP-quality, needs improvement** | `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` documented and used correctly; graceful AI-unavailable behavior throughout. Rate limiting is in-memory/single-instance — fine at current scale, a real constraint the moment there's more than one server process. |
| **Tests** (`tests/`) | **MVP-quality, needs improvement** | 70 unit/integration + 4 E2E, real (not mocked) SQLite DB per run, genuinely caught real bugs during this session (dedup normalization, RSS error-swallowing, search hash-collision false-positive). Gap directly relevant to this roadmap: **no recommendation-quality evaluation exists** — the current tests check that individual scoring functions compute correctly in isolation, not that the *system* reliably ranks a realistic opportunity set well for a realistic persona. That's Part 12. |

**Especially critical, as requested:**

- **Recommendation quality**: structurally sound, behaviorally unproven. No test today asserts "for persona X, opportunity A should outrank opportunity B" across a realistic multi-opportunity set — only narrow unit assertions. Real, known scoring bugs exist (see table). This is the top risk to the product's actual value.
- **Opportunity extraction quality**: mechanically correct (schema-validated, no hallucination-by-design), but only ever exercised against clean seed text and one real feed's news articles (not opportunity listings). Untested against genuinely messy real source text.
- **Data freshness**: a real gap — nothing expires anything.
- **Source reliability**: doesn't exist as a concept yet — every source is trusted equally.
- **Deduplication**: works for the case it was built for (near-identical titles, same org), blind to the cases it wasn't (different org string, semantically-identical-but-differently-worded descriptions).
- **Semantic search**: real but structurally limited (hashing, not embedding) — acceptable for MVP, a known ceiling.
- **AI usage**: correctly scoped (extraction/classification/summarization/query-parsing — never asked to *decide* who a recommendation goes to) and correctly fails safe. Underused for provenance (Part 6/7).
- **Scalability**: fine at today's 11-opportunity scale; the 500-candidate in-process re-rank in search and full-table-scan-then-score in `generateFeed` are both real ceilings once the catalog reaches the thousands, not before.

---

## PART 2 — The Polaris data pipeline (target architecture)

```
┌─────────────────────┐
│ Opportunity Sources │   Source registry (Part 4) — every source has metadata,
└──────────┬──────────┘   reliability, and an assigned adapter tier (Part 3)
           ↓
┌─────────────────────┐
│ Source Fetcher       │   Adapter-specific fetchRaw() — network I/O only,
└──────────┬──────────┘   respects robots.txt/rate limits, records timing/errors
           ↓
┌─────────────────────┐
│ Content Extraction   │   Adapter-specific normalize() — structural parse
└──────────┬──────────┘   (title/link/dates it can find without judgment)
           ↓
┌─────────────────────┐
│ Normalization        │   Deterministic cleanup — trimming, date parsing,
└──────────┬──────────┘   enum coercion — no AI, no judgment calls
           ↓
┌─────────────────────┐
│ Deduplication         │   Fingerprint + fuzzy match against existing records,
└──────────┬──────────┘   produces a confidence score, not a binary (Part 8)
           ↓
┌─────────────────────┐
│ AI Extraction (enrich)│  Structured, schema-validated judgment calls — type,
└──────────┬──────────┘   categories, eligibility, summary — with per-field
                          confidence (Part 6/7); dedup runs first so AI is never
                          spent classifying something already in the DB
           ↓
┌─────────────────────┐
│ Validation            │  Business-rule + schema gate on the *combined*
└──────────┬──────────┘  normalized+AI record before it's ever stored
           ↓
┌─────────────────────┐
│ Opportunity DB        │  Prisma/SQLite today, Postgres-compatible by design
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Search / Embeddings   │  FTS5 keyword index + local hashed embedding,
└──────────┬──────────┘  re-generated whenever title/description changes
           ↓
┌─────────────────────┐
│ Recommendation        │  Eligibility → candidate generation → ranking →
└─────────────────────┘  explanation (Part 11)
```

**Monitor** is drawn as a stage in the brief's flat pipeline list but is better modeled as an
*ongoing, parallel* concern rather than a step content passes through once: it watches
sources (reliability, error rate, staleness — Part 4/5), watches opportunities (freshness/
expiry — Part 9), and watches the recommendation engine itself (evaluation — Part 12). Only
one linear step in this pipeline is real-time-per-item; monitoring is continuous and
retrospective, so it's designed as its own subsystem rather than squeezed between Index and
Recommendation.

**Where this diverges from the current implementation, and why:**

The current `lib/ingestion/pipeline.ts` runs
`fetch → normalize → (structural validate) → dedupe → AI extract → store → index`, which is
close to this target already — the two real differences are (1) dedup today is binary
(store-or-skip) rather than confidence-scored, and (2) there's no post-AI validation pass
distinct from the AI response's own schema check. Both are Part 8/6 work, not a pipeline
reordering. The adapter interface and orchestration (`SourceAdapter`, `runIngestion`) stay
as-is — every stage above is either already a discrete function in that file or a small,
additive insertion into it.

---

## PART 3 — Scraper / ingestion roadmap by tier

Matches `docs/ingestion-roadmap.md`'s staging, reframed by *adapter tier* rather than
*rollout stage* per this request's structure — same underlying plan, different cut.

- **Tier 1 — APIs.** Not yet implemented (no adapter for `JSON_API`). Highest priority new
  adapter: structured, no HTML-fragility risk, usually has clear rate limits and terms.
  Build one generic `JsonApiAdapter` with per-source field-mapping config (same
  `Source.config` JSON pattern the manual adapter already uses), not one bespoke adapter per
  API.
- **Tier 2 — RSS/Atom.** Implemented and real (`rssAdapter`). "Make this robust" concretely
  means: handle feeds with inconsistent item shapes more defensively (missing `pubDate`,
  HTML-in-description needing stripping before it reaches the AI extractor), and expand the
  date-label regex in `lib/ingestion/date-extract.ts` (currently a fixed English label list)
  if/when non-English or differently-labeled feeds are added.
- **Tier 3 — Static websites.** Not yet implemented (`STATIC_PAGE` fails loudly, correctly).
  One shared `StaticPageAdapter` driven by per-source CSS-selector config, not bespoke
  scrapers — this is the architectural line that keeps "add a source" cheap.
- **Tier 4 — Organization-specific adapters.** Reserved for the rare case Tier 3's generic
  selector approach genuinely can't handle (client-rendered content, unusual pagination).
  Sparingly, only after Tier 1–3 are exhausted for a specific high-value target — this is
  explicitly the expensive end of the spectrum.
- **Tier 5 — Dynamic websites (future, conditional).** Not started, and gated on it being
  *both* technically necessary (Tier 1–4 insufficient for a specific valuable source) *and*
  legally appropriate (source's terms and `robots.txt` permit it). No work planned here
  until that condition is concretely true for a named source, not spec'd in the abstract.

**Access-policy floor for every tier**, not just Tier 5: `robots.txt` compliance and a
reasonable per-source rate limit are adapter-contract requirements, not an afterthought —
this is a design constraint on the shared adapter interface, not a per-source judgment call.

---

## PART 4 — Source registry

Current `Source` model: `id, name, sourceType, url, config, isActive, createdAt, updatedAt`.
Proposed additions (a schema migration, not implemented in this doc):

| Field | Type | Purpose |
|---|---|---|
| `organization` | `String?` | The publishing org, distinct from `name` (Polaris's label for the source) — e.g. `name: "NSF Funding RSS"`, `organization: "National Science Foundation"` |
| `reliabilityScore` | `Float @default(1.0)` | Rolling score derived from Part 5's signals; starts neutral, adjusted by observed behavior |
| `lastSuccessfulFetchAt` | `DateTime?` | Last time `fetchRaw` succeeded |
| `lastAttemptedFetchAt` | `DateTime?` | Last time a run was attempted, success or not — the gap between this and the above is a health signal on its own |
| `averageResponseTimeMs` | `Int?` | Rolling average, for spotting a source degrading before it fails outright |
| `errorCount` | `Int @default(0)` | Cumulative, reset-able counter distinct from per-job error lists (`IngestionJob.errors` already captures per-run detail; this is the aggregate) |
| `opportunityCount` | — | **Not a stored field** — derived via `_count` on the existing `opportunities` relation (Prisma already supports this without denormalizing); storing it separately would just create a value that can drift from the truth |
| `updateFrequency` | `String?` (enum-like: `daily`/`weekly`/`high-frequency`/`manual`) | Drives Part 10's scheduler cadence per source |
| `lastModifiedHeader` | `DateTime?` | The source's own `Last-Modified`/`ETag`-derived value where available, to skip unchanged fetches cheaply |
| `robotsStatus` | `String?` (`allowed`/`disallowed`/`unknown`) | Recorded at source-creation time and re-checked periodically; an adapter must not run against a source whose `robotsStatus` is `disallowed` |

`source_id` is already `Source.id`; not listed as a new field. This is additive to the
existing model — no relation or adapter code needs to change shape to support it.

---

## PART 5 — Source quality

Proposed tiering (a value set for a `Source.qualityTier` field, paired with the numeric
`reliabilityScore` above — tier is a coarse human-assigned category, reliability score is a
continuously-adjusted number):

1. **Official organization source** — the org's own site/feed for its own opportunity.
2. **Government/university source** — authoritative but not the opportunity's own org (e.g.
   a university career-center feed listing a third-party fellowship).
3. **Established institution** — a known, reputable aggregator or media source.
4. **Community source** — user- or community-maintained listings, unverified provenance.
5. **Unknown aggregator** — default for a newly-added source until it earns a tier.

**How this is allowed to be used**: as a tiebreaker signal in deduplication (prefer the
higher-tier source's version of a duplicate record, per `docs/product-gap-analysis.md`'s
dedup gap) and as one ranking input (Part 11's `source_quality` weight) — never as a
substitute for verifying the actual extracted information. Concretely: a `VERIFIED`
opportunity from a Tier 5 source stays `VERIFIED` (a human confirmed the specific facts); an
`AI_EXTRACTED` opportunity from a Tier 1 source does *not* get promoted to `VERIFIED` just
because the source is trusted — `verificationStatus` and `source quality tier` are and stay
orthogonal concepts.

---

## PART 6 — Extraction, with provenance

Target field list (already the `Opportunity` model's shape, confirmed complete against the
brief's list — title, organization, description, opportunityType, categories, skills,
targetAudience, eligibility fields, age/education/experience/citizenship requirements,
location, remote/hybrid/inPerson, cost, funding, benefits, deadline/startDate/endDate,
applicationUrl — the one gap is `genderRequirement`, present in the schema but absent from
the AI extraction schema in `lib/ai/extraction.ts`, so it's currently admin-entry-only).

**Provenance design**: repurpose the existing-but-dead `Opportunity.aiExtractedRequirements`
field (currently declared "raw AI extraction payload for admin review" but never actually
written by `pipeline.ts` — confirmed by reading the create call) to hold exactly the
brief's shape:

```json
{
  "deadline": { "value": "2026-10-14", "confidence": 0.96, "source": "official_page" },
  "eligibilitySummary": { "value": "...", "confidence": 0.72, "source": "ai_inferred" },
  "citizenshipRequirements": { "value": ["any"], "confidence": 0.4, "source": "ai_inferred" }
}
```

This is additive (the field already exists, unused) and gives the admin review queue
something real to show instead of only a single record-level `verificationStatus`. `source`
values distinguish "directly stated in the fetched text" from "inferred by the model" —
which is exactly the distinction that should gate whether a low-confidence field is worth
a human's attention first.

---

## PART 7 — AI extraction

Current implementation (`lib/ai/extraction.ts`, `lib/ai/provider.ts`) already satisfies the
brief's hard requirements, confirmed by reading the code, not assumed:

- Structured output only — `generateStructured` parses the model's JSON and validates it
  against a Zod schema (`extractionSchema`); there is no fragile string-parsing of free-form
  prose anywhere in the pipeline.
- Never hallucination-by-default — the extraction prompt explicitly instructs "extract only
  what the source text actually states — never invent eligibility requirements, deadlines,
  or benefits that aren't present," and `null`/omitted is the documented behavior for
  optional fields; on any failure (missing key, malformed JSON, schema mismatch), the
  function returns `null` to the caller rather than a guessed value, and the pipeline stores
  the item as `NEEDS_REVIEW` rather than dropping or fabricating.

What Part 6/7 actually adds on top of this working foundation: per-field `confidence`
instead of one whole-record `confidence`, and the `genderRequirement` schema gap. Both are
additive changes to the existing `extractionSchema` and prompt — not a rewrite of the AI
integration.

---

## PART 8 — Deduplication, with confidence bands

Current: `lib/ingestion/dedupe.ts` — exact fingerprint match, else Jaro-Winkler ≥0.92 within
the same organization string, else "not a duplicate." Binary.

Target — a continuous confidence score, banded per the brief:

| Score | Meaning | Action |
|---|---|---|
| ≥0.98 | Almost certainly duplicate | Auto-skip (bump `lastCheckedAt`, diff+refresh mutable fields per Part 9) |
| 0.85–0.97 | Likely duplicate | Auto-skip, but flagged for admin spot-check in the review queue rather than silent |
| 0.60–0.84 | Needs review | **Store as a separate row**, linked via the existing (currently-unused)
`duplicateOfId` relation as a *candidate*, surfaced in the admin review queue for a human
decision — never auto-merged |
| <0.60 | Probably distinct | Store normally, no linkage |

Signals to combine into the score (currently only title-similarity-within-exact-org is
used): canonical/normalized URL match, organization similarity (not just exact string
match — this closes the "duplicate posted under a slightly different org name" blind spot
called out in Part 1), title similarity (existing Jaro-Winkler), deadline proximity, and
description/semantic similarity (the existing embedding, already computed for every
opportunity, is free to reuse here). "Preserve source provenance when duplicates are merged"
is already structurally possible — `Opportunity.sourceId`/`sourceUrl`/`sourceName` are
per-row, so an auto-skip today already keeps the *original* source's provenance; the
`duplicateOfId` self-relation existing-but-unused in the schema is exactly the mechanism
needed to record "these N source rows all point at the same real opportunity" once
needs-review candidates start being stored as linked rows instead of silently skipped.

---

## PART 9 — Freshness / lifecycle

Current `OpportunityStatus`: `OPEN, CLOSING_SOON, CLOSED, DRAFT` — set once at
creation/admin-edit, never automatically revisited.

Proposed lifecycle, mapping the brief's states onto (and extending) the existing enum:

```
DISCOVERED → ACTIVE → EXPIRING_SOON → EXPIRED
                                    ↘ ARCHIVED (admin/manual)
                 ↘ NEEDS_REVIEW (any point extraction confidence is too low to trust status)
```

- `DISCOVERED`: just ingested, not yet through validation/review — maps to today's
  `verificationStatus: NEEDS_REVIEW` more than to `status`; worth clarifying in the eventual
  migration whether this becomes a new `status` value or stays expressed via
  `verificationStatus` (avoiding two enums that both partially mean "not trusted yet").
- `ACTIVE`: today's `OPEN`.
- `EXPIRING_SOON`: today's `CLOSING_SOON` — proposal: derive this automatically from
  `deadline` proximity (e.g. ≤7 days) rather than requiring it be set at ingestion time,
  since a deadline that was 60 days out at ingestion is 7 days out today without anyone
  having touched the row.
- `EXPIRED`: **new**, auto-derived the moment `deadline` passes. Excluded from
  recommendations exactly like `CLOSED` is today (the hard eligibility gate already excludes
  `CLOSED`; `EXPIRED` should join that exclusion list).
  distinguishes "we know this is over because its date passed" from `CLOSED`, which today
  conflates "the deadline passed" with "an admin/source explicitly said this is closed" —
  keeping them separate preserves the useful distinction between an inferred and a
  stated fact.
- `ARCHIVED`: manual/admin lifecycle end-state, for opportunities an admin wants out of
  circulation without deleting the historical record.
- `NEEDS_REVIEW`: already exists as a `verificationStatus`, not a `status` — recommend
  keeping it there rather than duplicating the concept into `status` too.

**Automatic derivation logic** (the actual new code this implies, not built in this pass):
a scheduled check (rides along with Part 10's scheduler) that flips `ACTIVE`/`CLOSING_SOON`
→ `EXPIRED` once `deadline < now`, and `ACTIVE` → `CLOSING_SOON` once `deadline` is within
the urgency window `lib/deadline.ts` already defines client-side (`getDeadlineUrgency`) —
reusing that existing threshold logic server-side instead of inventing a second definition
of "soon."

**Re-check cadence**: tied to `Source.updateFrequency` (Part 4) once the scheduler (Part 10)
exists; until then, the admin "Run ingestion" button already re-touches `lastCheckedAt` for
duplicates on every manual run.

---

## PART 10 — Scheduling

Current: `scripts/run-ingestion.ts` iterates all active sources; triggered only by hand (CLI)
or the admin "Run ingestion" button per-source. `IngestionJob` already has the right shape
(`status`, `startedAt`/`finishedAt`, `itemsFound/Stored/Duplicate/Failed`, `errors`) to serve
as the job-history record a real scheduler needs — no schema change required for history.

**Target — the simplest reliable thing, explicitly not a distributed system**: a single
scheduled process (cron on whatever this deploys to, or a managed scheduled-job service —
infrastructure choice deferred to deployment, not a code decision) that runs
`scripts/run-ingestion.ts`-equivalent logic on a cadence, filtered by each `Source`'s
`updateFrequency` (daily/weekly/high-frequency/manual — manual sources never auto-run).
Additions needed in the ingestion layer itself (not the scheduler):

- **Retry with exponential backoff**: on a transient fetch failure (network error, 5xx), the
  adapter/pipeline should retry a bounded number of times with increasing delay before
  marking the `IngestionJob` `FAILED` — today a single failure fails the job immediately.
- **Failure logging**: already exists (`IngestionJob.errors`, `logger.error` calls
  throughout `pipeline.ts`) — the scheduler just needs to surface a *cross-source* failure
  view (e.g. "3 sources failed their last run") in the admin dashboard, which is a UI query
  over existing data, not new backend logic.
- **Job history**: already exists (`IngestionJob` rows, already listed in
  `/admin/sources`) — no change needed here beyond what scheduling naturally accumulates.

No queue, no distributed workers, no multi-region concerns — one process, one schedule,
reusing the job-tracking table that already exists.

---

## PART 11 — The recommendation engine (target architecture)

This is the highest-priority subsystem in this entire roadmap, per the product's own stated
principle. Full current-state detail already lives in `docs/recommendation-roadmap.md`
(exact weights, exact bugs, line-referenced); this section is the target architecture that
roadmap's Version 2/3 work builds toward, restated in this brief's stage vocabulary.

### Stage 1 — Hard eligibility filter (exists, needs one fix)

`lib/matching/eligibility.ts`'s `checkEligibility` already implements this correctly:
citizenship, age, experience, education-stage, and closed-status are hard exclusions, never
overridable by relevance. **The one gap**: `genderRequirement` is schema-modeled and
admin-editable but never checked here — add it as a sixth hard-gate condition, symmetric
with the existing five. `EXPIRED` (Part 9) joins `CLOSED` in the exclusion list once that
status exists.

### Stage 2 — Candidate generation (currently absent as a distinct stage)

Today, `generateFeed` scores *every* `OPEN`/`CLOSING_SOON` opportunity (up to 500) against
the profile — there is no separate, cheaper candidate-narrowing step, because at 11 real
opportunities there's nothing to narrow. This is correctly deferred, not a current bug: the
brief itself says "do not rank every opportunity using an expensive LLM call," and today's
scoring is not an LLM call — it's cheap deterministic arithmetic, so full-scan scoring is
fine at current and near-term scale. The design decision to make *when data volume warrants
it* (Part 14's scale thresholds): narrow first by structured signals already indexed
(opportunity type preference, country, remote/hybrid, active preferred-type filters) and by
approximate embedding similarity (a top-K nearest-neighbor pass) before running the full
weighted scorer on the reduced candidate set. The scoring function itself doesn't need to
change to support this later — only what feeds it does.

### Stage 3 — Ranking (exists, needs correctness + completeness fixes)

`lib/matching/scoring.ts`'s six weighted sub-scores (eligibility-soft, interest, skills,
goal, preference, timing — summing to 100, `weights.ts`) are the right shape. Fixes needed,
already detailed in `docs/recommendation-roadmap.md` Version 2, restated here against this
brief's signal list:

| Brief's signal | Current state |
|---|---|
| Eligibility | Hard gate: correct. Soft signal: has the stage-check bug (Part 1). |
| Interest match | Implemented (`interestScore`), correct. |
| Skill match | Implemented (`skillsScore`), correct. |
| Goal match | Implemented (`goalScore`) via embedding similarity on aspiration text only — see "semantic matching" below for the richer version. |
| Experience match | **Only enforced as a hard gate** (explicit "N+ years" requirements), never a soft ranking signal — e.g. a user with exactly the right experience isn't ranked any higher than one who just barely clears the bar. |
| Opportunity-type preference | Implemented (`preferenceScore`), correct. |
| Location preference | Implemented (`preferenceScore`), correct. |
| Funding/cost preference | Implemented (`preferenceScore`), correct. |
| Timing | Implemented (`timingScore`), correct. |
| Semantic similarity | Implemented, but only feeds the single `goal` sub-score — not blended across interest/skill matching the way a more holistic representation could (see below). |
| **Source quality** | **Not a signal at all today** — Part 5's tiering, once it exists, should become a small new sub-score or a tiebreaker multiplier, not a replacement for any existing signal. |
| **Freshness** | **Not a signal at all today** — distinct from `timingScore` (which rewards a *near* deadline); freshness should reward *recently discovered/verified* content, so a newer, `VERIFIED` listing can edge out a stale `AI_EXTRACTED` one at an equal match score. |
| Behavioral signals | **Not collected at all** (see below — deliberately deferred). |

**Configurable weights**: `weights.ts` already isolates every weight as a named constant in
one file — the mechanism for "configurable" exists structurally. What's missing is anything
*using* that configurability (no admin UI, no per-experiment override, no documented
rationale for each number). Proposed next step: a short doc comment on each weight in
`weights.ts` explaining *why* that cap exists (already partially true — e.g. `INTEREST_MAX`
being higher than `SKILLS_MAX` reflects that stated interest is a more direct expression of
what someone wants than an inferred skill overlap), plus loading the weight object from a
single exported config (already true) so a future experiment can swap it without touching
scoring logic (already true) — mostly a documentation and validation task, not new
architecture.

### Separating eligibility from relevance (already correctly separated)

The brief's worked example — "software engineer interested in AI policy" vs. "AI governance
fellowship requiring 3 years of policy experience" — is already exactly how the current
system behaves: the experience requirement is a **hard gate** field
(`experienceRequirements`), so a user with 0 years policy experience against a stated "3+
years" requirement is excluded entirely by `checkEligibility`, regardless of how high their
topical relevance would otherwise score — confirmed by reading `eligibility.ts`'s experience
check. `MatchResult.eligible: false` short-circuits to `score: 0` before any relevance
sub-score is even computed (`scoring.ts`). What the system does *not* yet do is what the
brief also asks for: **explain why**, distinctly, when something is relevant-but-ineligible
vs. eligible-but-irrelevant. Today `ineligibleReasons` exists and is populated, but the UI
and the reasoning don't yet distinguish "this scored high on relevance and failed only on
eligibility" (worth surfacing prominently, e.g. "you'd be a great fit if you had 3 more years
of policy experience") from "this failed eligibility and also wasn't very relevant" (not
worth surfacing at all). That's a presentation/explanation enhancement over data the engine
already computes, not a new signal.

### Semantic matching (exists for goals, target: richer user representation)

Today: one embedding per opportunity (title + AI summary or description), compared against
one embedding of the user's aspiration text only. Target: a composite user-representation
text (interests + skills + academic interests + aspiration text, weighted by recency/
explicitness) embedded the same way, so semantic similarity isn't only "does this match your
stated goal" but "does this match the fuller shape of who you are" — still one embedding
call per side, still the same `cosineSimilarity` function, purely a change to *what text*
gets embedded on the profile side. Explicitly not a new model or new infrastructure.

### User goals as structured trajectory (foundation exists, schema needs extending)

`lib/ai/aspirations.ts`'s `extractAspiration` already turns free text into `summary` +
`goalTags` via a real AI call with graceful degradation — the mechanism the brief asks for
already exists, it's just not structured as richly as the brief's example
(`current_domain`/`target_domain`/`intersections`/`desired_transition`), and — per
`docs/product-gap-analysis.md` — `goalTags` is extracted and stored but **never read by
scoring at all today**, which is a bigger gap than the schema's shape. Proposed sequencing:
(1) wire the *existing* `goalTags` into `goalScore` as a cheap exact/near-tag-overlap floor
alongside the embedding similarity ceiling (this alone captures most of the "software
engineering → AI policy" transition case, since both domains would appear as tags), before
(2) extending the extraction schema to the fuller `current_domain`/`target_domain`/
`intersections` shape, which mainly benefits explanation quality ("supports your goal of
moving into AI policy") more than ranking math once (1) is done.

### Recommendation explanations (exists, needs a selection-logic fix)

Already real and already constrained correctly: every shown reason is assembled from actual
computed sub-score contributions (`scoring.ts`'s `reasons` arrays), never freely generated —
confirmed by reading the code, this already satisfies "never fabricate them." The one fix
needed: reasons are currently selected by *position* (first 4 in a fixed sub-score order,
`.slice(0, 4)`) rather than by *strength* — replace with a selection of the top-N reasons
ranked by their sub-score's actual contribution to the total, so a strong skills match is
never silently dropped in favor of a weaker interest match that happened to be assembled
first.

### Future behavioral learning (deliberately not started)

No signal collection exists yet (`View`/`Click`/`Impression`/`Dismissal` — none modeled).
Correctly sequenced as not-yet: per `docs/recommendation-roadmap.md` Version 4, this needs
(a) the feedback loop wired up first (today, marking something `NOT_RELEVANT` in the tracker
has zero effect on `generateFeed` — a real, cheap, high-value bug fix that is *not* the same
thing as behavioral ML, and should happen well before any learning system), and (b) enough
real user volume that a behavioral signal means something. Building anything past "wire up
the explicit signals that already exist in the schema" before real usage exists would be
building on data that doesn't exist yet.

---

## PART 12 — Recommendation evaluation framework

**Nothing like this exists today.** Current tests verify individual scoring functions in
isolation (`tests/unit/scoring.test.ts`, `eligibility.test.ts`) and that `generateFeed`
behaves correctly against small hand-built fixture sets (`tests/integration/feed.test.ts`)
— genuinely useful, but neither checks *system-level* recommendation quality across a
realistic, diverse opportunity catalog. This is the gap Part 12 exists to close, and — per
the final priority order below — the recommended first piece of implementation work.

**Synthetic test personas** (matching the brief's four, as concrete `Profile` fixtures):

- **User A** — early-career software engineer, interests `["AI/ML", "Software Engineering"]`,
  skills `["Python", "Machine Learning"]`, stage `EARLY_CAREER`, 1 year experience.
- **User B** — economics undergraduate, interests `["Finance", "Economics"]`, stage
  `UNDERGRADUATE`, 0 years experience.
- **User C** — public policy graduate, interests `["Public Policy", "AI/ML"]`, stage
  `GRADUATE`, aspiration text about technology policy.
- **User D** — experienced product manager, interests `["Entrepreneurship", "Leadership"]`,
  stage `EXPERIENCED`, 8+ years experience.

**Fixture opportunity catalog**: a realistic, deliberately diverse set (reusing/extending the
existing 11 seeded demo opportunities plus enough synthetic additions to cover: something
each persona should clearly be *eligible but poorly matched* for, something each should be
*ineligible for despite high topical relevance* — the brief's own worked example — and
several genuinely strong matches per persona) — this is what makes the evaluation
meaningful rather than trivially passable.

**Deterministic checks per persona** (a Vitest suite, `tests/evaluation/` — new directory,
reuses existing `scoreOpportunity`/`generateFeed`, no new production code required to write
these tests, though some will *fail* against today's engine and that failure list becomes
the evidence-based punch list for the next priority):

1. **Eligibility exclusion**: every opportunity with a stated hard constraint the persona
   fails (citizenship/age/experience/education/gender/closed) is absent from
   `eligible: true` results — this directly tests the Part 11 gender-gate fix once it lands.
2. **Relevant-and-eligible ranks highly**: for each persona, a hand-identified "obviously
   right" opportunity from the fixture catalog appears in the top-K of `generateFeed`'s
   output.
3. **Irrelevant-but-eligible is suppressed**: an eligible opportunity with no topical
   connection to the persona scores measurably lower than the persona's top matches (not
   necessarily excluded — eligible-but-irrelevant is a real, valid state per the brief, just
   one that shouldn't rank first).
4. **Explanation accuracy**: every reason string shown for a persona's top matches
   corresponds to a real, checkable signal (e.g. a shown "you've shown interest in X" reason
   implies X is genuinely in that persona's `interests`) — a direct, automatable test of
   "never fabricate them."
5. **Deadline respect**: no `CLOSED` or (once Part 9 lands) `EXPIRED` opportunity appears in
   any persona's results, regardless of how well it would otherwise score.
6. **The brief's own worked example, as a named test**: a fixture "AI governance fellowship
   requiring 3+ years policy experience" against User A (0 years) — asserts it's excluded
   from eligible results despite high topical overlap, and (once the explanation-quality
   work lands) that the ineligibility reason is specific ("requires 3+ years experience"),
   not generic.

Human evaluation is out of scope for this pass (no real users yet to recruit) but the
fixture personas and catalog are designed to be reusable as a script/prompt set for informal
human review later, not thrown away once automated checks exist.

---

## PART 13 — Recommendation quality metrics (documented now, measured later)

Standard IR/recsys metrics, defined here so they're ready the moment real usage data exists
— **not implemented against real users yet, because there aren't enough of them for a
statistically meaningful number**:

- **Precision@K**: of the top K recommendations shown, what fraction did the user consider
  relevant (saved, clicked, applied)? Needs real interaction data.
- **Recall@K**: of all the opportunities a user *would* have considered relevant, what
  fraction appeared in their top K? Needs a labeled "would have cared about" ground truth,
  which realistically only comes from later human evaluation or a large enough save/dismiss
  signal history.
- **NDCG (normalized discounted cumulative gain)**: rewards relevant results appearing
  *higher*, not just present — the right metric once ranking order (not just inclusion)
  needs to be evaluated against real preference data.
- **Save rate / click-through rate / application rate / dismissal rate / "not relevant"
  rate**: all require the behavioral event tracking that Part 11 explicitly defers — these
  become measurable the moment that tracking exists, not before.

**For now**: Part 12's deterministic evaluation suite is the honest substitute — pass/fail
assertions against known-good expectations for synthetic personas, run in CI like any other
test, rather than a dashboard implying statistical confidence the current user base can't
actually support.

---

## PART 14 — Data scale

Reaffirming and slightly sharpening `docs/product-gap-analysis.md` §8 against this brief's
explicit preference for quality over quantity ("500 excellent > 50,000 badly extracted" —
agreed, and it changes where the *strong-MVP* line should sit, not just the demo-floor line):

- **Minimum for a useful demo: ~50 opportunities.** Enough that one well-chosen persona
  (e.g. the seeded "early-career, India, AI/ML + policy" demo user) reliably sees 8–12
  eligible, well-scored, genuinely-different items spanning 4–5 opportunity types. This is
  reachable almost immediately via curated manual entries and is where the project already
  is today (11 seeded, real target ~50).
- **Minimum for a strong MVP: ~500 well-extracted opportunities**, matching the brief's own
  anchor number, from a deliberately limited set of high-reliability sources (Part 5 tiers
  1–3) rather than maximum breadth. At 500 genuinely good records, every one of the four
  synthetic personas (Part 12) should have real, distinct, non-overlapping feeds — the point
  at which the recommendation engine has enough to actually rank rather than just list.
- **Minimum before personalization is genuinely powerful: ~1,500–3,000 opportunities**
  spanning a wide category and geography mix, enough that a *narrow* persona (a specific
  niche interest + a restrictive eligibility profile, e.g. a citizenship-restricted, gender-
  specific, low-experience combination) still gets a non-empty, well-ranked feed rather than
  relying on broad personas always having enough eligible candidates. This is a "scale up
  once quality is proven at 500" target, not a near-term goal.

**Priority categories for the first ~500**, chosen to give the four synthetic personas (and
their likely real-world equivalents) genuine breadth rather than depth in one niche: AI/ML +
technology (software engineering, data science), public policy + technology policy, finance/
economics, entrepreneurship/leadership, and a general STEM/research bucket (undergraduate/
graduate research programs, academic fellowships) — covering both the "current domain" and
plausible "target domain" ends of the career-transition cases Part 11's goal-matching is
meant to serve, across the school-student → experienced-professional stage range the product
targets.

---

## PART 15 — Priority order (adjusted after inspecting the codebase)

The brief's suggested order is a reasonable default; here's the adjustment and why, based on
what Part 1's audit actually found rather than a generic checklist.

**P0**

1. **Recommendation evaluation framework** (Part 12) — moved to the top of P0, ahead of the
   brief's suggested position (#6). Rationale: every other P0 item below is a *fix* to the
   recommendation engine or its inputs; fixing bugs without a way to prove the fix improved
   things is exactly the "arbitrarily choose weights and never revisit them" failure mode
   the brief explicitly warns against. Build the yardstick first, then use it.
2. **Eligibility engine hardening** — the `genderRequirement` gate gap and the
   `eligibilitySoftScore` stage-check bug (Part 1/11). Cheap, high-trust-impact, and now
   directly verifiable via #1.
3. **Ranking correctness fixes** — wire up the dead signals (`goalTags`, `targetAudience`,
   experience-as-soft-signal), fix the positional reason-selection bug, per Part 11.
   Verifiable via #1.
4. **Deduplication confidence banding** (Part 8) — real data-quality risk once ingestion
   breadth grows; the binary skip-or-store decision is the biggest thing standing between
   today's dedup and something trustworthy at 500+ opportunities.
5. **Freshness/lifecycle** (Part 9) — a real, currently-true trust problem (nothing expires),
   independent of scale.
6. **Data model additions** (Part 4/6's schema fields) — done *incrementally, per feature*
   above, not as one upfront migration disconnected from concrete use — e.g. the dedup
   confidence field ships with #4, the extraction-provenance shape ships when Part 6/7's
   per-field confidence work happens, not before.
7. **Reliable ingestion architecture / real extraction quality** — the existing RSS+manual
   adapters and extraction pipeline are already production-quality-enough per Part 1; this
   item is really "grow real source count toward Part 14's ~500 target" more than an
   architecture change, and is appropriately sequenced after the recommendation engine is
   trustworthy (points 1–6) — more data flowing into a scorer with known bugs just surfaces
   the bugs at higher volume, so quality-of-engine before quantity-of-data.

**P1**

8. **Semantic user/opportunity representation upgrade** (richer composite user embedding,
   Part 11) — meaningful, not urgent; the current single-goal-text embedding already works,
   this is a quality ceiling, not a correctness bug.
9. **AI extraction provenance** (per-field confidence, `genderRequirement` in the schema,
   Part 6/7) — improves trust and admin efficiency, doesn't change what gets recommended.
10. **Source quality scoring** (Part 5) — only meaningfully differentiating once there are
    enough sources to actually differ in quality (Part 14's ~500 target implies more than
    today's 2 real sources).
11. **Scheduled ingestion** (Part 10) — needed once manual triggering doesn't scale, i.e.
    once P0.7's source growth is underway.
12. **Recommendation explanation quality** (relevant-but-ineligible framing, Part 11) — a
    real, valuable UX improvement over data the engine already computes; sequenced after
    correctness (P0.2/3) because there's no point explaining a wrong ranking well.
13. **More source adapters** (Tier 1 API, Tier 3 static-page, Part 3) — the actual mechanism
    for reaching Part 14's data targets; deliberately after the recommendation engine is
    trustworthy, for the same reason as P0.7.

**P2** — unchanged from the brief's own ordering, all correctly gated on P0/P1 preconditions
that don't yet hold: behavioral personalization and learning-to-rank need real user volume
that doesn't exist yet; opportunity pathways need the ~500-opportunity data floor (Part 14)
to not feel thin; notifications need the feedback loop (P0.3-adjacent) working first;
experimentation/A-B testing needs enough traffic to be statistically meaningful, which
correctly comes last.

---

## PART 16 — Summary (see chat response) and stop point

Per the brief: this document is the deliverable for Phase 0. No code has been changed to
produce it. The chat response accompanying this file covers the seven required points
(architecture, weaknesses, priority list, recommended first feature, rationale, what changes
technically, what tests will prove it works) and then stops for approval before any
implementation begins.
