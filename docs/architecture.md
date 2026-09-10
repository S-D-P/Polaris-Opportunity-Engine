# Polaris — Architecture

## 0. Environment note

This machine had no Node.js, npm, Docker, or PostgreSQL installed. Node.js 24 LTS was
installed via winget for this build. Because there is no Docker/Postgres server available
locally, **SQLite (via Prisma) replaces PostgreSQL for the MVP**, and **an in-process
embedding + cosine-similarity search replaces pgvector**. Both are implemented behind
interfaces (`Db` via Prisma's schema, `EmbeddingProvider`) so swapping to Postgres +
pgvector later is a config/adapter change, not a rewrite. This is called out everywhere
it matters below.

## 1. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | Single codebase for UI + API routes, server components for data-heavy pages, good default for a solo-buildable full-stack MVP |
| Styling | Tailwind CSS | Fast, consistent design tokens, no component-library look |
| ORM / DB | Prisma + SQLite (file DB) | Zero-infra relational DB with real schema/migrations/relations. Swap to Postgres by changing `datasource` provider + connection string — schema is written to be Postgres-compatible (no SQLite-only types) |
| Auth | Auth.js (NextAuth v5), Credentials provider, bcrypt password hashing, JWT session | Self-contained, no external IdP dependency required for MVP, still standard/production-shaped |
| Validation | Zod | Shared schema validation on API boundaries and forms |
| AI | Anthropic API (`@anthropic-ai/sdk`), model `claude-sonnet-4-5` (configurable) | Used only where judgment/understanding is required: extraction, classification, summarization, tagging, query-intent parsing |
| Embeddings | Local deterministic hashing embedding (bag-of-words → fixed-length vector, cosine similarity) behind an `EmbeddingProvider` interface | No embeddings endpoint ships with Anthropic's API and no external embeddings key is guaranteed to exist. This keeps semantic search **actually working** with zero external dependency. Swapping in OpenAI/Voyage embeddings later is a one-file change (`lib/ai/embeddings.ts`) |
| Keyword search | SQLite FTS5 virtual table | Real inverted-index keyword search, not LLM-based, not naive `LIKE` |
| Background jobs | `IngestionJob` DB table + a Node script (`scripts/run-ingestion.ts`) invoked from the admin dashboard or CLI/cron | No Redis/queue infra available locally; the job table already models status/attempts/errors so swapping to BullMQ/cloud tasks later doesn't change the data model |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Standard, fast, TS-native |

## 2. Module boundaries

```
/app                    Next.js routes (UI pages + API route handlers)
/components             Reusable UI components (cards, forms, feed, etc.)
/lib
  /db                    Prisma client singleton
  /auth                  Auth.js config, session helpers, RBAC guards
  /ai                    AIProvider (Anthropic), EmbeddingProvider, prompts, extraction schemas
  /ingestion             SourceAdapter interface + adapters (rss, seed) + pipeline stages
  /matching              Scoring engine, eligibility gate, explanation generator
  /search                Query parsing, FTS query builder, semantic ranking, result fusion
  /validation            Zod schemas shared by API + forms
/prisma                  schema.prisma, migrations, seed.ts
/scripts                 CLI entry points (run-ingestion, run-matching-refresh)
/tests                   unit, integration, e2e
/docs                    architecture.md, product-spec.md
```

Each of `ai`, `ingestion`, `matching`, `search` is independently unit-testable and has no
dependency on Next.js request/response types — they take plain data in, return plain data
out, so they can be called from API routes, scripts, or tests identically.

## 3. Ingestion pipeline

```
SOURCE (config row) → FETCH → EXTRACT → NORMALIZE → DEDUPLICATE → AI CLASSIFY → VALIDATE → STORE → INDEX → MATCH
```

- **Source**: a DB row (`Source`) describing one origin: `sourceType` (`RSS` | `JSON_API` |
  `MANUAL` — more types are defined in the enum but only `RSS` and `MANUAL` have working
  adapters today), a URL, and adapter-specific `config` JSON.
- **Adapter contract** (`lib/ingestion/types.ts`):
  ```ts
  interface SourceAdapter {
    sourceType: SourceType;
    fetchRaw(source: Source): Promise<RawItem[]>;      // network call, no parsing logic
    extract(raw: RawItem, source: Source): Promise<ExtractedOpportunity | null>; // structural parse only
  }
  ```
  Only `RssAdapter` (real: fetches and parses an actual RSS/Atom feed with `rss-parser`) and
  `ManualAdapter` (reads curated JSON seed files, clearly flagged as demo data) are
  implemented. The interface is designed so a static-HTML adapter or JSON-API adapter can be
  added later without touching the pipeline — **no adapter for a specific site is faked**;
  unimplemented source types are rejected at config time with a clear error rather than
  silently no-op'ing.
- **Normalize**: adapter output → the canonical `NormalizedOpportunity` shape (dates parsed,
  strings trimmed, enums coerced) — deterministic code, no AI.
- **Deduplicate**: before insert, compute a fingerprint (normalized title + organization +
  domain of source URL) and a title similarity score (Jaro-Winkler) against existing open
  opportunities from the same or different sources; matches above threshold are linked as
  `duplicateOfId` and merged (existing officially-sourced record wins) rather than inserted
  as a new row. Deterministic logic — not an LLM call — because it's a well-defined string
  problem.
- **AI classify/extract**: one Anthropic call per new opportunity, with a strict JSON schema
  (Zod-validated on response) to produce `opportunityType`, `categories`, `fields`,
  `targetAudience`, `aiSummary`, `aiTags`, and best-effort structured eligibility fields not
  already present after deterministic parsing (deadlines/URLs are parsed deterministically
  first; AI only fills in what plain parsing can't get, e.g. "who is this really for").
  Failures are caught, logged to `IngestionJob.errors`, and the item is stored with
  `verificationStatus = NEEDS_REVIEW` rather than dropped or guessed.
- **Validate**: Zod schema gate before DB write (required fields present, dates sane, URLs
  well-formed). Invalid items are stored in `IngestionJob.errors`, not written as
  opportunities.
- **Store / Index**: Prisma write inside a transaction; FTS5 row and local embedding are
  generated synchronously right after (small enough workload for MVP scale; documented as
  the first thing to move to an async worker at real scale).
- **Match**: newly stored opportunities are scored against active user profiles lazily (feed
  request time), not eagerly against every user on ingest — see §5.

## 4. AI pipeline (what AI is used for, and what it explicitly is not)

AI (Anthropic) is used for:
1. **Extraction/classification** of a new opportunity's free-text description into the
   structured taxonomy (type, categories, fields, audience) and a plain-language summary —
   genuinely needs judgment, not solvable with regex.
2. **Tag generation** — short structured tags for filtering/search.
3. **Search query understanding** — turning a natural-language query ("fully funded
   opportunities in Europe for Indian students") into a structured filter object
   (`{countries: ["..."], funded: true, ...}` merged with a semantic-search string) —
   deterministic filter *application* still happens in SQL, only the *parsing* is AI.
4. **Match explanation phrasing** — see §5: the explanation is templated from real matched
   signals, never freely generated, so it cannot fabricate a reason that isn't backed by
   data.

AI is explicitly **not** used for:
- Matching/ranking itself (deterministic scoring engine, §5) — "is this good for this
  user" is never asked directly to an LLM per the product requirement.
- Deduplication (string-similarity + deterministic rules).
- Deadline logic, eligibility hard-gating (plain date/number comparisons).

All AI calls go through `lib/ai/provider.ts`, which validates the response against a Zod
schema and throws on malformed output rather than trusting free text — callers get typed,
validated data or an explicit failure to handle.

## 5. Matching engine

Two-stage, deterministic, explainable:

**Stage 1 — Eligibility gate (hard filter).** For each opportunity/user pair, check
citizenship, minimum/maximum age, education-level, experience-level requirements that are
explicitly present on the opportunity. Any explicit, violated hard constraint sets
`eligible = false` and the opportunity is excluded from personalized recommendations
(it can still appear in plain search/browse). Requirements the opportunity doesn't specify
are not treated as constraints (absence ≠ ineligibility).

**Stage 2 — Weighted scoring (0–100), computed only for eligible opportunities:**

```
match_score = eligibility_score      (0-15, partial-credit for soft eligibility signals)
            + interest_score         (0-25, profile interests ∩ opportunity categories/fields)
            + skills_score           (0-15, profile skills ∩ opportunity skills)
            + goal_score             (0-20, embedding similarity between profile aspiration
                                       text and opportunity description)
            + preference_score       (0-15, remote/hybrid, paid/free, region match to
                                       stated preferences)
            + timing_score           (0-10, open now & deadline within a useful horizon
                                       scores higher than far-future or about-to-expire)
```

Each sub-score is computed by a pure function in `lib/matching/scoring.ts` that returns both
a number and the *reasons* that produced it (e.g. `{score: 20, reasons: ["Matches your interest in AI/ML", "Matches your interest in public policy"]}`). The final explanation shown
to the user (§ Recommendation Explanation) is assembled directly from these reason strings —
never a free-form LLM paragraph — so it can never state a reason that isn't backed by an
actual signal. Weights are named constants in one file so they're tunable without touching
logic.

## 6. Search architecture

Hybrid, three inputs fused into one ranked list:
1. **Keyword** — SQLite FTS5 `MATCH` query over title/org/description/tags (BM25 ranking).
2. **Semantic** — cosine similarity between the query's local embedding and each
   opportunity's stored embedding.
3. **Structured filters** — parsed either from explicit filter UI state or, for natural-
   language queries, from the AI query-parser (§4.3) — applied as SQL `WHERE` clauses
   (type, location, cost, deadline range, etc.), never as a ranking signal that can be
   "talked around."

Final rank = normalized-blend of (1) and (2), re-sorted with (3) as a hard filter first, then
boosted by the user's profile match score when the search happens on the signed-in feed
(logged-out/plain search skips the profile boost). This satisfies "don't rely solely on an
LLM" — the LLM only ever *parses intent*, SQL and vector math do the retrieval.

## 7. Security

- Passwords: bcrypt (cost 12), never logged, never returned from any API.
- Sessions: Auth.js JWT, httpOnly cookies.
- Authorization: every mutating API route re-checks session + ownership (a user can only
  read/write their own `SavedOpportunity`/`Profile`); admin routes additionally require
  `role === "ADMIN"` checked server-side (not just hidden in the UI).
- Input validation: every API route validates its body/query with a Zod schema before
  touching the DB.
- Secrets: `ANTHROPIC_API_KEY` and `NEXTAUTH_SECRET` read from `.env` only, never imported
  into client components; `.env` is gitignored, `.env.example` documents required vars with
  no real values.
- Rate limiting: a simple in-memory token-bucket middleware on auth and AI-backed routes
  (`lib/rate-limit.ts`) — documented as needing a shared store (Redis) once running more
  than one server instance.

## 8. Observability

Structured logger (`lib/logger.ts`) with levels and a consistent shape
(`{level, scope, message, meta}`), used for: source fetch failures, extraction/parse
failures, AI extraction failures (with the raw model output size but not full PII),
deduplication decisions, DB errors, and recommendation-generation failures. Ingestion run
results are additionally persisted to `IngestionJob` (status, itemsFound, itemsStored,
itemsFailed, errors[]) so the admin dashboard can show history without grepping logs.
User content (profile text, saved-opportunity notes) is never included in log lines.

## 9. Testing strategy

- **Unit** (`tests/unit`): scoring functions, eligibility gate, dedup fingerprinting/
  similarity, deadline/date-window logic, RSS extraction/normalization, embedding cosine
  similarity math.
- **Integration** (`tests/integration`): auth flows (signup/login/session), full ingestion
  pipeline against a fixture RSS feed (fetch mocked, everything after it real), search
  (FTS + semantic + filters against a seeded DB), recommendation generation end-to-end
  against seeded users/opportunities, save/tracker state transitions.
- **E2E** (`tests/e2e`, Playwright): signup → onboarding → personalized feed → opportunity
  detail → save → tracker; plus empty-state (`no opportunities yet`), expired-opportunity
  handling, and an invalid/incomplete-source ingestion run that surfaces in the admin
  dashboard instead of crashing.

Run via `npm test` (unit+integration, Vitest) and `npm run test:e2e` (Playwright, needs the
dev server running).

## 10. Known MVP limitations (explicit, not hidden)

- SQLite instead of Postgres, local hashing embeddings instead of a trained embedding model
  — both documented above with the swap path.
- Only one live ingestion adapter (RSS) plus a manual/seed adapter; other source types in
  the spec (government portals, static org pages) have a defined adapter interface but no
  implementation — they are not faked.
- Ingestion and match-refresh run on demand (admin trigger / CLI script), not on a real
  scheduler — cron wiring is a one-line addition (`node scripts/run-ingestion.ts` on a
  schedule) once deployed somewhere a scheduler exists.
- Rate limiting is in-memory/per-instance, fine for one server, not for a fleet.
