# Polaris — Security Audit

Real audit of the current codebase (2026-09-09), not a generic checklist. Every claim below
was verified by reading the actual route/adapter code, not assumed.

## Endpoint classification

| Route | Classification | Enforcement |
|---|---|---|
| `GET /api/opportunities`, `GET /api/opportunities/[id]`, `GET /api/search`, `GET /api/opportunities/geo` | PUBLIC | No auth required — intentional (browsing/search works logged-out, verified by E2E test "a logged-out visitor can browse and view an opportunity"). The geo endpoint returns only aggregate counts and already-public opportunity fields, no personal data. |
| `POST /api/auth/signup` | PUBLIC | Account creation itself; rate limiting not implemented (see Remaining risks) |
| `GET/PATCH /api/profile` | AUTHENTICATED, OWNER | `requireUser()`, always scoped to the session's own `user.id` — never accepts a client-supplied user id |
| `GET /api/feed` | AUTHENTICATED, OWNER | `requireUser()`, feed generated from the session user's own profile only |
| `GET/POST /api/tracker` | AUTHENTICATED, OWNER | `requireUser()`; `POST` upserts by `(userId, opportunityId)`, so a user can only ever write their own row |
| `PATCH/DELETE /api/tracker/[id]` | AUTHENTICATED, OWNER | `requireUser()` **plus** an explicit `assertOwnership(id, user.id)` check before any read/write — confirmed user A cannot patch user B's tracked-item id by guessing it |
| `GET /api/admin/jobs`, `/api/admin/analytics`, `/api/admin/opportunities`, `/api/admin/sources` | ADMIN | `requireAdmin()` on every handler — verified on all 6 admin route files, no exceptions found |
| `PATCH /api/admin/opportunities/[id]` | ADMIN | `requireAdmin()` |
| `POST /api/admin/sources/[id]/run` (ingestion trigger) | ADMIN | `requireAdmin()` — a normal authenticated user cannot trigger ingestion; see "Ingestion security" below for the rest of this path's protections |
| `[...nextauth]` (login/session/callback) | SYSTEM (Auth.js-managed) | Handled entirely by NextAuth's own request handling, not custom code |

**No route was found relying only on frontend route protection** — every authenticated/admin
route re-derives identity server-side via `auth()`/`requireUser()`/`requireAdmin()`, which
reads the actual session, not anything the client claims.

## Authentication

NextAuth v5, Credentials provider, bcrypt password hashing (`lib/auth`). Session tokens are
`HttpOnly`, `Secure`, `SameSite=Lax` (confirmed on the live Cloud Run deployment's
`Set-Cookie` header). `AUTH_TRUST_HOST=true` is required in any reverse-proxied deployment
(Cloud Run included) — Auth.js otherwise rejects every request with `UntrustedHost`, a real
bug hit and fixed during this deployment (docs/data-architecture.md).

## Authorization

