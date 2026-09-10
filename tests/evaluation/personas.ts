import type { MatchProfile } from "@/lib/matching/types";

/**
 * Four synthetic personas for the recommendation evaluation framework
 * (docs/backend-roadmap.md Part 12). Deliberately span different stages, geographies,
 * experience levels, and goals so the catalog (catalog.ts) can exercise every hard-gate
 * path (citizenship, age, experience, education) against real variation, not one persona
 * repeated with different labels.
 */

export type PersonaId = "A" | "B" | "C" | "D";

export interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  profile: MatchProfile;
}

export const PERSONAS: Persona[] = [
  {
    id: "A",
    name: "Aisha — early-career software engineer interested in AI",
    description:
      "1 year professional experience, based in and a citizen of India, wants to grow " +
      "into AI/ML engineering.",
    profile: {
      stage: "EARLY_CAREER",
      country: "India",
      citizenship: "India",
      gender: null,
      academicInterests: ["Computer Science"],
      skills: ["Python", "Machine Learning", "JavaScript"],
      technologies: [],
      interests: ["AI/ML", "Software Engineering"],
      aspirationsRaw: "I want to grow as a software engineer working on AI/ML systems.",
      aspirationsSummary: "Wants to grow as a software engineer working on AI/ML systems.",
      goalTags: ["AI/ML", "Software Engineering"],
      remoteOk: true,
      hybridOk: true,
      inPersonOk: false,
      preferredCountries: [],
      paidOnly: false,
      preferredTypes: ["INTERNSHIP", "JOB", "HACKATHON"],
      yearsExperience: 1,
      ageYears: 24,
    },
  },
  {
    id: "B",
    name: "Ben — economics undergraduate interested in finance",
    description:
      "No professional experience yet, US citizen, wants to break into investment " +
      "banking or corporate finance.",
    profile: {
      stage: "UNDERGRADUATE",
      country: "United States",
      citizenship: "United States",
      gender: null,
      academicInterests: ["Economics"],
      skills: ["Excel", "Financial Modeling"],
      technologies: [],
      interests: ["Finance", "Economics"],
      aspirationsRaw: "I want to work in investment banking or corporate finance after graduating.",
      aspirationsSummary: "Wants to work in investment banking or corporate finance after graduating.",
      goalTags: ["Finance", "Economics"],
      remoteOk: true,
      hybridOk: true,
      inPersonOk: true,
      preferredCountries: ["United States"],
      paidOnly: true,
      preferredTypes: ["INTERNSHIP", "SCHOLARSHIP", "COMPETITION"],
      yearsExperience: 0,
      ageYears: 20,
    },
  },
  {
    id: "C",
    name: "Chidi — public policy graduate interested in technology policy",
    description:
      "2 years of policy research experience, Nigerian citizen, wants to transition into " +
      "AI/technology governance policy specifically — the brief's own worked example persona.",
    profile: {
      stage: "GRADUATE",
      country: "Nigeria",
      citizenship: "Nigeria",
      gender: null,
      academicInterests: ["Public Policy", "International Relations"],
      skills: ["Policy Analysis", "Research", "Writing"],
      technologies: [],
      interests: ["Public Policy", "AI/ML"],
      aspirationsRaw:
        "I want to transition from public policy research into technology policy, especially around AI governance.",
      aspirationsSummary: "Wants to move from public policy research into AI/technology governance policy.",
      goalTags: ["AI Policy", "Technology Governance", "Public Policy"],
      remoteOk: true,
      hybridOk: true,
      inPersonOk: true,
      preferredCountries: [],
      paidOnly: false,
      preferredTypes: ["FELLOWSHIP", "RESEARCH_PROGRAM", "CONFERENCE"],
      yearsExperience: 2,
      ageYears: 27,
    },
  },
  {
    id: "D",
    name: "Diana — experienced product manager interested in entrepreneurship",
    description:
      "10 years of experience, UK citizen, wants to leave product management to found her " +
      "own startup.",
    profile: {
      stage: "EXPERIENCED",
      country: "United Kingdom",
      citizenship: "United Kingdom",
      gender: null,
      academicInterests: [],
      skills: ["Product Management", "Leadership", "Strategy"],
      technologies: [],
      interests: ["Entrepreneurship", "Leadership"],
      aspirationsRaw: "I want to start my own company and need leadership and startup experience.",
      aspirationsSummary: "Wants to transition from product management into founding her own startup.",
      goalTags: ["Entrepreneurship", "Startups", "Leadership"],
      remoteOk: true,
      hybridOk: false,
      inPersonOk: true,
      preferredCountries: ["United Kingdom", "United States"],
      paidOnly: false,
      preferredTypes: ["EXECUTIVE_EDUCATION", "LEADERSHIP_PROGRAM", "ADVISORY", "BOARD"],
      yearsExperience: 10,
      ageYears: 38,
    },
  },
];
