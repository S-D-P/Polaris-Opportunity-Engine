import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { ok, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const jobs = await prisma.ingestionJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
    include: { source: { select: { name: true, sourceType: true } } },
  });
  return ok({ jobs });
});
