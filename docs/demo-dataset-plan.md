# Polaris — India + Global Demo Dataset Plan

Combines the demo dataset strategy (India + globally-accessible-to-India, 150-300 curated
opportunities, diversity over volume, mostly active/upcoming) with the ongoing ingestion work.
This document is both the "show me before implementing" report the strategy asked for and the
record of what was implemented afterward.

## Step 1-6: Current state, before this batch (baseline)

Measured via `scripts/analyze-demo-coverage.ts` against the database as it stood after the
corporate opportunity work (38 opportunities: 11 demo/seed + 15 NSF + 12 corporate):

1. **By status**: all 38 `OPEN` (no `EXPIRED`/`CLOSED` yet — the catalog is young).
2. **By geography**: all 38 `LOCATION_UNKNOWN` — the `geographicScope` field didn't exist
   before this batch; every pre-existing opportunity is honestly unclassified, not guessed.
3. **By opportunity type**: 27 defaulted to `COURSE` (the pipeline's fallback when AI
   extraction doesn't run), 1 each for the other 11 types — a real signal that most of the
   catalog has no reliable type classification without an AI key.
4. **By education/career level** (keyword-derived): 27 `unclassified`, the rest spread thinly
   across undergraduate/early-career/experienced/high-school/recent-graduate.
5. **By domain** (keyword-derived): 27 `unclassified`, the rest spread thinly across
   technology/AI-ML/research/leadership/etc.
6. **Gap to target**: 38 of 150-300 — a gap of 112-262. **0 India-eligible opportunities.**

**The most important finding from this baseline**: the 27 "unclassified" items in both the
type and domain breakdowns are the same 27 real (non-seed) opportunities ingested without AI
extraction — meaning the current real-ingested catalog has almost no diversity signal for the
recommendation engine to work with, independent of raw count. Closing the count gap without
also closing this classification gap would not actually achieve "meaningfully different
recommendations for different profiles."

## Step 7: Compliant sources to fill the gap

Two parallel research passes investigated 16 India-focused and global-hackathon-platform
candidates (full detail: `docs/source-compliance.md`'s "India + Global Sources (Batch 3)").
Result: 1 ALLOWED (MyGov.in), 8 ALLOWED_WITH_RESTRICTIONS, 6 UNCLEAR_REQUIRES_REVIEW, 1
NOT_ALLOWED (MeitY, confirmed 403 block).

The 7 highest-value, cleanly-compliant sources, and why:

| Source | Why chosen | Adapter |
|---|---|---|
| MyGov.in | Working RSS, explicit crawl-delay, `INDIA_ONLY` by its own eligibility language | RSS |
| Atal Innovation Mission | Real named programs verified live, `INDIA_ONLY` (NITI Aayog) | STATIC_PAGE (`pages`) |
| Smart India Hackathon | Flagship national hackathon, `INDIA_ONLY`, permissive robots.txt | STATIC_PAGE (`pages`) |
| Unstop | Largest yield potential — explicitly allowlists Claude-Web/anthropic-ai in robots.txt, live sitemap, real current listings across many opportunity types | STATIC_PAGE (`listingPages`) |
| Devfolio | Permissive robots.txt, no scraping clause found, real current hackathons | STATIC_PAGE (`listingPages`) |
| HackerEarth | Permissive robots.txt/ToS on paper — see "what happened" below | STATIC_PAGE (`listingPages`) |
| MLH | Permissive robots.txt, confirmed genuine India+global mixed listing (proof the "no source-level geographic default" rule matters) | STATIC_PAGE (`listingPages`) |

9 sources were deliberately **not** implemented despite research: MeitY (confirmed blocked),
and 6 UNCLEAR_REQUIRES_REVIEW sources (Startup India, AICTE, DST's INSPIRE portal, TCS
CodeVita, Infosys Springboard, E-Cell IIT Bombay) where compliance couldn't be conclusively
resolved this pass — listed as follow-up items #17-22 in `docs/source-compliance.md`, not
silently dropped.

## What was built

- **`Opportunity.geographicScope` / `geographicDetail`** (schema addition,
  `docs/geographic-model.md`) — the `INDIA_ONLY`/`GLOBAL`/`REGION_SPECIFIC`/
  `COUNTRY_SPECIFIC`/`REMOTE_GLOBAL`/`LOCATION_UNKNOWN` model requested, populated only from
  explicit source evidence (a source-level config default for sources scoped by construction,
  e.g. a government-of-India-only source, or a per-item adapter override) — never inferred
  from the organization or from a platform's general reputation.
- **`lib/ingestion/adapters/static-page.ts` extended with `listingPages`** — the adapter
  previously only handled one hand-picked page per opportunity; most of this batch's highest-
  yield sources (Unstop, Devfolio, MLH) are listing/index pages hosting dozens of independent
  real opportunities. The new mode discovers links via a CSS selector, dedupes, caps at a
  configured `itemLimit` (kept deliberately small — 10-12 per source — matching "curated, not
  maximum volume"), and fetches+extracts each discovered page the same way as a hand-picked one.
- **7 new sources, seeded and run live.**

## Live results (2026-09-03)

| Source | Found | Stored | Notes |
|---|---|---|---|
| MyGov.in | 10 | 9 | RSS, `INDIA_ONLY` |
| Atal Innovation Mission | 2 | 2 | `INDIA_ONLY`; a 3rd real AIM program (Tinkerpreneur 2026) was deliberately excluded — its real link points to a third-party domain (`aistudent.community`) never compliance-reviewed |
| Smart India Hackathon | 1 | 1 | `INDIA_ONLY` |
| Unstop | 12 | 12 | `LOCATION_UNKNOWN` (mixed platform, no default) |
| Devfolio | 10 | 10 | `LOCATION_UNKNOWN` |
| HackerEarth | 0 | 0 | **Blocked — see below** |
| MLH | 10 | 10 | `LOCATION_UNKNOWN`; confirmed genuine India+global mix (HackNex/Innohacks/hackCBS alongside US/Canada events) |
| **Total new** | | **44** | |

**Database now: 82 opportunities** (was 38). Gap to the 150 minimum: 68 remaining.

### Problem found live: HackerEarth blocked by bot-fingerprint detection

A real automated run (headless Chromium via `playwright-core`) of `hackerearth.com/challenges/`
returned **HTTP 403 Forbidden** — the same page had rendered normally during compliance
research using an interactive browser session. This is consistent with detection specifically
targeting automated/headless clients, distinct from the robots.txt/ToS policy question that
was already cleared. **No workaround was attempted** — no stealth plugin, no fingerprint
spoofing — per the standing anti-circumvention rule. The source has been deactivated
(`isActive: false`) and its compliance record flagged `reviewRequired: true`, exactly the same
pattern as the HigherEdJobs/Incapsula finding from the corporate batch. This is the compliance
framework working as designed, not a bug to route around.

### Bug found and fixed: E2E test locator ambiguity

Real ingested descriptions from Unstop occasionally begin with the literal word "Overview"
(scraped page structure, not a Polaris UI element) — once more than one such opportunity
existed in the catalog, `tests/e2e/critical-journey.spec.ts`'s `page.getByText("Overview")`
became ambiguous (matched both the app's own `<h2>Overview</h2>` section heading and an
unrelated card's truncated description text). Fixed by scoping the assertion to
`getByRole("heading", { name: "Overview" })`, which only matches real heading elements — a
test-specificity fix, not a UI change.

## What this does and doesn't achieve yet

**Achieves**: real evidence the `listingPages` capability scales cleanly across three
different real platforms (Unstop, Devfolio, MLH) with three different site architectures
(Angular SPA, Next.js-style subdomains, static-ish event grid), all through config, no new
adapter code per platform. Confirms the geographic model correctly refuses to guess — 32 of
the 44 new opportunities are honestly `LOCATION_UNKNOWN` because their source is a mixed
platform, not because the feature doesn't work.

**Doesn't yet achieve**: the 150-300 target (82/150 minimum) or meaningful type/domain
diversity for the newly-added items — like the corporate batch, these 44 new opportunities
have title/organization/URL but largely lack deadline/eligibility/domain classification
without either an AI key or per-source selector tuning (Unstop's `.un_editor_text_live`
selector was tuned and did surface a couple of real deadlines; the other sources use generic
fallback extraction).

## Recommended next steps (not started)

1. Resolve the 6 UNCLEAR_REQUIRES_REVIEW sources (`docs/source-compliance.md` follow-ups
   #17-22) — Startup India and DST's INSPIRE portal in particular are high-value if their TLS
   fetch issues turn out to be transient.
2. Hand-tune `fieldMap` selectors per remaining source (matching what was done for Unstop) to
   improve description/deadline quality.
3. A future, carefully-scoped pass to extract genuine per-item geography from MLH's listing
   text (city/state strings are present in the source's own displayed content) and similar
   signals on Unstop/Devfolio's individual pages — evidence-based, not inferred.
4. Re-run `scripts/analyze-demo-coverage.ts` periodically as more sources land to track
   progress toward the 150-300 target and the diversity distribution.
