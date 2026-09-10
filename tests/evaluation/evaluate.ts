import { scoreOpportunity } from "@/lib/matching/scoring";
import type { MatchProfile, MatchOpportunity, MatchResult } from "@/lib/matching/types";
import { CATALOG, type GroundTruthEntry } from "./catalog";
import { PERSONAS, type Persona, type PersonaId } from "./personas";
import { eligibilityAccuracy, ndcgAtK, precisionAtK, recallAtK, relevantIdSet } from "./metrics";

export interface RankedEntry {
  id: string;
  title: string;
  tags: string[];
  score: number;
  reasons: string[];
  match: MatchResult;
  groundTruth: GroundTruthEntry;
}

export interface ExplanationCheck {
  opportunityId: string;
  opportunityTitle: string;
  reason: string;
  recognized: boolean;
  verified: boolean;
  detail: string;
}

export interface PersonaEvaluation {
  persona: Persona;
  totalCatalogSize: number;
  eligibleCount: number;
  ineligibleCount: number;
  allEligibleRanked: RankedEntry[];
  topResults: RankedEntry[];
  metrics: {
    precisionAt5: number;
    precisionAt10: number;
    recallAt10: number | null;
    ndcgAt10: number | null;
    relevantSetSize: number;
  };
  eligibilityAccuracyResult: ReturnType<typeof eligibilityAccuracy>;
  explanationChecks: ExplanationCheck[];
  truncatedExplanationEntries: RankedEntry[];
  missedRelevant: RankedEntry[];
  overrankedLowRelevance: RankedEntry[];
  slippedIneligible: { id: string; title: string; note: string }[];
  wronglyExcludedRelevant: { id: string; title: string; relevance: number; note: string }[];
}

/**
 * Verifies one shown explanation string against the persona/opportunity data it claims to
 * be backed by. Pattern-matches the exact templates `lib/matching/scoring.ts` generates —
 * if a reason doesn't match any known template, or matches but the claim doesn't check out
 * against the underlying data, it's flagged rather than assumed correct.
 */
