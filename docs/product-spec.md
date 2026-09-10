# Polaris — Product Specification

## 1. Vision

> Tell Polaris who you are and where you want to go. Polaris finds opportunities that can
> help you get there.

Polaris discovers, structures, and personalizes opportunities (scholarships, fellowships,
internships, jobs, hackathons, competitions, olympiads, camps, conferences, mentorship,
leadership programs, research programs, executive education, grants, awards, volunteering,
speaking/judging/advisory/board roles) that are scattered across the web. It is a discovery
and personalization layer, not a place opportunities are created — every listing links back
to its authoritative source for the actual application.

## 2. Users

Students (school → undergraduate → graduate → recent grad) and professionals
(early → mid → experienced career). The data model has no student-only fields; `Profile`
covers education *and* professional history simultaneously because a user's stage can be
either or both (e.g. a working professional doing a part-time degree).

## 3. Information architecture / route map

```
/                              Landing page (marketing, unauthenticated)
/signup, /login                Auth
/onboarding                    Multi-step progressive profile builder (post-signup)
/feed                          Personalized opportunity feed (home screen once onboarded)
/search                        Full search + filters (works logged-out too, no personalization)
/opportunities/[id]            Opportunity detail page
/tracker                       Saved / interested / applied / completed board
/profile                       Edit profile (same building blocks as onboarding)
/admin                         Admin dashboard (role=ADMIN only)
  /admin/sources               Manage sources, trigger ingestion, view job history
  /admin/opportunities         Review queue: approve/reject/edit, verification status
  /admin/analytics             Counts: opportunities, sources, users, saves, engagement
/api/...                       Route handlers backing all of the above (see API contracts)
```

`/`, `/search`, `/opportunities/[id]` are usable without an account (discovery is a hook);
personalization (`/feed`, match scores, tracker, save) requires auth.

## 4. Component map (high level)

```
components/
  landing/            Hero, HowItWorks, ExampleOpportunityCard, LandingCTA
  onboarding/          OnboardingWizard, steps: BasicsStep, EducationStep, ProfessionalStep,
                        InterestsStep, AspirationsStep (free text), PreferencesStep
  feed/                FeedList, OpportunityCard, MatchBadge, WhyThisMatches, FeedFilters, EmptyFeedState
  search/              SearchBar (NL input), FilterPanel, SearchResultsList, ActiveFilterChips
  opportunity/         OpportunityHeader, EligibilitySection, WhatYouGetSection,
                        ImportantDatesSection, ApplicationProcessSection, WhoThisIsForSection,
                        WhyPolarisRecommendsSection, SourceProvenance, SaveButton, StatusPicker
  tracker/             TrackerBoard, TrackerColumn (Discovered/Saved/Interested/Applied/Completed),
                        TrackerCardNotes
  admin/               SourceTable, IngestionJobList, OpportunityReviewTable,
                        AIExtractionDiff, AnalyticsCards
  ui/                  Button, Badge, Card, Input, Select, Skeleton, EmptyState, Toast — small
                        design-system primitives, Tailwind-based, no external component kit
```

## 5. Onboarding (progressive, not a form dump)

Six short steps, each independently skippable/resumable (`Profile.onboardingStep` persisted
after every step so a refresh never loses progress):
1. **Basics** — name, location/country, age range, current stage (school / undergrad /
   grad / recent grad / early-career / mid-career / experienced).
2. **Education** — school/university, degree, field of study, graduation year (shown/hidden
   based on stage from step 1).
3. **Professional** — current role, industry, years of experience, skills/technologies
   (tag input).
4. **Interests** — multi-select chip grid (AI/ML, software engineering, data science,
   finance, policy, sustainability, entrepreneurship, leadership, research, design, social
   impact, …), plus free "other".
5. **Aspirations** — one free-text box ("Tell Polaris where you want to go"). Sent to the AI
   extraction pipeline to produce structured `goalTags` + a one-sentence normalized goal
   statement, both stored alongside the raw text (raw text is the source of truth if
   extraction disagrees later).
6. **Preferences** — remote/hybrid/in-person, countries/regions, paid-only toggle,
   time-commitment, opportunity-type checklist.

After step 6, the user lands directly on `/feed` with a populated, explained feed — no dead
end, no "check back later."

## 6. Feed & explanation contract

Every card shows: title, organization, type, location + mode, deadline (relative + absolute,
e.g. "Deadline in 12 days · Oct 18, 2026"), eligibility one-line summary, cost/funding
badge, AI summary (2–3 sentences), match score, 2–4 "why this matches you" bullets, Save,
"View on org site" (opens `source_url`/`application_url` in a new tab). The "why" bullets are
generated exclusively from `lib/matching/scoring.ts` reason strings (§ architecture.md 5) —
the UI layer never invents copy.

