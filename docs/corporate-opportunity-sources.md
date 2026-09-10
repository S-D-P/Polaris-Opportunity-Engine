# Polaris — Corporate Opportunity Sources

Research and planning document for the corporate/non-job opportunity expansion. This is a
**research and planning deliverable, not an implementation** — no adapters have been built or
run against any source in this document. Detailed per-source compliance records (robots.txt
quotes, ToS quotes, rate limits) live in `docs/source-compliance.md`'s "Corporate Opportunity
Sources (Batch 2)" section; this document focuses on prioritization, the implementation gap,
and the sequencing recommendation.

**Scope reminder, carried over from the request that produced this document**: Polaris wants
non-job corporate opportunities — learning programs, technical academies, workshops,
mentorship, fellowships, structured internship *programs* (not open job reqs), research
programs, hackathons, competitions, innovation challenges, leadership programs, conferences,
developer/student programs, grants, awards, professional development, and speaker/mentor/
judge calls-for-participation. Ordinary job postings and generic careers/recruiting pages are
explicitly out of scope, even from an otherwise-compliant source.

---

## Step 1 — Audit of the current ingestion system

Before researching new sources, here's what the pipeline can and can't do today
(full detail in `docs/ingestion-roadmap.md`'s Implementation status section):

- **Adapters that exist**: `RSS` (reuses `rss-parser`, real and working — NSF.gov is live
  production evidence), `JSON_API` (generic, config-driven, dot-path field mapping — built for
  USAJobs.gov/Grants.gov), `MANUAL` (curated JSON, used for demo/seed data).
- **Adapter that does NOT exist yet, and matters a lot for this expansion**: there is no
  adapter for "a single static/rendered HTML page with no feed and no API" — which, per the
  research below, is what the overwhelming majority of corporate program pages actually are.
  RSS and JSON_API cover almost none of the Tier A/B corporate sources found. **This is the
  single most important engineering gap this document surfaces** — see Step 6.
- **Compliance gate**: wired in front of every source (`lib/ingestion/compliance.ts`),
  fail-closed on a missing/`NOT_ALLOWED`/unreviewed `UNCLEAR_REQUIRES_REVIEW` record. Extends
  cleanly to corporate sources with zero changes needed — it doesn't care what the adapter
  type is, only the linked `SourceComplianceRecord`.
- **Dedup**: confidence-banded (`lib/ingestion/dedupe.ts`) — canonical-URL exact match, org+
  title+deadline agreement, or a blended title/org-name/semantic-similarity score. Relevant
  here because corporate programs recur annually with a new URL/deadline each cycle (see Step
  9's recurring-program notes) — the existing bands should handle "same program, new cycle"
  as `NOT_DUPLICATE` correctly, since deadline and often the URL differ.
- **Freshness/lifecycle**: `lib/ingestion/freshness.ts` — `EXPIRED` inference and re-fetch
  reopening. Directly useful for corporate programs, which close and reopen annually more
  predictably than most sources already in the system.
- **What's currently in the database**: 6 sources — 2 demo (`MANUAL`, `NASA News` RSS demo), 1
  live real source (NSF.gov, 15 opportunities), 1 deactivated-on-discovery (HigherEdJobs,
  anti-bot block), 2 registered-but-inactive pending API keys (USAJobs.gov, Grants.gov). Zero
  corporate sources currently exist.

---

## Step 2/3 — Corporate source research (32 organizations investigated)

Full methodology: live `robots.txt`/ToS/RSS/sitemap fetches per organization (not inferred
from memory), performed by parallel research passes across 5 groups covering the requested
Cloud/Technology, AI/Developer, Consulting, and Finance/Business candidates. Every entry below
links to its full compliance record in `docs/source-compliance.md`.

### Step 5 — Summary table

| Organization | Program ecosystem | Opportunity types | Official URL | API/RSS/Sitemap | Compliance | Recommended adapter | Priority |
|---|---|---|---|---|---|---|---|
| Hugging Face | Community hackathons, blog-announced programs | Hackathon/competition | huggingface.co/blog, org hackathon pages | RSS ✓, sitemap ✓ | ALLOWED | rss | **High** |
| IBM | SkillsBuild | Learning program, credentials | skillsbuild.org | None found | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | **High** |
| JPMorganChase | Programs directory | Structured internship/early-career program | jpmorganchase.com/careers/explore-opportunities/programs | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | **High** |
| BCG | RISE by BCG, country case competitions | Technical academy, case competition | rise.bcg.com, careers.bcg.com | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | **High** |
| EY | EY-Parthenon NextGen Women | Case competition | ey.com/en_gl/careers/nextgen-women | Sitemap ✓ (168 regional) | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium |
| Google DeepMind | Student Researcher Program | Research internship | deepmind.google/student-researcher-program | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium |
| GitHub | GitHub Education | Student/developer program | github.com/education | RSS ✓ (blog only) | ALLOWED_WITH_RESTRICTIONS | rss (discovery) + sitemap_static_html (new) | Medium — resolve ToS D.9 first |
| Google | Google Summer of Code, developer community | Mentorship, community/leadership program | summerofcode.withgoogle.com, developers.google.com/community | RSS ✓ (blog), sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | rss (discovery) + sitemap_static_html (new) | Medium |
| Deloitte | Case competition, student careers | Case competition | deloitte.com/us/en/careers/join-deloitte/consulting-undergraduate-case-competition.html | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium |
| Accenture | Innovation Challenge, Externship | Case competition, mentorship | accenture.com/us-en/Careers/innovation-challenge-mba | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium |
| SAP | University Alliances | Learning program, academic conference | pages.community.sap.com/topics/university-alliances | RSS ✓ (news only), sitemap unverified | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium |
| Qualcomm | Innovation Fellowship, developer challenge | Research fellowship, competition | qualcomm.com/research/university-relations/innovation-fellowship | Sitemap ✓ | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new) | Medium — confirm ToS text first |
| Microsoft | Microsoft Learn, Research Fellowship (paused) | Learning program | learn.microsoft.com/en-us/training | RSS ✓ (news), no sitemap found | ALLOWED_WITH_RESTRICTIONS | rss (discovery) + manual | Medium — resolve ToS scope first |
| Salesforce | Trailhead | Learning program, certification | trailhead.salesforce.com | RSS ✓ (blog) | ALLOWED_WITH_RESTRICTIONS | rss (discovery); Trailhead itself likely JS-rendered | Low-Medium |
| AWS | AWS Educate, Activate, DeepRacer | Learning program, startup mentorship, competition | aws.amazon.com/education/awseducate | RSS ✓ but under a `Disallow: /blogs/` path — do not use | ALLOWED_WITH_RESTRICTIONS | sitemap_static_html (new), non-disallowed paths only | Low — narrow usable surface |
| Cisco | Networking Academy | Learning program, certification | netacad.com | Sitemap ✓ | UNCLEAR_REQUIRES_REVIEW | none pending review | Needs Review |
| Oracle | Oracle University / MyLearn | Learning program (unconfirmed) | mylearn.oracle.com (unverified) | Unknown — site blocked fetch | UNCLEAR_REQUIRES_REVIEW | none pending review | Needs Review |
| OpenAI | Researcher Access Program, OpenAI Academy | Research grant, learning program | grants.openai.com, academy.openai.com | Sitemap ✓, ToS unread (blocked) | UNCLEAR_REQUIRES_REVIEW | none pending review | Needs Review |
| KPMG | Global Advantage Program, case competitions | Case competition, leadership program | kpmguscareers.com/early-career/program | Unknown | UNCLEAR_REQUIRES_REVIEW | none pending review | Needs Review |
| Visa | Black Scholars and Jobs Program | Scholarship/mentorship | usa.visa.com (press release only) | robots.txt unreadable | UNCLEAR_REQUIRES_REVIEW | none pending review | Needs Review |
| Meta | Meta Research Fellows, RFP grants | Research fellowship, grant | research.facebook.com | None; ClaudeBot named in robots.txt disallow | NOT_ALLOWED | none | Do Not Implement |
| Adobe | Adobe for Students, Community Challenges | Learning program, competition | adobe.com/education.html | Unverified | NOT_ALLOWED | none | Do Not Implement |
| NVIDIA | Deep Learning Institute | Learning program, certification | nvidia.com/en-us/training | RSS ✓ (blog, discovery-only) | NOT_ALLOWED (main site) | none (blog: discovery-only, Tier C) | Do Not Implement |
| Intel | Software Innovator Program | Developer/speaker program | intel.com/.../innovators.html | Sitemap ✓ (moot) | NOT_ALLOWED | none | Do Not Implement |
| Anthropic | Fellows Program, AI for Science Program | Research fellowship, research grant | alignment.anthropic.com, support.claude.com | Sitemap ✓ (moot) | NOT_ALLOWED | none | Do Not Implement |
| PwC | The Challenge case competition | Case competition | pwc.com/us/en/careers/university-relations/challenge-case-study.html | RSS ✓ (press only, moot) | NOT_ALLOWED | none | Do Not Implement |
| McKinsey | Forward | Learning/fellowship program | mckinsey.org (program path itself disallowed) | Sitemap ✓ (moot) | NOT_ALLOWED | none | Do Not Implement |
| Bain | Internships/programs hub, WEF Externship | Structured internship program, externship | bain.com/careers/work-with-us/internships-programs | Sitemap ✓ (moot) | NOT_ALLOWED | none | Do Not Implement |
| Goldman Sachs | Possibilities Series, 10,000 Women | Learning program, mentorship | goldmansachs.com (WAF-blocked) | Unknown (blocked) | NOT_ALLOWED | none | Do Not Implement |
| Morgan Stanley | HBCU Scholars, Fisher/Future Generation Scholarships | Scholarship | Unverified (press only) | Unknown (blocked) | NOT_ALLOWED | none | Do Not Implement |
| Bloomberg | Hack of Knowledge, Journalism Diversity Program | Hackathon, fellowship | Unverified (press only) | RSS ✓ (news only, moot) | NOT_ALLOWED | none | Do Not Implement |
| Mastercard | Girls4Tech | STEM education program | mastercard.com (WAF-blocked) | Unknown (blocked) | NOT_ALLOWED | none | Do Not Implement |

**Corporate compliance yield: 1 ALLOWED, 14 ALLOWED_WITH_RESTRICTIONS, 5 UNCLEAR_REQUIRES_REVIEW,
12 NOT_ALLOWED** (full detail and every robots.txt/ToS citation: `docs/source-compliance.md`).

---

## Corporate source score (Tier framework, as specified)

- **Tier A** — official source + explicit public program + compliant automated access: **Hugging Face only.**
- **Tier B** — official source + compliant but limited extraction (no feed/API, static HTML
  needed): the 13 other `ALLOWED_WITH_RESTRICTIONS` organizations.
- **Tier C** — trusted third-party/discovery-only signal pointing at an official page, not
  itself the record of truth: NVIDIA's blog (relative to the ToS-blocked main site), Cisco
  pending its review.
- **Tier D** — unclear compliance or explicit block, not a candidate for ingestion: all 12
  `NOT_ALLOWED` organizations plus the 5 `UNCLEAR_REQUIRES_REVIEW` ones, until resolved.

A pattern worth internalizing from this batch: **robots.txt permissiveness correlates weakly,
sometimes inversely, with actual permission.** Bain, NVIDIA, PwC, and McKinsey all had
technically-open robots.txt but an explicit, dispositive ToS prohibition. The gate's existing
"read the ToS, don't just check robots.txt" discipline caught all four correctly.

---

## Step 6 — Recommended first wave (do not implement yet — for your review)

The single highest-leverage next step is **building one new adapter type**, not picking
individual sources: a `sitemap_static_html`-style adapter (fetch a specific, already-known
program page or a small set of sitemap-discovered URLs, parse structured fields from the
rendered HTML — title, description, dates — via a config-driven selector map, similar in
spirit to how `JSON_API`'s config-driven field map avoided one-bespoke-adapter-per-API). 13 of
the 14 `ALLOWED_WITH_RESTRICTIONS` corporate sources need exactly this adapter type; none of
them fit `RSS`, `JSON_API`, or `MANUAL` as-is. This is a real engineering decision I'd like
your sign-off on before building it — see the open question below.

**Recommended first 8, once that adapter exists, in priority order:**

1. **Hugging Face** (RSS — no new adapter needed, ready today, Tier A)
2. **IBM SkillsBuild** — cleanest ToS in the batch (affirmatively permits robots.txt-compliant crawling)
3. **JPMorganChase programs directory** — cleanest financial-services result; needs an
   extraction rule excluding the disallowed `/tech-data-product` path and filtering out
   anything that reads as an open job req rather than a program
4. **BCG** (RISE + case competitions) — ToS read directly, no prohibition found
5. **EY** (NextGen Women case competition) — permissive robots.txt, explicit AI-crawler allow-listing
6. **Google DeepMind** (Student Researcher Program) — single well-defined page, high name recognition
7. **Deloitte** (case competition) — clear program/job distinction, permissive robots.txt
8. **Accenture** (Innovation Challenge / Externship) — clear program/job distinction, permissive robots.txt

GitHub, Google (GSoC), Microsoft, SAP, and Qualcomm are one follow-up item away from this list
each (see `docs/source-compliance.md`'s corporate follow-up items #7–#12) — worth resolving
those specific questions before adding them, rather than implementing on an unread ToS.

---

## Step 9 — Recurring programs: proposed design (not implemented)

Corporate programs are the part of the catalog most likely to recur annually (Google Summer
of Code, EY NextGen Women, McKinsey Forward, etc.), so this needs a real answer before volume
grows — but per your instruction not to over-engineer, here's the smallest design that solves
it without a schema migration yet:

- **No new "program family" table for now.** The existing `fingerprint` +
  `duplicateOfId`/`duplicateConfidence` machinery already correctly treats a new cycle as
  `NOT_DUPLICATE` (different deadline, usually a different specific URL), so a 2027 cycle
  won't collide with or overwrite a 2026 record — verified by the P0 #5 dedup work already
  shipped.
- **What's genuinely missing**: nothing currently *groups* "2026 GSoC" and "2027 GSoC" as the
  same program family for a user or admin browsing history — they're just two unrelated-looking
  rows that happen to share an organization and a similar title.
- **Proposed minimal addition, when this becomes a real problem** (i.e., once corporate
  sources are actually producing repeat cycles, not before): a nullable
  `Opportunity.programFamilyId` self-referencing-style string key, populated by a normalized
  hash of `organization + a stable program-name slug` (not the full title, since titles carry
  the year: "GSoC 2026" vs "GSoC 2027") — computed the same deterministic way `fingerprint` is
  today, no AI involved. This lets a future admin view group "all cycles of GSoC" without
  needing a separate `ProgramFamily` model yet. Promote it to a real model only if/when
  cross-cycle features (e.g. "this program historically opens in March") are actually built.
- **Not solving now**: distinguishing "currently open cycle" vs "previous cycle" as a first-class
  concept — the existing `status`/`deadline` fields already answer that implicitly (an EXPIRED
  2026 row vs. an OPEN 2027 row), so a dedicated field would be redundant today.

---

## Organization-level grouping (per your example tree)

The requested `Google → GSoC / Cloud programs / dev programs / ...` structure is a real product
goal but **is not something to build from imagined categories** — per your own instruction,
"the exact programs should come from verified sources." Right now Polaris has verified exactly
one real program per organization in most cases (see the table above); there isn't yet a
second verified Google program, for instance, to justify a grouping UI. The `Source.organization`
field (added in the P0 #2 registry work) already captures this at the source level today —
e.g. every opportunity ingested from the Google DeepMind source will carry
`organization: "Google DeepMind"`. That's sufficient to group by organization in a query today
without any new schema. A dedicated "verified sub-program taxonomy" is worth building once
there are multiple real, ingested programs per organization to group — not before.

---

## Google Cloud alignment — what should move where (not migrated yet)

Per your instruction not to migrate blindly, here's the mapping, not the migration:

- **Cloud Scheduler** — natural fit for per-source cron cadence once corporate sources exist,
  since several (JPMorganChase, BCG, EY) have no published rate limit and should default to a
  conservative daily/weekly cadence rather than being hit repeatedly.
- **Cloud Run** — the ingestion pipeline (`lib/ingestion/pipeline.ts`) is already stateless
  per-invocation (reads Source + compliance record, writes results, no in-memory state across
  runs), so it's Cloud-Run-shaped as-is; no redesign needed to containerize it later.
- **Cloud Storage** — worth adding *specifically for corporate sources*: archiving the raw
  fetched HTML per run (not just the extracted fields) would materially help defend compliance
  decisions later (e.g., "here's exactly what JPMorganChase's page said on the day we ingested
  it") and would help re-parse historical pages if a selector map needs fixing. Not built yet.
- **BigQuery** — not urgent at current volume (tens to low hundreds of rows); worth revisiting
  once the corporate expansion pushes past the 250+ milestone and duplicate/quality analytics
  become a real query workload rather than something a SQLite table handles fine.
- **Gemini / Vertex AI** — flagging an existing architecture divergence, not proposing to fix
  it now: the AI classification step (`lib/ai/extraction.ts`) currently calls the Anthropic SDK
  (`@anthropic-ai/sdk`), not Gemini, and there's no `ANTHROPIC_API_KEY` configured in this
  environment, so extraction has been degrading gracefully to `NEEDS_REVIEW` throughout every
  real ingestion run so far (NSF included). Migrating this to Gemini/Vertex AI is a real,
  separate decision — out of scope for this document, called out so it isn't silently assumed
  solved.
- **Cloud Logging/Monitoring** — `lib/logger.ts`'s existing `logger.warn`/`logger.error` calls
  are already structured (scope + message + metadata object), which maps cleanly onto Cloud
  Logging's structured-log ingestion with no code shape change — just a different transport
  when deployed.

---

## Open question before implementation

Building the `sitemap_static_html` adapter is a bigger lift than the JSON_API adapter was — it
needs an actual HTML-parsing strategy (a DOM parser + a config-driven CSS-selector-style field
map, roughly), and several of the target pages (Trailhead, possibly others) may be
JS-rendered client-side, which a plain fetch-and-parse adapter can't handle at all — that would
need a headless-browser step, which is a meaningfully bigger and slower piece of
infrastructure than anything built so far. **Before I build this adapter and start wiring up
the first-wave sources, I'd like your call on**: (1) confirming the first-8 priority list above
matches what you want built first, and (2) whether JS-rendered pages (Trailhead-style) are in
scope for this wave or should be deferred until a headless-browser adapter is separately
justified.
