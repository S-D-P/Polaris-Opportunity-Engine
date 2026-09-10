import { cosineSimilarity, embedText } from "@/lib/ai/embeddings";
import { checkEligibility } from "@/lib/matching/eligibility";
import { WEIGHTS } from "@/lib/matching/weights";
import type { MatchOpportunity, MatchProfile, MatchResult, ScoreBreakdown } from "@/lib/matching/types";

const DAY_MS = 1000 * 60 * 60 * 24;

function overlap(a: string[], b: string[]): string[] {
  const bLower = new Set(b.map((x) => x.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const x of a) {
    const key = x.toLowerCase();
    if (bLower.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(x);
    }
  }
  return result;
}

function interestScore(profile: MatchProfile, opp: MatchOpportunity) {
  const oppTopics = [...opp.categories, ...opp.fields];
  const userTopics = [...profile.interests, ...profile.academicInterests];
  const matches = overlap(userTopics, oppTopics);
  if (matches.length === 0) return { score: 0, reasons: [] };
  const score = Math.min(WEIGHTS.INTEREST_MAX, matches.length * 8);
  return {
    score,
    reasons: matches.slice(0, 3).map((m) => `You've shown interest in ${m}`),
  };
}

function skillsScore(profile: MatchProfile, opp: MatchOpportunity) {
  // Skills (capabilities like "Leadership") and technologies (tools like "Python") are kept
  // as distinct profile fields (docs/personalization.md) since they're different signals to
  // collect and reason about, but opportunities only have one `skills` array to match
  // against — so both pools are matched against it here, with technologies called out
  // separately in the explanation so a user can see *which* signal drove the match.
  const skillMatches = overlap(profile.skills, opp.skills);
  const techMatches = overlap(profile.technologies, opp.skills);
  if (skillMatches.length === 0 && techMatches.length === 0) return { score: 0, reasons: [] };
  const score = Math.min(WEIGHTS.SKILLS_MAX, (skillMatches.length + techMatches.length) * 5);
  const reasons: string[] = [];
  if (skillMatches.length > 0) reasons.push(`Your skills include ${skillMatches.slice(0, 3).join(", ")}`);
  if (techMatches.length > 0) reasons.push(`You know ${techMatches.slice(0, 3).join(", ")}`);
  return { score, reasons };
}

function goalScore(profile: MatchProfile, opp: MatchOpportunity) {
  const goalText = profile.aspirationsSummary || profile.aspirationsRaw;
  if (!goalText || !opp.embedding) return { score: 0, reasons: [] };
  const goalEmbedding = embedText(goalText);
  const similarity = cosineSimilarity(goalEmbedding, opp.embedding); // -1..1, usually 0..1
  const normalized = Math.max(0, similarity);
  const score = Math.round(normalized * WEIGHTS.GOAL_MAX);
  if (score < WEIGHTS.GOAL_MAX * 0.35) return { score, reasons: [] };
  return {
    score,
    reasons: ["This aligns with the goals you described"],
  };
}

function preferenceScore(profile: MatchProfile, opp: MatchOpportunity) {
  let score = 0;
  const reasons: string[] = [];

  const modeOk =
    (opp.remote && profile.remoteOk) ||
    (opp.hybrid && profile.hybridOk) ||
    (opp.inPerson && profile.inPersonOk) ||
    (!opp.remote && !opp.hybrid && !opp.inPerson); // mode unspecified: don't penalize
  if (modeOk) {
    score += 6;
    if (opp.remote && profile.remoteOk) reasons.push("Available remotely");
  }

  // Geography — geographicScope (docs/geographic-model.md) is the real, populated signal for
  // real-ingested opportunities; the legacy `countries` array is mostly empty outside seed
  // data, so it's checked first but geographicScope is what actually carries this for most
  // of the catalog (closing the "collected field that does nothing" gap flagged in
  // docs/personalization.md).
  if (profile.preferredCountries.length > 0 && opp.countries.length > 0) {
    const countryMatch = overlap(profile.preferredCountries, opp.countries);
    if (countryMatch.length > 0) {
      score += 5;
      reasons.push(`Open to applicants in ${countryMatch[0]}`);
    }
  } else if (opp.geographicScope === "GLOBAL" || opp.geographicScope === "REMOTE_GLOBAL") {
    score += 5;
    reasons.push("Open to applicants worldwide");
  } else if (opp.geographicScope === "INDIA_ONLY" && profile.preferredCountries.some((c) => c.toLowerCase().includes("india"))) {
    score += 5;
    reasons.push("Accepts applicants from India");
  } else if (opp.geographicScope === "LOCATION_UNKNOWN" && opp.countries.length === 0) {
    score += 2; // unclassified — broadly compatible, not penalized for a source gap
  }

  if (profile.paidOnly) {
    if (!opp.isFree) score += 4;
  } else {
    score += 4;
  }

  if (profile.preferredTypes.length > 0 && profile.preferredTypes.includes(opp.opportunityType)) {
    score += 5;
    reasons.push(`Matches your interest in ${opp.opportunityType.toLowerCase().replace(/_/g, " ")} opportunities`);
  }

  return { score: Math.min(WEIGHTS.PREFERENCE_MAX, score), reasons };
}

function timingScore(opp: MatchOpportunity) {
  if (!opp.deadline) return { score: WEIGHTS.TIMING_MAX * 0.6, reasons: [] };
  const daysUntil = (opp.deadline.getTime() - Date.now()) / DAY_MS;
  if (daysUntil < 0) return { score: 0, reasons: [] };
  if (daysUntil <= 30) {
    return { score: WEIGHTS.TIMING_MAX, reasons: ["Applications are currently open"] };
  }
  if (daysUntil <= 90) return { score: WEIGHTS.TIMING_MAX * 0.8, reasons: [] };
  return { score: WEIGHTS.TIMING_MAX * 0.5, reasons: [] };
}

function eligibilitySoftScore(profile: MatchProfile, opp: MatchOpportunity) {
  // Partial credit for *stated and satisfied* constraints (stronger signal than an
  // opportunity that states nothing at all) — distinct from the hard gate in eligibility.ts.
  let satisfiedCount = 0;
  let statedCount = 0;

  if (opp.citizenshipRequirements.length > 0) {
    statedCount++;
    if (profile.citizenship && opp.citizenshipRequirements.some((c) => c.toLowerCase() === profile.citizenship!.toLowerCase() || c.toLowerCase() === "any")) {
      satisfiedCount++;
    }
  }
  if (opp.educationRequirements.length > 0) {
    statedCount++;
    if (profile.stage) satisfiedCount++;
  }

  if (statedCount === 0) return { score: WEIGHTS.ELIGIBILITY_MAX * 0.6, reasons: [] };
  const ratio = satisfiedCount / statedCount;
  const reasons =
    ratio === 1 && profile.citizenship && opp.citizenshipRequirements.length > 0
      ? [`Accepts applicants from ${profile.citizenship}`]
      : [];
  return { score: Math.round(WEIGHTS.ELIGIBILITY_MAX * ratio), reasons };
}

export function scoreOpportunity(profile: MatchProfile, opp: MatchOpportunity): MatchResult {
  const gate = checkEligibility(profile, opp);

  const breakdown: ScoreBreakdown = {
    eligibility: eligibilitySoftScore(profile, opp),
    interest: interestScore(profile, opp),
    skills: skillsScore(profile, opp),
    goal: goalScore(profile, opp),
    preference: preferenceScore(profile, opp),
    timing: timingScore(opp),
  };

  if (!gate.eligible) {
    return {
      eligible: false,
      ineligibleReasons: gate.reasons,
      score: 0,
      breakdown,
      reasons: [],
    };
  }

  const total = Math.round(
    breakdown.eligibility.score +
      breakdown.interest.score +
      breakdown.skills.score +
      breakdown.goal.score +
      breakdown.preference.score +
      breakdown.timing.score
  );

  const reasons = [
    ...breakdown.interest.reasons,
    ...breakdown.eligibility.reasons,
    ...breakdown.goal.reasons,
    ...breakdown.skills.reasons,
    ...breakdown.preference.reasons,
    ...breakdown.timing.reasons,
  ].slice(0, 4);

  return {
    eligible: true,
    ineligibleReasons: [],
    score: Math.min(100, total),
    breakdown,
    reasons,
  };
}