## 7. Opportunity detail page sections

Overview → Eligibility → What you get → Important dates → Application process → Who this is
for → Why Polaris recommends it (only when signed in and eligible) → Source (organization
name, original URL, "last checked" date, verification badge: **Verified** /
**AI-extracted** / **Needs review**). The source section is visually distinct and always
present — Polaris never presents itself as the applying destination.

## 8. Tracker

States: `DISCOVERED → SAVED → INTERESTED → APPLIED → COMPLETED`, plus a terminal
`NOT_RELEVANT` that can be reached from any state (rejected/archived). Free-text notes per
tracked item. Board view grouped by state; list view sortable by deadline.

## 9. Data model summary

See `prisma/schema.prisma` for the authoritative schema. Core entities: `User`, `Profile`
(1:1), `Opportunity`, `Source`, `IngestionJob`, `TrackedOpportunity` (join of user↔opportunity
with state/notes/matchScore snapshot), `SearchQueryLog` (for the "popular" filter + future
tuning). `Opportunity` implements every field listed in the product brief (§8 of the original
brief) — id, title, organization, description, short_description, opportunity_type,
categories, fields, skills, target_audience, eligibility (+ min/max age, education/
experience/citizenship requirements as structured sub-fields), location, countries, remote,
hybrid, cost, funding, benefits, deadline, start_date, end_date, application_url, source_url,
source_name, source_type, date_discovered, date_updated, status, verification_status,
embedding, ai_summary, ai_tags, ai_extracted_requirements, plus `isSeedData` provenance flag
(§ Seed data below).

## 10. API contracts (Next.js route handlers, all under `/app/api`)

```
POST   /api/auth/signup                 {email, password, name}
[...]  /api/auth/[...nextauth]          Auth.js handlers (login/logout/session)

GET    /api/profile                     current user's profile
PATCH  /api/profile                     partial update (used by every onboarding step + edit page)

GET    /api/opportunities               list/browse (filters as query params) — no auth required
GET    /api/opportunities/[id]          detail — no auth required
                                         (adds `whyMatches`/`matchScore` when authenticated)

GET    /api/feed                        auth required — personalized, ranked, paginated

GET    /api/search?q=...&...filters     hybrid search (keyword+semantic+filters), auth optional
                                         (adds profile boost when authenticated)

POST   /api/tracker                     {opportunityId, status} create/update tracked item
GET    /api/tracker                     list current user's tracked items (optionally by status)
PATCH  /api/tracker/[id]                {status?, notes?}
DELETE /api/tracker/[id]

GET    /api/admin/sources               ADMIN only
POST   /api/admin/sources               create a source
POST   /api/admin/sources/[id]/run      trigger ingestion for one source, returns IngestionJob
GET    /api/admin/jobs                  ingestion job history
GET    /api/admin/opportunities         review queue (filter by verificationStatus)
PATCH  /api/admin/opportunities/[id]    approve/reject/edit fields
GET    /api/admin/analytics             counts for dashboard cards
```

Every route validates input with a Zod schema from `lib/validation/*` and returns a
consistent `{data}` / `{error: {message, code}}` envelope.

## 11. Seed / demo data

Realistic, named opportunities (not "Opportunity 1") covering: fellowship, scholarship,
internship, hackathon, competition, mentorship, conference, leadership program, research
program, executive education, grant. Every seeded row has `isSeedData: true` and
`verificationStatus: "AI_EXTRACTED"` or `"NEEDS_REVIEW"` as appropriate (never
`"VERIFIED"` — verification means a human/source-of-truth confirmed it, which demo data has
not had) and is visually badged "Demo data" in the admin dashboard and, subtly, on the
opportunity detail page's source section, so it can never be mistaken for a live listing.

## 12. Phased implementation plan

1. **Foundation** — Next.js/TS/Tailwind scaffold, Prisma schema + migrations, Auth.js,
   base layout, design tokens, docs (this phase).
2. **Core product** — signup/login, onboarding wizard, profile CRUD, opportunity list/detail
   pages, save/tracker.
3. **Search & recommendations** — FTS + filters, matching engine, personalized feed, match
   score + explanation UI.
4. **AI** — Anthropic-backed extraction/classification/summarization/tagging, local
   embeddings + semantic search, NL query parsing.
5. **Ingestion** — adapter interface, RSS adapter (real), manual/seed adapter, admin trigger.
6. **Admin dashboard** — sources, job history, review queue, analytics.
7. **Quality** — unit/integration/E2E tests, typecheck, lint, a11y/responsive pass, fix
   findings before calling any phase done.
