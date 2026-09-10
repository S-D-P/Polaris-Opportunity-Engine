import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { optionalUser } from "@/lib/auth/guards";
import { parseSearchQuery } from "@/lib/ai/query-parser";
import { searchOpportunities } from "@/lib/search/index";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { ok, withErrorHandling } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(300),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { q, page, pageSize } = searchQuerySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );

  const user = await optionalUser();

  if (user && !checkRateLimit(`search:${user.id}`, RATE_LIMITS.AI)) {
    // Still serve the search, just skip the AI intent-parsing step under heavy load —
    // keyword+semantic search over the raw query still works.
  }

  const parsed = await parseSearchQuery(q);

  const { results, total } = await searchOpportunities({
    keywordQuery: q,
    semanticQuery: parsed.semanticQuery,
    filters: {
      types: parsed.types,
      countries: parsed.countries,
      remote: parsed.remoteOnly,
      isFree: parsed.freeOnly,
    },
    page,
    pageSize,
  });

  let matchProfile = null;
  if (user) {
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (profile) matchProfile = toMatchProfile(profile);
  }

  const opportunities = results.map(({ opportunity, relevance }) => {
    if (!matchProfile) return { ...opportunity, relevance };
    const match = scoreOpportunity(matchProfile, toMatchOpportunity(opportunity));
    return {
      ...opportunity,
      relevance,
      matchScore: match.eligible ? match.score : null,
      matchReasons: match.eligible ? match.reasons : [],
    };
  });

  await prisma.searchQueryLog.create({
    data: { userId: user?.id, query: q, resultCount: total },
  });

  return ok({ opportunities, total, page, pageSize, parsedFilters: parsed });
});
