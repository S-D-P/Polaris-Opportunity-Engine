import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { ok, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async () => {
  await requireAdmin();

  const [
    totalOpportunities,
    activeOpportunities,
    expiringSoon,
    needsReview,
    totalSources,
    totalUsers,
    totalSaves,
    totalApplied,
  ] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { status: { in: ["OPEN", "CLOSING_SOON"] } } }),
    prisma.opportunity.count({
      where: {
        deadline: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) },
      },
    }),
    prisma.opportunity.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    prisma.source.count(),
    prisma.user.count(),
    prisma.trackedOpportunity.count(),
    prisma.trackedOpportunity.count({ where: { status: "APPLIED" } }),
  ]);

  return ok({
    totalOpportunities,
    activeOpportunities,
    expiringSoon,
    needsReview,
    totalSources,
    totalUsers,
    totalSaves,
    totalApplied,
  });
});
