# Polaris — Corporate Ingestion Baseline

First real measurement of the corporate opportunity expansion (`docs/corporate-opportunity-sources.md`),
after implementing and running all 9 first-wave sources live against their actual, current
pages on 2026-09-03. This documents what actually happened — including two real problems
discovered by running the system, both fixed before this baseline was taken, not hidden.

## What was built

- **`lib/ingestion/adapters/static-page.ts`** (new) — the adapter type
  `docs/corporate-opportunity-sources.md` identified as the missing piece: fetches one
  explicitly-configured program page per `Source`, extracts title/description via
  `og:title`/`og:description` (preferred, since raw `<title>`/`<meta name=description>` are
  frequently just site-branding boilerplate) falling back to `<h1>`/`<title>`/first-substantial-`<p>`.
  Supports `renderMode: "js"` for client-side-rendered pages (Salesforce Trailhead), using a
  headless Chromium instance (`playwright-core`, already a project dependency via Playwright
  E2E testing) launched and closed per fetch.
- **`lib/ingestion/relevance-filter.ts`** (new) — a deterministic (non-AI) keyword pre-filter,
  built specifically because running Hugging Face's blog RSS live revealed it is ~99% ordinary
  ML tutorial/announcement content, not opportunities (see "Problems found" below). Opt-in via
  `Source.config.requireOpportunityKeywords`.
- **9 new sources wired up and run live**: Hugging Face (RSS), IBM SkillsBuild, JPMorganChase
  Programs Directory, RISE by BCG, EY-Parthenon NextGen Women, Google DeepMind Student
  Researcher Program, Deloitte Consulting Undergraduate Case Competition, Accenture Innovation
  Challenge, Salesforce Trailhead (STATIC_PAGE, all 8 non-Hugging-Face ones).
- **32 corporate compliance records** seeded into the database (`prisma/seed-corporate-compliance.ts`),
  matching `docs/source-compliance.md`'s full research — including the 23 organizations *not*
  implemented, so the compliance register stays complete and queryable even for sources that
  were researched but correctly excluded.

## Problems found by actually running it (and how they were resolved)

1. **Hugging Face's blog RSS is almost entirely non-opportunity content.** First live run
   ingested 711 items from this one feed — machine-learning tutorials, model releases,
   partnership announcements — because the feed itself has no way to distinguish "Student
   Ambassador Program call for applications" from "How to generate text with Transformers."
   This directly violated the product's quality bar. Fixed by building
   `lib/ingestion/relevance-filter.ts` and enabling it for this source; **the re-run stored 4
   items from the same 855-item feed** — the genuine opportunity posts, not the tutorials. One
   likely false positive slipped through ("Building Cost-Efficient Enterprise RAG applications
   with Intel Gaudi 2 and Intel Xeon" — probably a keyword collision, not a real opportunity);
   documented as a known limitation of simple keyword matching rather than silently accepted.
2. **Two of the eight static-page sources failed on the first live run**: Deloitte's
   originally-cited URL 404'd (the real page turned out to be at a different path —
   `docs/source-compliance.md` and `docs/corporate-opportunity-sources.md` corrected to the
   verified URL), and Salesforce Trailhead's headless-browser fetch timed out because
   `waitUntil: "networkidle"` never fires on Trailhead's SPA (it keeps background
   connections open). Fixed by switching to `domcontentloaded` + a fixed settle delay. **Both
   now succeed.**

Both are exactly the kind of finding "run it for real" is supposed to surface — the same
spirit as the HigherEdJobs anti-bot discovery during the P0 #3 work. Fixed at the root rather
than worked around or silently retried.

## Measured results (live run, 2026-09-03)

| Metric | Count |
|---|---|
| Sources run | 9 |
| Sources succeeded | 9/9 |
| Sources failed | 0/9 |
| Total items found (raw, pre-filter) | 863 |
| Items filtered out (relevance pre-filter, Hugging Face only) | ~851 |
| Items stored (accepted as opportunities) | 12 |
| Items updated (re-fetch diff) | 0 (first run) |
| Duplicates detected | 0 (first run — nothing pre-existing to match against) |
| Extraction failures (malformed/rejected) | 0 |
| Compliance-blocked sources | 0 (only ALLOWED/ALLOWED_WITH_RESTRICTIONS sources were wired up, per the fail-closed gate) |

**12 real corporate opportunities now in Polaris**, one from each configured program page plus
4 from the Hugging Face blog:

