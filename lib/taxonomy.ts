// Shared taxonomy constants used by onboarding UI, filters, validation, and seed data.
// Mirrors the Prisma `OpportunityType` enum — kept as a plain array (not generated from
// Prisma) so it's importable from client components without pulling in @prisma/client.

export const OPPORTUNITY_TYPES = [
  "SCHOLARSHIP",
  "FELLOWSHIP",
  "INTERNSHIP",
  "JOB",
  "HACKATHON",
  "COMPETITION",
  "OLYMPIAD",
  "CAMP",
  "CONFERENCE",
  "MENTORSHIP",
  "LEADERSHIP_PROGRAM",
  "RESEARCH_PROGRAM",
  "EXECUTIVE_EDUCATION",
  "COURSE",
  "GRANT",
  "AWARD",
  "VOLUNTEERING",
  "SPEAKING",
  "JUDGING",
  "ADVISORY",
  "BOARD",
] as const;

export type OpportunityTypeValue = (typeof OPPORTUNITY_TYPES)[number];

// Polaris's scope is opportunity discovery (scholarships, fellowships, hackathons, ...), not
// job search — JOB stays a valid enum value (existing data, ingestion, and tests are
// untouched) but is intentionally not offered as a selectable filter/preference in the UI.
export const USER_SELECTABLE_OPPORTUNITY_TYPES = OPPORTUNITY_TYPES.filter((t) => t !== "JOB");

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityTypeValue, string> = {
  SCHOLARSHIP: "Scholarship",
  FELLOWSHIP: "Fellowship",
  INTERNSHIP: "Internship",
  JOB: "Job",
  HACKATHON: "Hackathon",
  COMPETITION: "Competition",
  OLYMPIAD: "Olympiad",
  CAMP: "Camp",
  CONFERENCE: "Conference",
  MENTORSHIP: "Mentorship Program",
  LEADERSHIP_PROGRAM: "Leadership Program",
  RESEARCH_PROGRAM: "Research Program",
  EXECUTIVE_EDUCATION: "Executive Education",
  COURSE: "Course / Program",
  GRANT: "Grant",
  AWARD: "Award",
  VOLUNTEERING: "Volunteering",
  SPEAKING: "Speaking Opportunity",
  JUDGING: "Judging Opportunity",
  ADVISORY: "Advisory Opportunity",
  BOARD: "Board Opportunity",
};

export const STAGES = [
  "SCHOOL_STUDENT",
  "UNDERGRADUATE",
  "GRADUATE",
  "RECENT_GRADUATE",
  "EARLY_CAREER",
  "MID_CAREER",
  "EXPERIENCED",
] as const;

export type StageValue = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageValue, string> = {
  SCHOOL_STUDENT: "School student",
  UNDERGRADUATE: "Undergraduate student",
  GRADUATE: "Graduate student",
  RECENT_GRADUATE: "Recent graduate",
  EARLY_CAREER: "Early-career professional",
  MID_CAREER: "Mid-career professional",
  EXPERIENCED: "Experienced professional",
};

export const INTEREST_TAGS = [
  "AI/ML",
  "Software Engineering",
  "Data Science",
  "Finance",
  "Economics",
  "Public Policy",
  "Sustainability",
  "Entrepreneurship",
  "Leadership",
  "Research",
  "Design",
  "Social Impact",
  "Biotech & Health",
  "Robotics",
  "Cybersecurity",
  "Climate",
  "Education",
  "Law",
  "Media & Journalism",
  "Arts & Humanities",
] as const;

export const TIME_COMMITMENTS = [
  "few-hours-week",
  "part-time",
  "full-time",
  "one-time",
  "multi-week",
] as const;

export const TRACK_STATUSES = [
  "DISCOVERED",
  "SAVED",
  "INTERESTED",
  "APPLIED",
  "COMPLETED",
  "NOT_RELEVANT",
] as const;

export const TRACK_STATUS_LABELS: Record<(typeof TRACK_STATUSES)[number], string> = {
  DISCOVERED: "Discovered",
  SAVED: "Saved",
  INTERESTED: "Interested",
  APPLIED: "Applied",
  COMPLETED: "Completed",
  NOT_RELEVANT: "Not relevant",
};
