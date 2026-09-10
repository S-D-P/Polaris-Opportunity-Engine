import { embedText } from "@/lib/ai/embeddings";
import type { MatchOpportunity } from "@/lib/matching/types";
import type { PersonaId } from "./personas";

const DAY_MS = 86400000;
const inDays = (n: number) => new Date(Date.now() + n * DAY_MS);

/**
 * `true`/`false` — a confident, hand-derived expectation of what `checkEligibility` should
 * return, given the persona's stated attributes and the opportunity's stated requirements.
 * `"ambiguous"` — the requirement text itself doesn't cleanly resolve to a yes/no even for a
 * human reader (used sparingly, only for the one deliberately-unparseable case).
 * `"structural-gap"` — historically used for gender-restricted opportunities back when
 * `Profile` had no gender field at all (docs/backend-roadmap.md Part 1). `Profile.gender`
 * and `Opportunity.genderEligibility`/`genderRestrictedTo` now exist and are enforced by
 * `checkEligibility` (docs/personalization.md) — the "structural-gap" entries below predate
 * that and are stale (all four personas below are seeded with `gender: null`, so they no
 * longer exercise the gap this label describes). Kept as `"structural-gap"` rather than
 * rewritten with real values because this test only asserts on confident `eligible === false`
 * entries (recommendation-quality.test.ts) and these are skipped either way — not a
 * correctness bug, just unmaintained ground truth. Worth revisiting if this catalog is
 * extended to actually assert gender-eligibility behavior.
 */
export type EligibilityTruth = boolean | "ambiguous" | "structural-gap";

export interface GroundTruthEntry {
  /** Hand-derived expectation, independent of what the code actually computes. */
  eligible: EligibilityTruth;
  /** 0 = irrelevant, 1 = marginal, 2 = relevant, 3 = highly relevant — topical/goal fit only, independent of eligibility. */
  relevance: 0 | 1 | 2 | 3;
  note: string;
}

export interface CatalogItem {
  opportunity: MatchOpportunity;
  tags: string[];
  groundTruth: Record<PersonaId, GroundTruthEntry>;
}

function opp(partial: Partial<MatchOpportunity> & { id: string; title: string; description: string }): MatchOpportunity {
  return {
    opportunityType: "COURSE",
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
    deadline: inDays(45),
    status: "OPEN",
    embedding: embedText(`${partial.title} ${partial.description}`),
    ...partial,
  };
}