| Organization | Title | Type source |
|---|---|---|
| Hugging Face | Join the AMD Open Robotics Hackathon | RSS |
| Hugging Face | Announcing the Hugging Face Fellowship Program | RSS |
| Hugging Face | Student Ambassador Program's call for applications is open! | RSS |
| Hugging Face | Building Cost-Efficient Enterprise RAG applications with Intel Gaudi 2 and Intel Xeon *(likely false positive — see above)* | RSS |
| IBM | Unlock your future \| IBM SkillBuild | STATIC_PAGE |
| JPMorganChase | Programs \| JPMorganChase | STATIC_PAGE |
| BCG | Home - RISE by BCG | STATIC_PAGE |
| EY | EY-Parthenon NextGen Women: Future Leaders Competition | STATIC_PAGE |
| Google DeepMind | Student Researcher Program | STATIC_PAGE |
| Deloitte | Consulting undergraduate case competition | STATIC_PAGE |
| Accenture | College Student Internship & Other Student Programs \| Accenture | STATIC_PAGE |
| Salesforce | Skill up for the Agentforce era with Trailhead | STATIC_PAGE (JS-rendered) |

## Field completeness — the honest part

| Field | Present | Notes |
|---|---|---|
| title | 12/12 | Always present (required for storage) |
| organization | 12/12 | Always present |
| applicationUrl / sourceUrl | 12/12 | Always present, always the verified official page |
| deadline | 0/12 | `NOT_STATED` — see below |
| startDate | 0/12 | `NOT_STATED` |
| eligibilitySummary | 0/12 | `NOT_STATED` |
| minimumAge / educationRequirements / experienceRequirements / citizenshipRequirements | 0/12 | `NOT_STATED` |
| funding | 0/12 | `NOT_STATED` |
| verificationStatus | 12/12 `NEEDS_REVIEW` | No `ANTHROPIC_API_KEY` in this environment |

**Two distinct, honest reasons for the zeroes, not one:**

1. **No AI extraction ran** (same known limitation as the NSF ingestion in P0 #3) — every
   structured field beyond title/organization/URL depends on `lib/ai/extraction.ts`, which has
   no API key configured here and degrades every item to `NEEDS_REVIEW` rather than fabricating
   values. This is expected and was already documented; it isn't new.
2. **The static-page adapter's own extraction is shallow by design** — it currently pulls only
   `og:title`/`og:description`-or-fallback, which is often a short marketing tagline (e.g. "Home
   - RISE by BCG," "Unlock your future | IBM SkillBuild") rather than the actual program body
   text that would contain a deadline, eligibility language, or funding details. No per-source
   CSS selectors were hand-tuned in this pass (`Source.config.fieldMap` supports them, but none
   of the 9 sources use it yet) — this was a deliberate scope decision to get the adapter
   working end-to-end across 8 different real sites first, not an oversight to hide. **This is
   the single highest-value next step**: hand-tuning `fieldMap.description` (and possibly a
   `deadlineSelector`) per source would very likely surface real deadline/eligibility text
   already sitting in each page's body, well before any AI key is involved.

## What this baseline does and doesn't prove

**Proves**: the compliance-gated, adapter-driven, config-only-per-source architecture
(no bespoke code per organization) scales cleanly from government RSS/JSON feeds (P0 #3) to
real corporate program pages, including a JS-rendered one — 9/9 sources succeeded with the
same three adapter types plus one new one. The relevance filter correctly separates real
opportunities from a noisy general-content feed without an AI call.

**Doesn't yet prove**: opportunity *quality* at scale. 12 opportunities with only a title and
a URL each is a real, provenance-backed, non-fabricated starting point — exactly what was
asked for — but is far from the 50-100 milestone with genuinely useful (deadline, eligibility,
description) records. Reaching that means either (a) per-source selector tuning as noted
above, or (b) an AI key, or realistically both.

## Recommended next steps (not started)

1. Hand-tune `fieldMap` selectors for the 8 STATIC_PAGE sources by inspecting each page's real
   HTML structure — highest expected quality improvement per unit of effort.
2. Re-run `scripts/generate-corporate-ingestion-baseline.ts` after tuning and compare field
   completeness before/after.
3. Resolve the pending compliance follow-ups (`docs/source-compliance.md` items #7-#16) to
   unlock the next tier of sources (Google GSoC, GitHub Education, Microsoft Learn, SAP, Qualcomm).
4. Consider tightening the Hugging Face relevance keyword list further given the one observed
   false positive, or accept it as a known, documented, low-frequency imperfection.
