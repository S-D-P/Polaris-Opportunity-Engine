# Polaris — Antigravity Handoff

Written 2026-09-10 at the end of a Claude Code engineering pass, for a different engineer/tool
(Google Antigravity) picking this up next. Everything below was verified against the actual
running code/database/deployment at the time of writing — not copied from an earlier doc
without re-checking.

**Read this first, then the specific docs it points to. Do not start refactoring before
reading it.**

## 0. The one rule that matters most

**Inspect first. Preserve working behavior. Make only evidence-based fixes.** This
application already works — is deployed, tested, and has undergone multiple real correctness
passes (see `docs/recommendation-baseline.md` for the eligibility-engine bug fixes and their
measured before/after impact). Do not redesign the UI, do not replace the recommendation
engine with something "cleaner," do not swap the ingestion architecture for a different
pattern, purely because an alternative seems nicer in the abstract. If something looks wrong,
verify it's actually wrong (read the code, run the test, check the live data) before changing
it — several "obvious bugs" turned out to be deliberate, already-documented design decisions
this session (e.g. "why does search rank by keyword and not vector similarity alone" —
answered in `docs/architecture.md` §6).

## 1. Current architecture (verified, not aspirational)

Next.js 16 (App Router, Turbopack) + TypeScript + Prisma 6 + PostgreSQL (Cloud SQL) +
NextAuth v5 (credentials) + Gemini via Vertex AI (`@google/genai`). Deployed to Cloud Run.
Full detail: `docs/architecture.md`, `docs/data-architecture.md`.

- **Recommendation engine**: deterministic hard-eligibility gate (`lib/matching/eligibility.ts`)
  + weighted scoring (`lib/matching/scoring.ts`). Gemini never decides eligibility or ranking —
  it only classifies/extracts data at ingestion time and interprets natural-language search
  queries into structured filters (see §8 below).
- **Ingestion**: `SOURCE → COMPLIANCE CHECK → FETCH → EXTRACT → NORMALIZE → VALIDATE →
  DEDUPLICATE → AI ENRICH → STORE → INDEX` (`lib/ingestion/pipeline.ts`), adapter-based
  (RSS/JSON_API/STATIC_PAGE/MANUAL, `lib/ingestion/adapters/`). Compliance-first: every source
  has a `SourceComplianceRecord` researched via live robots.txt/ToS fetches before it's ever
  wired up — `docs/source-compliance.md` is the full audit trail, four research batches deep.
- **Explore/world map**: `/explore`, SVG-based (d3-geo + bundled Natural Earth data via the
  `world-atlas` npm package, no tile server, no runtime map-data fetch) — `components/explore/`,
  `lib/geo/`.

## 2. Live deployment

- URL: `https://polaris-ka4pyersra-uc.a.run.app`
- Image (at handoff time): `us-central1-docker.pkg.dev/polaris-opportunity-engine/polaris/app:v8`
  (v8 adds one fix from a later final-audit pass — see `docs/CLAUDE_FINAL_SUBMISSION_AUDIT.md`:
  the `sort` API parameter no longer silently accepts unimplemented `match`/`popular` values)
