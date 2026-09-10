import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { trackerCreateSchema } from "@/lib/validation/tracker";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const status = req.nextUrl.searchParams.get("status");

  const items = await prisma.trackedOpportunity.findMany({
    where: { userId: user.id, ...(status ? { status: status as never } : {}) },
    include: { opportunity: true },
    orderBy: { updatedAt: "desc" },
  });

  return ok({ items });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json();
  const input = trackerCreateSchema.parse(body);

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
  });
  if (!opportunity) return apiError("Opportunity not found", 404);

  const tracked = await prisma.trackedOpportunity.upsert({
    where: { userId_opportunityId: { userId: user.id, opportunityId: input.opportunityId } },
    update: { status: input.status },
    create: { userId: user.id, opportunityId: input.opportunityId, status: input.status },
  });

  return ok(tracked, 201);
});
