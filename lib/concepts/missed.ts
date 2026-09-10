import { prisma } from "@/lib/db/client";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import type { MatchResult } from "@/lib/matching/types";
import type { Opportunity } from "@prisma/client";

export interface MissedItem {
  opportunity: Opportunity;
  match: MatchResult;
}

const MIN_SCORE_TO_SURFACE = 40;

/**
 * "You might have missed this" (brief §5.4): real, eligible, well-scored opportunities that
 * fall outside the user's *current* narrow filter/search, surfaced only because they
 * genuinely score well against the user's actual profile — never a random suggestion, and
 * never shown without the caller being able to say *why* (the returned MatchResult carries
 * the same real reasons as everywhere else). Requires a signed-in profile: without one,
 * there's no honest basis for "this fits your goals" and the function returns nothing
 * rather than guessing.
 */
export async function findMissedOpportunities(params: {
  userId: string | null;
  excludeIds: string[];
  excludeTypes?: string[];
  limit?: number;
}): Promise<MissedItem[]> {
  const { userId, excludeIds, excludeTypes = [], limit = 3 } = params;
  if (!userId) return [];

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return [];

  const candidates = await prisma.opportunity.findMany({
    where: {
      status: { in: ["OPEN", "CLOSING_SOON"] },
      id: { notIn: excludeIds },
    },
    take: 300,
    orderBy: { dateDiscovered: "desc" },
  });

  const matchProfile = toMatchProfile(profile);

  const scored = candidates
    .map((opportunity) => ({ opportunity, match: scoreOpportunity(matchProfile, toMatchOpportunity(opportunity)) }))
    .filter((s) => s.match.eligible && s.match.score >= MIN_SCORE_TO_SURFACE)
    .filter((s) => !excludeTypes.includes(s.opportunity.opportunityType));

  return scored.sort((a, b) => b.match.score - a.match.score).slice(0, limit);
}
