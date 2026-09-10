import type { Opportunity, Profile } from "@prisma/client";
import { fromJsonArray } from "@/lib/db/json";
import { jsonToEmbedding } from "@/lib/ai/embeddings";
import type { MatchOpportunity, MatchProfile } from "@/lib/matching/types";

function parseAgeRange(ageRange: string | null): number | null {
  if (!ageRange) return null;
  const match = ageRange.match(/(\d+)\s*-\s*(\d+)/);
  if (match) return Math.round((parseInt(match[1], 10) + parseInt(match[2], 10)) / 2);
  const single = ageRange.match(/(\d+)/);
  return single ? parseInt(single[1], 10) : null;
}

export function toMatchProfile(profile: Profile): MatchProfile {
  return {
    stage: profile.stage,
    country: profile.country,
    citizenship: profile.citizenship,
    gender: profile.gender,
    academicInterests: fromJsonArray(profile.academicInterests),
    skills: fromJsonArray(profile.skills),
    technologies: fromJsonArray(profile.technologies),
    interests: fromJsonArray(profile.interests),
    aspirationsRaw: profile.aspirationsRaw,
    aspirationsSummary: profile.aspirationsSummary,
    goalTags: fromJsonArray(profile.goalTags),
    remoteOk: profile.remoteOk,
    hybridOk: profile.hybridOk,
    inPersonOk: profile.inPersonOk,
    preferredCountries: fromJsonArray(profile.preferredCountries),
    paidOnly: profile.paidOnly,
    preferredTypes: fromJsonArray(profile.preferredTypes),
    yearsExperience: profile.yearsExperience,
    ageYears: parseAgeRange(profile.ageRange),
  };
}

export function toMatchOpportunity(opp: Opportunity): MatchOpportunity {
  return {
    id: opp.id,
    opportunityType: opp.opportunityType,
    categories: fromJsonArray(opp.categories),
    fields: fromJsonArray(opp.fields),
    skills: fromJsonArray(opp.skills),
    targetAudience: fromJsonArray(opp.targetAudience),
    minimumAge: opp.minimumAge,
    maximumAge: opp.maximumAge,
    educationRequirements: fromJsonArray(opp.educationRequirements),
    experienceRequirements: fromJsonArray(opp.experienceRequirements),
    citizenshipRequirements: fromJsonArray(opp.citizenshipRequirements),
    countries: fromJsonArray(opp.countries),
    geographicScope: opp.geographicScope,
    geographicDetail: opp.geographicDetail,
    genderEligibility: opp.genderEligibility,
    genderRestrictedTo: fromJsonArray(opp.genderRestrictedTo),
    remote: opp.remote,
    hybrid: opp.hybrid,
    inPerson: opp.inPerson,
    isFree: opp.isFree,
    deadline: opp.deadline,
    status: opp.status,
    description: opp.description,
    title: opp.title,
    embedding: jsonToEmbedding(opp.embedding),
  };
}
