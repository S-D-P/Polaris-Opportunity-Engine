# Polaris — Recommendation Engine Roadmap

## Where it stands today (Version 1), precisely

Two-stage, fully deterministic (`lib/matching/`), no ML, no LLM call per opportunity —
matches the product requirement that matching not simply ask an LLM "is this good for this
user."

**Stage 1 — hard eligibility gate** (`eligibility.ts`). An opportunity is excluded from the
feed entirely (not down-ranked — excluded) if it explicitly violates a stated citizenship,
age, experience, or education-stage constraint, or if its status is `CLOSED`. Absence of a
stated constraint is never treated as a violation. This stage is correct and well-tested.

**Stage 2 — weighted scoring**, only for opportunities that pass Stage 1, weights summing to
100 (`weights.ts`):

```
eligibility (soft)  0-15   interest        0-25   skills   0-15
goal                0-20   preference      0-15   timing   0-10
```

- **`eligibilitySoftScore`** — a *second*, redundant eligibility signal, distinct from the
  hard gate. Grants credit for citizenship/education constraints being *stated and
  satisfied*. **Bug**: the education check only asks "did the user state a stage at all,"
  not "does the stated stage actually satisfy the requirement" (the correct check already
  exists in the hard gate and isn't reused here). Never looks at experience, age, or gender.
- **`interestScore`** — overlap between `profile.interests + academicInterests` and
  `opp.categories + fields`, `min(25, matches.length * 8)`. Ignores `opp.skills`/`aiTags`.
- **`skillsScore`** — overlap between `profile.skills` and `opp.skills` only,
  `matches.length * 5`, capped at 15.
- **`goalScore`** — cosine similarity between an embedding of
  `profile.aspirationsSummary || aspirationsRaw` and the opportunity's stored embedding,
  scaled to 20. The explanatory reason is suppressed below 35% of max, but the *score* still
  counts below that line — a user can get goal points with no visible justification for them.
- **`preferenceScore`** — additive credit for work-mode compatibility (with unspecified mode
  counting as compatible with everyone), country overlap (or partial credit for an
  unspecified location), free/paid fit, and opportunity-type preference match. **Never reads
  `profile.timeCommitment`**, despite it being collected at onboarding.
- **`timingScore`** — favors deadlines inside a 30-day window, tapering for further-out or
  passed deadlines (passed deadlines are already excluded by the hard gate, so this mostly
  differentiates "soon" from "later," not "closed" from "open").

**Explanations**: each sub-score returns both a number and plain-language reason strings;
the feed/detail UI renders those strings directly — never a freely-generated LLM paragraph —
so a shown reason is always traceable to a real signal. **Bug**: the final list is
concatenated in a fixed sub-score order and hard-truncated to 4, which means the *first*
four reasons in that order win regardless of which sub-scores actually contributed most —
not the four strongest.

**What's collected but structurally unused today**: `profile.goalTags` (the AI-structured
version of the aspiration text), `.timeCommitment`, `.industry`, `.fieldOfStudy`, `.degree`,
`.school`, `.graduationYear`; `opportunity.targetAudience` and `.genderRequirement`
(unenforced and not even populated by AI extraction). None of these cause bad
recommendations by commission — but every one of them is a signal a user explicitly gave
Polaris that currently does nothing.

**What could cause a bad or misleading recommendation right now**:
1. The `eligibilitySoftScore` stage-check bug can inflate a score for a user whose stage
   doesn't actually fit a stated requirement (the hard gate still protects against outright
   ineligibility, so this is a ranking-quality bug, not a trust-breaking one).
2. `genderRequirement` being unenforced means a gender-restricted opportunity could be shown
   and scored normally to a user it explicitly excludes.
3. The reason-cap truncation can show a user their *weakest* visible justification while
   hiding a stronger one that happened to compute later in the pipeline order.
4. The local hashed embedding is synonym-blind (§ `product-gap-analysis.md`), so `goalScore`
   silently under-scores a genuinely relevant opportunity phrased with different words than
   the user's stated goal, with no way for the user to know that's what happened.
