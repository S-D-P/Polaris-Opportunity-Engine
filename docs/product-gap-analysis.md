# Polaris — Product Gap Analysis

Honest audit of the working MVP: what's genuinely solid, what's basic, what's missing, what
was a deliberate shortcut, and what to explicitly not build yet. Written from a full read of
the matching engine, search, ingestion, AI layer, schema, API routes, pages, and tests — not
from memory of intent.

## Already strong — do not rebuild

- **Auth & authorization.** NextAuth credentials + bcrypt, server-side session re-derivation
  on every mutating route (`requireUser`/`requireAdmin`), ownership checks on tracker
  mutations. Standard, correct, nothing to fix.
- **Eligibility hard-gate** (`lib/matching/eligibility.ts`). Citizenship/age/experience/
  education/closed-status gating is correct, deterministic, and tested. This is the one
  piece of the matching engine that fully does its job.
- **Onboarding wizard architecture.** Progressive, per-step `PATCH`, resumable via
  `onboardingStep`, re-enterable via `?edit=1`. The *mechanism* is right even where the
  *content* it collects is under-used (see Missing).
- **Ingestion pipeline shape.** Adapter interface, fail-loud on an unimplemented source type
  (no silent no-op), per-run `IngestionJob` bookkeeping. Adding a real new adapter later is
  additive, not a rewrite.
- **Dedup algorithm.** Fingerprint + Jaro-Winkler ≥0.92 within the same organization,
  tested, with a real bug (`&` vs `and`) caught and fixed during build.
- **AI graceful degradation.** `generateStructured` never throws to callers; every AI-backed
  feature (extraction, aspirations, query parsing) has a defined, tested-adjacent fallback.
  Nothing fabricates data when AI is unavailable.
- **Test infrastructure.** Real SQLite DB per test run, sequential file execution to dodge
  SQLite's concurrency limits, 70 unit/integration tests + 4 E2E tests. A real base to build
  on, not scaffolding theater.
- **Source provenance UI.** Verified/AI-extracted/Needs-review badges, "last checked" date,
  outbound link to the org's own page — matches the trust principle from the brief.

## Functional but basic — works, needs product treatment

- **Feed is a flat grid.** `generateFeed` correctly ranks by score, but `/feed` renders one
  undifferentiated 2-column grid. No "closing soon," no grouping by interest, no sense of
  "here's what actually needs your attention today" — which is the product's entire premise.
- **Search UI has no sort control**, and matches the backend: `sort` accepts `match`/
  `popular`/`deadline`/`recent` but only `deadline` vs. "everything else → recent" is
  implemented (see Missing). The UI doesn't expose sort at all, which at least isn't lying
  to the user — but it means there's no way to say "show me what's closing soonest."
- **"Why this matches you" is a bare bullet list**, assembled by concatenating each
  sub-score's reason strings in a fixed order and hard-truncating to 4
  (`lib/matching/scoring.ts`) — not the 4 *strongest* reasons, the first 4 in insertion
  order. A user with 3 interest matches and 1 eligibility reason never sees their skills or
  timing reasons even when those are the more decisive signal.
- **Detail page is a comprehensive but flat single scroll.** All the right sections exist
  (eligibility, benefits, dates, target audience, source) but there's no hierarchy toward
  the two things that actually matter first: should I care, and should I act now.
- **Profile page is a read-only field dump.** The product asks users to write a paragraph
  about their aspirations and then shows it back as one line of italic text — none of the
  "compass" framing the collected data could support.
- **Tracker hides `NOT_RELEVANT`** from the board entirely, and — more importantly —
  dismissing something has zero effect on anything: `generateFeed` never reads
  `TrackedOpportunity` at all, so a dismissed opportunity can keep reappearing forever. The
  UI *looks* like it's teaching Polaris your preferences; it isn't.
- **Landing page shows 3 hardcoded example cards**, not live data — fine for a landing page,
  but worth naming since it's easy to forget it's not real.
- **Deadlines are correctly computed but passively displayed** — a badge, not a prompt.

## Missing — doesn't exist yet

- **No feedback loop.** Saves, applies, and dismissals are recorded but never read back into
  scoring or the feed. Polaris cannot currently learn from a single interaction.
