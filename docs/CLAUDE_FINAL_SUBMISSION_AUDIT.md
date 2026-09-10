# Polaris — Final Submission Audit (Claude)

Written 2026-09-10. This audit re-verified the actual repository and live deployment state
directly — nothing below is copied from an earlier report without re-checking. One prior tool
(Google Antigravity) had made a single commit (`83c908d`, "Initial submission") before this
audit began; its changes were inspected as part of this pass (see §1).

## 1. Executive summary

The application is in a genuinely working, tested, deployed state. This audit found and fixed
one real correctness gap (an unimplemented `sort` parameter that was silently accepted and
ignored) and investigated one cosmetic, non-blocking hydration console warning on the Explore
map (root-caused, confirmed functionally harmless, documented rather than risk a wide,
unnecessary code change to suppress it). Everything else — recommendation engine, ingestion,
security, Gemini integration, Cloud infrastructure — was re-verified against the live system
and matches what prior passes reported. **Antigravity's only change found was adding
`README.md`** (reviewed, one factual inaccuracy about "jobs" fixed) and committing the
repository; no application code, tests, or architecture were altered by it.

## 2. Actual current architecture (re-verified)

Next.js 16 (App Router, Turbopack) + TypeScript + Prisma 6 + PostgreSQL (Cloud SQL) + NextAuth
v5 + Gemini 2.5 Flash via Vertex AI. Deterministic hard-eligibility gate
(`lib/matching/eligibility.ts`) + weighted scoring (`lib/matching/scoring.ts`) — Gemini
classifies/interprets, never decides eligibility or ranking. Compliance-first ingestion
(`SOURCE → COMPLIANCE CHECK → FETCH → EXTRACT → NORMALIZE → VALIDATE → DEDUPLICATE → AI ENRICH
→ STORE → INDEX`). Full detail: `docs/architecture.md`, `docs/ANTIGRAVITY_HANDOFF.md`.

## 3. Test results (this session, re-run from a clean state)

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npx vitest run` | ✅ **206/206** (21 files), run in true isolation to avoid the known shared-test-DB contention pattern |
| `npx playwright test` | ✅ **4/4** |
| `npm run build` | ✅ clean, all routes compiled including `/api/internal/freshness`, `/explore`, `/api/opportunities/geo` |

## 4. Production/live verification

Live URL: `https://polaris-ka4pyersra-uc.a.run.app` — confirmed reachable and healthy.

- Homepage, signup, login, search, explore: all `200`.
- Signup: `201` on first attempt, `409 EMAIL_TAKEN` on duplicate (correct).
- `GET /api/opportunities`: returns real data (`total: 42`).
- Admin/profile/ingestion-trigger endpoints: all `401` without auth (verified live, not assumed).
- Rhodes → `SCHOLARSHIP`, Reliance Foundation → "Reliance Foundation Scholarships 2026-27" /
  `SCHOLARSHIP`, Mastercard Foundation → `SCHOLARSHIP` — all reconfirmed live via
  `/api/search` on this pass.
