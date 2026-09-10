# Polaris — Agent Architecture

Honest status, verified against the actual code (2026-09-09): Polaris does not use Google's
Agent Development Kit (ADK) or a separate Agent Runtime/Platform. That was evaluated for this
pass and deliberately not added — introducing a new orchestration framework and its dependency
surface this late, for a requirement the existing architecture already satisfies, would have
been exactly the unnecessary rewrite the project's own operating rules forbid ("do not
replace working architecture merely because another approach is possible"). This document
describes what's actually there instead of describing a framework that isn't.

## What exists

`app/api/search/route.ts` implements the requested behavioral contract — **user request →
intent interpretation → controlled retrieval → structured context → grounded response**,
with approved, schema-validated tools only and a deterministic layer as final authority:

1. **Intent interpretation**: `lib/ai/query-parser.ts`'s `parseSearchQuery(query)` sends the
   user's natural-language text to Gemini (`lib/ai/provider.ts`'s `generateStructured`) with a
   fixed system instruction and a `zod` output schema (`types`, `countries`, `remoteOnly`,
   `freeOnly`, `audience`, `semanticQuery`). The model receives a prompt and returns JSON
   matching that shape — nothing else. It is never given a function/tool definition, so it has
   no mechanism to call anything, read a file, run SQL, or fetch a URL.
2. **Controlled retrieval**: the parsed, validated object is the *only* thing passed into
   `lib/search/index.ts`'s `searchOpportunities()` — one fixed, parameterized Prisma query
   function operating only over the `Opportunity` table, with the same `isSeedData`/
   `COURSE+NEEDS_REVIEW` production-discovery filters every other read path uses. Retrieval and
   ranking (SQL filters + Postgres full-text search + local embedding cosine similarity) are
   100% deterministic — Gemini's output never reaches the database directly.
3. **Structured, grounded response**: results are real, existing `Opportunity` rows — the
   model cannot fabricate a result, because it never generates opportunity content, only a
   filter description.
4. **Deterministic layer remains authoritative**: eligibility gating
   (`lib/matching/eligibility.ts`) and scoring (`lib/matching/scoring.ts`) run *after*
   retrieval and are never influenced by the parsed query. A user can ask for anything; what
   they're actually shown as "eligible" is still decided by the same hard-gate code path used
   everywhere else in the product.

The same pattern (interpret → validate against a schema → feed one fixed, safe function)
governs every other Gemini call in the codebase: `lib/ai/extraction.ts` (ingestion-time
opportunity classification), `lib/ai/aspirations.ts` (goal summarization), `lib/geo/aggregate.ts`
consumers do not call Gemini at all (geography classification happens at ingestion). None of
these give the model a tool with side effects — every one is prompt-in, validated-JSON-out.

## Why this isn't "a fake agent wrapper"

The concern the product brief raises — a renamed single Gemini call presented as an agent — is
specifically about a system that pretends to do multi-step, tool-mediated reasoning while
`actually just being one prompt. What's described above is not that: it's a genuine two-stage
pipeline (interpret, then act on a separate, deterministic system) with a real, enforced
boundary between what the model is allowed to influence (a search filter) and what it isn't
(actual data, actual eligibility). It's intentionally *simple* — single-hop, one tool — not
disguised as more than it is.

## What would need to change for a "real" multi-tool agent

If a future requirement needs the model to chain multiple actions in one turn (e.g. "search,
then check this specific opportunity's eligibility for me, then explain the gap"), that's a
genuinely different shape of system — multiple named tools, a loop, tool-call validation on
each step — and would justify adopting ADK or an equivalent framework then, with its own
security review (tool allowlisting, argument validation, no unrestricted SQL/shell/URL access,
same constraints already enforced by construction in the current single-hop design). Not
needed today; nothing in the current product asks for multi-step tool chaining.

## Security posture (mirrors docs/security-audit.md's Agent security section)

- No tool/function is ever passed to the model — it cannot execute SQL, shell commands, or
  fetch arbitrary URLs, because no code path gives it that capability.
- All model output is `zod`-validated before use; invalid output falls back to treating the
  raw query as a plain semantic search string (`lib/ai/query-parser.ts`'s `fallback`).
- The search endpoint (`GET /api/search`) is PUBLIC by product design (browsing works
  logged-out) but rate-limited (`lib/rate-limit.ts`, `RATE_LIMITS.AI`, keyed per authenticated
  user where available) — see docs/security-audit.md.
- No secrets are ever included in a prompt or reachable by the model.
