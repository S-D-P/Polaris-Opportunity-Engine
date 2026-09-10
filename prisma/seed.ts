import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { embedText, embeddingToJson } from "../lib/ai/embeddings";
import { buildFingerprint } from "../lib/ingestion/dedupe";
import { seedComplianceRecords } from "./seed-compliance";
import { seedRealSources } from "./seed-sources";
import { seedCorporateComplianceRecords } from "./seed-corporate-compliance";
import { seedCorporateSources } from "./seed-corporate-sources";
import { seedIndiaGlobalComplianceRecords } from "./seed-india-global-compliance";
import { seedIndiaGlobalSources } from "./seed-india-global-sources";
import { seedIntlFoundationsComplianceRecords } from "./seed-intl-foundations-compliance";
import { seedIntlFoundationsSources } from "./seed-intl-foundations-sources";
import { seedCorporateBatch3ComplianceRecords } from "./seed-corporate-batch3-compliance";
import { seedCorporateBatch3Sources } from "./seed-corporate-batch3-sources";
import { seedGlobalInstitutionsComplianceRecords } from "./seed-global-institutions-compliance";
import { seedGlobalInstitutionsSources } from "./seed-global-institutions-sources";

const prisma = new PrismaClient();

// All seed opportunities are clearly flagged isSeedData: true and never VERIFIED —
// they are realistic demo content (docs/product-spec.md §11), not live, confirmed
// listings. Dates are set relative to "today" so the demo always shows a mix of
// urgency states.
const DAY = 1000 * 60 * 60 * 24;
const inDays = (n: number) => new Date(Date.now() + n * DAY);

interface SeedOpportunity {
  title: string;
  organization: string;
  description: string;
  shortDescription: string;
  opportunityType: string;
  categories: string[];
  fields: string[];
  skills: string[];
  targetAudience: string[];
  eligibilitySummary: string;
  minimumAge?: number;
  maximumAge?: number;
  educationRequirements?: string[];
  experienceRequirements?: string[];
  citizenshipRequirements?: string[];
  genderRequirement?: string;
  genderEligibility?: "GENDER_REQUIRED" | "GENDER_PREFERRED" | "NO_GENDER_RESTRICTION" | "NOT_STATED";
  genderRestrictedTo?: string[];
  location?: string;
  countries: string[];
  remote: boolean;
  hybrid: boolean;
  inPerson: boolean;
  cost: string;
  isFree: boolean;
  funding?: string;
  benefits: string[];
  deadline: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  applicationUrl: string;
  sourceUrl: string;
  sourceName: string;
  aiSummary: string;
  aiTags: string[];
  verificationStatus: "AI_EXTRACTED" | "NEEDS_REVIEW";
}

