import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/guards";
import { opportunityAdminUpdateSchema } from "@/lib/validation/opportunity";
import { toJsonArray } from "@/lib/db/json";
import { upsertFtsRow } from "@/lib/search/fts";
import { embedText, embeddingToJson } from "@/lib/ai/embeddings";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";

export const PATCH = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await params;
    const existing = await prisma.opportunity.findUnique({ where: { id } });
    if (!existing) return apiError("Opportunity not found", 404);

    const input = opportunityAdminUpdateSchema.parse(await req.json());
    const { categories, fields, skills, targetAudience, educationRequirements,
      experienceRequirements, citizenshipRequirements, countries, benefits, ...rest } = input;

    const data: Prisma.OpportunityUncheckedUpdateInput = { ...rest };
    if (categories) data.categories = toJsonArray(categories);
    if (fields) data.fields = toJsonArray(fields);
    if (skills) data.skills = toJsonArray(skills);
    if (targetAudience) data.targetAudience = toJsonArray(targetAudience);
    if (educationRequirements) data.educationRequirements = toJsonArray(educationRequirements);
    if (experienceRequirements) data.experienceRequirements = toJsonArray(experienceRequirements);
    if (citizenshipRequirements) data.citizenshipRequirements = toJsonArray(citizenshipRequirements);
    if (countries) data.countries = toJsonArray(countries);
    if (benefits) data.benefits = toJsonArray(benefits);

    // A human editing/approving a record is exactly what turns AI-extracted data into
    // verified data (docs/architecture.md §7 / product-spec §11).
    if (input.verificationStatus === "VERIFIED" || !input.verificationStatus) {
      data.reviewedById = admin.id;
      data.reviewedAt = new Date();
    }

    const updated = await prisma.opportunity.update({ where: { id }, data });

    if (input.title || input.description || input.organization) {
      await upsertFtsRow({
        id: updated.id,
        title: updated.title,
        organization: updated.organization,
        description: updated.description,
        tags: "",
      });
    }
    if (input.description) {
      await prisma.opportunity.update({
        where: { id },
        data: {
          embedding: embeddingToJson(embedText(`${updated.title} ${updated.description}`)),
        },
      });
    }

    return ok(updated);
  }
);
