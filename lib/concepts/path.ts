import type { Opportunity } from "@prisma/client";
import type { MatchResult } from "@/lib/matching/types";

export interface PathStep {
  stageLabel: string;
  opportunity: Opportunity;
  match: MatchResult;
}

// A heuristic progression through the opportunity taxonomy, not a claim about any specific
// career — used to arrange a user's own real matched opportunities into a suggested
// sequence (brief §5.3 "opportunity paths"). Deliberately a prototype: it orders real data
// it already has, it does not fabricate opportunities or claim to plan someone's career.
const STAGE_ORDER: { label: string; types: string[] }[] = [
  { label: "Learn the space", types: ["COURSE", "MENTORSHIP"] },
  { label: "Build visibility", types: ["CONFERENCE", "HACKATHON", "COMPETITION", "OLYMPIAD", "CAMP"] },
  { label: "Get hands-on", types: ["INTERNSHIP", "VOLUNTEERING", "SPEAKING", "JUDGING"] },
  {
    label: "Go deeper",
    types: ["FELLOWSHIP", "RESEARCH_PROGRAM", "SCHOLARSHIP", "GRANT", "LEADERSHIP_PROGRAM", "EXECUTIVE_EDUCATION"],
  },
  { label: "Arrive", types: ["JOB", "ADVISORY", "BOARD", "AWARD"] },
];

/**
 * Picks the best-matched real opportunity for each stage of the heuristic progression, in
 * order, skipping stages the user has no eligible match for. Never invents an opportunity —
 * every step is a real row from `items`.
 */
export function buildOpportunityPath(
  items: { opportunity: Opportunity; match: MatchResult }[]
): PathStep[] {
  const steps: PathStep[] = [];
  for (const stage of STAGE_ORDER) {
    const candidates = items
      .filter((i) => stage.types.includes(i.opportunity.opportunityType))
      .sort((a, b) => b.match.score - a.match.score);
    if (candidates.length > 0) {
      steps.push({ stageLabel: stage.label, opportunity: candidates[0].opportunity, match: candidates[0].match });
    }
  }
  return steps;
}