Enforced server-side via three guard functions (`lib/auth/guards.ts`):
`requireUser()` (401 if unauthenticated), `requireAdmin()` (403 if not `role: "ADMIN"`),
`optionalUser()`. Ownership is checked explicitly wherever a row belongs to a specific user
(`tracker/[id]/route.ts`'s `assertOwnership`; `profile`/`feed`/`tracker` routes scope every
query to the session's own `user.id` directly rather than an id from the request body/URL).

## Ingestion security

- **Cannot be triggered by an unauthenticated or non-admin user** — `requireAdmin()` on the
  run endpoint, confirmed above.
- **The compliance gate always runs first**, before any adapter's `fetchRaw` is called
  (`lib/ingestion/pipeline.ts`) — this is structural, not a check that can be bypassed by
  calling a different code path, since `runIngestion()` is the only entry point every trigger
  (manual admin click, `scripts/run-ingestion.ts`, a future Cloud Scheduler job) goes through.
- **SSRF**: added this pass. `lib/ingestion/url-safety.ts`'s `assertSafeFetchUrl()` is called
  at every network-fetch call site across all three fetching adapters (RSS, JSON API,
  STATIC_PAGE's both static and headless-render paths) — rejects non-http(s) schemes,
  localhost, loopback, RFC1918 private ranges, and link-local addresses (which includes the
  cloud metadata endpoint `169.254.169.254`). 7 unit tests (`tests/unit/url-safety.test.ts`).
  Source URLs only ever come from `Source.url`/`Source.config`, which only an admin can set —
  so the realistic threat this defends against is a compromised or mistaken admin action, not
  an arbitrary public user, but it's checked regardless of how trusted the caller is.
- **Arbitrary user-supplied URLs cannot be fetched** — there is no code path where a public
  request body's URL reaches an adapter's fetch call; ingestion only ever fetches
  `Source.url`, which is admin-authored.
- **Cloud Scheduler authentication**: not yet configured — Cloud Scheduler triggering
  ingestion is planned (docs/ingestion-roadmap.md) but not deployed. When it is, it must use
  an authenticated Cloud Scheduler → Cloud Run invocation (OIDC token, Cloud Run's built-in
  scheduler auth), not a public unauthenticated HTTP trigger. **Not implemented — real gap,
  not claimed done.**
- **Rate limiting on ingestion itself**: not implemented at the application layer. Each
  source's own crawl-frequency/rate-limit fields are documentation, not an enforced throttle.
  Real gap for a future pass.

## Agent security

**Honest framing, revised 2026-09-09**: there is no Google ADK (Agent Development Kit)
integration and no multi-turn, self-directed tool-calling loop in this codebase — that
specific package/pattern was evaluated and deliberately not added this late in the project,
since introducing a new orchestration framework and its dependency surface carries real risk
of destabilizing a working, tested, deployed system for a rewrite that wasn't necessary to
satisfy the actual requirement (product's own "do not rewrite the architecture unnecessarily"
rule).

What genuinely exists, and does satisfy the requested behavioral contract ("user request →
intent interpretation → controlled opportunity retrieval → structured context → grounded
response", approved schema-validated tools only, deterministic layer authoritative):
`app/api/search/route.ts` → `lib/ai/query-parser.ts`'s `parseSearchQuery()` interprets a
natural-language query into a schema-validated (`zod`) structured filter object via Gemini
(`generateStructured`) — the model is given a prompt and a system instruction and returns
JSON matching a fixed shape (`types`, `countries`, `remoteOnly`, `freeOnly`, `audience`,
`semanticQuery`); nothing else. That structured output is the *only* thing that reaches
`lib/search/index.ts`'s `searchOpportunities()` — a single, fixed, parameterized
Prisma-query function. The model never receives a database connection, never executes SQL,
never fetches a URL, never calls a shell — it has no mechanism to do any of those things,
because no tool/function definition giving it one was ever passed to it. Retrieval and
ranking are 100% deterministic (SQL filters + Postgres FTS + embedding cosine similarity);
eligibility gating (`lib/matching/eligibility.ts`) runs after retrieval and is never
influenced by the model's output. This is a real (if intentionally simple, single-hop)
instance of the requested pattern, not a rewrite pretending to be one — every claim above was
verified by reading `app/api/search/route.ts`, `lib/ai/query-parser.ts`, and
`lib/search/index.ts` directly.

If a genuine multi-tool, multi-turn agent (e.g. one that can chain "search, then check a
specific opportunity's eligibility, then explain") becomes a real product requirement, ADK or
an equivalent framework is worth adopting then — with its own dedicated security review, not
retrofitted under time pressure at the end of an unrelated pass.

## Secret handling

- `AUTH_SECRET`, `DATABASE_URL` (with the Cloud SQL password embedded) are stored in **Secret
  Manager** (`polaris-auth-secret`, `polaris-database-url`) and injected into Cloud Run via
  `--set-secrets`, never baked into the container image or committed to the repo.
- `GOOGLE_CLOUD_PROJECT`/`GOOGLE_CLOUD_LOCATION` are plain env vars (not secrets — project ID
  is not sensitive) set via `--set-env-vars`.
- Local development uses Application Default Credentials (`gcloud auth application-default
  login`) for Gemini — no API key is stored anywhere in this codebase for Gemini access.
- `.env`/`.env.local` are gitignored and excluded from the Docker build context
  (`.dockerignore`).

## File handling

No file upload feature exists in the current codebase (resume upload is a documented future
item, `docs/implementation-status.md` P2). Nothing to audit here yet — noting its absence
rather than describing controls for a feature that isn't built.

## Database security

- Cloud SQL reached only via the Cloud SQL Auth Proxy locally / Cloud Run's native Cloud SQL
  integration in production (IAM-authenticated, not a raw password-over-the-internet
  connection) — no public IP authorization was configured for direct access.
- The Cloud Run runtime service account has exactly two roles relevant to data access:
  `roles/cloudsql.client` and `roles/secretmanager.secretAccessor` — not the broad `Owner`
  role the developer's own account has for provisioning. Least-privilege for the running
  application, confirmed via the actual IAM policy set during deployment.
- All queries go through Prisma's parameterized query builder; the only raw SQL in the
  codebase is `lib/search/fts.ts`'s full-text search, which uses `$queryRawUnsafe`/
  `$executeRawUnsafe` with **positional parameters** (`$1`, `$2`, ...), not string
  interpolation of user input — verified by reading the actual query strings.

## Logging

`lib/logger.ts` provides structured `logger.warn`/`logger.error` calls with a scope + message
+ metadata object shape, which maps directly onto Cloud Logging's structured-log ingestion on
Cloud Run (no code change needed for that transport). Gender (`Profile.gender`) and other
personal profile fields are never passed to `logger.*` calls anywhere in the codebase (checked
via grep) — the only place gender data is read is inside `lib/matching/eligibility.ts`'s pure
scoring function, which doesn't log its inputs.

## Rate limiting

**Correction from an earlier draft of this document**, which claimed no rate limiting existed
anywhere — that was wrong, found and fixed by re-reading the actual route code rather than
trusting the earlier pass. `lib/rate-limit.ts` is a real in-memory token-bucket limiter, applied
at two call sites: `POST /api/auth/signup` (`signup:${ip}`, 10 attempts/minute) and
`POST /api/search`'s Gemini-backed natural-language path (`search:${user.id}`, 20/minute,
`RATE_LIMITS.AI`) — confirmed via `grep` for `checkRateLimit` across `app/api/**`.

**Real gap that remains**: `/api/auth/callback/credentials` (the actual login attempt) is
handled entirely by NextAuth's own internal routing, not custom route code, so the app-level
limiter above doesn't cover it — a credential-stuffing attempt against login specifically isn't
throttled by this application. The in-memory bucket is also per-process, so it resets on every
Cloud Run cold start and isn't shared across instances once `max-instances` > 1 — noted in the
file's own comment. Recommended next step for both: Cloud Armor in front of Cloud Run (covers
login and every other route uniformly, survives restarts and multi-instance scaling) rather than
extending the in-app limiter further.

## Remaining risks (honest list, not resolved this pass)

1. Login (`/api/auth/callback/credentials`) isn't rate-limited, and the in-app limiter is
   per-process/in-memory, not shared across Cloud Run instances (above).
2. No Cloud Scheduler authentication configured yet (ingestion automation isn't deployed).
3. No formal penetration test or dependency vulnerability scan was run as part of this audit —
   `npm audit` reports 3 high-severity issues in a transitive Prisma CLI dependency
   (`deepmerge-ts`, via `@prisma/config`), not exploitable at runtime (build/CLI-only
   dependency) but worth resolving via a Prisma version bump when convenient, not urgent.
4. No formal tool-calling agent exists, so its specific security requirements (Section 13)
   are not yet applicable — revisit if one is built.
5. `genderRestrictedTo`/`genderEligibility` AI extraction was wired into the prompt this pass
   but has not yet been exercised against a real live ingestion run with a genuinely
   gender-restricted source — the deterministic eligibility gate itself is tested (10 unit
   tests), but the AI classification step's real-world accuracy on this specific field is
   unverified pending a live run against a source that actually has this content.