export const CATALOG: CatalogItem[] = [
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c1",
      title: "AI/ML Software Engineering Internship",
      description:
        "A 12-week internship building production machine learning systems alongside " +
        "senior software engineers. For early-career engineers who want hands-on AI/ML " +
        "engineering experience.",
      opportunityType: "INTERNSHIP",
      categories: ["AI/ML", "Software Engineering"],
      fields: ["Machine Learning"],
      skills: ["Python", "Machine Learning"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 3, note: "Exact match: AI/ML software engineering internship for early-career engineers." },
      B: { eligible: true, relevance: 0, note: "No finance/economics connection." },
      C: { eligible: true, relevance: 1, note: "AI overlap only; not policy, not C's preferred type." },
      D: { eligible: true, relevance: 0, note: "No entrepreneurship/leadership connection." },
    },
  },
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c2",
      title: "Open AI Hackathon 2026",
      description:
        "A weekend hackathon open to anyone 18 and older to build AI/ML prototypes and " +
        "compete for prizes.",
      opportunityType: "HACKATHON",
      categories: ["AI/ML"],
      minimumAge: 18,
    }),
    groundTruth: {
      A: { eligible: true, relevance: 3, note: "AI/ML hackathon, A's preferred type." },
      B: { eligible: true, relevance: 0, note: "Not finance-related." },
      C: { eligible: true, relevance: 1, note: "AI overlap only." },
      D: { eligible: true, relevance: 0, note: "No connection to D's interests." },
    },
  },
  {
    tags: ["highly_relevant_ineligible", "experience_restriction"],
    opportunity: opp({
      id: "c3",
      title: "Elite AI Engineering Fellowship",
      description:
        "A prestigious fellowship for senior AI/ML software engineers to lead major " +
        "technical initiatives.",
      opportunityType: "FELLOWSHIP",
      categories: ["AI/ML", "Software Engineering"],
      experienceRequirements: ["5+ years experience"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 3, note: "Dead-center topical match, but A has 1 year vs. required 5+ — highly relevant but ineligible." },
      B: { eligible: false, relevance: 0, note: "0 years experience, also irrelevant topically." },
      C: { eligible: false, relevance: 1, note: "2 years experience, below the 5+ bar." },
      D: { eligible: true, relevance: 0, note: "10 years clears the bar, but D isn't interested in AI/ML engineering." },
    },
  },
  {
    tags: ["highly_relevant_ineligible", "experience_restriction", "briefs_worked_example"],
    opportunity: opp({
      id: "c4",
      title: "AI Governance Fellowship",
      description:
        "A fellowship for experienced policy professionals working on AI governance and " +
        "technology regulation frameworks.",
      opportunityType: "FELLOWSHIP",
      categories: ["Public Policy", "AI/ML"],
      experienceRequirements: ["3+ years policy experience"],
      citizenshipRequirements: ["any"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 2, note: "Some AI interest, but not policy-focused; also below experience bar." },
      B: { eligible: false, relevance: 0, note: "0 years experience, irrelevant topically." },
      C: { eligible: false, relevance: 3, note: "This is the brief's own worked example: exactly C's stated goal (AI + policy), but C has 2 years vs. required 3+ — highly relevant but ineligible." },
      D: {
        eligible: true,
        relevance: 0,
        note:
          "D's 10 years clears the numeric '3+ years' floor, but D's experience isn't policy experience at all — " +
          "the hard gate only regex-matches a number, not the stated domain, so this is a known false-eligible.",
      },
    },
  },
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c5",
      title: "Technology Policy Fellowship",
      description:
        "An open fellowship for anyone interested in technology policy, AI governance, and " +
        "public-interest tech regulation. No prior policy experience required.",
      opportunityType: "FELLOWSHIP",
      categories: ["Public Policy", "Technology"],
      fields: ["AI Policy"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 1, note: "Tech-adjacent, not A's core focus." },
      B: { eligible: true, relevance: 0, note: "No connection to finance." },
      C: { eligible: true, relevance: 3, note: "Exactly C's stated goal, open eligibility — should rank at or near the top." },
      D: { eligible: true, relevance: 0, note: "No connection to D's interests." },
    },
  },
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c6",
      title: "AI & Technology Governance Conference",
      description:
        "A conference bringing together policymakers and technologists to discuss AI " +
        "governance, regulation, and the future of technology policy.",
      opportunityType: "CONFERENCE",
      categories: ["Public Policy", "AI/ML"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 1, note: "AI overlap, not C's policy focus." },
      B: { eligible: true, relevance: 0, note: "No finance connection." },
      C: { eligible: true, relevance: 3, note: "Directly on C's goal; C also prefers CONFERENCE type." },
      D: { eligible: true, relevance: 0, note: "No connection to D's interests." },
    },
  },
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c7",
      title: "Investment Banking Summer Analyst Program",
      description:
        "A summer analyst program for undergraduates interested in investment banking, " +
        "financial modeling, and corporate finance.",
      opportunityType: "INTERNSHIP",
      categories: ["Finance"],
      skills: ["Financial Modeling"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 0, note: "No AI/software connection." },
      B: { eligible: true, relevance: 3, note: "Exact match for B's stated goal and preferred type." },
      C: { eligible: true, relevance: 0, note: "No policy connection." },
      D: { eligible: true, relevance: 0, note: "Finance-adjacent to entrepreneurship at best; not a real match." },
    },
  },
  {
    tags: ["partial_match", "education_restriction", "known_bug_substring_stage_match"],
    opportunity: opp({
      id: "c8",
      title: "Undergraduate Economics Scholarship",
      description:
        "A scholarship for currently-enrolled undergraduate students studying economics or " +
        "a related field.",
      opportunityType: "SCHOLARSHIP",
      categories: ["Finance", "Economics"],
      educationRequirements: ["undergraduate"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 0, note: "Not an undergraduate; also irrelevant to A's interests." },
      B: { eligible: true, relevance: 3, note: "Exact match: B is an undergraduate studying economics." },
      C: {
        eligible: false,
        relevance: 0,
        note:
          "C is a GRADUATE student, not an undergraduate, so this should be ineligible. Flagged as a likely " +
          "false-eligible: the hard gate's stage-matching does a plain substring check, and the string " +
          "'undergraduate' contains the substring 'graduate' — check whether this causes a false positive.",
      },
      D: { eligible: false, relevance: 0, note: "Not an undergraduate; irrelevant to D's interests." },
    },
  },
  {
    tags: ["gender_restricted", "structural_gap"],
    opportunity: opp({
      id: "c9",
      title: "Women in Technology Leadership Fellowship",
      description:
        "A leadership fellowship for women and non-binary technologists moving into " +
        "senior leadership roles.",
      opportunityType: "FELLOWSHIP",
      categories: ["Leadership", "Technology"],
      // Note: MatchOpportunity has no `genderRequirement` field at all — checkEligibility
      // structurally cannot see it even if it wanted to. That absence is itself the finding
      // (see the "structural-gap" ground truth below and docs/backend-roadmap.md Part 1).
    }),
    groundTruth: {
      A: { eligible: "structural-gap", relevance: 0, note: "Persona has no gender attribute to evaluate against; see structural gap note in the report." },
      B: { eligible: "structural-gap", relevance: 0, note: "Same structural gap." },
      C: { eligible: "structural-gap", relevance: 1, note: "Same structural gap; mild leadership/tech overlap." },
      D: { eligible: "structural-gap", relevance: 3, note: "Same structural gap; would be a strong topical match (leadership) if eligibility were known." },
    },
  },
  {
    tags: ["citizenship_restricted"],
    opportunity: opp({
      id: "c10",
      title: "US Citizens Government Innovation Fellowship",
      description:
        "A fellowship placing technologists inside US federal agencies to work on " +
        "technology policy and public-sector innovation. Open only to US citizens.",
      opportunityType: "FELLOWSHIP",
      categories: ["Technology", "Public Policy"],
      citizenshipRequirements: ["United States"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 2, note: "Tech-policy relevant, but A is not a US citizen — highly relevant but ineligible via citizenship." },
      B: { eligible: true, relevance: 1, note: "US citizen, eligible; only mildly relevant (finance focus, not tech policy)." },
      C: { eligible: false, relevance: 3, note: "Exactly C's goal (tech + policy), but C is Nigerian — highly relevant but ineligible via citizenship." },
      D: { eligible: false, relevance: 0, note: "Not a US citizen; also irrelevant to D's interests." },
    },
  },
  {
    tags: ["citizenship_restricted"],
    opportunity: opp({
      id: "c11",
      title: "UK Founders Innovation Grant",
      description:
        "A grant for UK-based founders building early-stage technology startups.",
      opportunityType: "GRANT",
      categories: ["Entrepreneurship"],
      citizenshipRequirements: ["United Kingdom"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 0, note: "Not a UK citizen; irrelevant to A's interests." },
      B: { eligible: false, relevance: 0, note: "Not a UK citizen; irrelevant to B's interests." },
      C: { eligible: false, relevance: 0, note: "Not a UK citizen; irrelevant to C's interests." },
      D: { eligible: true, relevance: 3, note: "UK citizen, exact match for D's entrepreneurship goal." },
    },
  },
  {
    tags: ["ambiguous_eligibility", "experience_restriction"],
    opportunity: opp({
      id: "c12",
      title: "Global Startup Advisory Board Program",
      description:
        "Invites professionals with several years of relevant experience to join advisory " +
        "boards for early-stage startups.",
      opportunityType: "ADVISORY",
      categories: ["Entrepreneurship", "Leadership"],
      experienceRequirements: ["several years of relevant experience"],
    }),
    groundTruth: {
      A: { eligible: "ambiguous", relevance: 0, note: "Requirement text isn't a clean yes/no even for a human; not topically relevant regardless." },
      B: { eligible: "ambiguous", relevance: 0, note: "Same ambiguity; not topically relevant." },
      C: { eligible: "ambiguous", relevance: 0, note: "Same ambiguity; not topically relevant." },
      D: { eligible: "ambiguous", relevance: 3, note: "Same ambiguity in the requirement text — but topically this is an excellent match for D if genuinely eligible." },
    },
  },
  {
    tags: ["education_restriction"],
    opportunity: opp({
      id: "c13",
      title: "High School Robotics Summer Camp",
      description:
        "A summer robotics camp for current high school students to build and program " +
        "robots.",
      opportunityType: "CAMP",
      categories: ["Robotics", "Software Engineering"],
      educationRequirements: ["school student"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 1, note: "Not a school student; mild software-engineering overlap." },
      B: { eligible: false, relevance: 0, note: "Not a school student; irrelevant to B's interests." },
      C: { eligible: false, relevance: 0, note: "Not a school student; irrelevant to C's interests." },
      D: { eligible: false, relevance: 0, note: "Not a school student; irrelevant to D's interests." },
    },
  },
  {
    tags: ["highly_relevant_ineligible", "education_restriction"],
    opportunity: opp({
      id: "c14",
      title: "PhD Research Assistantship in Machine Learning",
      description:
        "A funded research assistantship in a machine learning lab, for current graduate " +
        "students pursuing a PhD.",
      opportunityType: "RESEARCH_PROGRAM",
      categories: ["AI/ML", "Research"],
      educationRequirements: ["graduate"],
    }),
    groundTruth: {
      A: { eligible: false, relevance: 3, note: "Dead-center AI/ML research match, but A is EARLY_CAREER, not a graduate student — highly relevant but ineligible." },
      B: { eligible: false, relevance: 0, note: "Not a graduate student; irrelevant to B's interests." },
      C: { eligible: true, relevance: 1, note: "C is a graduate student (eligible); AI-adjacent but not C's policy focus." },
      D: { eligible: false, relevance: 0, note: "Not a graduate student; irrelevant to D's interests." },
    },
  },
  {
    tags: ["eligible_irrelevant"],
    opportunity: opp({
      id: "c15",
      title: "Marine Biology Conservation Research Program",
      description:
        "A research program studying coral reef ecosystems and marine conservation, open " +
        "to all backgrounds.",
      opportunityType: "RESEARCH_PROGRAM",
      categories: ["Biology", "Environment"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 0, note: "No stated restrictions, but zero topical connection to A." },
      B: { eligible: true, relevance: 0, note: "No stated restrictions, but zero topical connection to B." },
      C: { eligible: true, relevance: 0, note: "No stated restrictions, but zero topical connection to C." },
      D: { eligible: true, relevance: 0, note: "No stated restrictions, but zero topical connection to D." },
    },
  },
  {
    tags: ["eligible_irrelevant"],
    opportunity: opp({
      id: "c16",
      title: "Community Food Bank Volunteering",
      description: "Ongoing volunteering opportunities sorting and distributing food at a local food bank.",
      opportunityType: "VOLUNTEERING",
      categories: ["Social Impact"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 0, note: "Open to everyone, no topical connection to A's stated goals." },
      B: { eligible: true, relevance: 0, note: "Open to everyone, no topical connection to B's stated goals." },
      C: { eligible: true, relevance: 0, note: "Open to everyone, no topical connection to C's stated goals." },
      D: { eligible: true, relevance: 0, note: "Open to everyone, no topical connection to D's stated goals." },
    },
  },
  {
    tags: ["partial_match"],
    opportunity: opp({
      id: "c17",
      title: "General Leadership Skills Workshop",
      description: "A one-day workshop covering foundational leadership and communication skills for any professional.",
      opportunityType: "COURSE",
      categories: ["Leadership"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 0, note: "No AI/software connection." },
      B: { eligible: true, relevance: 0, note: "No finance connection." },
      C: { eligible: true, relevance: 0, note: "No policy connection." },
      D: { eligible: true, relevance: 2, note: "Leadership overlap, but generic and not D's preferred type (executive education/board/advisory)." },
    },
  },
  {
    tags: ["highly_relevant_ineligible", "age_restriction"],
    opportunity: opp({
      id: "c18",
      title: "Global Youth Innovation Challenge",
      description:
        "A competition for young innovators under 25 to pitch entrepreneurial ideas in " +
        "technology.",
      opportunityType: "COMPETITION",
      categories: ["Entrepreneurship", "Technology"],
      maximumAge: 25,
    }),
    groundTruth: {
      A: { eligible: true, relevance: 1, note: "Age 24 clears the bar; mild tech overlap, entrepreneurship isn't A's focus." },
      B: { eligible: true, relevance: 1, note: "Age 20 clears the bar; mild overlap." },
      C: { eligible: false, relevance: 0, note: "Age 27 exceeds the 25 maximum; also not topically relevant." },
      D: { eligible: false, relevance: 3, note: "Entrepreneurship is exactly D's goal, but age 38 exceeds the 25 maximum — highly relevant but ineligible via age." },
    },
  },
  {
    tags: ["expired", "known_bug_freshness"],
    opportunity: opp({
      id: "c19",
      title: "AI Bootcamp — Summer 2026",
      description:
        "An intensive AI/ML bootcamp for early-career engineers. (Listing not updated by " +
        "its source since the deadline passed — status still shows OPEN.)",
      opportunityType: "COURSE",
      categories: ["AI/ML"],
      deadline: inDays(-60),
      status: "OPEN",
    }),
    groundTruth: {
      A: {
        eligible: false,
        relevance: 3,
        note:
          "Would be a great match, but its deadline passed 60 days ago — it should not be recommended " +
          "regardless of what `status` says. Flagged as a likely false-eligible: the hard gate only excludes " +
          "explicit status=CLOSED, not a passed deadline.",
      },
      B: { eligible: false, relevance: 0, note: "Expired; also irrelevant to B." },
      C: { eligible: false, relevance: 0, note: "Expired; also irrelevant to C." },
      D: { eligible: false, relevance: 0, note: "Expired; also irrelevant to D." },
    },
  },
  {
    tags: ["expired", "correctly_handled_contrast"],
    opportunity: opp({
      id: "c20",
      title: "Explicitly Closed Fellowship",
      description:
        "A fellowship on AI and public policy. Applications are now closed for this cycle.",
      opportunityType: "FELLOWSHIP",
      categories: ["AI/ML", "Public Policy"],
      status: "CLOSED",
    }),
    groundTruth: {
      A: { eligible: false, relevance: 2, note: "Explicitly closed — should be excluded; the hard gate already checks status=CLOSED directly, so this should pass." },
      B: { eligible: false, relevance: 0, note: "Explicitly closed and irrelevant to B." },
      C: { eligible: false, relevance: 3, note: "Explicitly closed — should be excluded despite being C's exact topical match." },
      D: { eligible: false, relevance: 0, note: "Explicitly closed and irrelevant to D." },
    },
  },
  {
    tags: ["incomplete_data"],
    opportunity: opp({
      id: "c21",
      title: "Untitled Regional Program",
      description: "",
      opportunityType: "COURSE",
      categories: [],
      fields: [],
      skills: [],
      targetAudience: [],
      deadline: null,
      embedding: null,
    }),
    groundTruth: {
      A: { eligible: true, relevance: 0, note: "No stated restrictions and no extractable content — should score near the baseline, not crash." },
      B: { eligible: true, relevance: 0, note: "Same — sparse-data robustness check." },
      C: { eligible: true, relevance: 0, note: "Same — sparse-data robustness check." },
      D: { eligible: true, relevance: 0, note: "Same — sparse-data robustness check." },
    },
  },
  {
    tags: ["relevant_eligible"],
    opportunity: opp({
      id: "c22",
      title: "AI Product Leadership Fellowship",
      description:
        "A fellowship for professionals moving into leadership roles at AI-focused " +
        "technology companies, combining product strategy, leadership, and entrepreneurial " +
        "thinking.",
      opportunityType: "FELLOWSHIP",
      categories: ["AI/ML", "Leadership", "Entrepreneurship"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 1, note: "AI overlap, but not leadership/entrepreneurship-focused." },
      B: { eligible: true, relevance: 0, note: "No connection to B's interests." },
      C: { eligible: true, relevance: 1, note: "AI overlap, but not policy-focused." },
      D: { eligible: true, relevance: 3, note: "Leadership + entrepreneurship overlap directly matches D's goal." },
    },
  },
  {
    tags: ["gender_restricted", "structural_gap"],
    opportunity: opp({
      id: "c23",
      title: "Women in AI Mentorship Circle",
      description:
        "A mentorship program pairing women and gender-minority professionals in AI/ML " +
        "with senior industry mentors.",
      opportunityType: "MENTORSHIP",
      categories: ["AI/ML", "Leadership"],
      // Same structural gap as c9 — no field for checkEligibility to read.
    }),
    groundTruth: {
      A: { eligible: "structural-gap", relevance: 2, note: "Structural gap (no gender attribute); AI/ML overlap is real." },
      B: { eligible: "structural-gap", relevance: 0, note: "Structural gap; no topical connection." },
      C: { eligible: "structural-gap", relevance: 1, note: "Structural gap; mild AI overlap." },
      D: { eligible: "structural-gap", relevance: 2, note: "Structural gap; leadership overlap is real." },
    },
  },
  {
    tags: ["partial_match", "experience_restriction", "known_bug_no_max_years"],
    opportunity: opp({
      id: "c24",
      title: "Early Career AI Ethics Fellowship",
      description:
        "A fellowship for early-career professionals (0-3 years of experience) working on " +
        "AI ethics and responsible AI policy.",
      opportunityType: "FELLOWSHIP",
      categories: ["AI/ML", "Public Policy"],
      experienceRequirements: ["0-3 years professional experience"],
    }),
    groundTruth: {
      A: { eligible: true, relevance: 3, note: "1 year experience fits the intended early-career band; strong AI+ethics overlap." },
      B: { eligible: true, relevance: 0, note: "0 years fits the band, but irrelevant to B's interests." },
      C: { eligible: true, relevance: 2, note: "2 years fits the band; strong AI+policy overlap." },
      D: {
        eligible: false,
        relevance: 0,
        note:
          "D has 10 years — well outside the intended 0-3 year early-career band, so this should be ineligible. " +
          "Flagged as a likely false-eligible: the hard gate's experience regex only extracts a minimum-years " +
          "floor from the first number it finds ('0'), so it can't enforce an upper bound at all.",
      },
    },
  },
];
