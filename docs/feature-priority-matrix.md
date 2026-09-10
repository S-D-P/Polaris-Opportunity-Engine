# Polaris — Feature Priority Matrix

Prioritized by **how much a feature improves Polaris's ability to help a person discover
and act on a meaningful opportunity** — not by how easy it is to build. Complexity is
recorded so trade-offs are visible, not so it drives the ranking.

Legend for Engineering complexity: **S** (hours), **M** (a day or two), **L** (a week+ /
needs new infra).

## P0 — Critical (without this, Polaris doesn't deliver its core promise)

| Feature | Current state | User problem solved | Product impact | Complexity | Priority | Dependencies |
|---|---|---|---|---|---|---|
| Feedback loop (dismiss/apply/save affect future feed) | `TrackedOpportunity` status is recorded but `generateFeed` never reads it — a dismissed item reappears forever | "Polaris keeps showing me things I already said no to" | Without this the feed can't be trusted to actually be personal — it's the difference between a list and a system that listens | S | P0 | None — pure read-side change in `generateFeed` |
| Matching correctness fixes (gender gate, stage-check bug, dead fields wired up) | `genderRequirement` unenforced; `eligibilitySoftScore` rewards any stated stage regardless of match; `targetAudience`/`timeCommitment`/`goalTags` collected, never scored | Bad or nonsensical recommendations quietly erode trust in every other feature | Correctness is a prerequisite for everything else on this list — a smarter feed built on a buggy scorer just fails more convincingly | M | P0 | None |
| Real dataset growth (150–250 opportunities, 8–12 real sources) | 11 seeded demo opportunities | "There's nothing here for me" | Every downstream feature (sections, comparison, sort, paths) is undemonstrable without enough real inventory — this is the actual bottleneck, not a nice-to-have | L | P0 | Stage 1–2 of `ingestion-roadmap.md` |
| Curated feed sections (Best matches / Closing soon / Because you like X) | One flat, undifferentiated grid | "I don't know what to look at first" | Directly answers the product's own promise ("what should I look at right now") using data Polaris already computes | S–M | P0 | None — grouping logic over existing `generateFeed` output |
| "Why you" narrative upgrade | Bullet list, positionally capped at 4, not the 4 strongest reasons | "I don't trust a bare percentage" | Highest perceived-intelligence change available for the effort; also fixes a real bug (top-4-by-contribution, not top-4-by-insertion-order) | S | P0 | None |

## P1 — High impact (significantly improves usefulness/differentiation)

| Feature | Current state | User problem solved | Product impact | Complexity | Priority | Dependencies |
|---|---|---|---|---|---|---|
| Real `sort` (match/popular) + UI control | Schema accepts the values, backend silently ignores them, UI doesn't expose sort at all | "Show me what's closing soonest / best for me" | Closes an existing broken promise; cheap, concrete usability win | S | P1 | None |
| Opportunity comparison (2–3 side by side) | Doesn't exist | "I've narrowed it down to two — which one?" | Real differentiation at the decision stage, not just the discovery stage | M | P1 | None — reads existing opportunity fields |
| Deadline actionability ("start this weekend") | Deadlines computed correctly, shown as a passive badge | "I know the date but not what to do about it" | Cheap, deterministic, converts information into action — core to the brief's "prioritization → action" principle | S | P1 | None — extends `lib/deadline.ts` |
| Freshness / auto-expiry | Nothing flips `OPEN`→`CLOSED` on deadline passing; re-detected duplicates only bump `lastCheckedAt`, never refresh content | "This says open but the deadline was last month" | Direct trust/quality issue — a discovery product showing expired opportunities as live is a credibility failure | M | P1 | A scheduled job (Stage 4, `ingestion-roadmap.md`) for full effect; a status-derivation check can ship without one |
| Search `audience` filter wiring | `parseSearchQuery` extracts it from NL queries, `/api/search` drops it before it reaches `SearchFilters` | "I searched for 'programs for women' and got everything" | Small fix, closes a real gap in the NL search promise | S | P1 | None |
| Profile as a "compass," not a field dump | Read-only list of fields; aspiration text shown as one italic line | "I wrote a paragraph about my goals and got nothing back for it" | Makes the product feel like it understood you, not just stored you | S–M | P1 | Pairs naturally with Concept A's UI direction |

## P2 — Important later (useful, not required for the first compelling version)

| Feature | Current state | User problem solved | Product impact | Complexity | Priority | Dependencies |
|---|---|---|---|---|---|---|
| "You might have missed this" adjacent-goal surfacing | Doesn't exist | "I searched narrowly and missed something relevant to my actual goal" | Strong differentiator, but risks feeling random if not visibly justified — needs the narrative-reason work (P0) first | M | P2 | "Why you" narrative upgrade |
| Opportunity paths/sequences | Doesn't exist | "What should I do first, second, third to get where I want to go?" | Potentially the biggest long-term differentiator in the whole brief, but needs enough inventory (P0 dataset growth) per stage of a path to not feel thin | L | P2 | Real dataset growth; behavior data eventually improves path quality |
| Source quality/reliability scoring | Only a per-opportunity `VerificationStatus` enum; no per-source score | "Why should I trust this listing?" | Matters more as source count grows past a handful | M | P2 | More sources (Stage 3, `ingestion-roadmap.md`) to have something to score |
| `JSON_API` / `STATIC_PAGE` ingestion adapters | Selectable in admin UI, fail loudly, not implemented | Broader source coverage beyond RSS/manual | Needed to hit the 150–250 dataset target sustainably | M–L | P2 | Concrete target sources identified first (Stage 2–3) |
| Scheduled ingestion (cron) | Manual trigger only (admin button / CLI) | Content goes stale between manual runs | Necessary once there are enough sources that manual triggering doesn't scale | S–M | P2 | A few real sources worth scheduling |
| Deadline reminder notifications | Doesn't exist (no email/push infra) | "I forgot to apply before the deadline" | High value, but only once the feed itself reliably reflects what a user actually cares about (P0 feedback loop) | L | P2 | Feedback loop; freshness/auto-expiry |
| Cross-organization dedup | Jaro-Winkler match only within an exact-match org string | Same opportunity posted under slightly different org names creates duplicate cards | Matters more once multiple sources cover overlapping org opportunities | M | P2 | More sources |

## P3 — Future (do not build now)

| Feature | Current state | Why it waits |
|---|---|---|
| Behavior/ML-based ranking (recommendation Version 4) | No behavior data collected yet | There is nothing to train on; building this before real usage exists is pure waste (see `recommendation-roadmap.md`) |
| Hosted embedding model / pgvector migration | Local 2048-dim hashed bag-of-words embedding | Worth it once synonym-blindness demonstrably hurts real users, or the Postgres migration happens for other reasons |
| General-purpose web scraping (arbitrary static pages) | Two adapters (RSS, manual) | High per-site maintenance burden; RSS/API sources (Stage 1–2) aren't exhausted yet |
| Distributed rate limiting / job queue | In-memory, single-instance | Premature before there's more than one server instance |
| Push notification infrastructure | None | Don't build reminders for a feed that doesn't yet honor "not relevant" |
