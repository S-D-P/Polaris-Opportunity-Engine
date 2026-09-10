import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { PERSONAS } from "./personas";
import { evaluatePersona } from "./evaluate";

/**
 * Recommendation-quality evaluation suite (docs/backend-roadmap.md Part 12). Unlike
 * tests/unit/scoring.test.ts (which checks individual scoring functions in isolation),
 * this checks the *system's* behavior across a realistic, deliberately diverse catalog for
 * four synthetic personas — the checks the brief specifically asked for: eligibility
 * exclusion, relevant-ranks-highly, irrelevant-is-suppressed, explanation accuracy, and
 * deadline respect.
 *
 * Every test here is written to pass against the CURRENT engine. Where the evaluation
 * uncovered a real bug, that bug is captured as an explicit test asserting *today's actual*
 * behavior (clearly commented as a known limitation, with a pointer to
 * docs/recommendation-baseline.md) rather than a normal test asserting the *desired*
 * behavior — the latter would leave this suite permanently red, which defeats its purpose
 * as a regression guard. If a "known limitation" test below starts failing, that means the
 * underlying behavior changed (fixed or newly broken) and this file needs a conscious update.
 */

const evaluations = Object.fromEntries(PERSONAS.map((p) => [p.id, evaluatePersona(p)]));

const KNOWN_BUG_IDS = new Set<string>([]); // "<opportunityId>:<personaId>" — c4:D, c8:C,
// c24:D, and c19:A/B/C/D were all removed once the domain-aware experience check,
// word-boundary stage matching, range parsing, and deadline-freshness fixes shipped
// (docs/recommendation-baseline.md); all are now covered by real exclusion assertions below.

describe("Stage 1 — hard eligibility exclusion", () => {
  for (const persona of PERSONAS) {
    it(`excludes every opportunity ${persona.id} clearly fails a stated requirement for (except known bugs, tested separately)`, () => {
      const evaluation = evaluations[persona.id];
      const eligibleIds = new Set(evaluation.allEligibleRanked.map((r) => r.id));

      for (const item of CATALOG) {
        const gt = item.groundTruth[persona.id];
        if (gt.eligible !== false) continue; // only check confident "should be ineligible" cases
        if (KNOWN_BUG_IDS.has(`${item.opportunity.id}:${persona.id}`)) continue;

        expect(
          eligibleIds.has(item.opportunity.id),
          `${item.opportunity.title} should be ineligible for ${persona.name}: ${gt.note}`
        ).toBe(false);
      }
    });
  }

  it("FIXED: domain-aware experience matching excludes persona D's product-management years from a policy-specific requirement", () => {
    // Was a KNOWN LIMITATION until lib/matching/eligibility.ts's domain check shipped
    // (docs/recommendation-baseline.md) — 'AI Governance Fellowship' requires 3+ years
    // *policy* experience; D's 10 years are product management, not policy.
    const d = evaluations.D;
    const entry = d.allEligibleRanked.find((r) => r.id === "c4");
    expect(entry, "D's unrelated (product management) experience should no longer satisfy a policy-specific requirement").toBeUndefined();
  });

  it("FIXED: word-boundary stage matching no longer lets 'undergraduate' satisfy a GRADUATE persona", () => {
    // Was a KNOWN LIMITATION — the substring "undergraduate".includes("graduate") wrongly
    // matched; eligibility.ts now uses \b-bounded matching (docs/recommendation-baseline.md).
    const c = evaluations.C;
    const entry = c.allEligibleRanked.find((r) => r.id === "c8");
    expect(entry, "Chidi (GRADUATE) should not satisfy an undergraduate-only requirement").toBeUndefined();
  });

  it("FIXED: a passed deadline excludes an opportunity even when status was never updated to CLOSED/EXPIRED", () => {
    // Was a KNOWN LIMITATION — checkEligibility now compares the actual deadline date
    // directly, not only `status` (docs/recommendation-baseline.md). 'AI Bootcamp' (c19) has
    // deadline: -60 days but status: OPEN specifically to exercise this gap.
    for (const persona of PERSONAS) {
      const entry = evaluations[persona.id].allEligibleRanked.find((r) => r.id === "c19");
      expect(entry, `${persona.id}: a 60-day-passed deadline should exclude this regardless of status`).toBeUndefined();
    }
  });

  it("FIXED: a range requirement like '0-3 years' is parsed as both a floor and a ceiling", () => {
    // Was a KNOWN LIMITATION — the old single "N+ years" regex matched the range's upper
    // bound as if it were a minimum, wrongly excluding early-career candidates and wrongly
    // admitting an over-experienced one (docs/recommendation-baseline.md).
    const shouldBeEligible = ["A", "B", "C"] as const;
    for (const id of shouldBeEligible) {
      const entry = evaluations[id].allEligibleRanked.find((r) => r.id === "c24");
      expect(entry, `${id}: fits the intended 0-3 year early-career range and should now be eligible`).toBeDefined();
    }
    const dEntry = evaluations.D.allEligibleRanked.find((r) => r.id === "c24");
    expect(dEntry, "D: 10 years is well outside the 0-3 year range and should now be excluded").toBeUndefined();
  });

  it("the brief's own worked example: Chidi (2 years) is correctly excluded from the AI Governance Fellowship (requires 3+ years), despite it being his single most relevant listed goal", () => {
    const c = evaluations.C;
    const entry = c.allEligibleRanked.find((r) => r.id === "c4");
    expect(entry).toBeUndefined();
    const ineligibleEntry = CATALOG.find((c) => c.opportunity.id === "c4")!;
    expect(ineligibleEntry.groundTruth.C.relevance).toBe(3);
  });

  it("explicitly CLOSED opportunities are excluded for every persona, regardless of topical relevance", () => {
    for (const persona of PERSONAS) {
      const eligibleIds = new Set(evaluations[persona.id].allEligibleRanked.map((r) => r.id));
      expect(eligibleIds.has("c20")).toBe(false);
    }
  });
});

