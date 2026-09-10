import type { MatchProfile, MatchOpportunity } from "@/lib/matching/types";

/**
 * Hard eligibility gate. An opportunity that violates an *explicit* stated constraint is
 * excluded from personalized recommendations, no matter how well its topic matches the
 * user's interests — per the product requirement that eligibility act as a hard
 * constraint, not a scoring input. Absence of a stated constraint is never treated as a
 * violation (we don't know the requirement, so we don't gate on it).
 */
export function checkEligibility(
  profile: MatchProfile,
  opportunity: MatchOpportunity
): { eligible: boolean; reasons: string[] } {
  const violations: string[] = [];

  // Citizenship
  if (opportunity.citizenshipRequirements.length > 0 && profile.citizenship) {
    const allowed = opportunity.citizenshipRequirements.map((c) => c.toLowerCase());
    const isAny = allowed.includes("any") || allowed.includes("all") || allowed.includes("open");
    if (!isAny && !allowed.includes(profile.citizenship.toLowerCase())) {
      violations.push(
        `Requires citizenship in ${opportunity.citizenshipRequirements.join(", ")}`
      );
    }
  }

  // Age
  if (profile.ageYears != null) {
    if (opportunity.minimumAge != null && profile.ageYears < opportunity.minimumAge) {
      violations.push(`Requires a minimum age of ${opportunity.minimumAge}`);
    }
    if (opportunity.maximumAge != null && profile.ageYears > opportunity.maximumAge) {
      violations.push(`Requires a maximum age of ${opportunity.maximumAge}`);
    }
  }

  // Education level — only gate when the opportunity states requirements AND the user
  // has declared a stage; this is a soft-structured field so we match on substring/stage
  // keywords rather than an exact enum comparison.
  if (opportunity.educationRequirements.length > 0 && profile.stage) {
    const stageMatches = opportunity.educationRequirements.some((req) =>
      stageSatisfiesRequirement(profile.stage!, req)
    );
    if (!stageMatches) {
      violations.push(`Requires: ${opportunity.educationRequirements.join(", ")}`);
    }
  }

  // Experience — only gate when both sides have real numbers to compare, and only on a
  // clearly-parseable requirement. Ranges ("0-3 years") set both a floor and a ceiling —
  // an intentionally early-career-only listing, not "3+ years" (the previous regex matched
  // the range's second number as if it were a bare minimum, silently inverting the
  // requirement — found via docs/recommendation-baseline.md's evaluation).
  if (opportunity.experienceRequirements.length > 0 && profile.yearsExperience != null) {
    for (const req of opportunity.experienceRequirements) {
      const parsed = parseExperienceRequirement(req);
      if (!parsed) continue;
      if (parsed.min != null && profile.yearsExperience < parsed.min) {
        violations.push(`Requires ${parsed.min}+ years of experience`);
        continue;
      }
      if (parsed.max != null && profile.yearsExperience > parsed.max) {
        violations.push(`Requires ${parsed.max} years of experience or less`);
        continue;
      }
      // Domain-aware check: a requirement that names a specific field ("3+ years policy
      // experience") shouldn't be satisfied by numerically-sufficient but unrelated
      // experience. Only gates when the profile actually states a domain signal that
      // clearly doesn't overlap — if the profile has nothing to check against, we don't
      // know either way, so (matching the rest of this gate's philosophy) we don't exclude.
      const domain = extractRequirementDomain(req);
      if (domain) {
        const profileSignal = [...profile.academicInterests, ...profile.skills, ...profile.technologies]
          .join(" ")
          .toLowerCase();
        if (profileSignal && !profileSignal.includes(domain)) {
          violations.push(`Requires experience in ${domain}`);
        }
      }
    }
  }

  // Gender — only enforced for GENDER_REQUIRED (an explicit restriction), never for
  // GENDER_PREFERRED ("women encouraged to apply" is not a hard exclusion — docs/personalization.md).
  // Only gates when the user has stated a gender; unset gender is unknown, not a violation.
  if (opportunity.genderEligibility === "GENDER_REQUIRED" && profile.gender && opportunity.genderRestrictedTo.length > 0) {
    const allowed = opportunity.genderRestrictedTo.map((g) => g.toLowerCase());
    if (!allowed.includes(profile.gender.toLowerCase())) {
      violations.push(`Eligibility is restricted to: ${opportunity.genderRestrictedTo.join(", ")}`);
    }
  }

  // Geography — only enforced for the tiers that state a specific, singular restriction
  // (INDIA_ONLY, COUNTRY_SPECIFIC). REGION_SPECIFIC is deliberately not hard-gated here: we
  // have no structured "region" on the profile to compare against, and guessing whether a
  // country falls in a named region risks a false exclusion — safer as a soft signal only
  // (lib/matching/scoring.ts). GLOBAL/REMOTE_GLOBAL/LOCATION_UNKNOWN never gate.
  const userLocation = (profile.country || profile.citizenship || "").toLowerCase();
  if (userLocation) {
    if (opportunity.geographicScope === "INDIA_ONLY" && !userLocation.includes("india")) {
      violations.push("Restricted to applicants located in or citizens of India");
    } else if (
      opportunity.geographicScope === "COUNTRY_SPECIFIC" &&
      opportunity.geographicDetail &&
      !userLocation.includes(opportunity.geographicDetail.toLowerCase())
    ) {
      violations.push(`Restricted to ${opportunity.geographicDetail}`);
    }
  }

  // Closed/expired opportunities are never eligible for active recommendation. EXPIRED is
  // distinct from CLOSED (inferred from a passed deadline vs. explicitly stated) but both
  // mean the same thing for eligibility purposes (docs/ingestion-roadmap.md Part 11).
  if (opportunity.status === "CLOSED") {
    violations.push("Applications are closed");
  } else if (opportunity.status === "EXPIRED") {
    violations.push("Application deadline has passed");
  } else if (opportunity.deadline && opportunity.deadline.getTime() < Date.now()) {
    // A real, live gap found via evaluation (docs/recommendation-baseline.md): `status` only
    // flips to EXPIRED via a re-fetch or the periodic freshness sweep
    // (scripts/refresh-freshness.ts) — between sweeps, a stale OPEN/CLOSING_SOON row with a
    // passed date would otherwise stay eligible. Checking the actual date directly here means
    // eligibility is never wrong for longer than it takes to check, regardless of whether the
    // background sweep has run yet — the sweep still exists to keep `status` itself accurate
    // for display/sorting, this is a second, independent guarantee at recommendation time.
    violations.push("Application deadline has passed");
  }

  return { eligible: violations.length === 0, reasons: violations };
}

