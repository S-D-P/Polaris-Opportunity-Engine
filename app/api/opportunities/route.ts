import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { optionalUser } from "@/lib/auth/guards";
import { opportunityFilterSchema } from "@/lib/validation/opportunity";
import { searchOpportunities } from "@/lib/search/index";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { ok, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const typeParam = req.nextUrl.searchParams.getAll("type");
  const input = opportunityFilterSchema.parse({
    ...params,
    type: typeParam.length > 0 ? typeParam : undefined,
  });

  const { results, total } = await searchOpportunities({
    keywordQuery: input.q,
    filters: {
      types: input.type,
      remote: input.remote,
      hybrid: input.hybrid,
      inPerson: input.inPerson,
      isFree: input.isFree,
      deadlineBefore: input.deadlineBefore,
      countries: input.country ? [input.country] : undefined,
    },
    sort: input.sort,
    page: input.page,
    pageSize: input.pageSize,
  });

  const user = await optionalUser();
  let matchProfile = null;
  if (user) {
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (profile) matchProfile = toMatchProfile(profile);
  }

  const opportunities = results.map(({ opportunity, relevance }) => {
    const base = { ...opportunity, relevance };
    if (!matchProfile) return base;
    const match = scoreOpportunity(matchProfile, toMatchOpportunity(opportunity));
    return {
      ...base,
      matchScore: match.eligible ? match.score : null,
      matchReasons: match.eligible ? match.reasons : [],
    };
  });

  return ok({ opportunities, total, page: input.page, pageSize: input.pageSize });
});
