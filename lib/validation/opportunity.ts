import { z } from "zod";
import { OPPORTUNITY_TYPES } from "@/lib/taxonomy";

export const opportunityFilterSchema = z.object({
  q: z.string().trim().max(300).optional(),
  type: z.array(z.enum(OPPORTUNITY_TYPES)).optional(),
  remote: z.coerce.boolean().optional(),
  hybrid: z.coerce.boolean().optional(),
  inPerson: z.coerce.boolean().optional(),
  isFree: z.coerce.boolean().optional(),
  country: z.string().trim().max(120).optional(),
  deadlineBefore: z.coerce.date().optional(),
  // Only "deadline" and "recent" are actually implemented (lib/search/index.ts) — "match" and
  // "popular" were accepted here but silently fell back to "recent" behavior with no real
  // sort applied, since no UI control ever sent them and no code path implemented either
  // (no save-count/popularity signal exists to sort by; match-score sorting only exists in
  // the personalized feed, a different endpoint). Narrowed to what's real rather than
  // accepting-and-ignoring values that look supported but aren't (docs/scalability.md).
  sort: z.enum(["deadline", "recent"]).default("recent"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type OpportunityFilterInput = z.infer<typeof opportunityFilterSchema>;

// Admin edit — every extracted field is correctable by a human reviewer.
export const opportunityAdminUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  organization: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).optional(),
  shortDescription: z.string().trim().min(1).max(500).optional(),
  opportunityType: z.enum(OPPORTUNITY_TYPES).optional(),
  categories: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
  eligibilitySummary: z.string().max(2000).optional(),
  minimumAge: z.number().int().min(0).max(120).nullable().optional(),
  maximumAge: z.number().int().min(0).max(120).nullable().optional(),
  educationRequirements: z.array(z.string()).optional(),
  experienceRequirements: z.array(z.string()).optional(),
  citizenshipRequirements: z.array(z.string()).optional(),
  genderRequirement: z.string().max(60).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  countries: z.array(z.string()).optional(),
  remote: z.boolean().optional(),
  hybrid: z.boolean().optional(),
  inPerson: z.boolean().optional(),
  cost: z.string().max(200).nullable().optional(),
  isFree: z.boolean().optional(),
  funding: z.string().max(500).nullable().optional(),
  benefits: z.array(z.string()).optional(),
  deadline: z.coerce.date().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  applicationUrl: z.string().url().optional(),
  status: z.enum(["OPEN", "CLOSING_SOON", "CLOSED", "DRAFT"]).optional(),
  verificationStatus: z.enum(["VERIFIED", "AI_EXTRACTED", "NEEDS_REVIEW"]).optional(),
});

export type OpportunityAdminUpdateInput = z.infer<typeof opportunityAdminUpdateSchema>;

export const sourceCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  organization: z.string().trim().max(200).optional(),
  sourceType: z.enum(["RSS", "JSON_API", "STATIC_PAGE", "MANUAL"]),
  url: z.string().url(),
  config: z.record(z.string(), z.unknown()).optional(),
  // Optional at the API layer so the existing admin "add source" form (frozen UI, doesn't
  // send this field) keeps working unmodified. Safety doesn't depend on this being
  // required here: a Source with no complianceRecordId is exactly what the gate
  // (lib/ingestion/compliance.ts) treats as "no record" and fails closed on — it simply
  // can't run until an admin links a compliance record, via this field on a future
  // request or a direct update. Prefer setting it at creation time when possible.
  complianceRecordId: z.string().min(1).optional(),
  categoryCoverage: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  geographicCoverage: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  crawlFrequency: z.enum(["daily", "weekly", "high-frequency", "manual"]).optional(),
  rateLimit: z.string().trim().max(100).optional(),
  extractionMethod: z.enum(["official_api", "rss", "sitemap_html", "manual"]).optional(),
});

export type SourceCreateInput = z.infer<typeof sourceCreateSchema>;
