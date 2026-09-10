# Polaris — Architecture

## 0. Current deployment

Polaris runs on Google Cloud: **Cloud Run** (containerized Next.js app, built via **Cloud
Build** and stored in **Artifact Registry**), **Cloud SQL for PostgreSQL** as the database,
**Secret Manager** for credentials (database URL, auth secret, internal scheduler secret),
and **Cloud Scheduler** triggering a daily freshness sweep against an authenticated internal
endpoint. AI classification, extraction, and natural-language query parsing use **Gemini**
(2.5 Flash) via **Vertex AI**, authenticated with Application Default Credentials — no API key
is stored anywhere in the codebase. The project started as a local SQLite prototype; the
migration to this Postgres/Cloud SQL architecture is documented in `docs/data-architecture.md`.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript | Single codebase for UI + API routes, server components for data-heavy pages |
| Styling | Tailwind CSS | Fast, consistent design tokens, no component-library look |
| ORM / DB | Prisma + PostgreSQL (Cloud SQL) | Real schema/migrations/relations; JSON-array fields are stored as JSON-encoded strings rather than native Postgres arrays — a deliberate, documented choice (`docs/data-architecture.md`), not an oversight |
| Auth | Auth.js (NextAuth v5), Credentials provider, bcrypt password hashing, JWT session | Self-contained, no external IdP dependency required |
| Validation | Zod | Shared schema validation on API boundaries and forms |
| AI | Gemini 2.5 Flash via Vertex AI (`@google/genai`), Application Default Credentials (no stored API key) | Used only where judgment/understanding is required: extraction, classification, natural-language query parsing. Every call is a single-shot, schema-validated structured-JSON request — no tool/function access is ever given to the model (`docs/agent-architecture.md`) |
| Embeddings | Local deterministic hashing embedding (bag-of-words → fixed-length vector, cosine similarity) behind an `EmbeddingProvider` interface | No external embeddings dependency required; semantic search works with zero additional API surface. Swapping in a hosted embeddings model later is a one-file change (`lib/ai/embeddings.ts`) |
| Keyword search | PostgreSQL native full-text search (`tsvector` + GIN index, `ts_rank`) | Real inverted-index keyword search, not LLM-based, not a `LIKE` scan |
| Scheduled work | Cloud Scheduler → `app/api/internal/freshness` (shared-secret authenticated) → deterministic deadline/status sweep, daily. Bulk ingestion across all sources is deliberately **not** on the same schedule-triggered-HTTP-request pattern — running ~30 sources' worth of external fetches + Gemini calls sequentially risks exceeding Cloud Run's request timeout; ingestion currently runs via an admin-triggered endpoint or CLI script, documented as a candidate for a Cloud Run Job/Cloud Tasks queue if scheduled bulk ingestion becomes a real need (`docs/scalability.md`) | Keeps the one scheduled job fast and safely inside the request timeout rather than forcing a shape that doesn't fit |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Standard, fast, TS-native |

## 2. Module boundaries

```
/app                    Next.js routes (UI pages + API route handlers)
  /api/internal          System-only endpoints (Cloud Scheduler target), shared-secret auth
/components             Reusable UI components (cards, forms, feed, explore/map, etc.)
/lib
  /db                    Prisma client singleton
  /auth                  Auth.js config, session helpers, RBAC guards
  /ai                    Gemini provider, embeddings, extraction schemas, query parser
  /ingestion             SourceAdapter interface + adapters (RSS, JSON API, static page,
                         manual), compliance gate, SSRF guard, dedup, freshness sweep
  /geo                   Country-name normalization + geographic aggregation for the Explore map
  /matching              Scoring engine, eligibility gate
  /search                Query parsing, full-text query builder, semantic ranking, result fusion
  /validation            Zod schemas shared by API + forms
/prisma                  schema.prisma, migrations, seed files
/scripts                 CLI entry points (run-ingestion, refresh-freshness, eval baseline, etc.)
/tests                   unit, integration, e2e, recommendation-quality evaluation
/docs                    architecture.md, product-spec.md, and per-subsystem docs
```

Each of `ai`, `ingestion`, `matching`, `search` is independently unit-testable and has no
dependency on Next.js request/response types — they take plain data in, return plain data
out, so they can be called from API routes, scripts, or tests identically.

## 3. Ingestion pipeline

```
SOURCE → COMPLIANCE CHECK → FETCH (SSRF-guarded) → EXTRACT → NORMALIZE → VALIDATE →
DEDUPLICATE → AI ENRICH → STORE → INDEX
```

- **Source**: a DB row (`Source`) describing one origin — `sourceType` (`RSS` | `JSON_API` |
  `STATIC_PAGE` | `MANUAL`, all four have working adapters), a URL, and adapter-specific
  `config` JSON.
- **Compliance check** (`lib/ingestion/compliance.ts`): runs before any fetch, structurally —
  a source only proceeds if its linked `SourceComplianceRecord` (researched via a live
  robots.txt/Terms-of-Service check, recorded in `docs/source-compliance.md`) is `ALLOWED` or
  `ALLOWED_WITH_RESTRICTIONS`. `NOT_ALLOWED`/`UNCLEAR_REQUIRES_REVIEW` sources are recorded
  for the audit trail but never ingested.
