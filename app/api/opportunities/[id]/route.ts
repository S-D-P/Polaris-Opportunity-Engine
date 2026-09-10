import { prisma } from "@/lib/db/client";
import { optionalUser } from "@/lib/auth/guards";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const opportunity = await prisma.opportunity.findUnique({ where: { id } });
    if (!opportunity) return apiError("Opportunity not found", 404);

    const user = await optionalUser();
    if (!user) return ok({ opportunity, match: null });

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return ok({ opportunity, match: null });

    const match = scoreOpportunity(toMatchProfile(profile), toMatchOpportunity(opportunity));
    return ok({ opportunity, match });
  }
);