- **`sort=match` and `sort=popular` are accepted by the schema and silently do nothing** —
  confirmed by reading `lib/search/index.ts`: both fall through to `dateDiscovered desc`.
  `SearchQueryLog` rows are written on every search and never read by anything.
- **No opportunity comparison.**
- **No "you might have missed this" adjacent-goal surfacing.**
- **No opportunity paths/sequences.**
- **No notifications or reminders** — no email/push code, no cron; `expiringSoon` is an
  admin-only count, never surfaced to the end user who could act on it.
- **`genderRequirement` is unenforced** — it's schema-modeled, admin-editable, and displayed
  on the detail page, but `checkEligibility` never checks it, and AI extraction doesn't even
  populate it (no key in the extraction schema).
- **Several onboarding fields are collected and stored but never read by matching**:
  `timeCommitment`, `industry`, `fieldOfStudy`, `degree`, `school`, `graduationYear`, and —
  notably — `goalTags`, the AI-extracted structured version of the aspiration text the whole
  goal-matching pitch is built on. `opp.targetAudience` has the same problem on the
  opportunity side: extracted, displayed, never scored.
- **The parsed `audience` field from NL search queries is silently dropped** —
  `parseSearchQuery` extracts it, `/api/search/route.ts` never forwards it into
  `SearchFilters`.
- **No freshness mechanism.** Nothing ever flips `status` from `OPEN` to `CLOSED` when a
  deadline passes, and nothing re-derives changed content on a source's already-ingested
  items (a duplicate hit only bumps `lastCheckedAt`).
- **`JSON_API` and `STATIC_PAGE` source types are selectable in the admin UI but have no
  adapter** — they fail loudly rather than silently, which is correct, but real ingestion
  breadth doesn't exist beyond RSS + hand-curated manual entries.
- **No scheduler.** Ingestion is trigger-only (admin button or manual CLI).

## MVP shortcuts — intentionally simplified, will need upgrading

- SQLite instead of Postgres — fine well past MVP scale, becomes a real constraint under
  concurrent writes or a multi-instance deployment.
- Local 2048-dim hashed bag-of-words embedding instead of a real semantic model — good
  enough to separate "AI policy" from "marine biology," not good enough to catch paraphrase/
  synonym closeness (a goal written as "I want to help ships navigate safely" will not match
  an opportunity about "maritime autonomous systems" — no shared tokens, ~0 similarity).
- In-memory rate limiter — correct for one server instance, silently ineffective across more
  than one.
