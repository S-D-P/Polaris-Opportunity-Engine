import { z } from "zod";
import { STAGES, TIME_COMMITMENTS, OPPORTUNITY_TYPES } from "@/lib/taxonomy";

// Every field optional + independently addressable: each onboarding step PATCHes only
// the fields it owns, so partial profiles are always valid and resumable.
export const profileUpdateSchema = z.object({
  // Basics
  name: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(1).max(120).optional(),
  ageRange: z.string().trim().max(20).optional(),
  stage: z.enum(STAGES).optional(),
  gender: z.string().trim().max(60).optional(),

  // Education
  school: z.string().trim().max(200).optional(),
  degree: z.string().trim().max(120).optional(),
  fieldOfStudy: z.string().trim().max(120).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  academicInterests: z.array(z.string().trim().min(1).max(60)).max(20).optional(),

  // Professional
  currentRole: z.string().trim().max(150).optional(),
  industry: z.string().trim().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  technologies: z.array(z.string().trim().min(1).max(60)).max(30).optional(),

  // Interests
  interests: z.array(z.string().trim().min(1).max(60)).max(30).optional(),

  // Aspirations (free text -> AI extraction happens server-side on save)
  aspirationsRaw: z.string().trim().max(2000).optional(),

  // Preferences
  remoteOk: z.boolean().optional(),
  hybridOk: z.boolean().optional(),
  inPersonOk: z.boolean().optional(),
  preferredCountries: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  paidOnly: z.boolean().optional(),
  timeCommitment: z.enum(TIME_COMMITMENTS).optional(),
  preferredTypes: z.array(z.enum(OPPORTUNITY_TYPES)).max(21).optional(),
  citizenship: z.string().trim().max(120).optional(),

  // Wizard bookkeeping
  onboardingStep: z.number().int().min(0).max(6).optional(),
  onboardingComplete: z.boolean().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
