import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { trackerUpdateSchema } from "@/lib/validation/tracker";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";

async function assertOwnership(id: string, userId: string) {
  const tracked = await prisma.trackedOpportunity.findUnique({ where: { id } });
  if (!tracked || tracked.userId !== userId) return null;
  return tracked;
}

export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const existing = await assertOwnership(id, user.id);
    if (!existing) return apiError("Tracked item not found", 404);

    const input = trackerUpdateSchema.parse(await req.json());
    const updated = await prisma.trackedOpportunity.update({ where: { id }, data: input });
    return ok(updated);
  }
);

export const DELETE = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await params;
    const existing = await assertOwnership(id, user.id);
    if (!existing) return apiError("Tracked item not found", 404);

    await prisma.trackedOpportunity.delete({ where: { id } });
    return ok({ deleted: true });
  }
);
