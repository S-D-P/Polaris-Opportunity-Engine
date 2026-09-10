import type { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { sourceCreateSchema } from "@/lib/validation/opportunity";
import { toJsonArray } from "@/lib/db/json";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";

export const GET = withErrorHandling(async () => {
  await requireAdmin();
  const sources = await prisma.source.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { opportunities: true, jobs: true } },
      complianceRecord: { select: { automatedAccessStatus: true, sourceName: true } },
    },
  });
  return ok({ sources });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireAdmin();
  const input = sourceCreateSchema.parse(await req.json());

  // If a compliance record is referenced, snapshot its status/check-date onto the Source
  // (the denormalized fields documented in docs/ingestion-roadmap.md Part 5) — source of
  // truth stays the record itself; the gate always reads the live relation, never this copy.
  let complianceSnapshot: Pick<Prisma.SourceUncheckedCreateInput, "complianceStatus" | "lastPolicyCheckAt"> = {};
  if (input.complianceRecordId) {
    const record = await prisma.sourceComplianceRecord.findUnique({
      where: { id: input.complianceRecordId },
    });
    if (!record) return apiError("complianceRecordId does not reference an existing compliance record", 400);
    complianceSnapshot = {
      complianceStatus: record.automatedAccessStatus,
      lastPolicyCheckAt: record.lastPolicyCheckAt,
    };
  }

  const data: Prisma.SourceUncheckedCreateInput = {
    name: input.name,
    organization: input.organization,
    sourceType: input.sourceType,
    url: input.url,
    config: input.config ? JSON.stringify(input.config) : null,
    complianceRecordId: input.complianceRecordId,
    categoryCoverage: input.categoryCoverage ? toJsonArray(input.categoryCoverage) : undefined,
    geographicCoverage: input.geographicCoverage ? toJsonArray(input.geographicCoverage) : undefined,
    crawlFrequency: input.crawlFrequency,
    rateLimit: input.rateLimit,
    extractionMethod: input.extractionMethod,
    ...complianceSnapshot,
  };
  const source = await prisma.source.create({ data });
  return ok(source, 201);
});