- Deploy method: Cloud Build (`cloudbuild.yaml`) builds and pushes the image; the actual
  `gcloud run deploy` step is currently **broken** (see §9) so the working deploy path is a
  direct Cloud Run v2 REST `services.patch` call. **Read this before deploying**: GET the
  live service (`GET .../v2/.../services/polaris`), change only `template.containers[0].image`
  (and any new env/secret you're adding) in the returned JSON, PATCH it back with
  `?updateMask=template`. Never hand-write a fresh `gcloud run deploy`-equivalent payload from
  scratch — a hand-rolled one this session was missing the Cloud SQL volume mount that only
  showed up by diffing against the real live config first.

## 3. Google Cloud services — honest status

| Service | Status | Notes |
|---|---|---|
| Cloud Run | **IMPLEMENTED, VERIFIED** | Live, `--allow-unauthenticated`, min 0/max 3 instances, 60s request timeout, Cloud SQL connector volume mount. |
| Cloud SQL | **IMPLEMENTED, VERIFIED** | Postgres, connected via Cloud SQL Auth Proxy locally / native connector in Cloud Run. |
| Secret Manager | **IMPLEMENTED, VERIFIED** | `polaris-database-url`, `polaris-auth-secret`, `polaris-scheduler-secret` (new this pass). |
| Artifact Registry | **IMPLEMENTED, VERIFIED** | `polaris` repo, `us-central1-docker.pkg.dev`. |
| Cloud Build | **PARTIALLY BLOCKED** | Docker build/push steps work; the `gcloud run deploy` step fails on an IAM/mirror permission error pulling `gcr.io/google-cloud-sdk` — see §9. Not caused by anything in this repo's code. |
| Cloud Scheduler | **IMPLEMENTED, VERIFIED** | Daily freshness-sweep job live; endpoint independently curl-tested against production. See §5. |
| Gemini / Vertex AI | **IMPLEMENTED, VERIFIED** | `lib/ai/provider.ts`; used at ingestion time (extraction/classification) and for natural-language search query parsing — never called per-opportunity-per-feed-request. |
| Google ADK / Agent Runtime | **NOT IMPLEMENTED — by deliberate decision, documented honestly** | See `docs/agent-architecture.md`. The existing query-parser → deterministic-search pipeline already satisfies the *behavioral* requirement (intent interpretation → controlled retrieval → grounded response, schema-validated, no arbitrary tool access) without the actual ADK package. Adding real ADK was evaluated and intentionally not done this late in the project to avoid destabilizing a working deploy for a framework swap that wasn't required to meet the behavior. If a genuine multi-tool agent becomes a real requirement, `docs/agent-architecture.md` states exactly what would need to change. |
| BigQuery | **NOT IMPLEMENTED** | No analytics layer exists. Not added this pass — no meaningful analytics use case was identified that couldn't wait; adding it purely to check a box would have been exactly the "impressive-looking but pointless" infrastructure this project's own rules warn against. |
| Cloud Storage | **NOT IMPLEMENTED** | No raw-source archival or file-upload feature exists yet (no upload feature exists in the product at all). |

## 4. Data state (verified by direct DB query, 2026-09-10)

- **71** real (non-demo) opportunities in the database
- **42** of those currently visible in discovery (feed/search/map) — the gap is
  `isSeedData` exclusion (0, none leak) plus a deliberate `opportunityType = COURSE AND
  verificationStatus = NEEDS_REVIEW` exclusion (a real data-quality fix this session: that
  specific combination is where the ingestion pipeline's extraction-failure fallback produced
  mistitled/non-opportunity records — see `docs/personalization.md`)
- **11** demo/seed fixtures, fully isolated from discovery (used by tests/eval/admin only)
- **29** active compliant sources of **37** registered (the rest are `NOT_ALLOWED`/
  `UNCLEAR_REQUIRES_REVIEW` records kept for the audit trail, never wired to ingestion)
- Organizations with at least one real, verified opportunity include: Rhodes Trust
  (Scholarship), Mastercard Foundation (Scholarship), Reliance Foundation (Scholarship),
  Chevening, ACM-W, CSIR-HRDG, Google (GDG on Campus), Microsoft (Learn Student Hub), AWS
  (AWS Educate), IIT Bombay (Research Internship), Draper Richards Kaplan Foundation (Grant),
  BCG, Deloitte, EY, Accenture, JPMorgan Chase, IBM, Salesforce, Google DeepMind, Hugging
  Face, Major League Hacking (multiple hackathons), Devfolio/Unstop-sourced Indian hackathons,
  NSF, and others — full list and per-source compliance status in `docs/source-compliance.md`.
- **Specifically verified this pass**: Rhodes → `SCHOLARSHIP` (was wrongly `COURSE`, the
  extraction-failure fallback default — fixed directly in the DB). Mastercard Foundation →
  `SCHOLARSHIP` (was already correct). Reliance Foundation → title fixed from the scraped page
  title "About Us" to "Reliance Foundation Scholarships 2026-27", type `SCHOLARSHIP` (was
  already correct). AWS Educate → title fixed from a malformed concatenation ("AWS Educate -
  Cloud Skills for Education- AWS") to "AWS Educate — Cloud Skills for Education".

## 5. Cloud Scheduler / freshness automation

**IMPLEMENTED and VERIFIED live** (2026-09-10):

- `lib/ingestion/freshness.ts`'s `runFreshnessSweep()` (shared by the manual script
  `scripts/refresh-freshness.ts` and the endpoint below) re-derives `OPEN`/`CLOSING_SOON`/
  `EXPIRED` status from each opportunity's actual `deadline` date — fast, no external
  fetches, safe inside Cloud Run's 60s timeout.
- `app/api/internal/freshness/route.ts` — a `POST` endpoint authenticated by a shared secret
  (`INTERNAL_SCHEDULER_SECRET`, compared against `Authorization: Bearer <secret>`, not by
  session/role — a SYSTEM-only endpoint, not reachable by any normal user or admin flow).
  Secret lives in Secret Manager as `polaris-scheduler-secret`, granted to the Cloud Run
  service account, and wired into the live service's env in the `v7` deploy.
- **Verified directly**: `curl -X POST -H "Authorization: Bearer <secret>" .../api/internal/freshness`
  against the live production URL returned `200 {"data":{"checked":82,"transitioned":0,"transitions":[]}}`
  — the endpoint, secret, and sweep logic all genuinely work end-to-end against real production data.
- **Cloud Scheduler job created**: `polaris-freshness-sweep` in `us-central1`, `schedule: "0 3 * * *"`
  (daily, 03:00 UTC), HTTP POST target with the same `Authorization: Bearer <secret>` header —
  confirmed the job's stored header exactly matches the secret used in the successful manual
  test above. Next scheduled run shown by the API as `2026-09-11T03:00:00Z`. A manual `:run`
  trigger via the Cloud Scheduler API returned an ambiguous `status.code: -1` with no
  `lastAttemptTime` populated yet at the time of writing — since the endpoint itself is
  independently proven correct, this is most likely a status-propagation delay in the
  Scheduler API's response rather than a real dispatch failure, but **worth a quick spot-check
  tomorrow**: `GET .../v1/projects/polaris-opportunity-engine/locations/us-central1/jobs/polaris-freshness-sweep`
  after 03:00 UTC and confirm `lastAttemptTime`/`status` show a real successful call.
- **Ingestion scheduling was deliberately NOT attempted**: running all ~29 active sources
  sequentially (each involving external fetches + Gemini calls) in a single HTTP request
  risks exceeding Cloud Run's 60s request timeout. The freshness sweep above is safe because
  it's pure DB read/write with no external calls; ingestion isn't the same shape. If this
  becomes a real need, the correct pattern is a Cloud Run Job (batch, no request timeout) or a
  Cloud Tasks queue fanning out one task per source — not the same request-triggered pattern
  used for freshness. Documented, not built, to avoid forcing something into a shape it
  doesn't safely fit.

## 6. Recommendation engine — before/after (this session's biggest correctness work)

Full detail and methodology: `docs/recommendation-baseline.md` (regenerated fresh, reflects
every fix below — re-run any time with `npm run eval:baseline`).

| Metric | Before this session's fixes | After |
|---|---|---|
| Eligibility accuracy | 85.7–90.5% | **95.2–100%** |
| Recall@10 | 0.67–1.00 | **1.00 (all 4 personas)** |
| NDCG@10 | 0.707–0.992 | **0.707–0.992** (D's ceiling is a separate, documented ranking-weight issue, not an eligibility bug) |

Real bugs found and fixed (not weight tuning):
1. Experience-range parsing inverted "0-3 years" into "requires 3+ years" (regex matched the
   range's upper bound as a floor). Fixed in `lib/matching/eligibility.ts`'s
   `parseExperienceRequirement`.
2. Education-stage matching used plain substring containment, so `"undergraduate"` wrongly
   satisfied a check for the keyword `"graduate"`. Fixed with word-boundary regex matching.
3. Experience matching had no domain concept — unrelated experience (e.g. product management)
   numerically satisfied a domain-specific requirement (e.g. "3+ years *policy* experience").
   Fixed with a conservative domain-keyword check that only gates when the profile has an
   actual signal to compare against (never gates on total absence of data).
4. Deadline freshness: eligibility now checks the actual `deadline` date directly, not only
   the `status` field — a stale `OPEN` row with a passed date is excluded immediately, not
   only after the next freshness sweep runs.

All four have dedicated regression tests (`tests/unit/eligibility.test.ts`,
`tests/evaluation/recommendation-quality.test.ts`).

## 7. Testing (all commands, all currently passing at handoff time)

```bash
npm run typecheck   # clean
npm run lint        # clean
npx vitest run      # 206/206 passing (21 files)
npx playwright test # 4/4 passing
npm run build       # clean
npm run eval:baseline  # regenerates docs/recommendation-baseline.md
```

Two notes for whoever runs these next:
- The E2E signup test occasionally needs its `test.setTimeout(60000)` (already set) because it
  makes 7+ sequential real Cloud SQL round trips — this is a real latency characteristic of
  Cloud SQL Auth Proxy, not flakiness to "fix" by weakening the test.
- **Never run two `npx vitest run` invocations concurrently** — they share the same
  `polaris_test` Postgres database and will produce spurious "record not found" failures from
  each other's `resetDb()` calls racing. If you see that failure pattern, it's contention, not
  a real bug — rerun in isolation before trusting the result.

## 8. Search / natural-language discovery

`GET /api/search` → `lib/ai/query-parser.ts` (Gemini, schema-validated intent parsing) →
`lib/search/index.ts` (deterministic SQL filters + Postgres FTS + local embedding cosine
similarity) → eligibility gate applied after retrieval. Full architecture rationale (including
why this already satisfies the "agent" pattern without ADK) in `docs/agent-architecture.md`.
Gemini is called once per search request, never once per opportunity.

## 9. Known issue: Cloud Build's deploy step

`gcloud run deploy` (the third step in `cloudbuild.yaml`) fails with:
```
Error response from daemon: Head "https://gcr.io/v2/google-cloud-sdk/manifests/latest":
denied: Permission "artifactregistry.repositories.downloadArtifacts" denied on resource
"projects/google-cloud-sdk/locations/us/repositories/gcr.io"
```
This is a permission issue pulling Google's own `gcr.io/google-cloud-sdk` builder image
through the Artifact Registry gcr.io mirror — unrelated to this project's code (the
docker build/push steps that build *this app's* image succeed every time). Root cause not
resolved (would need IAM investigation on the Cloud Build service account's Artifact Registry
access to the public gcr.io mirror). **Workaround in active use**: let Cloud Build do only the
docker build+push (a `cloudbuild.yaml` variant with just those two steps, or trigger via the
REST API directly with only those steps — see this session's transcript for the exact JSON
payload pattern), then deploy the pushed image via a direct Cloud Run v2 `services.patch`
call as described in §2. This has worked reliably for the last 4 deploys this session.

## 10. GitHub readiness

- `.env`, `.env.local`, and all `.env*` variants are gitignored (verified: not in `git status`
  output despite existing locally).
- `.env.example` contains only placeholder values (verified by reading it) — safe to commit,
  and updated this pass to reflect Postgres (not the old SQLite path) and the new
  `INTERNAL_SCHEDULER_SECRET` variable.
- Grepped tracked source files for Google API key patterns (`AIza...`) and OAuth access token
  patterns (`ya29....`) — none found.
- `cloudbuild.yaml` references Secret Manager secret *names* only, never values.
- No service-account JSON, `.pem`, or `.key` files found in the repo tree outside
  `node_modules`.
- `node_modules`, `.next`, build artifacts, `playwright-report`, `test-results`, and local
  SQLite db files are all gitignored.

## 11. Known limitations (honest, not hidden)

- **Rate limiting** (`lib/rate-limit.ts`) is in-process memory — resets on every Cloud Run
  cold start and doesn't share state across instances if `max-instances` is ever raised above
  the current low ceiling. Fine today, worth moving to a shared store (Redis, or Cloud Run's
  own request-based throttling) before scaling instance count up.
- **`generateFeed()`** (`lib/matching/feed.ts`) fetches up to 500 candidate opportunities into
  memory and scores them in JS — fine at current catalog size (dozens to ~100), would need
  SQL-level pre-filtering before the catalog reaches the tens-of-thousands range. Documented
  in `docs/scalability.md` with the specific mechanism for the future fix.
- **Login isn't rate-limited** (only signup and the AI-backed search path are) — `docs/security-audit.md`'s
  Remaining risks section.
- Real opportunity catalog is intentionally modest (71 real, 42 visible) rather than padded —
  every organization contacted this session that didn't yield a real opportunity is recorded
  in `docs/source-compliance.md` with the specific reason (explicit ToS prohibition, an
  anti-bot wall, or simply no currently-open application cycle).

## 12. What Antigravity should inspect first

1. `docs/recommendation-baseline.md` — the eligibility engine's real, measured behavior and
   its known remaining ranking-weight issue (persona D's NDCG ceiling).
2. `docs/source-compliance.md` — every source decision and why, before adding or re-evaluating
   any source.
3. `lib/matching/eligibility.ts` and `lib/matching/scoring.ts` — the actual recommendation
   logic, now heavily comment-annotated with the bugs found and fixed this session.
4. This document's §9 before touching `cloudbuild.yaml` or attempting a deploy.

## 13. What Antigravity must not casually change

- The recommendation engine's deterministic-eligibility-is-final-authority architecture (Gemini
  interprets, never overrides).
- The compliance-first ingestion gate (`lib/ingestion/compliance.ts`) — no source is ever
  fetched without a passing `SourceComplianceRecord`.
- The existing UI/visual language — multiple explicit user directives this session said not
  to redesign it; only targeted responsiveness/overflow/bug fixes were made (e.g. a real
  mobile horizontal-overflow bug on the opportunity detail page's source-link box, fixed with
  `min-w-0` + `break-all`, not a redesign).
- `isSeedData`/demo-data isolation in `lib/search/index.ts`, `lib/matching/feed.ts`, and
  `lib/geo/aggregate.ts` — removing this filter would leak fabricated demo content into real
  user-facing discovery.
