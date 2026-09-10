import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { ok, withErrorHandling } from "@/lib/api-response";

const querySchema = z.object({
  verificationStatus: z.enum(["VERIFIED", "AI_EXTRACTED", "NEEDS_REVIEW"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireAdmin();
  const { verificationStatus, page, pageSize } = querySchema.parse(
    Object.fromEntries(req.nextUrl.searchParams.entries())
  );

  const where = verificationStatus ? { verificationStatus } : {};
  const [opportunities, total] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      orderBy: { dateDiscovered: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { source: { select: { name: true } } },
    }),
    prisma.opportunity.count({ where }),
  ]);

  return ok({ opportunities, total, page, pageSize });
});
