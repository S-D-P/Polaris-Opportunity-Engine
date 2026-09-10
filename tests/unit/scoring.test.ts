import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { embedText, embeddingToJson, jsonToEmbedding } from "@/lib/ai/embeddings";
import type { MatchOpportunity, MatchProfile } from "@/lib/matching/types";

function baseProfile(overrides: Partial<MatchProfile> = {}): MatchProfile {
  return {
    stage: null,
    country: null,
    citizenship: null,
    gender: null,
    academicInterests: [],
    skills: [],
    technologies: [],
    interests: [],
    aspirationsRaw: null,
    aspirationsSummary: null,
    goalTags: [],
    remoteOk: true,
    hybridOk: true,
    inPersonOk: true,
    preferredCountries: [],
    paidOnly: false,
    preferredTypes: [],
    yearsExperience: null,
    ageYears: null,
    ...overrides,
  };
}

function baseOpportunity(overrides: Partial<MatchOpportunity> = {}): MatchOpportunity {
  return {
    id: "opp-1",
    opportunityType: "SCHOLARSHIP",
    categories: [],
    fields: [],
    skills: [],
    targetAudience: [],
    minimumAge: null,
    maximumAge: null,
    educationRequirements: [],
    experienceRequirements: [],
    citizenshipRequirements: [],
    countries: [],
    geographicScope: "LOCATION_UNKNOWN",
    geographicDetail: null,
    genderEligibility: "NOT_STATED",
    genderRestrictedTo: [],
    remote: true,
    hybrid: false,
    inPerson: false,
    isFree: true,
    deadline: new Date(Date.now() + 10 * 86400000),
    status: "OPEN",
    description: "",
    title: "Test Opportunity",
    embedding: null,
    ...overrides,
  };
}

describe("scoreOpportunity", () => {
  it("returns score 0 and no reasons for an ineligible opportunity", () => {
    const profile = baseProfile({ citizenship: "India" });
    const opp = baseOpportunity({ citizenshipRequirements: ["United States"] });
    const result = scoreOpportunity(profile, opp);
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
    expect(result.reasons).toHaveLength(0);
    expect(result.ineligibleReasons.length).toBeGreaterThan(0);
  });

  it("scores higher when interests overlap with categories/fields", () => {
    const profile = baseProfile({ interests: ["AI/ML"] });
    const matching = baseOpportunity({ categories: ["AI/ML"] });
    const nonMatching = baseOpportunity({ categories: ["Finance"] });

    const matchResult = scoreOpportunity(profile, matching);
    const nonMatchResult = scoreOpportunity(profile, nonMatching);

    expect(matchResult.score).toBeGreaterThan(nonMatchResult.score);
    expect(matchResult.reasons.some((r) => r.includes("AI/ML"))).toBe(true);
  });

  it("does not double-count or duplicate a reason when interests overlap twice", () => {
    // interests and academicInterests both containing "AI/ML" must not produce two
    // identical "You've shown interest in AI/ML" bullets or inflate the score twice.
    const profile = baseProfile({ interests: ["AI/ML"], academicInterests: ["AI/ML"] });
    const opp = baseOpportunity({ categories: ["AI/ML"] });
    const result = scoreOpportunity(profile, opp);
    const aiReasons = result.reasons.filter((r) => r === "You've shown interest in AI/ML");
    expect(aiReasons).toHaveLength(1);
  });

  it("gives a higher goal_score when the opportunity embedding is semantically close", () => {
    // The embedding is a bag-of-hashed-words model (docs/architecture.md §1) — it matches
    // on literal token overlap, not cross-token synonyms, so fixtures need shared words
    // ("ai", "policy", "technology") to exercise the intended behavior fairly.
    const profile = baseProfile({
      aspirationsSummary: "Wants to work in AI policy and technology regulation.",
    });
    const relevantEmbedding = jsonToEmbedding(
      embeddingToJson(embedText("A fellowship for professionals in AI policy and technology regulation"))
    )!;
    const irrelevantEmbedding = jsonToEmbedding(
      embeddingToJson(embedText("A marine biology summer camp for ocean conservation and coral reefs"))
    )!;

    const relevant = scoreOpportunity(profile, baseOpportunity({ embedding: relevantEmbedding }));
    const irrelevant = scoreOpportunity(profile, baseOpportunity({ embedding: irrelevantEmbedding }));

    expect(relevant.breakdown.goal.score).toBeGreaterThan(irrelevant.breakdown.goal.score);
  });

  it("scores deadline-soon opportunities higher on timing than far-future ones", () => {
    const profile = baseProfile();
    const soon = baseOpportunity({ deadline: new Date(Date.now() + 5 * 86400000) });
    const farFuture = baseOpportunity({ deadline: new Date(Date.now() + 200 * 86400000) });

    const soonResult = scoreOpportunity(profile, soon);
    const farResult = scoreOpportunity(profile, farFuture);

    expect(soonResult.breakdown.timing.score).toBeGreaterThan(farResult.breakdown.timing.score);
  });

  it("caps the total score at 100", () => {
    const profile = baseProfile({
      interests: ["AI/ML", "Public Policy", "Leadership"],
      academicInterests: ["Research"],
      skills: ["Python", "Research"],
      preferredCountries: ["India"],
      preferredTypes: ["SCHOLARSHIP"],
      aspirationsSummary: "AI policy",
    });
    const opp = baseOpportunity({
      categories: ["AI/ML", "Public Policy", "Leadership", "Research"],
      skills: ["Python", "Research"],
      countries: ["India"],
      opportunityType: "SCHOLARSHIP",
      embedding: embedText("AI policy"),
    });
    const result = scoreOpportunity(profile, opp);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