function verifyReason(reason: string, profile: MatchProfile, opp: MatchOpportunity): ExplanationCheck {
  const base = { opportunityId: opp.id, opportunityTitle: opp.title, reason };

  let m = reason.match(/^You've shown interest in (.+)$/);
  if (m) {
    const topic = m[1].toLowerCase();
    const userHas = [...profile.interests, ...profile.academicInterests].some((t) => t.toLowerCase() === topic);
    const oppHas = [...opp.categories, ...opp.fields].some((t) => t.toLowerCase() === topic);
    return {
      ...base,
      recognized: true,
      verified: userHas && oppHas,
      detail: userHas && oppHas ? "Confirmed: topic is in the user's interests and the opportunity's categories/fields." : `NOT backed: userHasTopic=${userHas}, opportunityHasTopic=${oppHas}.`,
    };
  }

  m = reason.match(/^Your skills include (.+)$/);
  if (m) {
    const listed = m[1].split(",").map((s) => s.trim().toLowerCase());
    const oppSkills = opp.skills.map((s) => s.toLowerCase());
    const userSkills = profile.skills.map((s) => s.toLowerCase());
    const allBacked = listed.every((s) => oppSkills.includes(s) && userSkills.includes(s));
    return {
      ...base,
      recognized: true,
      verified: allBacked,
      detail: allBacked ? "Confirmed: every listed skill is in both the user's skills and the opportunity's skills." : "NOT backed: at least one listed skill is missing from the user or the opportunity.",
    };
  }

  if (reason === "This aligns with the goals you described") {
    const hasGoalText = Boolean(profile.aspirationsSummary || profile.aspirationsRaw);
    const hasEmbedding = opp.embedding != null;
    return {
      ...base,
      recognized: true,
      verified: hasGoalText && hasEmbedding,
      detail: hasGoalText && hasEmbedding ? "Confirmed: user has stated aspirations and the opportunity has an embedding to compare against." : "NOT backed: missing aspiration text or opportunity embedding.",
    };
  }

  m = reason.match(/^Accepts applicants from (.+)$/);
  if (m) {
    const claimed = m[1];
    const backed = profile.citizenship === claimed && opp.citizenshipRequirements.length > 0;
    return {
      ...base,
      recognized: true,
      verified: backed,
      detail: backed ? "Confirmed: matches the user's stated citizenship and the opportunity states a citizenship requirement." : "NOT backed.",
    };
  }

  if (reason === "Available remotely") {
    const backed = opp.remote === true && profile.remoteOk === true;
    return { ...base, recognized: true, verified: backed, detail: backed ? "Confirmed: opportunity is remote and user is open to remote." : "NOT backed." };
  }

  m = reason.match(/^Matches your interest in (.+) opportunities$/);
  if (m) {
    const typeLabel = m[1].replace(/ /g, "_").toUpperCase();
    const backed = profile.preferredTypes.includes(opp.opportunityType) && opp.opportunityType.toLowerCase().replace(/_/g, " ") === m[1];
    return { ...base, recognized: true, verified: backed || profile.preferredTypes.includes(opp.opportunityType), detail: `preferredTypes includes opportunityType=${profile.preferredTypes.includes(opp.opportunityType)}; label check is approximate (${typeLabel}).` };
  }

  if (reason === "Applications are currently open") {
    const backed = opp.deadline != null && opp.deadline.getTime() > Date.now();
    return { ...base, recognized: true, verified: backed, detail: backed ? "Confirmed: deadline is set and in the future." : "NOT backed." };
  }

  return { ...base, recognized: false, verified: false, detail: "Reason string did not match any known template from the scoring code." };
}

export function evaluatePersona(persona: Persona): PersonaEvaluation {
  const scored = CATALOG.map((item) => {
    const match = scoreOpportunity(persona.profile, item.opportunity);
    return { item, match };
  });

  const eligible = scored.filter((s) => s.match.eligible);
  const ineligible = scored.filter((s) => !s.match.eligible);

  // Stable sort by score desc, matching lib/matching/feed.ts's actual tie-break behavior
  // (ties keep catalog insertion order — Array.prototype.sort is stable in V8/Node).
  const rankedEligible: RankedEntry[] = eligible
    .slice()
    .sort((a, b) => b.match.score - a.match.score)
    .map((s) => ({
      id: s.item.opportunity.id,
      title: s.item.opportunity.title,
      tags: s.item.tags,
      score: s.match.score,
      reasons: s.match.reasons,
      match: s.match,
      groundTruth: s.item.groundTruth[persona.id],
    }));

  const top10 = rankedEligible.slice(0, 10);
  const rankedIds = rankedEligible.map((r) => r.id);

  const relevantIds = relevantIdSet(CATALOG, persona.id);
  const metrics = {
    precisionAt5: precisionAtK(rankedIds, relevantIds, 5),
    precisionAt10: precisionAtK(rankedIds, relevantIds, 10),
    recallAt10: recallAtK(rankedIds, relevantIds, 10),
    ndcgAt10: ndcgAtK(rankedIds, CATALOG, persona.id, 10),
    relevantSetSize: relevantIds.size,
  };

  const actualEligibleById = new Map(scored.map((s) => [s.item.opportunity.id, s.match.eligible]));
  const eligibilityAccuracyResult = eligibilityAccuracy(CATALOG, persona.id, actualEligibleById);

  const explanationChecks: ExplanationCheck[] = [];
  for (const entry of top10) {
    const opp = CATALOG.find((c) => c.opportunity.id === entry.id)!.opportunity;
    for (const reason of entry.reasons) {
      explanationChecks.push(verifyReason(reason, persona.profile, opp));
    }
  }

  const truncatedExplanationEntries = top10.filter((entry) => {
    const b = entry.match.breakdown;
    const availableReasonCount =
      b.eligibility.reasons.length +
      b.interest.reasons.length +
      b.skills.reasons.length +
      b.goal.reasons.length +
      b.preference.reasons.length +
      b.timing.reasons.length;
    return availableReasonCount > entry.reasons.length;
  });

  const top10Ids = new Set(top10.map((r) => r.id));
  const missedRelevant = rankedEligible.filter((r) => relevantIds.has(r.id) && !top10Ids.has(r.id));
  const overrankedLowRelevance = top10.filter((r) => r.groundTruth.relevance <= 1);

  const slippedIneligible = eligibilityAccuracyResult.mismatches
    .filter((m) => m.expected === false && m.actual === true)
    .map((m) => {
      const gt = CATALOG.find((c) => c.opportunity.id === m.id)!.groundTruth[persona.id];
      return { id: m.id, title: m.title, note: gt.note };
    });

  // The opposite failure mode: an opportunity we believe the persona genuinely qualifies
  // for is wrongly excluded by the hard gate — worse than ranking low, since it never
  // reaches the eligible list at all, so `missedRelevant` (which only looks within the
  // eligible set) can't catch it.
  const wronglyExcludedRelevant = eligibilityAccuracyResult.mismatches
    .filter((m) => m.expected === true && m.actual === false)
    .map((m) => {
      const gt = CATALOG.find((c) => c.opportunity.id === m.id)!.groundTruth[persona.id];
      return { id: m.id, title: m.title, relevance: gt.relevance, note: gt.note };
    });

  return {
    persona,
    totalCatalogSize: CATALOG.length,
    eligibleCount: eligible.length,
    ineligibleCount: ineligible.length,
    allEligibleRanked: rankedEligible,
    topResults: top10,
    metrics,
    eligibilityAccuracyResult,
    explanationChecks,
    truncatedExplanationEntries,
    missedRelevant,
    wronglyExcludedRelevant,
    overrankedLowRelevance,
    slippedIneligible,
  };
}

export function runFullEvaluation(): Record<PersonaId, PersonaEvaluation> {
  const result = {} as Record<PersonaId, PersonaEvaluation>;
  for (const persona of PERSONAS) {
    result[persona.id] = evaluatePersona(persona);
  }
  return result;
}

export { CATALOG };