describe("Stage 3 — ranking quality", () => {
  it("each persona's flagship relevant-and-eligible opportunities rank in their top 5", () => {
    const flagships: Record<string, string[]> = {
      A: ["c1", "c2"],
      B: ["c7", "c8"],
      C: ["c5", "c6"],
      D: ["c11", "c22"],
    };
    for (const persona of PERSONAS) {
      const top5Ids = new Set(evaluations[persona.id].topResults.slice(0, 5).map((r) => r.id));
      for (const id of flagships[persona.id]) {
        expect(top5Ids.has(id), `${id} should be in ${persona.name}'s top 5`).toBe(true);
      }
    }
  });

  it("eligible-but-topically-irrelevant opportunities (marine biology, food bank volunteering) do not crack any persona's top 5", () => {
    for (const persona of PERSONAS) {
      const top5Ids = new Set(evaluations[persona.id].topResults.slice(0, 5).map((r) => r.id));
      expect(top5Ids.has("c15")).toBe(false);
      expect(top5Ids.has("c16")).toBe(false);
    }
  });
});

describe("Explanations", () => {
  it("every recognized explanation reason shown in any persona's top 10 is backed by a real signal", () => {
    for (const persona of PERSONAS) {
      const unverifiedRecognized = evaluations[persona.id].explanationChecks.filter((c) => c.recognized && !c.verified);
      expect(
        unverifiedRecognized,
        `Unverified reasons for ${persona.name}: ${JSON.stringify(unverifiedRecognized, null, 2)}`
      ).toHaveLength(0);
    }
  });
});

describe("Sanity / robustness", () => {
  it("an opportunity with no description, no categories, and no embedding does not crash scoring and does not rank in anyone's top 5", () => {
    for (const persona of PERSONAS) {
      const top5Ids = new Set(evaluations[persona.id].topResults.slice(0, 5).map((r) => r.id));
      expect(top5Ids.has("c21")).toBe(false);
    }
  });
});