- **Fetch** (`lib/ingestion/url-safety.ts`): every outbound fetch is checked against an SSRF
  guard first — rejects non-http(s) schemes, localhost, RFC1918 private ranges, and
  link-local addresses (covers the cloud metadata endpoint).
- **Adapter contract** (`lib/ingestion/types.ts`): each adapter implements `fetchRaw` (network
  call) and `normalize` (structural parse). No adapter for a specific site is faked;
  unimplemented source types are rejected at config time with a clear error.
- **Normalize**: adapter output → the canonical `NormalizedOpportunity` shape (dates parsed,
  strings trimmed, enums coerced) — deterministic code, no AI.
- **Deduplicate**: a fingerprint (normalized title + organization) and embedding similarity
  against existing candidates decide HIGH_CONFIDENCE (merged in place) vs. POSSIBLE_DUPLICATE
  (stored separately, flagged for review) — deterministic logic, not an LLM call.
- **AI enrich** (`lib/ai/extraction.ts`): one Gemini call per new opportunity, schema-validated
  (Zod), producing `opportunityType`, categories/fields, a summary, gender/geographic/deadline
  eligibility classification — only from what the source text actually states, never inferred
  from the organization's own name or location. Extraction failures are stored with
  `verificationStatus = NEEDS_REVIEW` rather than dropped or guessed; discovery surfaces
  additionally exclude the specific combination of `opportunityType = COURSE` (the pipeline's
  fallback default) with `NEEDS_REVIEW`, since that pairing is where low-confidence/failed
  extractions were found to produce misleading records.
- **Validate**: Zod schema gate before DB write.
- **Store / Index**: Prisma write; full-text index and local embedding generated at the same
  time.
- **Freshness**: a separate, scheduled sweep (`lib/ingestion/freshness.ts`, Cloud Scheduler §0)
  re-derives `OPEN`/`CLOSING_SOON`/`EXPIRED` status from each opportunity's actual deadline
  date. The recommendation engine's eligibility gate (§5) additionally checks the real
  deadline directly at recommendation time, so eligibility is never wrong for longer than it
  takes to check, independent of whether the sweep has run recently.

## 4. AI pipeline (what AI is used for, and what it explicitly is not)

Gemini is used for:
1. **Extraction/classification** of a new opportunity's free-text description into the
   structured taxonomy (type, categories, fields, gender/geographic/deadline eligibility) and
   a plain-language summary.
