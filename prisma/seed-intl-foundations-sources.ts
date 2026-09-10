import type { PrismaClient } from "@prisma/client";

/**
 * The 9 international-org/foundation/professional-society/India sources approved for
 * implementation from docs/source-compliance.md's Batch 4 (2026-09-09) — each linked to its
 * compliance record from prisma/seed-intl-foundations-compliance.ts. All 9 are
 * ALLOWED_WITH_RESTRICTIONS; no UNCLEAR_REQUIRES_REVIEW or NOT_ALLOWED source is wired up
 * here, matching the fail-closed rule enforced by every prior batch.
 *
 * Every source uses staticPageAdapter (lib/ingestion/adapters/static-page.ts) with a single
 * hand-picked `pages` entry — one genuinely verified, currently-live program page per
 * organization (not a listing/discovery crawl), matching the AIM/SIH pattern from Batch 3
 * rather than the higher-volume listingPages pattern used for platforms like Unstop/Devfolio.
 * No renderMode: "js" is needed for any of these — every page's real content was confirmed
 * present in a plain (non-JS-rendered) fetch during compliance research.
 *
 * NOTE — live ingestion findings (2026-09-09, see docs/source-compliance.md Batch 4): a real
 * run of all 9 sources found 3 blocked by bot detection despite passing compliance research
 * (robots.txt/ToS review alone can't surface this — it only shows up against a real fetch):
 *  - UNESCO (source-unesco-fellowships): the fetch returns HTTP 200 but with an obfuscated
 *    JS bot-challenge page (Akamai/TSPD-style) instead of real content, not a 403 — so it
 *    fails downstream as an "invalid item" (empty title) rather than a fetch error.
 *  - Mozilla Foundation (source-mozilla-fellowship): HTTP 403 Forbidden to the pipeline's
 *    `PolarisBot/1.0` User-Agent, even though the same URL is reachable with a browser UA.
 *  - AAUW (source-aauw-international-fellowships): same HTTP 403 pattern as Mozilla.
 * All three have `isActive: false` in the live database (set directly, matching the existing
 * HigherEdJobs/HackerEarth convention in seed-sources.ts / seed-india-global-sources.ts). A
 * fresh `create` here still defaults to `isActive: true` per that same accepted convention —
 * re-flip manually if this is ever re-seeded from scratch, don't assume it's safe to
 * reactivate without re-checking the block.
 */