const SEED_OPPORTUNITIES: SeedOpportunity[] = [
  {
    title: "Global Voyager Fellowship",
    organization: "Horizon Foundation",
    description:
      "The Global Voyager Fellowship supports early-career leaders working at the " +
      "intersection of technology and public policy. Fellows receive a stipend, a " +
      "structured mentorship track with senior policy and technology leaders, and " +
      "join a two-week policy lab in Washington, D.C. The program is aimed at people " +
      "early in their careers who want to shape how emerging technology is governed.",
    shortDescription:
      "A fellowship for early-career professionals combining technology and public policy work.",
    opportunityType: "FELLOWSHIP",
    categories: ["Public Policy", "Technology"],
    fields: ["AI Policy", "Tech Governance"],
    skills: ["Policy Analysis", "Research", "Communication"],
    targetAudience: ["early-career professional", "recent graduate"],
    eligibilitySummary:
      "Open to early-career professionals (0-5 years experience) with a demonstrated interest in technology policy.",
    experienceRequirements: ["0-5 years professional experience"],
    citizenshipRequirements: ["any"],
    location: "Washington, D.C. (in-person policy lab) + remote fellowship",
    countries: [],
    remote: true,
    hybrid: true,
    inPerson: false,
    cost: "Free",
    isFree: true,
    funding: "$12,000 stipend + travel and housing for the policy lab",
    benefits: ["Stipend", "Mentorship", "Policy lab in D.C.", "Alumni network"],
    deadline: inDays(46),
    startDate: inDays(120),
    applicationUrl: "https://example.org/voyager-fellowship/apply",
    sourceUrl: "https://example.org/voyager-fellowship",
    sourceName: "Horizon Foundation",
    aiSummary:
      "A fellowship for early-career professionals who want to build a career at the " +
      "intersection of technology and public policy, combining mentorship, a stipend, " +
      "and an in-person policy lab.",
    aiTags: ["fellowship", "public policy", "AI policy", "early-career"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "AI & Machine Learning Scholarship",
    organization: "CloudWorks & OpenLearn",
    description:
      "The AI & Machine Learning Scholarship funds a 4-month, industry-designed " +
      "machine learning course for students and early-career technologists. Awardees " +
      "receive free access to the full course, a certificate, and the top performers " +
      "are connected with hiring partners. The scholarship is aimed at increasing " +
      "access to AI education for students from underrepresented backgrounds and " +
      "developing regions.",
    shortDescription:
      "A funded 4-month machine learning course for students and early-career technologists.",
    opportunityType: "SCHOLARSHIP",
    categories: ["AI/ML", "Software Engineering"],
    fields: ["Machine Learning", "Data Science"],
    skills: ["Python", "Machine Learning", "Statistics"],
    targetAudience: ["undergraduate", "graduate", "early-career professional"],
    eligibilitySummary:
      "Open globally to students and early-career professionals with basic programming experience.",
    educationRequirements: ["undergraduate", "graduate", "early-career"],
    citizenshipRequirements: ["any"],
    location: "Online",
    countries: [],
    remote: true,
    hybrid: false,
    inPerson: false,
    cost: "Free (scholarship covers full course cost)",
    isFree: true,
    funding: "Full course scholarship, value $1,200",
    benefits: ["Free course access", "Certificate", "Hiring partner network"],
    deadline: inDays(15),
    startDate: inDays(60),
    applicationUrl: "https://example.org/ai-ml-scholarship/apply",
    sourceUrl: "https://example.org/ai-ml-scholarship",
    sourceName: "CloudWorks & OpenLearn",
    aiSummary:
      "A scholarship covering a 4-month applied machine learning course, aimed at " +
      "students and early-career technologists worldwide, with a certificate and " +
      "hiring-partner connections for top performers.",
    aiTags: ["scholarship", "AI/ML", "students", "free"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Software Engineering Summer Internship",
    organization: "Meridian Systems",
    description:
      "Meridian Systems' Summer Internship places undergraduate and graduate students " +
      "on product engineering teams for 12 weeks. Interns ship real production code, " +
      "are paired with a senior engineer mentor, and receive a competitive stipend " +
      "plus relocation support. Strong candidates typically have coursework or " +
      "project experience in data structures, algorithms, and at least one modern " +
      "programming language.",
    shortDescription: "A 12-week paid software engineering internship for students.",
    opportunityType: "INTERNSHIP",
    categories: ["Software Engineering"],
    fields: ["Backend Engineering", "Distributed Systems"],
    skills: ["Python", "Java", "Data Structures", "Algorithms"],
    targetAudience: ["undergraduate", "graduate"],
    eligibilitySummary:
      "Open to currently-enrolled undergraduate and graduate students studying computer science or a related field.",
    educationRequirements: ["undergraduate", "graduate"],
    citizenshipRequirements: ["any"],
    location: "Multiple offices (US, UK, Singapore)",
    countries: ["United States", "United Kingdom", "Singapore"],
    remote: false,
    hybrid: true,
    inPerson: true,
    cost: "Free",
    isFree: true,
    funding: "Paid — competitive weekly stipend + relocation support",
    benefits: ["Paid stipend", "Mentorship", "Relocation support", "Return-offer track"],
    deadline: inDays(72),
    startDate: inDays(200),
    applicationUrl: "https://example.org/meridian-internship/apply",
    sourceUrl: "https://example.org/meridian-internship",
    sourceName: "Meridian Systems",
    aiSummary:
      "A paid, 12-week summer software engineering internship for students, with " +
      "mentorship and a path to a return offer.",
    aiTags: ["internship", "software engineering", "paid", "students"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Open Skies Hackathon",
    organization: "Aerospace Innovation Alliance",
    description:
      "A 48-hour global hackathon challenging teams to build tools using open " +
      "satellite and climate datasets. Participants form teams of up to four and " +
      "build a working prototype addressing a real-world sustainability or disaster-" +
      "response challenge. Judged by engineers and scientists; winning teams receive " +
      "cash prizes and incubator introductions.",
    shortDescription: "A 48-hour global hackathon using open satellite and climate data.",
    opportunityType: "HACKATHON",
    categories: ["Software Engineering", "Sustainability", "Climate"],
    fields: ["Data Visualization", "Climate Tech"],
    skills: ["Programming", "Data Analysis", "Teamwork"],
    targetAudience: ["undergraduate", "graduate", "early-career professional"],
    eligibilitySummary: "Open globally to individuals 18 and older; no professional experience required.",
    minimumAge: 18,
    citizenshipRequirements: ["any"],
    location: "Online",
    countries: [],
    remote: true,
    hybrid: false,
    inPerson: false,
    cost: "Free",
    isFree: true,
    benefits: ["Cash prizes", "Incubator introductions", "Mentorship during the event"],
    deadline: inDays(20),
    startDate: inDays(21),
    endDate: inDays(23),
    applicationUrl: "https://example.org/open-skies-hackathon/register",
    sourceUrl: "https://example.org/open-skies-hackathon",
    sourceName: "Aerospace Innovation Alliance",
    aiSummary:
      "A weekend hackathon open to anyone 18+, using open satellite and climate " +
      "datasets to prototype sustainability or disaster-response tools, with cash " +
      "prizes for winning teams.",
    aiTags: ["hackathon", "climate", "sustainability", "online"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "National Science Talent Search",
    organization: "Society for Scientific Discovery",
    description:
      "A prestigious research competition for high school seniors who complete an " +
      "original scientific research project. Finalists present their work to a panel " +
      "of scientists and compete for scholarships. The competition has run for over " +
      "80 years and many alumni have gone on to notable scientific careers.",
    shortDescription: "A research competition for high school seniors with original science projects.",
    opportunityType: "COMPETITION",
    categories: ["Research"],
    fields: ["STEM Research"],
    skills: ["Scientific Research", "Data Analysis", "Presentation"],
    targetAudience: ["school student"],
    eligibilitySummary: "Open to high school seniors in their final year, with an original research project.",
    educationRequirements: ["school student"],
    citizenshipRequirements: ["any"],
    location: "Washington, D.C. (finals)",
    countries: [],
    remote: false,
    hybrid: false,
    inPerson: true,
    cost: "Free to enter",
    isFree: true,
    funding: "Top prize $250,000; multiple scholarship tiers",
    benefits: ["Scholarships", "National recognition", "Scientist mentorship"],
    deadline: inDays(95),
    applicationUrl: "https://example.org/science-talent-search/apply",
    sourceUrl: "https://example.org/science-talent-search",
    sourceName: "Society for Scientific Discovery",
    aiSummary:
      "A long-running national research competition for graduating high school " +
      "seniors, awarding significant scholarships to top original-research projects.",
    aiTags: ["competition", "research", "high school", "STEM"],
    verificationStatus: "NEEDS_REVIEW",
  },
  {
    title: "Women in AI Mentorship Circle",
    organization: "Women in AI Global Network",
    description:
      "A 6-month structured mentorship program pairing women and gender-minority " +
      "professionals in AI/ML with senior industry mentors. Includes monthly 1:1 " +
      "mentorship sessions, group workshops on career growth, and a closing summit. " +
      "Open to students through mid-career professionals.",
    shortDescription: "A 6-month mentorship program for women and gender minorities in AI/ML.",
    opportunityType: "MENTORSHIP",
    categories: ["AI/ML", "Leadership"],
    fields: ["Career Development"],
    skills: ["AI/ML"],
    targetAudience: ["undergraduate", "graduate", "early-career professional", "mid-career professional"],
    eligibilitySummary: "Open to women and gender-minority individuals studying or working in AI/ML.",
    genderRequirement: "Open to women and gender minorities",
    genderEligibility: "GENDER_REQUIRED",
    genderRestrictedTo: ["woman", "non-binary"],
    citizenshipRequirements: ["any"],
    location: "Online",
    countries: [],
    remote: true,
    hybrid: false,
    inPerson: false,
    cost: "Free",
    isFree: true,
    benefits: ["1:1 mentorship", "Workshops", "Peer community", "Closing summit"],
    deadline: inDays(10),
    startDate: inDays(40),
    applicationUrl: "https://example.org/women-in-ai-mentorship/apply",
    sourceUrl: "https://example.org/women-in-ai-mentorship",
    sourceName: "Women in AI Global Network",
    aiSummary:
      "A structured 6-month mentorship program connecting women and gender-minority " +
      "AI/ML talent — from students to mid-career professionals — with senior " +
      "industry mentors.",
    aiTags: ["mentorship", "AI/ML", "women in tech", "free"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Frontier Tech Summit — Student Scholars Program",
    organization: "Frontier Tech Alliance",
    description:
      "The Student Scholars Program provides free conference passes, travel " +
      "stipends, and a dedicated mentorship track for students attending the " +
      "Frontier Tech Summit, a three-day conference on emerging technology, AI, and " +
      "computing research. Scholars also participate in a resume-review and " +
      "employer-networking track.",
    shortDescription:
      "Funded conference attendance and mentorship for students at a major tech conference.",
    opportunityType: "CONFERENCE",
    categories: ["Technology", "Software Engineering"],
    fields: ["Computing Research"],
    skills: [],
    targetAudience: ["undergraduate", "graduate"],
    eligibilitySummary: "Open to currently-enrolled undergraduate and graduate students in computing fields.",
    educationRequirements: ["undergraduate", "graduate"],
    citizenshipRequirements: ["any"],
    location: "Austin, Texas",
    countries: ["United States"],
    remote: false,
    hybrid: false,
    inPerson: true,
    cost: "Free for accepted scholars (travel stipend included)",
    isFree: true,
    funding: "Travel stipend up to $800",
    benefits: ["Conference pass", "Travel stipend", "Mentorship track", "Employer networking"],
    deadline: inDays(55),
    startDate: inDays(150),
    applicationUrl: "https://example.org/frontier-tech-summit/scholars",
    sourceUrl: "https://example.org/frontier-tech-summit",
    sourceName: "Frontier Tech Alliance",
    aiSummary:
      "A scholars program covering conference attendance, travel, and mentorship for " +
      "students attending a major emerging-technology conference.",
    aiTags: ["conference", "students", "technology", "funded"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Global Shapers Leadership Program",
    organization: "Council for Global Cooperation",
    description:
      "A year-long leadership development program for young civic and social " +
      "entrepreneurs. Participants join a local chapter, lead a community-impact " +
      "project, and attend an annual global leadership summit. The program " +
      "emphasizes hands-on leadership practice over classroom instruction.",
    shortDescription: "A year-long civic leadership program with a local chapter and global summit.",
    opportunityType: "LEADERSHIP_PROGRAM",
    categories: ["Leadership", "Social Impact"],
    fields: ["Civic Engagement"],
    skills: ["Leadership", "Project Management", "Community Organizing"],
    targetAudience: ["early-career professional", "mid-career professional"],
    eligibilitySummary: "Open to individuals aged 20-30 engaged in civic, social, or entrepreneurial work.",
    minimumAge: 20,
    maximumAge: 30,
    citizenshipRequirements: ["any"],
    location: "Local chapters worldwide + annual summit",
    countries: [],
    remote: true,
    hybrid: true,
    inPerson: false,
    cost: "Free",
    isFree: true,
    benefits: ["Chapter membership", "Leadership training", "Global summit", "Alumni network"],
    deadline: inDays(38),
    startDate: inDays(100),
    applicationUrl: "https://example.org/global-shapers/apply",
    sourceUrl: "https://example.org/global-shapers",
    sourceName: "Council for Global Cooperation",
    aiSummary:
      "A hands-on, year-long civic leadership program for young people aged 20-30, " +
      "combining local chapter work with an annual global summit.",
    aiTags: ["leadership", "social impact", "civic engagement"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Summer Research Program in Computational Biology",
    organization: "Ridgeline Institute for Biomedical Research",
    description:
      "An 8-week, fully-funded summer research program pairing undergraduates with " +
      "faculty labs working on computational biology and genomics. Participants " +
      "complete an original research project, present at a closing symposium, and " +
      "are supported to submit their work to peer-reviewed conferences.",
    shortDescription: "A funded 8-week undergraduate research program in computational biology.",
    opportunityType: "RESEARCH_PROGRAM",
    categories: ["Research", "Biotech & Health"],
    fields: ["Computational Biology", "Genomics"],
    skills: ["Python", "Statistics", "Research"],
    targetAudience: ["undergraduate"],
    eligibilitySummary: "Open to undergraduate students with coursework in biology, CS, or statistics.",
    educationRequirements: ["undergraduate"],
    citizenshipRequirements: ["any"],
    location: "Ridgeline Institute campus",
    countries: ["United States"],
    remote: false,
    hybrid: false,
    inPerson: true,
    cost: "Free",
    isFree: true,
    funding: "$6,000 stipend + housing",
    benefits: ["Stipend", "Housing", "Faculty mentorship", "Conference submission support"],
    deadline: inDays(64),
    startDate: inDays(180),
    applicationUrl: "https://example.org/ridgeline-research/apply",
    sourceUrl: "https://example.org/ridgeline-research",
    sourceName: "Ridgeline Institute for Biomedical Research",
    aiSummary:
      "A fully-funded 8-week summer research program placing undergraduates in " +
      "computational biology and genomics labs, with a stipend, housing, and support " +
      "to present findings publicly.",
    aiTags: ["research", "biotech", "undergraduate", "funded"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Executive Program in Applied AI Strategy",
    organization: "Blackwell School of Management",
    description:
      "A one-week, in-person executive education program for mid-to-senior " +
      "professionals leading AI adoption at their organizations. Covers AI strategy, " +
      "governance, and change management, taught by faculty and industry " +
      "practitioners. Class size is capped at 40 for small-group discussion.",
    shortDescription: "A one-week executive education program on leading AI adoption.",
    opportunityType: "EXECUTIVE_EDUCATION",
    categories: ["AI/ML", "Leadership"],
    fields: ["AI Strategy", "Management"],
    skills: ["Strategy", "Leadership"],
    targetAudience: ["mid-career professional", "experienced professional"],
    eligibilitySummary: "Designed for professionals with 8+ years of experience, typically in a leadership role.",
    experienceRequirements: ["8+ years experience"],
    citizenshipRequirements: ["any"],
    location: "Boston, Massachusetts",
    countries: ["United States"],
    remote: false,
    hybrid: false,
    inPerson: true,
    cost: "$8,500 (need-based fee waivers available)",
    isFree: false,
    benefits: ["Certificate", "Peer cohort", "Faculty access"],
    deadline: inDays(80),
    startDate: inDays(160),
    applicationUrl: "https://example.org/blackwell-ai-strategy/apply",
    sourceUrl: "https://example.org/blackwell-ai-strategy",
    sourceName: "Blackwell School of Management",
    aiSummary:
      "An intensive one-week executive program for senior professionals on leading " +
      "AI strategy and adoption, with a paid tuition and available fee waivers.",
    aiTags: ["executive education", "AI strategy", "leadership"],
    verificationStatus: "AI_EXTRACTED",
  },
  {
    title: "Open Web Technology Fund Grant",
    organization: "Digital Commons Foundation",
    description:
      "Grants of $10,000-$50,000 for individuals and small teams building open-source " +
      "tools that improve internet openness, privacy, or accessibility. Grantees " +
      "receive funding, legal/IP guidance, and technical mentorship over a 6-month " +
      "grant period.",
    shortDescription: "Grants for open-source projects improving internet openness, privacy, or accessibility.",
    opportunityType: "GRANT",
    categories: ["Software Engineering", "Social Impact"],
    fields: ["Open Source", "Privacy"],
    skills: ["Software Engineering"],
    targetAudience: ["early-career professional", "mid-career professional", "experienced professional"],
    eligibilitySummary: "Open to individuals and teams of any experience level with a working open-source project or credible plan.",
    citizenshipRequirements: ["any"],
    location: "Remote",
    countries: [],
    remote: true,
    hybrid: false,
    inPerson: false,
    cost: "Free to apply",
    isFree: true,
    funding: "$10,000 - $50,000 grant",
    benefits: ["Funding", "Legal/IP guidance", "Technical mentorship"],
    deadline: inDays(30),
    applicationUrl: "https://example.org/open-web-fund/apply",
    sourceUrl: "https://example.org/open-web-fund",
    sourceName: "Digital Commons Foundation",
    aiSummary:
      "A grant program funding open-source projects that improve internet openness, " +
      "privacy, or accessibility, with mentorship alongside the funding.",
    aiTags: ["grant", "open source", "funding"],
    verificationStatus: "AI_EXTRACTED",
  },
];

async function main() {
  console.log("Seeding Polaris demo data...");

  // Admin user
  const adminPasswordHash = await bcrypt.hash("PolarisAdmin!23", 12);
  await prisma.user.upsert({
    where: { email: "admin@polaris.demo" },
    update: {},
    create: {
      email: "admin@polaris.demo",
      name: "Polaris Admin",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
    },
  });
  console.log(`Admin user: admin@polaris.demo / PolarisAdmin!23`);

  // Demo end-user with a fully filled profile, so /feed has something to show immediately
  const demoPasswordHash = await bcrypt.hash("PolarisDemo!23", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@polaris.demo" },
    update: {},
    create: {
      email: "demo@polaris.demo",
      name: "Asha Rao",
      role: "USER",
      passwordHash: demoPasswordHash,
    },
  });
  await prisma.profile.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      onboardingStep: 6,
      onboardingComplete: true,
      name: "Asha Rao",
      country: "India",
      citizenship: "India",
      ageRange: "22-25",
      stage: "EARLY_CAREER",
      school: "Indian Institute of Technology, Bombay",
      degree: "B.Tech",
      fieldOfStudy: "Computer Science",
      graduationYear: 2025,
      academicInterests: JSON.stringify(["AI/ML", "Public Policy"]),
      currentRole: "Software Engineer",
      industry: "Technology",
      yearsExperience: 1,
      skills: JSON.stringify(["Python", "Machine Learning", "Research"]),
      interests: JSON.stringify(["AI/ML", "Public Policy", "Leadership"]),
      aspirationsRaw:
        "I want to eventually work in AI policy and build a career combining " +
        "technology and public policy.",
      aspirationsSummary:
        "Wants to build a career combining AI/ML engineering and public policy.",
      goalTags: JSON.stringify(["AI Policy", "Technology", "Public Policy"]),
      remoteOk: true,
      hybridOk: true,
      inPersonOk: false,
      preferredCountries: JSON.stringify(["India", "United States"]),
      paidOnly: false,
      timeCommitment: "part-time",
      preferredTypes: JSON.stringify(["FELLOWSHIP", "SCHOLARSHIP", "MENTORSHIP"]),
    },
  });
  console.log(`Demo user: demo@polaris.demo / PolarisDemo!23`);

  // Every Source must have a compliance record — even the two Polaris-internal demo
  // sources below, which aren't "scraped" from an external site in the ordinary sense but
  // still go through the same gate (docs/ingestion-roadmap.md Part 4).
  const manualDemoCompliance = await prisma.sourceComplianceRecord.upsert({
    where: { id: "compliance-seed-manual-demo" },
    update: {},
    create: {
      id: "compliance-seed-manual-demo",
      sourceName: "Polaris Demo Data (internal, manually curated)",
      sourceUrl: "https://example.org/polaris-demo-data",
      robotsTxtStatus: "not_applicable",
      robotsTxtCrawlPermission: "not_applicable",
      tosReviewed: true,
      tosSummary: "Internally curated demo content, not fetched from an external website — no robots.txt/ToS applies.",
      apiAvailable: false,
      apiPreferred: false,
      rssAvailable: false,
      sitemapAvailable: false,
      automatedAccessStatus: "ALLOWED",
      permittedAdapterType: "manual",
      complianceNotes: "Admin-curated JSON payload, not automated collection from a third-party site.",
      lastPolicyCheckAt: new Date(),
      reviewRequired: false,
    },
  });

  const nasaDemoCompliance = await prisma.sourceComplianceRecord.upsert({
    where: { id: "compliance-seed-nasa-rss-demo" },
    update: {},
    create: {
      id: "compliance-seed-nasa-rss-demo",
      sourceName: "NASA News & Updates (RSS ingestion demo)",
      sourceUrl: "https://www.nasa.gov/news-release/feed/",
      robotsTxtStatus: "not_checked",
      robotsTxtCrawlPermission: "unknown",
      tosReviewed: false,
      tosSummary:
        "Not part of the formal 19-source compliance research batch (docs/source-compliance.md) — this is a general public US government RSS feed used only to demonstrate the ingestion pipeline against a real external XML source. A full robots.txt/ToS check should be done before relying on this beyond a demo.",
      apiAvailable: false,
      apiPreferred: false,
      rssAvailable: true,
      rssUrl: "https://www.nasa.gov/news-release/feed/",
      sitemapAvailable: false,
      automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
      permittedAdapterType: "rss",
      complianceNotes:
        "US federal government site publishing a public RSS feed — low compliance risk in practice, but flagged reviewRequired since it wasn't run through the same live-fetch research process as the other 19 sources.",
      lastPolicyCheckAt: new Date(),
      reviewRequired: true,
    },
  });

  // A manual source to own the seed opportunities' provenance in the admin dashboard
  const manualSourceRegistryFields = {
    organization: "Polaris (internal)",
    complianceRecordId: manualDemoCompliance.id,
    complianceStatus: manualDemoCompliance.automatedAccessStatus,
    lastPolicyCheckAt: manualDemoCompliance.lastPolicyCheckAt,
    categoryCoverage: JSON.stringify([
      "AI/ML",
      "Public Policy",
      "Finance",
      "Entrepreneurship",
      "Leadership",
      "Research",
    ]),
    geographicCoverage: JSON.stringify(["global"]),
    crawlFrequency: "manual",
    extractionMethod: "manual",
    reliabilityScore: 1.0,
  };
  const seedSource = await prisma.source.upsert({
    where: { id: "seed-source-manual" },
    update: manualSourceRegistryFields,
    create: {
      id: "seed-source-manual",
      name: "Polaris Demo Data",
      sourceType: "MANUAL",
      url: "https://example.org/polaris-demo-data",
      isActive: false,
      ...manualSourceRegistryFields,
    },
  });

  // A real RSS source wired to a genuinely live public feed, so ingestion can be
  // demonstrated end-to-end from the admin dashboard (docs/architecture.md §3). NASA's
  // public news feed is general news rather than a curated opportunities feed, but it is
  // a real, stable, live source — proving the fetch/parse/dedupe/classify pipeline works
  // against real external XML, not a mock. Swap the URL for an org's real opportunities
  // feed once one is available; the adapter code does not change.
  // Inactive by default: this is general NASA news (not curated opportunities), kept only
  // to demonstrate that "Run ingestion" in the admin dashboard performs a real fetch +
  // parse against live external XML. An admin can flip it active to see the pipeline run.
  const nasaSourceRegistryFields = {
    name: "NASA News & Updates (RSS ingestion demo)",
    url: "https://www.nasa.gov/news-release/feed/",
    organization: "National Aeronautics and Space Administration",
    complianceRecordId: nasaDemoCompliance.id,
    complianceStatus: nasaDemoCompliance.automatedAccessStatus,
    lastPolicyCheckAt: nasaDemoCompliance.lastPolicyCheckAt,
    categoryCoverage: JSON.stringify(["General News"]),
    geographicCoverage: JSON.stringify(["United States"]),
    crawlFrequency: "daily",
    extractionMethod: "rss",
    reliabilityScore: 1.0,
  };
  await prisma.source.upsert({
    where: { id: "seed-source-rss-example" },
    update: nasaSourceRegistryFields,
    create: {
      id: "seed-source-rss-example",
      sourceType: "RSS",
      isActive: false,
      ...nasaSourceRegistryFields,
    },
  });

  await seedComplianceRecords(prisma);
  await seedRealSources(prisma);
  await seedCorporateComplianceRecords(prisma);
  await seedCorporateSources(prisma);
  await seedIndiaGlobalComplianceRecords(prisma);
  await seedIndiaGlobalSources(prisma);
  await seedIntlFoundationsComplianceRecords(prisma);
  await seedIntlFoundationsSources(prisma);
  await seedCorporateBatch3ComplianceRecords(prisma);
  await seedCorporateBatch3Sources(prisma);
  await seedGlobalInstitutionsComplianceRecords(prisma);
  await seedGlobalInstitutionsSources(prisma);

  for (const item of SEED_OPPORTUNITIES) {
    const fingerprint = buildFingerprint(item.title, item.organization);
    const embedding = embeddingToJson(embedText(`${item.title} ${item.aiSummary}`));

    const existing = await prisma.opportunity.findFirst({ where: { fingerprint } });
    if (existing) continue;

    await prisma.opportunity.create({
      data: {
        title: item.title,
        organization: item.organization,
        description: item.description,
        shortDescription: item.shortDescription,
        opportunityType: item.opportunityType as never,
        categories: JSON.stringify(item.categories),
        fields: JSON.stringify(item.fields),
        skills: JSON.stringify(item.skills),
        targetAudience: JSON.stringify(item.targetAudience),
        eligibilitySummary: item.eligibilitySummary,
        minimumAge: item.minimumAge,
        maximumAge: item.maximumAge,
        educationRequirements: JSON.stringify(item.educationRequirements ?? []),
        experienceRequirements: JSON.stringify(item.experienceRequirements ?? []),
        citizenshipRequirements: JSON.stringify(item.citizenshipRequirements ?? []),
        location: item.location,
        countries: JSON.stringify(item.countries),
        remote: item.remote,
        hybrid: item.hybrid,
        inPerson: item.inPerson,
        cost: item.cost,
        isFree: item.isFree,
        funding: item.funding,
        benefits: JSON.stringify(item.benefits),
        deadline: item.deadline,
        deadlineType: item.deadline ? "FIXED" : "NOT_STATED",
        startDate: item.startDate ?? null,
        endDate: item.endDate ?? null,
        genderRequirement: item.genderRequirement,
        genderEligibility: item.genderEligibility ?? "NOT_STATED",
        genderRestrictedTo: item.genderRestrictedTo ? JSON.stringify(item.genderRestrictedTo) : undefined,
        applicationUrl: item.applicationUrl,
        sourceUrl: item.sourceUrl,
        sourceName: item.sourceName,
        sourceType: "MANUAL",
        sourceId: seedSource.id,
        fingerprint,
        embedding,
        aiSummary: item.aiSummary,
        aiTags: JSON.stringify(item.aiTags),
        isSeedData: true,
        verificationStatus: item.verificationStatus,
        status: "OPEN",
      },
    });
  }

  console.log(`Seeded ${SEED_OPPORTUNITIES.length} demo opportunities.`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
