# Polaris Opportunity Engine

> **Live deployment**: [https://polaris-ka4pyersra-uc.a.run.app](https://polaris-ka4pyersra-uc.a.run.app)

**Patchamomma 2026 submission resources:**
[Medium article](https://medium.com/@siddhipandirkar/the-deadline-had-already-passed-again-29d476a7f3cf) ·
[Submission document](https://docs.google.com/document/d/1Z3KutaRJNoqH6nhZ_0_pSOm1Ccr9ZkJz3uQgy7sg4NE/edit?tab=t.0) ·
[Demo screen recording](https://drive.google.com/file/d/1PkKP1AmXiyhIkuipmVpU_E9Zx8gRqCxn/view?usp=sharing)

## The Problem

Opportunities can change the trajectory of a person's education and career. But an opportunity can only create impact if the person who needs it knows that it exists.

I realized this personally while applying to Google Patchamomma. I discovered the program because a single Instagram reel happened to appear on my feed. I was actively looking for opportunities, yet even I found this one through chance.

That made me wonder how many opportunities people never discover at all.

This problem becomes even more significant for students and professionals who are the first in their families to navigate higher education and career development. They may not know what opportunities exist, what they are eligible for, where to search, or which sources to trust. Information may technically be available online, but knowing that it exists and knowing how to find and evaluate it are very different things.

I have seen this happen beyond my own experience.

I once met a first-generation engineering student whose father worked as a daily-wage labourer while supporting a family with two younger children. During college admissions, she was advised not to apply for the Tuition Fee Waiver Scheme because she was told that unless she ranked among the top applicants, applying could affect her chances of admission.

She trusted that advice and did not apply.

Later, she discovered that students with lower academic scores had successfully received the waiver. Her family ultimately had to arrange more than ₹1 lakh each year for fees, a significant burden that could potentially have been avoided with the right information at the right time.

What stayed with me was not only the financial impact. It was how much depended on knowing what question to ask and where to find the answer.

We often assume that because information exists online, it is equally accessible to everyone. In reality, people with strong personal networks, experience navigating these systems, or simply better exposure to the right communities often have an advantage.

The same pattern exists across the wider opportunity ecosystem.

Scholarships, fellowships, internships, research programs, competitions, hackathons, mentorships, leadership programs, conferences, workshops, volunteering opportunities, grants, and outreach initiatives are spread across university websites, government portals, company pages, nonprofit organizations, professional communities, newsletters, and social media.

There is no shortage of opportunities.

There is a discovery problem.

## The Idea

Polaris is an AI-powered opportunity discovery platform designed to make existing opportunities easier to find, understand, and act on.

The goal is not to create another opportunity.

The goal is to make the opportunities that already exist discoverable.

Instead of asking people to repeatedly search hundreds of websites and hope that the right opportunity appears in their feed, Polaris creates a personalized discovery layer across the fragmented opportunity ecosystem.

A user can tell Polaris about their educational stage, interests, skills, experience, aspirations, preferred countries, goals, and other relevant preferences.

Polaris then helps answer a much more useful question: "What opportunities are actually relevant to me?"

## How Polaris Works

Polaris brings together publicly available opportunities from trusted sources such as universities, government initiatives, nonprofits, CSR programs, companies, professional organizations, communities, and other verified sources.

The platform processes these opportunities through a structured pipeline:

`Source → Compliance Check → Discovery → Extraction → Validation → Deduplication → AI Enrichment → Matching → Recommendation`

Gemini helps Polaris understand information that is difficult to represent with simple rules, including opportunity descriptions, eligibility language, categories, summaries, and match explanations.

The recommendation engine then combines this information with the user's profile.

Importantly, Polaris does not allow an AI model to make every eligibility decision on its own. Hard eligibility requirements are handled deterministically, while AI is used to interpret unstructured information and improve understanding and personalization.

This allows the system to be both useful and transparent.

Users can see why an opportunity was recommended, understand its eligibility requirements, explore the original source, and track opportunities through stages such as discovered, saved, interested, applied, and completed.

## Who Polaris Is For

Polaris is designed to support people across different stages of education and professional life.

A school student interested in astronomy could discover space and STEM outreach programs, astronomy camps, science competitions, and workshops.

A university student could find research internships, scholarships, hackathons, fellowships, exchange programs, and competitions aligned with their interests.

An early-career professional could discover leadership programs, conferences, mentorship initiatives, executive learning, and industry fellowships.

An experienced professional could discover opportunities to become a mentor, speaker, competition judge, advisor, industry expert, volunteer, or board member.

The idea is to make opportunity discovery useful throughout a person's journey, not only at the point when they are looking for a job or applying to university.

## Why This Matters

Experiential learning and participation in opportunities outside the traditional classroom can contribute to stronger academic, professional, and career outcomes.

Research and initiatives documented by the National Association of Colleges and Employers have highlighted the value of internships, research, study abroad, mentorship, and other experiential learning opportunities. Their work also demonstrates that improving awareness and access can increase participation in these experiences.

The challenge is that awareness itself is uneven.

People who already know where to look can keep finding more opportunities. People who do not know where to start may never encounter them.

That creates an invisible information barrier.

Polaris aims to reduce that barrier by making discovery more intentional and personalized.

## A Broader Vision

The long-term vision for Polaris is to become a personalized opportunity layer for the internet.

There are thousands of organizations creating programs intended to help people learn, contribute, connect, and grow. At the same time, there are millions of people who could benefit from those programs but may never encounter them.

Polaris sits between these two sides.

For individuals, it can reduce the time and uncertainty involved in finding opportunities that fit their goals.

For organizations, universities, nonprofits, and outreach programs, it can help meaningful opportunities reach people beyond the audiences they already know how to reach.

Ultimately, Polaris is built around a simple belief: access to opportunity should depend less on who you happen to know, what algorithm happens to show you, or whether you happen to hear about something at the right time.

The opportunities already exist.

Polaris is about helping the right people find them.

### References

1. Kahn, J., & Patil, S. (2025). Impacts of Experiential Learning on the Gen Z Early Career Experience. National Association of Colleges and Employers (NACE).
2. Carpenter, E. (2023). Sparking Early Experiential Learning. National Association of Colleges and Employers (NACE).
3. Kahn, J., & Patil, S. (2025). The Integration of Career Readiness into Experiential Learning and High-Impact Practices. National Association of Colleges and Employers (NACE).
4. Government of India Vidya Lakshmi Portal. A unified platform that brings together education loan schemes and government scholarships, demonstrating the value of centralized information access while highlighting the need for similar discovery mechanisms across private, nonprofit, CSR, and international opportunities.

---

## Technical Implementation

The rest of this document describes how Polaris is actually built: the architecture, the ingestion pipeline, the recommendation engine, how Gemini is used (and just as importantly, where it deliberately is not), how the system is tested, and how to run it locally.

A short summary of what exists today, verified against the running application, not aspirational: a personalized feed built on a deterministic eligibility engine plus weighted scoring, natural-language search where Gemini parses intent into structured filters, an interactive world map for browsing opportunities geographically, an opportunity tracker (save, interested, applied, completed), and a compliance-first ingestion pipeline (29 active sources at the time of writing, each with a researched compliance record before any fetch ever runs; 71 real opportunities in the database, 42 currently visible in discovery). Polaris is an opportunity discovery product, not a jobs board: regular job listings are intentionally excluded from the user-facing product (see `docs/personalization.md`).

## Architecture

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), TypeScript |
| Database | PostgreSQL via Cloud SQL, Prisma 6 ORM |
| AI | Google Gemini 2.5 Flash via Vertex AI (`@google/genai`) |
| Auth | NextAuth v5, Credentials provider, bcrypt |
| Search | Postgres native full-text search + local embedding cosine similarity |
| Map | d3-geo + world-atlas (no external tile server) |
| Deployment | Google Cloud Run (containerized, `--allow-unauthenticated`) |
| Container | Docker, built via Google Cloud Build |
| Secrets | Google Secret Manager |
| Scheduling | Google Cloud Scheduler |
| Registry | Google Artifact Registry |
| Tests | Vitest (206 unit + integration tests), Playwright (4 E2E tests) |

Key design principles:

- **Gemini interprets, never decides.** The recommendation engine's hard eligibility gate is deterministic TypeScript (`lib/matching/eligibility.ts`). Gemini parses queries and classifies ingested content; it never overrides or replaces the eligibility logic.
- **Compliance-first.** No source is fetched without a `SourceComplianceRecord` with `ALLOWED` or `ALLOWED_WITH_RESTRICTIONS` status. The gate is structural, not advisory.
- **Graceful AI degradation.** If Gemini is unavailable, search falls back to keyword-only retrieval; ingestion stores items as `NEEDS_REVIEW` rather than fabricating a classification.
- **Demo data stays isolated.** Seed and evaluation fixtures (`isSeedData: true`) are excluded from every discovery surface (feed, search, map) through explicit filter conditions, not convention.

Module boundaries (`/lib`): `db` (Prisma client), `auth` (Auth.js config and guards), `ai` (Gemini provider, embeddings, query parser), `ingestion` (source adapters, compliance gate, SSRF guard, dedup, freshness sweep), `geo` (map aggregation), `matching` (eligibility gate and scoring), `search` (query parsing and ranking), `validation` (shared Zod schemas). Each of these is independently unit-testable, with no dependency on Next.js request/response types.

## Data and Ingestion

Opportunities are ingested through an adapter-based pipeline, not one large scraper: RSS, JSON API, static page, and manual adapters (`lib/ingestion/adapters/`) each implement the same contract, so adding a new source type doesn't touch the pipeline.

For every source, the sequence is: **source registered → compliance check → fetch (SSRF-guarded) → extract → normalize → validate → deduplicate → AI enrichment → store → index**. The compliance check runs first and is structural, not optional: a source is only ever fetched if it has a `SourceComplianceRecord` researched from a live robots.txt and Terms of Service check, recorded as `ALLOWED` or `ALLOWED_WITH_RESTRICTIONS`. Sources that turn out to be `NOT_ALLOWED` or `UNCLEAR_REQUIRES_REVIEW` are recorded for the audit trail and never ingested (`docs/source-compliance.md`). Every outbound fetch also passes through an SSRF guard that rejects non-http(s) schemes, localhost, private IP ranges, and link-local addresses.

Deduplication uses a fingerprint (normalized title and organization) plus embedding similarity to decide between a confident merge and a possible-duplicate flag for review, so distinct opportunity cycles are not accidentally collapsed into one another.

A daily Cloud Scheduler job re-derives each opportunity's `OPEN` / `CLOSING_SOON` / `EXPIRED` status from its actual deadline date, and the recommendation engine's eligibility gate independently checks the real deadline again at recommendation time, so a stale status can never make an expired opportunity look eligible.

## Recommendation Engine

Matching is two-stage and deterministic:

**Hard eligibility gate.** For each opportunity and user pair, Polaris checks citizenship, age, education stage, experience (including range-aware parsing like "0-3 years" and a domain-aware check so unrelated experience doesn't satisfy a domain-specific requirement), gender restrictions (only when explicitly stated by the source, never inferred from an organization's name or branding), geography, and deadline status. A constraint the opportunity does not state is never treated as a violation.

**Weighted scoring**, computed only for opportunities that pass the gate, combines eligibility signal strength, interest and skills overlap, goal alignment (via embedding similarity between a user's stated aspirations and the opportunity description), stated preferences, and timing, into a 0 to 100 match score. Every sub-score returns both a number and the specific reasons behind it, and the "why this matches you" explanation shown to the user is assembled directly from those reasons, never a freely generated paragraph, so it can never state a reason that isn't backed by a real signal.

## AI / Gemini Integration

Gemini (2.5 Flash, via Vertex AI) is used for three things: classifying and structuring newly ingested opportunities (type, categories, eligibility language, gender and geographic eligibility, deadline type), parsing a natural-language search query into structured filters, and summarizing a user's free-text goals. Every call is a single-shot, schema-validated request; the model is never given a tool or function that could touch the database, run a command, or fetch an arbitrary URL. Retrieval and ranking stay deterministic in both search and the personalized feed: Gemini only ever interprets, the SQL and scoring do the deciding. Gemini is not called on every feed request or once per opportunity; AI enrichment happens at ingestion time, and search makes one call per query, not one per result. See `docs/agent-architecture.md` for the reasoning behind this design, including why it does not use a separate agent framework.

## Evaluation and Testing

```bash
npm run typecheck          # TypeScript, must be clean
npm run lint                # ESLint, must be clean
npm test                    # Vitest unit + integration (requires a polaris_test database)
npm run test:e2e            # Playwright E2E (requires the dev server and a live database)
npm run eval:baseline       # Regenerate the recommendation quality baseline
```

All of the above were passing at submission time. One practical note: the unit and integration suites share a test database, so running two `vitest` processes at the same time can produce spurious failures from one run's cleanup racing another's; running the suite in isolation resolves this.

Recommendation quality is measured against four synthetic personas over a hand-labeled catalog, tracking Precision@5, Precision@10, Recall@10, NDCG@10, and eligibility accuracy. Results and methodology are in `docs/recommendation-baseline.md`.

## Google Cloud Architecture / Deployment

| Service | Status |
|---|---|
| Cloud Run | Live, `polaris-ka4pyersra-uc.a.run.app` |
| Cloud SQL (PostgreSQL) | Live, connected via the Cloud SQL Auth Connector |
| Secret Manager | Live: `polaris-database-url`, `polaris-auth-secret`, `polaris-scheduler-secret` |
| Artifact Registry | Live, `us-central1-docker.pkg.dev/polaris-opportunity-engine/polaris/app` |
| Cloud Build | Builds and pushes the container image |
| Cloud Scheduler | Live, `polaris-freshness-sweep`, daily |
| Gemini / Vertex AI | Live, query parsing and ingestion classification via `gemini-2.5-flash` |

Two services this project deliberately does not use: BigQuery (no analytics use case has justified adding it yet) and Cloud Storage (no file-upload or raw-archival feature exists in the product). Polaris also does not implement Google's Agent Development Kit; the query-parsing and deterministic-retrieval pipeline described above satisfies the same practical need without a separate agent framework, and that decision is documented rather than glossed over in `docs/agent-architecture.md`.

## Running Locally

**Prerequisites**: Node 20+, PostgreSQL, [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy) (for the real database), `gcloud auth application-default login` (for Gemini).

```bash
cp .env.example .env        # fill in your values
npm install
npx prisma db push          # sync the schema to your database
npm run db:seed             # optional: load seed/demo data
npm run dev                 # start the dev server at http://localhost:3000
```

See `.env.example` for all required environment variables and their descriptions.

## Project Structure

```
/app          Next.js routes (pages and API route handlers)
/components   Reusable UI components
/lib          Application logic: ai, auth, db, geo, ingestion, matching, search, validation
/prisma       schema.prisma, migrations, seed files
/scripts      CLI entry points (ingestion runner, freshness sweep, evaluation baseline)
/tests        Unit, integration, evaluation, and end-to-end tests
/docs         Architecture and subsystem documentation
```

## Further Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Full system architecture, module boundaries, design decisions |
| [`docs/agent-architecture.md`](docs/agent-architecture.md) | Why the Gemini query-parser and deterministic-retrieval pipeline satisfies the product's AI-interpretation requirement without a separate agent framework |
| [`docs/data-architecture.md`](docs/data-architecture.md) | Database schema, Cloud SQL setup, migration notes |
| [`docs/security-audit.md`](docs/security-audit.md) | Route-by-route security audit, auth model, SSRF mitigations |
| [`docs/source-compliance.md`](docs/source-compliance.md) | Per-source robots.txt and Terms of Service compliance records |
| [`docs/recommendation-baseline.md`](docs/recommendation-baseline.md) | Eligibility engine accuracy metrics and before/after bug-fix results |
| [`docs/scalability.md`](docs/scalability.md) | Known scale ceilings and the documented next steps for each |
| [`docs/personalization.md`](docs/personalization.md) | Profile model, matching logic, and which fields actually influence recommendations |