2. **Search query understanding** — turning a natural-language query ("fully funded
   opportunities in Europe for Indian students") into a structured filter object, merged with
   a semantic-search string — deterministic filter *application* still happens in SQL, only
   the *parsing* is AI.
3. **Aspiration summarization** — a user's free-text goals get a short AI-generated summary
   and extracted goal tags.

AI is explicitly **not** used for:
- Matching/ranking itself (deterministic scoring engine, §5) — "is this good for this user"
  is never asked directly to a model.
- Deduplication (fingerprint + embedding similarity, deterministic rules).
- Deadline logic, eligibility hard-gating (date/number comparisons and explicit-text checks).
- Match explanation text — every "why this matches you" reason is assembled from real,
  computed matching signals in `lib/matching/scoring.ts` (e.g. `"Your skills include Python"`,
  `"Accepts applicants from India"`), never a freely-generated LLM paragraph, so it can never
  state a reason that isn't backed by an actual signal.

Every Gemini call goes through `lib/ai/provider.ts`'s `generateStructured()`, which validates
the response against a Zod schema and returns `null` on malformed/unavailable output rather
than trusting free text or fabricating a fallback — callers store the result as
`NEEDS_REVIEW` rather than guess. No function/tool is ever passed to the model; see
`docs/agent-architecture.md` for why this satisfies the product's "controlled AI interpretation,
never a decision-maker" requirement without a separate agent framework.

## 5. Matching engine

Two-stage, deterministic, explainable:

**Stage 1 — Eligibility gate (hard filter, `lib/matching/eligibility.ts`).** For each
opportunity/user pair, checks (only when both the opportunity states a requirement and the
profile states the corresponding fact — absence is never treated as a violation):
citizenship, minimum/maximum age, education stage (word-boundary keyword matching, not
substring), experience (range-aware parsing — "0-3 years", "2+ years", "less than N years" —
and a conservative domain-aware check that only gates when the profile has an actual signal to
compare against), gender (only `GENDER_REQUIRED` hard-excludes; `GENDER_PREFERRED` never does),
geography (`INDIA_ONLY`/`COUNTRY_SPECIFIC` gate; `GLOBAL`/`REMOTE_GLOBAL`/`REGION_SPECIFIC`
don't), and deadline (the real `deadline` date is checked directly, not only the `status`
field). Any violated explicit constraint excludes the opportunity from personalized
recommendations (it can still appear in plain search/browse).

**Stage 2 — Weighted scoring (0–100), computed only for eligible opportunities:**

```
match_score = eligibility_score      (0-15, partial-credit for soft eligibility signals)
            + interest_score         (0-25, profile interests/academic interests ∩ opportunity categories/fields)
            + skills_score           (0-15, profile skills + technologies ∩ opportunity skills)
            + goal_score             (0-20, embedding similarity between profile aspiration
                                       text and opportunity description)
            + preference_score       (0-15, remote/hybrid, paid/free, preferred-countries/
                                       geographic-scope match)
            + timing_score           (0-10, open now & deadline within a useful horizon
                                       scores higher than far-future or about-to-expire)
```

Each sub-score is a pure function in `lib/matching/scoring.ts` returning both a number and the
*reasons* that produced it — the final explanation shown to the user is assembled directly
from these reason strings. Weights are named constants in `lib/matching/weights.ts`, tunable
without touching scoring logic.

## 6. Search architecture

Hybrid, three inputs fused into one ranked list:
1. **Keyword** — Postgres full-text search (`tsvector`/GIN index, `ts_rank`) over
   title/org/description/tags.
2. **Semantic** — cosine similarity between the query's local embedding and each
   opportunity's stored embedding.
3. **Structured filters** — parsed either from explicit filter UI state or, for
   natural-language queries, from the Gemini query-parser (§4.2) — applied as SQL `WHERE`
   clauses, never as a ranking signal that can be "talked around."

Retrieval and ranking are deterministic (SQL filters + full-text rank + embedding cosine
similarity); Gemini only ever parses intent into that filter object, never ranks results
itself.

## 7. Security

- Passwords: bcrypt (cost 12), never logged, never returned from any API.
- Sessions: Auth.js JWT, httpOnly, secure, SameSite=Lax cookies.
- Authorization: every mutating API route re-checks session + ownership server-side (a user
  can only read/write their own `TrackedOpportunity`/`Profile`); admin routes additionally
  require `role === "ADMIN"`, checked server-side, never only hidden in the UI. The
  `app/api/internal/*` endpoint (Cloud Scheduler target) uses a separate shared-secret check,
  not session/role — it's not reachable via any normal user or admin flow.
- Input validation: every API route validates its body/query with a Zod schema before
  touching the DB.
- Secrets: `AUTH_SECRET` and `DATABASE_URL` live in Secret Manager in production, `.env`
  locally (gitignored, `.env.example` documents required vars with placeholder values only).
  Gemini access uses Application Default Credentials — no API key is stored in the codebase
  at all.
- Ingestion SSRF protection: see §3.
- Rate limiting: an in-memory token-bucket limiter (`lib/rate-limit.ts`) on signup and the
  AI-backed search path — documented as needing a shared store (e.g. Redis) once running more
  than one server instance; login itself is not currently rate-limited at the application
  layer (`docs/security-audit.md`'s Remaining risks).

## 8. Observability

Structured logger (`lib/logger.ts`) with levels and a consistent shape
(`{level, scope, message, meta}`), used for: source fetch/compliance failures,
extraction/parse failures, AI request failures, deduplication decisions, DB errors, and the
freshness sweep's own summary. User content (profile text, gender, notes) is never included
in log lines — confirmed by direct inspection of every `logger.*` call site.

## 9. Testing strategy

- **Unit** (`tests/unit`): scoring functions, eligibility gate (including gender/geography/
  deadline-freshness regression tests), dedup fingerprinting/similarity, deadline/date-window
  logic, adapter extraction/normalization, embedding cosine similarity math, SSRF guard,
  scheduler-secret auth.
- **Integration** (`tests/integration`): auth flows, full ingestion pipeline against fixture
  data, search (full-text + semantic + filters against a seeded DB), feed generation,
  freshness sweep, tracker state transitions, compliance gate enforcement.
- **Evaluation** (`tests/evaluation`): four synthetic personas against a hand-labeled 24-item
  catalog, measuring Precision@5/10, Recall@10, NDCG@10, and eligibility accuracy —
  regenerated via `npm run eval:baseline`, results in `docs/recommendation-baseline.md`.
- **E2E** (`tests/e2e`, Playwright): signup → onboarding → personalized feed → opportunity
  detail → save/track → tracker; search empty-state; logged-out browsing.

Run via `npm test` (Vitest) and `npm run test:e2e` (Playwright, needs the dev server running).

## 10. Known limitations (explicit, not hidden)

- Rate limiting is in-memory/per-process — fine at the current low `max-instances` ceiling,
  documented as needing a shared store before scaling instance count up (§7).
- `generateFeed()` scores a bounded, in-memory candidate set — fine at the current catalog
  size, documented fix path (SQL-level pre-filtering) in `docs/scalability.md` before the
  catalog reaches tens of thousands of rows.
- Bulk ingestion across all sources is not on a schedule yet (§1) — only the freshness sweep
  is currently automated via Cloud Scheduler.
- No Google Agent Development Kit / Agent Runtime integration — evaluated and deliberately
  not added; the existing single-hop Gemini-interpret-then-deterministic-retrieve pattern
  satisfies the practical need. See `docs/agent-architecture.md` for the full reasoning and
  what would change if a genuine multi-tool agent became a real requirement.
- No BigQuery or Cloud Storage — no analytics or file-storage use case has justified adding
  either.
