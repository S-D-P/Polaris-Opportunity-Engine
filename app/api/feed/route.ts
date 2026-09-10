import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { generateFeed } from "@/lib/matching/feed";
import { ok, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  const items = await generateFeed(user.id, Math.min(Math.max(limit, 1), 100));
  return ok({
    items: items.map(({ opportunity, match }) => ({
      opportunity,
      matchScore: match.score,
      matchReasons: match.reasons,
    })),
  });
});