export async function seedIntlFoundationsSources(prisma: PrismaClient) {
  const findCompliance = (sourceUrl: string) =>
    prisma.sourceComplianceRecord.findFirst({ where: { sourceUrl } });

  interface SourceSpec {
    id: string;
    name: string;
    organization: string;
    url: string;
    complianceSourceUrl: string;
    categoryCoverage: string[];
    geographicCoverage: string[];
    config: Record<string, unknown>;
  }

  const sources: SourceSpec[] = [
    {
      id: "source-unesco-fellowships",
      name: "UNESCO — Japan Young Researchers' Fellowships",
      organization: "UNESCO",
      url: "https://www.unesco.org/en/fellowships/keizo-obuchi",
      complianceSourceUrl: "https://www.unesco.org",
      categoryCoverage: ["Fellowship", "Research"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://www.unesco.org/en/fellowships/keizo-obuchi",
            organization: "UNESCO",
          },
        ],
      },
    },
    {
      id: "source-chevening-scholarships",
      name: "Chevening Scholarships",
      organization: "UK Foreign, Commonwealth & Development Office (FCDO)",
      url: "https://www.chevening.org/scholarships/",
      complianceSourceUrl: "https://www.chevening.org",
      categoryCoverage: ["Scholarship"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://www.chevening.org/scholarships/",
            organization: "Chevening",
          },
        ],
      },
    },
    {
      id: "source-mastercard-foundation-scholars",
      name: "Mastercard Foundation Scholars Program",
      organization: "Mastercard Foundation",
      url: "https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/",
      complianceSourceUrl: "https://mastercardfdn.org",
      categoryCoverage: ["Scholarship"],
      geographicCoverage: ["Africa", "global"],
      config: {
        pages: [
          {
            url: "https://mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/",
            organization: "Mastercard Foundation",
          },
        ],
      },
    },
    {
      id: "source-rhodes-scholarship",
      name: "Rhodes Scholarship",
      organization: "Rhodes Trust",
      url: "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/",
      complianceSourceUrl: "https://www.rhodeshouse.ox.ac.uk",
      categoryCoverage: ["Scholarship"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/",
            organization: "Rhodes Trust",
          },
        ],
      },
    },
    {
      id: "source-mozilla-fellowship",
      name: "Mozilla Fellowship Program",
      organization: "Mozilla Foundation",
      url: "https://www.mozillafoundation.org/en/what-we-do/grantmaking/fellowship/",
      complianceSourceUrl: "https://www.mozillafoundation.org",
      categoryCoverage: ["Fellowship", "Technology"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://www.mozillafoundation.org/en/what-we-do/grantmaking/fellowship/",
            organization: "Mozilla Foundation",
          },
        ],
      },
    },
    {
      id: "source-csir-hrdg-fellowships",
      name: "CSIR-HRDG Fellowships",
      organization: "Council of Scientific & Industrial Research (India)",
      url: "https://csirhrdg.res.in/Home/Index/1/Default/914/11",
      complianceSourceUrl: "https://csirhrdg.res.in",
      categoryCoverage: ["Fellowship", "Research", "Government"],
      geographicCoverage: ["India"],
      config: {
        geographicScope: "INDIA_ONLY",
        pages: [
          {
            url: "https://csirhrdg.res.in/Home/Index/1/Default/914/11",
            organization: "CSIR-HRDG",
          },
        ],
      },
    },
    {
      id: "source-reliance-foundation-scholarships",
      name: "Reliance Foundation Scholarships",
      organization: "Reliance Foundation",
      url: "https://www.reliancefoundation.org/media/media-release/Reliance_Foundation_Scholarships_2026-27",
      complianceSourceUrl: "https://www.reliancefoundation.org",
      categoryCoverage: ["Scholarship"],
      geographicCoverage: ["India"],
      config: {
        geographicScope: "INDIA_ONLY",
        pages: [
          {
            url: "https://www.reliancefoundation.org/media/media-release/Reliance_Foundation_Scholarships_2026-27",
            organization: "Reliance Foundation",
          },
        ],
      },
    },
    {
      id: "source-acm-w-scholarships",
      name: "ACM-W Computer Science Research Conference Scholarships",
      organization: "Association for Computing Machinery (ACM-W)",
      url: "https://women.acm.org/scholarships/",
      complianceSourceUrl: "https://www.acm.org",
      categoryCoverage: ["Scholarship", "Technology"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://women.acm.org/scholarships/",
            organization: "ACM-W",
          },
        ],
      },
    },
    {
      id: "source-aauw-international-fellowships",
      name: "AAUW International Fellowships",
      organization: "American Association of University Women",
      url: "https://www.aauw.org/resources/programs/fellowships-grants/aauw-international-fellowships/",
      complianceSourceUrl: "https://www.aauw.org",
      categoryCoverage: ["Fellowship"],
      geographicCoverage: ["global"],
      config: {
        pages: [
          {
            url: "https://www.aauw.org/resources/programs/fellowships-grants/aauw-international-fellowships/",
            organization: "AAUW",
          },
        ],
      },
    },
  ];

  for (const s of sources) {
    const compliance = await findCompliance(s.complianceSourceUrl);
    if (!compliance) {
      console.log(`Skipping "${s.name}" — no compliance record found for ${s.complianceSourceUrl}. Run seedIntlFoundationsComplianceRecords first.`);
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
        sourceType: "STATIC_PAGE",
        url: s.url,
        config: JSON.stringify(s.config),
        isActive: true,
        complianceRecordId: compliance.id,
        complianceStatus: compliance.automatedAccessStatus,
        lastPolicyCheckAt: compliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(s.categoryCoverage),
        geographicCoverage: JSON.stringify(s.geographicCoverage),
        crawlFrequency: "weekly",
        extractionMethod: "sitemap_html",
        reliabilityScore: 1.0,
      },
    });
  }

  console.log(`Seeded/updated ${sources.length} international/foundations/professional-society/India sources.`);
}