- Geo/map API returns real aggregated country data.
- **Browser-level check found a real issue** on `/explore`: a hydration console warning
  (React error #418). Investigated properly (see §11) rather than dismissed — root-caused to
  d3-geo projection float differences for antimeridian-crossing geometry (Fiji), confirmed
  the map renders correctly regardless (React auto-recovers, confirmed via screenshot showing
  correct bubble data), and left undisturbed rather than force a fix that would touch a
  177-country render loop for a cosmetic, non-functional warning.

## 5. Recommendation engine audit

Re-read `lib/matching/eligibility.ts` and `lib/matching/scoring.ts` line by line this pass to
confirm claims rather than trust prior notes:

- Hard eligibility runs and fully excludes before scoring — confirmed by code structure
  (`checkEligibility` returns `{eligible, reasons}`, callers gate on it before scoring runs).
- Education stage: word-boundary matching (`hasWordMatch`), not substring — confirmed fixed.
- Experience: range-aware parser (`parseExperienceRequirement`) handles "0-3 years", "2+
  years", "3-5 years", "less than N years", "no experience required" — confirmed via its own
  regression tests.
- Domain-aware experience check: only gates when the profile has an actual signal to compare,
  never on total absence of data — confirmed in code and by its dedicated test
  ("does not gate a domain-specific requirement when the profile has no domain signal at all").
- Citizenship, gender (`GENDER_REQUIRED` only, never `GENDER_PREFERRED`), age, geography
  (`INDIA_ONLY`/`COUNTRY_SPECIFIC` gate; `REGION_SPECIFIC`/`GLOBAL`/`REMOTE_GLOBAL` don't) —
  all present, all with dedicated tests.
- Deadline freshness: `checkEligibility` now checks the actual `deadline` Date directly
  (`opportunity.deadline.getTime() < Date.now()`), not only the `status` field — confirmed
  fixed, confirmed tested (expired, today, future, null-deadline cases all covered).
- Academic interests, skills, technologies, preferred countries: all read by
  `scoring.ts`'s `interestScore`/`skillsScore`/`preferenceScore` — confirmed by reading the
  functions, not assumed from field existence.
- `goalTags`, `timeCommitment`, `school`/`degree`/`fieldOfStudy`, `currentRole`/`industry`:
  confirmed still collected but not scored — documented honestly in `docs/personalization.md`,
  not silently ignored without acknowledgment.

**Evaluation re-run this pass** (`npm run eval:baseline`, fresh, not cached):

| Persona | Eligibility accuracy | Recall@10 | NDCG@10 | P@5 | P@10 |
|---|---|---|---|---|---|
| A — Aisha | 100.0% | 1.00 | 0.917 | 0.60 | 0.30 |
| B — Ben | 100.0% | 1.00 | 0.992 | 0.40 | 0.20 |
| C — Chidi | 100.0% | 1.00 | 0.964 | 0.60 | 0.30 |
| D — Diana | 95.2% | 1.00 | 0.707 | 0.60 | 0.30 |

Full methodology, before/after comparison, and every found-and-fixed bug's evidence:
`docs/recommendation-baseline.md`. Not hardcoded to pass — the fixtures
(`tests/evaluation/catalog.ts`, `personas.ts`) predate the fixes and the ground-truth labels
were written before the fixes existed.

## 6. Ingestion/compliance audit

- SSRF guard (`lib/ingestion/url-safety.ts`) confirmed wired into all three fetching adapters
  (RSS, JSON API, STATIC_PAGE) — blocks non-http(s) schemes, localhost, RFC1918 ranges,
  link-local (covers the cloud metadata endpoint).
- Compliance gate (`lib/ingestion/compliance.ts`) runs before any adapter fetch — structural,
  not optional; confirmed by reading `runIngestion()`'s call order.
- No arbitrary URL ingestion: sources only ever come from the `Source.url`/`config` fields,
  admin-authored and compliance-gated, never from a request body.
- Deduplication: confidence-banded matching (`lib/ingestion/dedupe.ts`) — HIGH_CONFIDENCE
  merges in place, POSSIBLE_DUPLICATE creates a flagged row for review, never a silent merge
  of distinct records.
- Generic-page protection: `lib/ingestion/adapters/static-page.ts`'s title extraction skips
  known-generic titles ("About Us", "Home", etc.) and falls through to real content — added
  this pass's earlier work, re-verified present and tested (2 dedicated tests).
- Data-quality gate: discovery (feed/search/map) excludes `opportunityType = COURSE AND
  verificationStatus = NEEDS_REVIEW` — the specific combination where the pipeline's
  extraction-failure fallback produced bad records. **Re-scanned the full live catalog this
  pass** for generic titles, malformed titles, missing/invalid application URLs, and exact
  duplicate titles across all 71 real active opportunities: **0 flagged**.
- `docs/source-compliance.md`: every source researched via live robots.txt/ToS fetch, with
  explicit `NOT_ALLOWED`/`UNCLEAR_REQUIRES_REVIEW` records kept for the audit trail rather
  than silently dropped.

## 7. Gemini audit

Confirmed by reading `lib/ai/provider.ts`, `lib/ai/extraction.ts`, `lib/ai/query-parser.ts`:

- Every call is `generateStructured()` — a single-shot, schema-validated (`zod`) JSON request.
  No function/tool definitions are ever passed to the model.
- Ingestion-time use: opportunity classification, gender/geographic/deadline-type
  interpretation, summarization.
- Request-time use: natural-language search query parsing only (`parseSearchQuery`) — one call
  per search request, never once per opportunity.
- Confirmed **not** called per-opportunity-per-feed-request: `generateFeed()`
  (`lib/matching/feed.ts`) does zero AI calls — pure deterministic scoring over already-stored
  structured fields.
- Graceful degradation: `isAiAvailable()` gates every call; ingestion falls back to
  `NEEDS_REVIEW` rather than fabricating a classification when AI is unavailable.

## 8. Google Cloud audit

| Service | Status |
|---|---|
| Cloud Run | ✅ Live, verified this pass |
| Cloud SQL | ✅ Live, verified (real query results throughout this audit) |
| Secret Manager | ✅ `polaris-database-url`, `polaris-auth-secret`, `polaris-scheduler-secret` |
| Artifact Registry | ✅ Images `v1`-`v8` present |
| Cloud Build | ⚠️ Build/push steps work; `gcloud run deploy` step has a pre-existing IAM/mirror permission issue unrelated to this app's code — documented, worked around via direct Cloud Run REST deploy (`docs/ANTIGRAVITY_HANDOFF.md §9`) |
| Cloud Scheduler | ✅ `polaris-freshness-sweep` job live, daily 03:00 UTC; endpoint independently curl-verified against production this pass and the prior pass |
| Gemini/Vertex AI | ✅ Live |
| Google ADK / Agent Runtime | ❌ **Not implemented — by deliberate, documented decision** (`docs/agent-architecture.md`). The existing query-parser → deterministic-search pipeline satisfies the behavioral requirement (intent interpretation → controlled, schema-validated retrieval → grounded response, no arbitrary tool access) without the actual ADK package. Verified this is not silently faked: no code references any ADK/agent-runtime package; `package.json` has no such dependency. |
| BigQuery | ❌ Not implemented — no analytics use case identified that justified adding it |
| Cloud Storage | ❌ Not implemented — no file-upload or raw-archival feature exists in the product |

## 9. Security audit

Re-verified live this pass (not just re-reading `docs/security-audit.md`):
- `GET /api/admin/opportunities`, `GET /api/profile`, `POST /api/admin/sources/x/run`: all
  `401` without auth, tested directly against production.
- No SQL injection surface: all queries go through Prisma's parameterized query builder except
  `lib/search/fts.ts`'s full-text search, which uses positional parameters (`$1`, `$2`), not
  string interpolation — confirmed by reading the actual query strings.
- No secrets in tracked source: grepped for Google API key (`AIza...`) and OAuth token
  (`ya29....`) patterns across all `.ts/.tsx/.yaml/.json/.md` files — zero matches.
  `cloudbuild.yaml` references Secret Manager secret *names* only.
- Rate limiting: real (`lib/rate-limit.ts`), applied to signup and AI-backed search — but
  in-process memory, doesn't survive multi-instance scaling or cold starts. **Assessed as not
  a submission blocker**: current deployment is `max-instances=3` with low traffic; documented
  honestly as a scaling limitation, not hidden, not risky to leave as-is for submission.
- Ingestion/agent security: no tool-calling agent exists (see §8), so there's no unrestricted
  SQL/shell/filesystem/URL-fetch surface to audit there — confirmed by absence, not asserted.

## 10. Search audit

- Keyword search (Postgres FTS), structured filters, natural-language parsing (Gemini →
  structured filters → deterministic retrieval): all confirmed working via direct API calls
  against production this pass (`/api/search?q=fully+funded+scholarships+for+indian+students`
  returned 25 real, relevant results).
- **Found and fixed this pass**: `sort=match` and `sort=popular` were accepted by API
  validation (`lib/validation/opportunity.ts`) but had zero underlying implementation —
  `lib/search/index.ts`'s actual sort logic only ever branches on `"deadline"`, with every
  other value (including `"match"`/`"popular"`) silently falling through to `recent` ordering.
  No UI control ever sent these values (confirmed by grep — `app/search/page.tsx` has no sort
  selector at all), so **no real user was ever affected**, but the API silently accepted and
  ignored an unimplemented parameter rather than rejecting it. Fixed by narrowing the accepted
  enum to `["deadline", "recent"]` — the two values that are actually implemented — so an
  unsupported value now gets a clear `400 VALIDATION_ERROR` instead of silent wrong behavior.
  Zero regression risk: no caller (tested or live) ever sent the removed values.

## 11. UI/responsive audit

- Preserved the existing visual language entirely — no redesign, no new screens, per explicit
  instruction across every pass this project.
- Real mobile-overflow bug found and fixed earlier this project (the opportunity detail page's
  "Original link" box forced 150px of horizontal scroll on a 375px viewport from an unbroken
  long URL) — re-verified fixed this pass (0 overflowing elements at 375px, 768px).
- **Investigated, not fixed**: `/explore` page's hydration console warning (React error #418).
  Root cause: `d3-geo`'s `geoNaturalEarth1` projection produces trivially different
  floating-point path/bounds output between Node's SSR pass and the browser's V8 for
  antimeridian-crossing country geometry (Fiji reproduces it reliably; this is a documented
  class of issue for SSR'd map-projection libraries, not unique to this codebase). Confirmed
  via Next's dev-mode error overlay (`components/explore/world-map.tsx:122`). **Confirmed
  functionally harmless**: the map renders correctly with accurate data after React's
  automatic recovery (screenshotted, bubble sizes/positions correct). Attempted a
  `suppressHydrationWarning` fix on the `<svg>` root; it did not fully suppress the warning
  (the mismatch is deeper, inside the per-country `<path>`/`<title>` loop), and applying it to
  every one of 177 per-country elements would be a larger, riskier change than this cosmetic,
  auto-recovering console warning justifies in a final audit pass — reverted the incomplete
  fix rather than ship a partial one. **Classified P2** (documented, not blocking).

## 12. Data quality audit

- 71 real opportunities, 42 currently visible in discovery, 11 demo/seed fully isolated
  (0 leaked into search/feed/map, re-verified this pass).
- 29 active compliant sources of 37 registered.
- Full-catalog scan this pass (title generic-ness, malformed concatenation, missing/invalid
  URLs, exact-title duplicates): **0 flagged records**.
- Rhodes/Mastercard Foundation/Reliance Foundation: all confirmed correctly classified live.

## 13. GitHub readiness

- One commit exists (`83c908d`, by Antigravity) — clean tree, no pending changes before this
  audit's edits.
- No `.env`/credentials/service-account files tracked (`git ls-files` grepped clean).
- `.env.example` contains only placeholders (reviewed in full).
- `README.md` exists (added by Antigravity), reviewed for accuracy — **one inaccuracy found
  and fixed**: the pitch line mentioned "jobs" as something Polaris discovers, contradicting
  the product's own explicit "Job is not a user-facing opportunity type" rule. Corrected.
- No remote configured yet — pushing to GitHub is a user action, not performed here per
  instruction not to publish anything externally.

## 14. Submission readiness

The four-part submission package (per your instructions) is prepared as content
recommendations only — nothing external was created or published:

**1. Google Doc** should include: Project title ("Polaris — AI-Powered Opportunity Discovery
Engine"), Description (pull from README's "What it does" section — already accurate), Use
Case (a student/early-career professional spends hours across scattered scholarship/fellowship
sites; Polaris aggregates compliantly, personalizes, and explains matches), Architecture
Diagram (see §16 below for the exact recommended diagram).

**2. GitHub repository**: ready as-is once you push — see §13.

**3. Demo video**: see §18 for the recommended flow.

**4. Medium blog**: could cover the compliance-first ingestion design and the recommendation
engine correctness work (the 85%→95-100% eligibility accuracy improvement is a genuinely
interesting, concrete story with real before/after numbers — `docs/recommendation-baseline.md`
has the full data if you want to write from it).

## 15. Remaining items

| # | Item | Priority |
|---|---|---|
| 1 | Explore map's hydration console warning (cosmetic, auto-recovers, functionally harmless) | P2 |
| 2 | Rate limiting is in-process memory, won't survive multi-instance scaling | P2 |
| 3 | `generateFeed()`'s in-memory scoring won't scale past ~thousands of rows (documented fix path exists) | P2 |
| 4 | Login isn't rate-limited (only signup/search are) | P2 |
| 5 | Confirm the Cloud Scheduler job's first automatic 03:00 UTC run shows a populated `lastAttemptTime` (endpoint independently proven correct; the manual `:run` trigger's API response was ambiguous) | P2 |
| 6 | `/concepts/*` prototype pages still exist in the build (internal design exploration, not linked from nav, not misleading, but unnecessary surface area) | P3 |

No P0 items found. No P1 items remain unfixed — the one found this pass (`sort` parameter)
was fixed and verified.

## 16. Recommended architecture diagram content

A single-page diagram with three horizontal layers:

1. **Client** → Next.js App Router (pages: feed, search, explore, opportunity detail, tracker,
   profile, onboarding, admin) — Cloud Run.
2. **Application layer** → API routes → `lib/matching/` (deterministic eligibility + scoring),
   `lib/search/` (FTS + embeddings), `lib/ingestion/` (compliance-gated adapters), `lib/ai/`
   (Gemini via Vertex AI, schema-validated structured output only).
3. **Data + Cloud** → Cloud SQL (Postgres), Secret Manager, Cloud Scheduler (daily freshness
   sweep) → Cloud Build/Artifact Registry (image pipeline).

Arrows worth showing explicitly: Gemini → structured JSON → deterministic engine (never
Gemini → decision directly) — this is the single most important architectural claim to make
visually clear, since it's the crux of "deterministic eligibility is the final authority."

## 17. Demo flow recommendation

1. Land on homepage → sign up → onboarding (show academic interests / skills-vs-technologies
   as two distinct fields / preferred countries as real tags, not a CSV box).
2. Land on personalized feed → point out a match score + "why this matches you" with specific,
   evidence-based reasons (not generic AI text).
3. Open an opportunity detail page → point out the "Official source content" badge vs. the
   "AI generated summary" badge — the AI-transparency distinction.
4. Natural-language search: type "fully funded scholarships for Indian students" → show real
   results.
5. Explore map → click India → show the real opportunity list for that country.
6. Save → Interested → Applied on an opportunity → jump to Tracker → show it's synchronized.
7. Close with the number: eligibility accuracy went from ~86% to 95-100% after finding and
   fixing four real bugs — this is a genuine engineering story, not a vanity metric.

## 18. Final verdict

**READY TO SUBMIT.** All P0 and P1 items found during this audit were fixed and verified.
Remaining items are P2/P3 — non-blocking improvements, documented honestly above, not hidden.

## 19. Deployment record for this audit pass

Image `v8` deployed via the documented Cloud Run REST-patch workaround (§8's Cloud Build note).
Live-verified post-deploy:
- Homepage `200`, `/api/opportunities` returns real data (`total: 42`)
- `sort=popular` (the removed, previously-silent-no-op value) now correctly returns
  `400 VALIDATION_ERROR` instead of silently ignoring the parameter
- `sort=recent` still `200` (unaffected, still works)
- `/api/admin/opportunities` still `401` without auth (unaffected)

No regressions found post-deploy.
