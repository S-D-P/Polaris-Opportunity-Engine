import type { PrismaClient } from "@prisma/client";

/**
 * The India + global demo-dataset sources approved for implementation
 * (docs/demo-dataset-plan.md), each linked to its compliance record from
 * prisma/seed-india-global-compliance.ts. All 7 are ALLOWED or ALLOWED_WITH_RESTRICTIONS —
 * no UNCLEAR_REQUIRES_REVIEW or NOT_ALLOWED source is wired up here.
 *
 * MyGov.in reuses the existing rssAdapter. The other 6 use staticPageAdapter
 * (lib/ingestion/adapters/static-page.ts):
 *  - AIM, Smart India Hackathon: `pages` (a few explicitly-verified named programs), sourced
 *    as INDIA_ONLY at the source level — Government of India programs whose own eligibility
 *    language confirms this, not an inference from the organization.
 *  - Unstop, Devfolio, HackerEarth, MLH: `listingPages` (discover-then-fetch a bounded number
 *    of real, currently-listed items) — deliberately modest itemLimits, matching the "curated,
 *    not maximum volume" demo goal. No source-level geographicScope default is set for these
 *    four: each hosts a genuine mix of India-only and internationally-open listings, and
 *    setting a default would violate the "never infer from the platform" rule
 *    (docs/geographic-model.md) — every item stays LOCATION_UNKNOWN until a future,
 *    evidence-based per-item classification pass.
 */
export async function seedIndiaGlobalSources(prisma: PrismaClient) {
  const findCompliance = (sourceUrl: string) =>
    prisma.sourceComplianceRecord.findFirst({ where: { sourceUrl } });

  interface SourceSpec {
    id: string;
    name: string;
    organization: string;
    url: string;
    complianceSourceUrl: string;
    categoryCoverage: string[];
    config: Record<string, unknown>;
    sourceType: "RSS" | "STATIC_PAGE";
    extractionMethod: "rss" | "sitemap_html";
  }

  const sources: SourceSpec[] = [
    {
      id: "source-mygov-in-rss",
      name: "MyGov.in (RSS)",
      organization: "Government of India",
      url: "https://mygov.in/rss.xml",
      complianceSourceUrl: "https://mygov.in",
      categoryCoverage: ["Government", "Civic", "Contests"],
      config: { geographicScope: "INDIA_ONLY" },
      sourceType: "RSS",
      extractionMethod: "rss",
    },
    {
      id: "source-aim-india",
      name: "Atal Innovation Mission",
      organization: "NITI Aayog (Government of India)",
      url: "https://aim.gov.in/",
      complianceSourceUrl: "https://aim.gov.in",
      categoryCoverage: ["Innovation", "Entrepreneurship", "Government"],
      config: {
        // URLs verified live via direct browser navigation from aim.gov.in's own homepage —
        // Tinkerpreneur 2026 was deliberately excluded even though it's a real, current AIM
        // program: its actual link points to a third-party domain (aistudent.community) that
        // has not been separately compliance-reviewed, so it's out of scope for this source.
        geographicScope: "INDIA_ONLY",
        pages: [
          {
            url: "https://aimapp2.aim.gov.in/atl_tranche3/index.php",
            organization: "Atal Innovation Mission",
          },
          {
            url: "https://aim.gov.in/ICDK-water-innovation-challenge-6.php",
            organization: "Atal Innovation Mission",
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-smart-india-hackathon",
      name: "Smart India Hackathon",
      organization: "Government of India (AICTE / MIC)",
      url: "https://sih.gov.in/",
      complianceSourceUrl: "https://sih.gov.in",
      categoryCoverage: ["Hackathon", "Government"],
      config: {
        geographicScope: "INDIA_ONLY",
        pages: [{ url: "https://sih.gov.in/", organization: "Smart India Hackathon" }],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-unstop-hackathons",
      name: "Unstop — Hackathons",
      organization: "Unstop",
      url: "https://unstop.com/hackathons",
      complianceSourceUrl: "https://unstop.com",
      categoryCoverage: ["Hackathon", "Competition"],
      config: {
        renderMode: "js",
        listingPages: [
          {
            url: "https://unstop.com/hackathons",
            linkSelector: 'a[href*="/hackathons/"]',
            itemLimit: 12,
          },
        ],
        fieldMap: { description: ".un_editor_text_live" },
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-devfolio-open-hackathons",
      name: "Devfolio — Open Hackathons",
      organization: "Devfolio",
      url: "https://devfolio.co/hackathons/open",
      complianceSourceUrl: "https://devfolio.co",
      categoryCoverage: ["Hackathon"],
      config: {
        renderMode: "js",
        listingPages: [
          {
            // Individual hackathons are hosted on *.devfolio.co subdomains (confirmed via
            // live inspection, e.g. recursion-edition.devfolio.co) — ".devfolio.co" as a
            // substring match targets those without also matching devfolio.co's own relative
            // nav links.
            url: "https://devfolio.co/hackathons/open",
            linkSelector: 'a[href*=".devfolio.co"]',
            itemLimit: 10,
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      // NOTE: a live run (2026-09-03) found this source blocked by bot-fingerprint detection
      // (headless Chromium gets HTTP 403; a normal browser session does not) — see
      // docs/source-compliance.md's HackerEarth entry. The current database has this source's
      // isActive manually set to false; a fresh `create` here still defaults to true, matching
      // the same "fresh-install default vs. current known-state" gap already accepted for
      // HigherEdJobs in prisma/seed-sources.ts — re-flip manually if this is ever re-seeded
      // from scratch, don't assume it's safe to reactivate without re-checking the block.
      id: "source-hackerearth-challenges",
      name: "HackerEarth — Challenges",
      organization: "HackerEarth",
      url: "https://www.hackerearth.com/challenges/",
      complianceSourceUrl: "https://hackerearth.com",
      categoryCoverage: ["Hackathon", "Competition"],
      config: {
        renderMode: "js",
        listingPages: [
          {
            url: "https://www.hackerearth.com/challenges/",
            linkSelector: 'a[href*="/challenges/"]',
            itemLimit: 10,
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
    {
      id: "source-mlh-events",
      name: "Major League Hacking — Events",
      organization: "Major League Hacking",
      url: "https://www.mlh.com/seasons/2027/events",
      complianceSourceUrl: "https://mlh.io",
      categoryCoverage: ["Hackathon", "Student Community"],
      config: {
        listingPages: [
          {
            // Every real event card links out with this exact utm_campaign signature
            // (confirmed via live inspection) — far more precise than filtering out MLH's own
            // domain/social links, which would otherwise pollute the first N results.
            url: "https://www.mlh.com/seasons/2027/events",
            linkSelector: 'a[href*="utm_campaign=events"]',
            itemLimit: 10,
            renderMode: "js",
          },
        ],
      },
      sourceType: "STATIC_PAGE",
      extractionMethod: "sitemap_html",
    },
  ];

  for (const s of sources) {
    const compliance = await findCompliance(s.complianceSourceUrl);
    if (!compliance) {
      console.log(`Skipping "${s.name}" — no compliance record found for ${s.complianceSourceUrl}. Run seedIndiaGlobalComplianceRecords first.`);
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
        geographicCoverage: JSON.stringify(["India"]),
        crawlFrequency: "weekly",
        extractionMethod: s.extractionMethod,
        reliabilityScore: 1.0,
      },
    });
  }

  console.log(`Seeded/updated ${sources.length} India/global demo-dataset sources.`);
}
