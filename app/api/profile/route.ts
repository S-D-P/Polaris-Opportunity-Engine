import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { profileUpdateSchema } from "@/lib/validation/profile";
import { toJsonArray } from "@/lib/db/json";
import { extractAspiration } from "@/lib/ai/aspirations";
import { ok, withErrorHandling } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";

// Server-side safety net for array-of-string fields (docs/personalization.md) — the TagInput
// UI never produces empty/duplicate entries, but this guards the API contract itself rather
// than trusting the client, case-insensitive so "USA" and "usa" don't both get stored.
function dedupeTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const trimmed = v.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export const GET = withErrorHandling(async () => {
  const user = await requireUser();
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return ok(profile);
});

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const user = await requireUser();
  const body = await req.json();
  const input = profileUpdateSchema.parse(body);

  const {
    academicInterests,
    skills,
    technologies,
    interests,
    preferredCountries,
    preferredTypes,
    aspirationsRaw,
    ...rest
  } = input;

  const data: Prisma.ProfileUncheckedUpdateInput = { ...rest };
  if (academicInterests) data.academicInterests = toJsonArray(academicInterests);
  if (skills) data.skills = toJsonArray(skills);
  if (technologies) data.technologies = toJsonArray(technologies);
  if (interests) data.interests = toJsonArray(interests);
  if (preferredCountries) data.preferredCountries = toJsonArray(dedupeTrimmed(preferredCountries));
  if (preferredTypes) data.preferredTypes = toJsonArray(preferredTypes);

  if (aspirationsRaw !== undefined) {
    data.aspirationsRaw = aspirationsRaw;
    const extraction = await extractAspiration(aspirationsRaw);
    if (extraction) {
      data.aspirationsSummary = extraction.summary;
      data.goalTags = toJsonArray(extraction.goalTags);
    }
  }

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, ...data } as Prisma.ProfileUncheckedCreateInput,
  });

  return ok(profile);
});