5. Tie-breaking falls back to `dateDiscovered desc` — a newly-ingested but weaker-fit
   opportunity can outrank an older, equally-scored, better-documented one for no
   product reason.

## Version 2 — improved weighting + fuller profile understanding

Goal: fix known bugs, use every signal the product already collects, without adding new
infrastructure.

- Fix `eligibilitySoftScore`'s stage check to reuse `stageSatisfiesRequirement`.
- Enforce `genderRequirement` in the hard gate; add it to the AI extraction schema so it's
  actually populated from source text, not only admin-entered.
- Add `targetAudience` overlap into `interestScore` (or a small new sub-score) — it's already
  extracted and stored, purely a scoring-code change.
- Add `timeCommitment` compatibility into `preferenceScore`.
- Use `goalTags` as a second, cheaper signal alongside the embedding similarity for
  `goalScore` (exact/near tag overlap as a floor, embedding similarity as the ceiling) —
  reduces the synonym-blindness problem without needing a new embedding model.
- Replace the positional reason cap with a top-N-by-contribution selection across all
  sub-scores' reasons, so the shown "why" always reflects the strongest actual signals.
- Break ties by a secondary signal (e.g., verification status, or the opportunity's own
  score components) instead of pure insertion order.

This is scoring-code and prompt work only — no schema change beyond adding one field to the
AI extraction JSON schema, no new dependency, and it's exactly the P0/P1 "matching
correctness" work called out in `feature-priority-matrix.md`.

## Version 3 — hybrid semantic + structured ranking

Goal: reduce the local embedding's synonym-blindness without prematurely committing to
hosted-model infrastructure.

- Evaluate whether the fix is (a) a genuinely better local technique (larger dimension,
  proper TF-IDF weighting, or a small local semantic model that ships as a static asset), or
  (b) finally justifies a hosted embeddings API — decide based on real evidence of the
  current approach's failure rate against real user goal text once the P0 dataset-growth
  milestone is reached, not speculatively.
- Blend structured signals (categories/fields/skills/targetAudience/timeCommitment overlap —
  all deterministic, all already partly built) with the improved semantic score, rather than
  leaning on either alone. The eligibility hard gate stays deterministic regardless — Version
  3 only touches how eligible opportunities are ranked and explained.
- Extend the same improved semantic layer to search ranking (`lib/search/index.ts`), which
  today shares the same embedding function and would benefit identically.

## Version 4 — behavior-based personalization

Goal: incorporate what a user actually *does*, not just what they filled in at onboarding —
but only once there's real behavior data to learn from.

Preconditions (do not start before these are true):
- The Version 1/2 feedback loop is live (dismiss/save/apply actually change future output —
  currently they don't at all, see `product-gap-analysis.md`), so there's a real, trustworthy
  signal stream to build on.
- A meaningful number of real users have generated enough interaction history (clicks,
  saves, dismissals, searches, applies) that a behavioral signal wouldn't just be noise from
  a handful of sessions.

Planned signals, roughly in order of trust/ease: explicit "not relevant" (already modeled,
currently inert — wire this up first, it's Version 1/2 work, not Version 4), explicit saves/
applies (strong positive signal), search queries that didn't lead to a save (weak negative
signal on the *returned results*, not the query itself), dwell/click patterns (weakest, most
prone to misinterpretation, do last if at all).

**Explicitly not building yet**: reinforcement learning, collaborative filtering, or any
model training pipeline. The product principle — quality and relevance over quantity, an
explainable "why" for every recommendation — argues for behavior signals feeding into the
same explainable weighted-scoring shape (e.g., a learned or tuned per-user weight adjustment
on the existing sub-scores) rather than a black-box model that can no longer produce a
truthful "why this matches you." If a future version needs a genuine ML model, that's a
distinct, later decision that should be made from real behavior data, not designed in
advance of it.