function stageSatisfiesRequirement(stage: string, requirement: string): boolean {
  const r = requirement.toLowerCase();
  const stageKeywords: Record<string, string[]> = {
    SCHOOL_STUDENT: ["school", "high school", "secondary"],
    UNDERGRADUATE: ["undergraduate", "undergrad", "bachelor"],
    GRADUATE: ["graduate", "master", "phd", "doctoral"],
    RECENT_GRADUATE: ["recent graduate", "graduate", "undergraduate", "bachelor"],
    EARLY_CAREER: ["early-career", "early career", "professional", "any education"],
    MID_CAREER: ["mid-career", "mid career", "professional", "any education"],
    EXPERIENCED: ["experienced", "senior", "professional", "any education"],
  };
  const keywords = stageKeywords[stage] ?? [];
  // Word-boundary match, not substring — "undergraduate" must not satisfy a check for the
  // keyword "graduate", which a plain .includes() wrongly allowed (there's no boundary
  // between "under" and "graduate" inside "undergraduate", so \b correctly excludes it).
  return (
    keywords.some((k) => hasWordMatch(r, k)) || hasWordMatch(r, "any") || r.includes("all levels")
  );
}

function hasWordMatch(haystack: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

// Recognized experience-requirement phrasings (docs/recommendation-baseline.md's evaluation
// found the previous single "N+ years" regex silently inverted ranges like "0-3 years" into
// "requires 3+ years"). Order matters: range/bound phrasings are checked before the bare
// "N years" fallback so they aren't shadowed by it.
function parseExperienceRequirement(req: string): { min?: number; max?: number } | null {
  const r = req.toLowerCase();
  if (/no (?:prior )?experience|entry.level/.test(r)) return null;

  let m = r.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*\+?\s*years?/);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };

  m = r.match(/(?:less than|under|fewer than|at most|up to)\s*(\d+)\s*years?/);
  if (m) return { max: parseInt(m[1], 10) };

  m =
    r.match(/(\d+)\s*\+\s*years?/) ||
    r.match(/(\d+)\s*(?:or more)\s*years?/) ||
    r.match(/(?:at least|minimum(?:\s*of)?)\s*(\d+)\s*years?/);
  if (m) return { min: parseInt(m[1], 10) };

  m = r.match(/(\d+)\s*years?/);
  if (m) return { min: parseInt(m[1], 10) };

  return null;
}

// A small, honest heuristic, not a claim of true domain understanding: only recognizes a
// fixed set of common field names explicitly named in a requirement's own text, and only
// gates on it when the profile has some stated signal to check against (see caller) — never
// invents a domain, never gates on total absence of profile data.
const REQUIREMENT_DOMAINS = [
  "policy", "engineering", "research", "science", "finance", "business", "medicine", "law",
  "education", "design", "marketing", "product", "sales", "operations", "consulting",
];

function extractRequirementDomain(req: string): string | null {
  const r = req.toLowerCase();
  return REQUIREMENT_DOMAINS.find((d) => hasWordMatch(r, d)) ?? null;
}
