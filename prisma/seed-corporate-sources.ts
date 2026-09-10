import type { PrismaClient } from "@prisma/client";

/**
 * The first wave of corporate/non-job opportunity sources approved for implementation
 * (docs/corporate-opportunity-sources.md, "Step 6 — Recommended first wave"), each linked to
 * its compliance record from prisma/seed-corporate-compliance.ts. All 9 are ALLOWED or
 * ALLOWED_WITH_RESTRICTIONS — no NOT_ALLOWED or UNCLEAR_REQUIRES_REVIEW source is wired up
 * here, per the compliance gate's fail-closed rule.
 *
 * Hugging Face reuses the existing, already-proven `rssAdapter` unmodified. The other 8 use
 * the new `staticPageAdapter` (lib/ingestion/adapters/static-page.ts) — each config's "pages"
 * array points at exactly one verified, real program page, treated as one opportunity.
 * Salesforce Trailhead uses `renderMode: "js"` since Trailhead is client-side rendered and
 * invisible to a plain fetch; the other 7 use the default static fetch.
 */
export async function seedCorporateSources(prisma: PrismaClient) {
  const findCompliance = (sourceUrl: string) =>
    prisma.sourceComplianceRecord.findFirst({ where: { sourceUrl } });

  const sources: Array<{
    id: string;
    name: string;
    organization: string;
    url: string;
    complianceSourceUrl: string;
    categoryCoverage: string[];
    config: Record<string, unknown>;
    sourceType: "RSS" | "STATIC_PAGE";
    extractionMethod: "rss" | "sitemap_html";
  }> = [
    {
      id: "source-huggingface-blog-rss",
      name: "Hugging Face Blog (RSS)",
      organization: "Hugging Face",
      url: "https://huggingface.co/blog/feed.xml",
      complianceSourceUrl: "https://huggingface.co",
      categoryCoverage: ["AI/ML", "Hackathons", "Developer Community"],
      // The blog feed mixes general ML tutorial/announcement posts with genuine program
      // announcements (~1-2%, discovered empirically — see
      // docs/corporate-ingestion-baseline.md). requireOpportunityKeywords makes the
      // pipeline's deterministic relevance filter (lib/ingestion/relevance-filter.ts) skip
      // anything that doesn't look like an actual opportunity, instead of storing every post.
      config: { requireOpportunityKeywords: true },
      sourceType: "RSS",
      extractionMethod: "rss",
    },
    {
      id: "source-ibm-skillsbuild",
      name: "IBM SkillsBuild",
      organization: "IBM",
      url: "https://skillsbuild.org/",
      complianceSourceUrl: "https://ibm.com",
      categoryCoverage: ["Learning Program", "Digital Credentials"],
      config: { pages: [{ url: "https://skillsbuild.org/", organization: "IBM" }] },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-jpmorganchase-programs",
      name: "JPMorganChase Programs Directory",
      organization: "JPMorganChase",
      url: "https://www.jpmorganchase.com/careers/explore-opportunities/programs",
      complianceSourceUrl: "https://jpmorganchase.com",
      categoryCoverage: ["Internship Program", "Early Career"],
      config: {
        pages: [
          {
            url: "https://www.jpmorganchase.com/careers/explore-opportunities/programs",
            organization: "JPMorganChase",
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-bcg-rise",
      name: "RISE by BCG",
      organization: "BCG",
      url: "https://rise.bcg.com/",
      complianceSourceUrl: "https://bcg.com",
      categoryCoverage: ["Technical Academy", "AI/Digital Skills"],
      config: { pages: [{ url: "https://rise.bcg.com/", organization: "BCG" }] },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-ey-nextgen-women",
      name: "EY-Parthenon NextGen Women",
      organization: "EY",
      url: "https://www.ey.com/en_gl/careers/nextgen-women",
      complianceSourceUrl: "https://ey.com",
      categoryCoverage: ["Case Competition"],
      config: { pages: [{ url: "https://www.ey.com/en_gl/careers/nextgen-women", organization: "EY" }] },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-deepmind-student-researcher",
      name: "Google DeepMind Student Researcher Program",
      organization: "Google DeepMind",
      url: "https://deepmind.google/student-researcher-program/",
      complianceSourceUrl: "https://deepmind.google",
      categoryCoverage: ["Research Internship", "AI/ML"],
      config: {
        pages: [{ url: "https://deepmind.google/student-researcher-program/", organization: "Google DeepMind" }],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-deloitte-case-competition",
      name: "Deloitte Consulting Undergraduate Case Competition",
      organization: "Deloitte",
      url: "https://www.deloitte.com/us/en/careers/join-deloitte/consulting-undergraduate-case-competition.html",
      complianceSourceUrl: "https://deloitte.com",
      categoryCoverage: ["Case Competition"],
      config: {
        pages: [
          {
            url: "https://www.deloitte.com/us/en/careers/join-deloitte/consulting-undergraduate-case-competition.html",
            organization: "Deloitte",
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-accenture-innovation-challenge",
      name: "Accenture Innovation Challenge (MBA)",
      organization: "Accenture",
      url: "https://www.accenture.com/us-en/Careers/innovation-challenge-mba",
      complianceSourceUrl: "https://accenture.com",
      categoryCoverage: ["Case Competition", "Innovation Challenge"],
      config: {
        pages: [{ url: "https://www.accenture.com/us-en/Careers/innovation-challenge-mba", organization: "Accenture" }],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-salesforce-trailhead",
      name: "Salesforce Trailhead",
      organization: "Salesforce",
      url: "https://trailhead.salesforce.com/",
      complianceSourceUrl: "https://salesforce.com",
      categoryCoverage: ["Learning Program", "Certification"],
      config: {
        renderMode: "js",
        pages: [{ url: "https://trailhead.salesforce.com/", organization: "Salesforce" }],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
  ];

  for (const s of sources) {
    const compliance = await findCompliance(s.complianceSourceUrl);
    if (!compliance) {
      console.log(`Skipping "${s.name}" — no compliance record found for ${s.complianceSourceUrl}. Run seedCorporateComplianceRecords first.`);
      continue;
    }
    await prisma.source.upsert({
      where: { id: s.id },
      update: {
        config: JSON.stringify(s.config),
        complianceRecordId: compliance.id,
        complianceStatus: compliance.automatedAccessStatus,
        lastPolicyCheckAt: compliance.lastPolicyCheckAt,
      },
      create: {
        id: s.id,
        name: s.name,
        organization: s.organization,
        sourceType: s.sourceType,
        url: s.url,
        config: JSON.stringify(s.config),
        isActive: true,
        complianceRecordId: compliance.id,
        complianceStatus: compliance.automatedAccessStatus,
        lastPolicyCheckAt: compliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(s.categoryCoverage),
        geographicCoverage: JSON.stringify(["global"]),
        crawlFrequency: "weekly",
        extractionMethod: s.extractionMethod,
        reliabilityScore: 1.0,
      },
    });
  }

  console.log(`Seeded/updated ${sources.length} first-wave corporate opportunity sources.`);
}
