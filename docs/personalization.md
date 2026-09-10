# Polaris — Personalization Audit

Audit of every onboarding/profile field against whether it actually influences
recommendations (the specific ask: "every collected field should either influence
recommendations or be explicitly documented as informational only — do not collect
personalization data that silently does nothing").

## Fields and what they actually do

| Field | Influences recommendations? | Where |
|---|---|---|
| `academicInterests` | Yes | `lib/matching/scoring.ts` `interestScore` (matched against opportunity categories/fields) |
| `skills` | Yes | `scoring.ts` `skillsScore` (matched against opportunity skills) |
| `technologies` **(new)** | Yes | `scoring.ts` `skillsScore` — matched against the same opportunity `skills` array as `skills`, called out separately in the match explanation so the signal source is visible |
| `interests` (taxonomy chips) | Yes | `scoring.ts` `interestScore` |
| `aspirationsRaw`/`aspirationsSummary` | Yes | `scoring.ts` `goalScore` (embedding cosine similarity against the opportunity) |
| `goalTags` | Not directly scored | Extracted by Gemini from `aspirationsRaw` but not currently read by any scorer — informational/future use. Documented here rather than silently unused. |
| `stage` | Yes | Hard gate in `eligibility.ts` (education requirements) and soft credit in `eligibilitySoftScore` |
| `citizenship` | Yes | Hard gate in `eligibility.ts` (citizenship requirements) and the geography hard gate (India/country-specific opportunities) |
| `gender` **(new)** | Yes | Hard gate in `eligibility.ts` — only enforced for `GENDER_REQUIRED` opportunities, never for `GENDER_PREFERRED` |
| `country` | Yes | Geography hard gate (`eligibility.ts`) for `INDIA_ONLY`/`COUNTRY_SPECIFIC` opportunities |
| `preferredCountries` | Yes | `scoring.ts` `preferenceScore` (soft preference, not a hard gate — distinct from `country`/`citizenship`, which are eligibility signals) — **fixed this pass**: previously only matched against the legacy `Opportunity.countries` array, which is empty for nearly all real-ingested data; now also credits `geographicScope`-classified opportunities (GLOBAL/REMOTE_GLOBAL/INDIA_ONLY), which is what real ingested opportunities actually carry |
| `remoteOk`/`hybridOk`/`inPersonOk` | Yes | `preferenceScore` |
| `paidOnly` | Yes | `preferenceScore` |
| `timeCommitment` | **No** — collected, not read by any scorer | Informational only, documented here rather than silently collected. Candidate for a future `preferenceScore` signal once opportunities reliably carry a comparable structured time-commitment field (most currently don't). |
| `preferredTypes` | Yes | `preferenceScore` |
| `ageRange` | Yes | Hard gate in `eligibility.ts` (min/max age), via the derived `ageYears` |
| `yearsExperience` | Yes | Hard gate in `eligibility.ts` (experience requirements) |
| `school`/`degree`/`fieldOfStudy`/`graduationYear` | **No** — collected, not read by any scorer | Informational/profile-display only. `fieldOfStudy` is a reasonable future candidate for the interest-matching pool but isn't wired in — documented rather than silently unused. |
| `currentRole`/`industry` | **No** — collected, not read by any scorer | Informational/profile-display only. |
| `name` | No (by design) | Display only. |

## What changed this pass

- Added `Profile.technologies` and `Profile.gender` (schema), wired into scoring/eligibility.
- Added `Opportunity.genderEligibility`/`genderRestrictedTo` (structured, alongside the
  existing free-text `genderRequirement`) and wired a hard eligibility gate for
  `GENDER_REQUIRED` only — `GENDER_PREFERRED` ("women encouraged to apply") never excludes,
  per the explicit product rule.
- Fixed the preferred-countries input: the CSV text field derived its own displayed value
  from `list.join(", ")`, which fought the user's own typing on every keystroke (typing a
  comma silently reset the field before the next character could be entered). Replaced with
  `TagInput` (`components/ui/tag-input.tsx`), a real array-backed multi-value input, used for
  `academicInterests`, `skills`, `technologies`, and `preferredCountries`.
- Fixed `preferredCountries` matching to actually affect scoring for real data — see the
  table row above.

## Deadline lifecycle and demo-data isolation (added this pass)

- Added `Opportunity.deadlineType` (`FIXED`/`ROLLING`/`ONGOING`/`NOT_STATED`) so a null
  `deadline` is no longer ambiguous — `FIXED` is derived deterministically whenever a real
  date was parsed; `ROLLING`/`ONGOING` only come from Gemini classifying explicit source
  wording ("rolling basis", "always open"), never guessed from the mere absence of a date.
  `lib/matching/feed.ts`'s `generateFeed()` now sorts the main discovery feed by lifecycle
  tier first (approaching FIXED deadlines soonest-first, then ROLLING/ONGOING, then
  NOT_STATED) and personalized match score second within each tier.
- Also added per-item `geographicScope`/`geographicDetail` classification to the same Gemini
  extraction call (previously this was only ever a source-level default in `Source.config`,
  which is why most real ingested opportunities were stuck at `LOCATION_UNKNOWN` even when
  their own source text stated eligibility). Ran `scripts/backfill-geography.ts` once against
  the existing catalog: reclassified 15 of 54 previously-`LOCATION_UNKNOWN` real opportunities
  from their already-stored description text (11 INDIA_ONLY/COUNTRY_SPECIFIC, 3 REMOTE_GLOBAL,
  1 GLOBAL, 2 REGION_SPECIFIC) — the rest genuinely don't state location eligibility and
  correctly remain `LOCATION_UNKNOWN`. Re-runnable via `npm run backfill:geography`.
- `generateFeed()` and `searchOpportunities()` now both filter `isSeedData: false` — demo/seed
  fixtures (`prisma/seed.ts`) no longer appear in the personalized feed or search results.
  They're untouched everywhere else (admin views, unit tests, the evaluation framework), so
  nothing that depends on them broke; they're just excluded from real user-facing discovery.

## Known remaining gap

`timeCommitment`, `school`/`degree`/`fieldOfStudy`/`graduationYear`, `currentRole`/`industry`,
and `goalTags` are collected but don't influence scoring. Each is explicitly documented above
rather than silently doing nothing. None was wired in this pass because doing so well needs a
comparable, reliably-populated field on the opportunity side first (e.g. most opportunities
don't carry a structured time-commitment field yet) — wiring against a mostly-empty opportunity
field would be a no-op with extra code, not a real improvement.
