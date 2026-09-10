// Plain-data shapes the matching engine operates on — deliberately decoupled from Prisma
// types so scoring/eligibility functions are pure and unit-testable without a DB.

export interface MatchProfile {
  stage: string | null;
  country: string | null;
  citizenship: string | null;
  gender: string | null;
  academicInterests: string[];
  skills: string[];
  technologies: string[];
  interests: string[];
  aspirationsRaw: string | null;
  aspirationsSummary: string | null;
  goalTags: string[];
  remoteOk: boolean;
  hybridOk: boolean;
  inPersonOk: boolean;
  preferredCountries: string[];
  paidOnly: boolean;
  preferredTypes: string[];
  yearsExperience: number | null;
  ageYears: number | null; // derived from ageRange midpoint, used only for soft signals
}

export interface MatchOpportunity {
  id: string;
  opportunityType: string;
  categories: string[];
  fields: string[];
  skills: string[];
  targetAudience: string[];
  minimumAge: number | null;
  maximumAge: number | null;
  educationRequirements: string[];
  experienceRequirements: string[];
  citizenshipRequirements: string[];
  countries: string[];
  geographicScope: string;
  geographicDetail: string | null;
  genderEligibility: string;
  genderRestrictedTo: string[];
  remote: boolean;
  hybrid: boolean;
  inPerson: boolean;
  isFree: boolean;
  deadline: Date | null;
  status: string;
  description: string;
  title: string;
  embedding: number[] | null;
}

export interface ScoreBreakdown {
  eligibility: { score: number; reasons: string[] };
  interest: { score: number; reasons: string[] };
  skills: { score: number; reasons: string[] };
  goal: { score: number; reasons: string[] };
  preference: { score: number; reasons: string[] };
  timing: { score: number; reasons: string[] };
}

export interface MatchResult {
  eligible: boolean;
  ineligibleReasons: string[];
  score: number; // 0-100, only meaningful when eligible
  breakdown: ScoreBreakdown;
  reasons: string[]; // flattened, ordered "why this matches you" bullets
}
