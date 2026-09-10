import { z } from "zod";
import { generateStructured } from "@/lib/ai/provider";
import { OPPORTUNITY_TYPES } from "@/lib/taxonomy";

export const extractionSchema = z.object({
  opportunityType: z.enum(OPPORTUNITY_TYPES),
  categories: z.array(z.string()).max(8),
  fields: z.array(z.string()).max(8),
  skills: z.array(z.string()).max(10),
  targetAudience: z.array(z.string()).max(6),
  shortDescription: z.string().max(400),
  aiSummary: z.string().max(1200),
  aiTags: z.array(z.string()).max(12),
  eligibilitySummary: z.string().max(600).optional(),
  minimumAge: z.number().int().min(0).max(120).nullable().optional(),
  maximumAge: z.number().int().min(0).max(120).nullable().optional(),
  educationRequirements: z.array(z.string()).max(6).optional(),
  experienceRequirements: z.array(z.string()).max(6).optional(),
  citizenshipRequirements: z.array(z.string()).max(20).optional(),
  // Gender eligibility (docs/personalization.md) — GENDER_REQUIRED must only be used when the
  // source explicitly restricts eligibility (never inferred from branding/encouragement
  // wording); the deterministic eligibility gate (lib/matching/eligibility.ts) is what
  // actually enforces this, Gemini only classifies the source text.
  genderEligibility: z.enum(["GENDER_REQUIRED", "GENDER_PREFERRED", "NO_GENDER_RESTRICTION", "NOT_STATED"]).optional(),
  genderRestrictedTo: z.array(z.string()).max(5).optional(),
  // Geographic eligibility (docs/geographic-model.md) — classified per-item from the source's
  // own text so real ingested data isn't stuck at LOCATION_UNKNOWN whenever a source has no
  // registry-level default configured. Never infer from the organization's own country.
  geographicScope: z
    .enum(["INDIA_ONLY", "GLOBAL", "REGION_SPECIFIC", "COUNTRY_SPECIFIC", "REMOTE_GLOBAL", "LOCATION_UNKNOWN"])
    .optional(),
  geographicDetail: z.string().max(80).optional(),
  // Deadline lifecycle (docs/personalization.md) — only classify ROLLING/ONGOING when the
  // source explicitly says so ("rolling basis", "always open"); a parsed date already covers
  // FIXED deterministically upstream, so this is only consulted when no date was parsed.
  // Absence of any timing language is NOT_STATED, never guessed as ROLLING.
  deadlineType: z.enum(["ROLLING", "ONGOING", "NOT_STATED"]).optional(),
  isFree: z.boolean().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ExtractionResult = z.infer<typeof extractionSchema>;

const geoClassificationSchema = z.object({
  geographicScope: z.enum([
    "INDIA_ONLY",
    "GLOBAL",
    "REGION_SPECIFIC",
    "COUNTRY_SPECIFIC",
    "REMOTE_GLOBAL",
    "LOCATION_UNKNOWN",
  ]),
  geographicDetail: z.string().max(80).optional(),
});

export type GeoClassificationResult = z.infer<typeof geoClassificationSchema>;

/**
 * Cheap, focused re-classification for the backfill pass over already-ingested opportunities
 * that predate per-item geographic classification (scripts/backfill-geography.ts) — deliberately
 * a small separate call rather than re-running the full ~1500-token extraction, since only one
 * field needs to change (docs §15's "don't call Gemini for more than the reasoning actually
 * requires"). Same anti-fabrication rule as the full extraction: classify only what the text
 * states, never the organization's own location.
 */
export async function classifyGeography(input: {
  title: string;
  organization: string;
  rawText: string;
}): Promise<GeoClassificationResult | null> {
  return generateStructured({
    scope: "ai.geo-classification",
    maxTokens: 300,
    system:
      "You classify who is geographically eligible to apply to an opportunity, based only " +
      "on what the source text explicitly states. Never infer eligibility from the " +
      "organization's own country or headquarters. Respond with a single JSON object.",
    prompt:
      `Title: ${input.title}\n` +
      `Organization: ${input.organization}\n\n` +
      `Source text:\n${input.rawText.slice(0, 4000)}\n\n` +
      "Return JSON with geographicScope (one of INDIA_ONLY/GLOBAL/REGION_SPECIFIC/" +
      "COUNTRY_SPECIFIC/REMOTE_GLOBAL/LOCATION_UNKNOWN — INDIA_ONLY if explicitly " +
      "restricted to applicants in/citizens of India, GLOBAL if explicitly open " +
      "worldwide, REGION_SPECIFIC if restricted to a named multi-country region (set " +
      "geographicDetail to it), COUNTRY_SPECIFIC if restricted to one specific country " +
      "other than India (set geographicDetail to it), REMOTE_GLOBAL if explicitly " +
      "remote/online AND explicitly international, LOCATION_UNKNOWN if the source " +
      "doesn't clearly state location eligibility) and geographicDetail (string, only " +
      "for REGION_SPECIFIC/COUNTRY_SPECIFIC).",
    schema: geoClassificationSchema,
  });
}

/**
 * Classifies and extracts structured fields from a raw opportunity title+description.
 * Only called for fields plain parsing genuinely can't determine (see
 * docs/architecture.md §3) — deadlines/URLs are parsed deterministically upstream.
 * Returns null on AI failure; caller stores the item as NEEDS_REVIEW rather than guessing.
 */
export async function extractOpportunity(input: {
  title: string;
  organization: string;
  rawText: string;
}): Promise<ExtractionResult | null> {
  return generateStructured({
    scope: "ai.extraction",
    maxTokens: 1500,
    system:
      "You structure opportunity listings (scholarships, fellowships, internships, jobs, " +
      "hackathons, competitions, mentorships, grants, etc.) for a discovery platform. " +
      "You extract only what the source text actually states — never invent eligibility " +
      "requirements, deadlines, or benefits that aren't present. Respond with a single " +
      "JSON object and nothing else, matching the requested shape exactly.",
    prompt:
      `Title: ${input.title}\n` +
      `Organization: ${input.organization}\n\n` +
      `Source text:\n${input.rawText.slice(0, 8000)}\n\n` +
      "Return a JSON object with exactly these keys: opportunityType (one of " +
      `${OPPORTUNITY_TYPES.join(", ")}), categories (string[], broad domains like ` +
      '"Technology", "Public Policy"), fields (string[], more specific subfields), ' +
      "skills (string[]), targetAudience (string[], e.g. \"undergraduate\", " +
      '"early-career professional"), shortDescription (1-2 plain sentences), aiSummary ' +
      "(3-5 sentences, what it is / why it matters / who should care), aiTags " +
      "(string[], short filter tags), eligibilitySummary (plain-language, omit if the " +
      "source doesn't state eligibility), minimumAge/maximumAge (numbers or null if not " +
      "stated), educationRequirements/experienceRequirements/citizenshipRequirements " +
      "(string[], omit or empty array if not explicitly stated), genderEligibility " +
      "(one of GENDER_REQUIRED/GENDER_PREFERRED/NO_GENDER_RESTRICTION/NOT_STATED — use " +
      "GENDER_REQUIRED ONLY if the source explicitly restricts who may apply by gender, " +
      "GENDER_PREFERRED for wording that merely encourages/prioritizes a gender without " +
      "excluding others, NOT_STATED if gender isn't addressed — never infer a restriction " +
      "from the organization's name, branding, or general subject matter), " +
      "genderRestrictedTo (string[] of the specific genders named, ONLY when " +
      "genderEligibility is GENDER_REQUIRED, e.g. [\"woman\"]), geographicScope (one of " +
      "INDIA_ONLY/GLOBAL/REGION_SPECIFIC/COUNTRY_SPECIFIC/REMOTE_GLOBAL/LOCATION_UNKNOWN " +
      "based ONLY on what the source explicitly states about who is eligible to apply by " +
      "location — INDIA_ONLY if explicitly restricted to applicants in/citizens of India, " +
      "GLOBAL if explicitly open worldwide with no stated restriction, REGION_SPECIFIC if " +
      "restricted to a named multi-country region (set geographicDetail to that region, " +
      "e.g. \"Southeast Asia\"), COUNTRY_SPECIFIC if restricted to one specific country " +
      "other than India (set geographicDetail to that country), REMOTE_GLOBAL if " +
      "explicitly remote/online AND explicitly open to international applicants, " +
      "LOCATION_UNKNOWN if eligibility by location isn't clearly stated — never infer this " +
      "from where the organization itself is headquartered, only from what is stated about " +
      "who may apply), geographicDetail (string, only when geographicScope is " +
      "REGION_SPECIFIC or COUNTRY_SPECIFIC), deadlineType (one of " +
      "ROLLING/ONGOING/NOT_STATED — use ROLLING only if the source explicitly says " +
      "applications are reviewed on a rolling basis, ONGOING only if it explicitly says " +
      "there is no deadline / applications are always open, NOT_STATED if timing simply " +
      "isn't mentioned — never guess ROLLING just because no date is given), isFree " +
      "(boolean if the source states cost, omit otherwise), and confidence " +
      "(\"high\"/\"medium\"/\"low\" reflecting how complete and unambiguous the source " +
      "text was).",
    schema: extractionSchema,
  });
}
