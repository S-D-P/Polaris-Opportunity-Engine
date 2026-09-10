import { prisma } from "@/lib/db/client";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import type { Opportunity } from "@prisma/client";
import type { MatchResult } from "@/lib/matching/types";

export interface FeedItem {
  opportunity: Opportunity;
  match: MatchResult;
}

/**
 * Generates the personalized feed for one user: eligibility-gates and scores every
 * active opportunity, returns only eligible ones ranked by score. Per the product
 * principle (docs §28), this intentionally returns a bounded, curated set rather than
 * "everything that scored above zero."
 */
export async function generateFeed(userId: string, limit = 30): Promise<FeedItem[]> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return [];

  const opportunities = await prisma.opportunity.findMany({
    // isSeedData: false keeps demo/evaluation fixtures out of the real personalized feed
    // (docs/personalization.md) — they still exist for tests/eval/admin, just never here.
    // The COURSE+NEEDS_REVIEW exclusion matches lib/search/index.ts's same filter — see its
    // comment for why this specific combination (not all NEEDS_REVIEW) is excluded.
    where: {
      status: { in: ["OPEN", "CLOSING_SOON"] },
      isSeedData: false,
      NOT: { opportunityType: "COURSE", verificationStatus: "NEEDS_REVIEW" },
    },
    orderBy: { dateDiscovered: "desc" },
    take: 500,
  });

  const matchProfile = toMatchProfile(profile);

  const scored = opportunities.map((opp) => ({
    opportunity: opp,
    match: scoreOpportunity(matchProfile, toMatchOpportunity(opp)),
  }));

  return scored
    .filter((s) => s.match.eligible && s.match.score > 0)
    .sort((a, b) => {
      const tierDiff = lifecycleTier(a.opportunity) - lifecycleTier(b.opportunity);
      if (tierDiff !== 0) return tierDiff;
      // Within the "approaching deadline" tier, soonest first; every other tier ranks
      // purely by personalized relevance (docs §4's "within each lifecycle group, continue
      // using the deterministic recommendation engine to personalize relevance").
      if (
        lifecycleTier(a.opportunity) === 0 &&
        a.opportunity.deadline &&
        b.opportunity.deadline
      ) {
        const dateDiff = a.opportunity.deadline.getTime() - b.opportunity.deadline.getTime();
        if (dateDiff !== 0) return dateDiff;
      }
      return b.match.score - a.match.score;
    })
    .slice(0, limit);
}

/**
 * Lifecycle ordering for the main discovery feed (docs/personalization.md): opportunities
 * with a known, approaching real deadline surface first (most urgent/actionable), then
 * rolling/ongoing opportunities (always actionable, no urgency signal), then everything
 * whose timing simply isn't known. EXPIRED/CLOSED never reach here at all — filtered by
 * `generateFeed`'s own status query above, not by this function.
 */
function lifecycleTier(opp: { deadlineType: string; deadline: Date | null }): number {
  if (opp.deadlineType === "FIXED" && opp.deadline) return 0;
  if (opp.deadlineType === "ROLLING" || opp.deadlineType === "ONGOING") return 1;
  return 2;
}