- `eligibilitySoftScore`'s education check is a genuine bug, not a simplification: it awards
  credit for *having stated a stage at all*, not for the stage matching the requirement (the
  correct check already exists in the hard gate and just isn't reused here). Low blast
  radius today (it's a soft signal, capped at 15/100) but worth fixing alongside any other
  scoring work rather than leaving it to compound.
- Dedup only compares titles within an exact-match organization string — a duplicate posted
  under a slightly different org name is invisible to it.
- Search re-ranks a 500-row candidate window in-process rather than ranking at the index
  level — invisible today at 11 rows, becomes real once the catalog is in the thousands.

## Future / scale — do not build yet

- ML/reinforcement-learning personalization — there is no user behavior data yet to train
  on; building this before Part 6's Version 4 preconditions exist is pure waste.
- General-purpose web scraping for arbitrary static org pages — high maintenance burden per
  site, brittle, and the wrong place to invest before RSS/API sources (Stage 1–2 of
  `ingestion-roadmap.md`) are exhausted.
- A real hosted embedding model / pgvector — worth doing once either (a) the local hashing
  approach's synonym-blindness is demonstrably hurting real users, or (b) the Postgres
  migration happens for other reasons anyway.
- Distributed rate limiting / job queue — premature before there's more than one server
  instance.
- Push/email notification infrastructure — valuable, but sequencing matters: it's not worth
  building reminders for a feed that doesn't yet dismiss things you told it weren't relevant.

## Part 8 — the real data bottleneck

**Direct answer: today's 11 opportunities are enough to prove the mechanism, not enough to
demonstrate the product.** With 11 rows, most user profiles will see a feed of 3–6 items
after eligibility gating, which is too few to show off ranking, sections, comparison, or
"you might have missed this" — those features all need enough volume that a *choice*
between several genuinely-plausible items exists.

Reasoning, not a guess:

- **~50 opportunities** is the floor for *internal/demo credibility* — enough that a
  hand-picked persona (e.g., the seeded "early-career, India, AI/ML + policy" demo user)
  reliably sees 8–12 eligible, well-scored items spanning at least 4–5 opportunity types.
  Reachable almost immediately via hand-curated manual entries; this is a demo-quality
  threshold, not a product-quality one.
- **~150–250 opportunities from 8–12 real, live sources** is where the *product* starts
  being true rather than staged — enough that different personas (school student vs.
  mid-career professional; India vs. US; free-only vs. any-cost) each get a distinct,
  plausible, non-empty feed, and search filters stop returning near-empty results. This is
  the realistic Stage 1–2 ingestion target (see `ingestion-roadmap.md`) and the number this
  audit recommends as the actual MVP-v2 data goal.
- **500–1,000+ opportunities** is where Polaris starts feeling *alive* — new content
  appearing between visits, genuine breadth across every persona and geography. Not required
  to validate the product direction; it's the target once ingestion breadth (Stage 3+) and a
  scheduler (Stage 4) exist.

What the first ~150–250 should be made of, concretely: a handful of large, reliable
**structured** sources rather than many fragile scraped ones — government/funder RSS or API
feeds (e.g. grants and funding-opportunity feeds), university career-center RSS where
published, hackathon-platform feeds, and 2–3 curated manual batches for categories that
rarely publish machine-readable feeds (mentorship programs, fellowships, leadership
programs) entered by an admin the way the seed data already models. This matches Stage 1–2
of `ingestion-roadmap.md` and is the single highest-leverage non-code investment in this
audit — no amount of UI/matching work compensates for too little real inventory.

## Part 9 — Polaris MVP v2: the smallest set of changes that makes it feel real

Ranked by *"how much does this improve Polaris's ability to help a person discover and act
on meaningful opportunities,"* not by engineering ease. Full detail (impact/complexity/
dependencies) in `feature-priority-matrix.md`; this is the short list.

1. **Close the feedback loop** — `NOT_RELEVANT` and `APPLIED` actually change future feed
   output; dismissed items stop reappearing. Cheapest possible trust win; currently the UI
   lies about this.
2. **Fix real matching correctness bugs** — reuse the hard gate's stage check inside
   `eligibilitySoftScore`, enforce `genderRequirement`, wire up `targetAudience` and
   `timeCommitment`/`goalTags` into scoring, replace the positional reason cap with a
   top-4-by-contribution selection.
3. **Curated feed sections** ("Best matches," "Closing soon," "Because you're interested in
   X") instead of one flat grid — the single highest perceived-intelligence change available
   using data Polaris already has.
4. **Make `sort` real** — implement `match`/`popular` end-to-end and expose sort in the
   search UI. Small, currently a broken promise in the schema.
5. **Grow the real dataset to 150–250 opportunities** (Part 8) — without this, nothing above
   is fully demonstrable; this is infrastructure/content work, not a feature, and it's the
   actual bottleneck.
6. **Upgrade "why you" from bullets to a one/two-sentence narrative** — fully deterministic
   (template the existing reason signals into a sentence), no AI dependency required, large
   perceived-quality jump for near-zero risk.
7. **Opportunity comparison** (2–3 side by side) — meaningful differentiator for a user
   choosing between finalists; moderate complexity, no new data needed.
8. **Deadline actionability** — "start this weekend" style framing from the existing
   `getDeadlineUrgency` buckets; cheap, deterministic, ties directly into the brief's Part 5.
9. **Freshness/auto-expiry** — flip `OPEN`→`CLOSED` when `deadline` passes; refresh content
   on a re-detected duplicate instead of only bumping `lastCheckedAt`. Trust/quality, medium
   complexity.
10. **"You might have missed this"** adjacent-goal surfacing in search results — real
    differentiator, needs care (must be visibly justified, never random) to avoid feeling
    like noise.
