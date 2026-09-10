import { describe, expect, it } from "vitest";
import { checkEligibility } from "@/lib/matching/eligibility";
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
    deadline: null,
    status: "OPEN",
    description: "",
    title: "Test Opportunity",
    embedding: null,
    ...overrides,
  };
}

describe("checkEligibility", () => {
  it("is eligible when the opportunity states no constraints", () => {
    const result = checkEligibility(baseProfile(), baseOpportunity());
    expect(result.eligible).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("rejects a citizenship mismatch", () => {
    const profile = baseProfile({ citizenship: "India" });
    const opp = baseOpportunity({ citizenshipRequirements: ["United States"] });
    const result = checkEligibility(profile, opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/citizenship/i);
  });

  it("accepts when citizenship requirement is 'any'", () => {
    const profile = baseProfile({ citizenship: "India" });
    const opp = baseOpportunity({ citizenshipRequirements: ["any"] });
    expect(checkEligibility(profile, opp).eligible).toBe(true);
  });

  it("does not gate on citizenship when the user hasn't stated one", () => {
    const opp = baseOpportunity({ citizenshipRequirements: ["United States"] });
    expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
  });

  it("rejects when the user is younger than the stated minimum age", () => {
    const profile = baseProfile({ ageYears: 16 });
    const opp = baseOpportunity({ minimumAge: 18 });
    const result = checkEligibility(profile, opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/minimum age/i);
  });

  it("rejects when the user is older than the stated maximum age", () => {
    const profile = baseProfile({ ageYears: 35 });
    const opp = baseOpportunity({ maximumAge: 30 });
    expect(checkEligibility(profile, opp).eligible).toBe(false);
  });

  it("accepts a user within a stated age range", () => {
    const profile = baseProfile({ ageYears: 24 });
    const opp = baseOpportunity({ minimumAge: 20, maximumAge: 30 });
    expect(checkEligibility(profile, opp).eligible).toBe(true);
  });

  it("rejects insufficient years of experience against an explicit requirement", () => {
    const profile = baseProfile({ yearsExperience: 2 });
    const opp = baseOpportunity({ experienceRequirements: ["8+ years experience"] });
    const result = checkEligibility(profile, opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/8\+ years/i);
  });

  it("accepts sufficient years of experience", () => {
    const profile = baseProfile({ yearsExperience: 10 });
    const opp = baseOpportunity({ experienceRequirements: ["8+ years experience"] });
    expect(checkEligibility(profile, opp).eligible).toBe(true);
  });

  // Regression tests for docs/recommendation-baseline.md's evaluation findings.
  it("treats '0-3 years' as an early-career ceiling, not a 3+ year floor", () => {
    const opp = baseOpportunity({ experienceRequirements: ["0-3 years professional experience"] });
    expect(checkEligibility(baseProfile({ yearsExperience: 1 }), opp).eligible).toBe(true);
    expect(checkEligibility(baseProfile({ yearsExperience: 10 }), opp).eligible).toBe(false);
  });

  it("parses a '3-5 years' range as both a floor and a ceiling", () => {
    const opp = baseOpportunity({ experienceRequirements: ["3-5 years experience"] });
    expect(checkEligibility(baseProfile({ yearsExperience: 1 }), opp).eligible).toBe(false);
    expect(checkEligibility(baseProfile({ yearsExperience: 4 }), opp).eligible).toBe(true);
    expect(checkEligibility(baseProfile({ yearsExperience: 8 }), opp).eligible).toBe(false);
  });

  it("parses 'less than 2 years' as a ceiling", () => {
    const opp = baseOpportunity({ experienceRequirements: ["less than 2 years experience"] });
    expect(checkEligibility(baseProfile({ yearsExperience: 0 }), opp).eligible).toBe(true);
    expect(checkEligibility(baseProfile({ yearsExperience: 5 }), opp).eligible).toBe(false);
  });

  it("never gates on 'no experience required'", () => {
    const opp = baseOpportunity({ experienceRequirements: ["no experience required"] });
    expect(checkEligibility(baseProfile({ yearsExperience: 0 }), opp).eligible).toBe(true);
  });

  it("does not let unrelated experience satisfy a domain-specific requirement", () => {
    const opp = baseOpportunity({ experienceRequirements: ["3+ years policy experience"] });
    const engineeringProfile = baseProfile({ yearsExperience: 10, skills: ["Software Engineering"] });
    expect(checkEligibility(engineeringProfile, opp).eligible).toBe(false);
    const policyProfile = baseProfile({ yearsExperience: 4, skills: ["Policy Analysis"] });
    expect(checkEligibility(policyProfile, opp).eligible).toBe(true);
  });

  it("does not gate a domain-specific requirement when the profile has no domain signal at all", () => {
    const opp = baseOpportunity({ experienceRequirements: ["3+ years policy experience"] });
    const blankProfile = baseProfile({ yearsExperience: 10 });
    expect(checkEligibility(blankProfile, opp).eligible).toBe(true);
  });

  it("does not let 'undergraduate' satisfy a GRADUATE stage via substring match", () => {
    const profile = baseProfile({ stage: "GRADUATE" });
    const opp = baseOpportunity({ educationRequirements: ["undergraduate"] });
    expect(checkEligibility(profile, opp).eligible).toBe(false);
  });

  it("rejects a closed opportunity regardless of other signals", () => {
    const opp = baseOpportunity({ status: "CLOSED" });
    const result = checkEligibility(baseProfile(), opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/closed/i);
  });

  it("rejects an expired opportunity the same as a closed one", () => {
    const opp = baseOpportunity({ status: "EXPIRED" });
    const result = checkEligibility(baseProfile(), opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/deadline/i);
  });

  // Deadline-freshness regression tests (docs/recommendation-baseline.md): the gate now
  // checks the actual deadline date directly, not only `status`, so a stale row whose status
  // hasn't been synced by the freshness sweep yet is still correctly excluded.
  it("rejects a passed fixed deadline even when status is still OPEN (freshness sweep hasn't run yet)", () => {
    const opp = baseOpportunity({ status: "OPEN", deadline: new Date(Date.now() - 24 * 60 * 60 * 1000) });
    const result = checkEligibility(baseProfile(), opp);
    expect(result.eligible).toBe(false);
    expect(result.reasons[0]).toMatch(/deadline/i);
  });

  it("accepts a deadline later today", () => {
    const opp = baseOpportunity({ status: "OPEN", deadline: new Date(Date.now() + 60 * 60 * 1000) });
    expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
  });

  it("accepts a future fixed deadline", () => {
    const opp = baseOpportunity({ status: "OPEN", deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
  });

  it("never gates on a null deadline regardless of deadlineType (rolling/ongoing/not-stated)", () => {
    // checkEligibility only sees `deadline`/`status`, not `deadlineType` directly — this
    // confirms a null deadline is never itself treated as a violation, whatever the reason
    // for it being null (the UI layer, lib/deadline.ts, is what distinguishes the label).
    const opp = baseOpportunity({ status: "OPEN", deadline: null });
    expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
  });

  it("gates education requirements against the user's stage", () => {
    const profile = baseProfile({ stage: "SCHOOL_STUDENT" });
    const opp = baseOpportunity({ educationRequirements: ["undergraduate"] });
    expect(checkEligibility(profile, opp).eligible).toBe(false);
  });

  it("accepts a matching stage for stated education requirements", () => {
    const profile = baseProfile({ stage: "UNDERGRADUATE" });
    const opp = baseOpportunity({ educationRequirements: ["undergraduate"] });
    expect(checkEligibility(profile, opp).eligible).toBe(true);
  });

  describe("gender eligibility", () => {
    it("rejects a user whose gender isn't in a GENDER_REQUIRED restriction", () => {
      const profile = baseProfile({ gender: "man" });
      const opp = baseOpportunity({ genderEligibility: "GENDER_REQUIRED", genderRestrictedTo: ["woman"] });
      const result = checkEligibility(profile, opp);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/restricted to/i);
    });

    it("accepts a user whose gender matches a GENDER_REQUIRED restriction", () => {
      const profile = baseProfile({ gender: "woman" });
      const opp = baseOpportunity({ genderEligibility: "GENDER_REQUIRED", genderRestrictedTo: ["woman", "non-binary"] });
      expect(checkEligibility(profile, opp).eligible).toBe(true);
    });

    it("never excludes for GENDER_PREFERRED, only GENDER_REQUIRED", () => {
      const profile = baseProfile({ gender: "man" });
      const opp = baseOpportunity({ genderEligibility: "GENDER_PREFERRED", genderRestrictedTo: ["woman"] });
      expect(checkEligibility(profile, opp).eligible).toBe(true);
    });

    it("does not gate on gender when the user hasn't stated one", () => {
      const opp = baseOpportunity({ genderEligibility: "GENDER_REQUIRED", genderRestrictedTo: ["woman"] });
      expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
    });

    it("is eligible when the opportunity has no gender restriction at all", () => {
      const profile = baseProfile({ gender: "man" });
      const opp = baseOpportunity({ genderEligibility: "NO_GENDER_RESTRICTION" });
      expect(checkEligibility(profile, opp).eligible).toBe(true);
    });
  });

  describe("geography eligibility", () => {
    it("rejects a non-India user for an INDIA_ONLY opportunity", () => {
      const profile = baseProfile({ country: "United States" });
      const opp = baseOpportunity({ geographicScope: "INDIA_ONLY" });
      const result = checkEligibility(profile, opp);
      expect(result.eligible).toBe(false);
      expect(result.reasons[0]).toMatch(/india/i);
    });

    it("accepts an India-based user for an INDIA_ONLY opportunity", () => {
      const profile = baseProfile({ country: "India" });
      const opp = baseOpportunity({ geographicScope: "INDIA_ONLY" });
      expect(checkEligibility(profile, opp).eligible).toBe(true);
    });

    it("does not gate on geography when the user hasn't stated a location", () => {
      const opp = baseOpportunity({ geographicScope: "INDIA_ONLY" });
      expect(checkEligibility(baseProfile(), opp).eligible).toBe(true);
    });

    it("never gates GLOBAL or REMOTE_GLOBAL opportunities", () => {
      const profile = baseProfile({ country: "France" });
      expect(checkEligibility(profile, baseOpportunity({ geographicScope: "GLOBAL" })).eligible).toBe(true);
      expect(checkEligibility(profile, baseOpportunity({ geographicScope: "REMOTE_GLOBAL" })).eligible).toBe(true);
    });

    it("rejects a mismatched COUNTRY_SPECIFIC opportunity", () => {
      const profile = baseProfile({ country: "India" });
      const opp = baseOpportunity({ geographicScope: "COUNTRY_SPECIFIC", geographicDetail: "Kenya" });
      expect(checkEligibility(profile, opp).eligible).toBe(false);
    });
  });
});
