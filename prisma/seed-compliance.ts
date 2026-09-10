import type { PrismaClient } from "@prisma/client";

/**
 * The 19 source compliance records researched and recorded in docs/source-compliance.md.
 * Populating these into the database is what makes the compliance gate
 * (lib/ingestion/compliance.ts) real and queryable rather than documentation-only — most of
 * these sources have no `Source` row yet (no adapter has been wired up for them), which is
 * the point: compliance research happens *before* a source is ever operationally added.
 *
 * `lastPolicyCheckAt` matches the date the live robots.txt/ToS research in
 * docs/source-compliance.md was actually performed — do not bump this without re-doing the
 * research; it is not "last time this file was edited."
 */
const POLICY_CHECK_DATE = new Date("2026-09-03T00:00:00.000Z");

export interface ComplianceSeedRecord {
  sourceName: string;
  sourceUrl: string;
  robotsTxtStatus: string;
  robotsTxtCrawlPermission: string;
  tosReviewed: boolean;
  tosUrl?: string;
  tosSummary?: string;
  apiAvailable: boolean;
  apiPreferred: boolean;
  apiDocsUrl?: string;
  rssAvailable: boolean;
  rssUrl?: string;
  sitemapAvailable: boolean;
  sitemapUrl?: string;
  automatedAccessStatus: "ALLOWED" | "ALLOWED_WITH_RESTRICTIONS" | "UNCLEAR_REQUIRES_REVIEW" | "NOT_ALLOWED";
  rateLimit?: string;
  permittedAdapterType: string;
  complianceNotes: string;
  reviewRequired: boolean;
}

export const COMPLIANCE_SEED_RECORDS: ComplianceSeedRecord[] = [
  {
    sourceName: "USAJobs.gov",
    sourceUrl: "https://www.usajobs.gov",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://developer.usajobs.gov/guides/terms-of-use",
    tosSummary: "Standard federal-system-use language; no scraping/redistribution/commercial-use prohibition found.",
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://developer.usajobs.gov",
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.usajobs.gov/sitemap.xml",
    automatedAccessStatus: "ALLOWED",
    rateLimit: "Search Jobs API: 10,000 rows/query cap, 500 rows/page",
    permittedAdapterType: "official_api",
    complianceNotes:
      "Cleanest result of all researched sources — permissive robots.txt, free official API, no redistribution restriction found.",
    reviewRequired: false,
  },
  {
    sourceName: "Data.gov",
    sourceUrl: "https://www.data.gov",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://resources.data.gov/open-licenses/",
    tosSummary:
      "Federal-origin datasets are public-domain/openly licensed under the OPEN Government Data Act. Non-federal datasets cataloged here carry independent licenses that must be checked per dataset.",
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://resources.data.gov/catalog-api/",
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://data.gov/sitemap.xml",
    automatedAccessStatus: "ALLOWED",
    rateLimit: "1,000 req/hour with a personal API key; DEMO_KEY limited to 30/hour, 50/day per IP",
    permittedAdapterType: "official_api",
    complianceNotes:
      "Value to Polaris is as a discovery layer (Part 7), not a direct opportunity feed — each surfaced non-federal dataset needs its own license check.",
    reviewRequired: false,
  },
  {
    sourceName: "Grants.gov",
    sourceUrl: "https://www.grants.gov",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://grants.gov/api/terms-conditions",
    tosSummary:
      "General site ToS not located; API-specific terms require an attribution notice and prohibit implying HHS endorsement. Access is revocable at HHS's sole discretion.",
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://grants.gov/api/api-guide",
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.grants.gov/sitemap.xml",
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "No published numeric limit; usage monitored, access revocable at any time",
    permittedAdapterType: "official_api",
    complianceNotes:
      'Attribution notice required in-product: "This product uses the Grants.gov API but is not endorsed or certified by...". Adapter must fail gracefully (no retry-storm) if access is withdrawn.',
    reviewRequired: false,
  },
  {
    sourceName: "NSF.gov (funding opportunities)",
    sourceUrl: "https://www.nsf.gov",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://www.nsf.gov/policies/reuse.jsp",
    tosSummary:
      "Most page text is a US-government work, not copyrighted, freely copyable. robots.txt explicitly disallows the /funding/opportunities search and CSV-export paths — RSS is the sanctioned channel for this content instead.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: true,
    rssUrl: "https://www.nsf.gov/rss/rss_www_funding_pgm_annc_inf.xml",
    sitemapAvailable: true,
    sitemapUrl: "https://www.nsf.gov/sitemap.xml",
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "Not published; treat as a normal feed-polling interval",
    permittedAdapterType: "rss",
    complianceNotes:
      "Use the funding-opportunity RSS feeds only — never the disallowed /funding/opportunities or csvexport HTML paths. Reuses the existing rssAdapter unmodified.",
    reviewRequired: false,
  },
  {
    sourceName: "Kaggle",
    sourceUrl: "https://www.kaggle.com",
    robotsTxtStatus: "not_found",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: true,
    tosUrl: "https://www.kaggle.com/terms",
    tosSummary:
      "Direct fetch blocked by reCAPTCHA; scraping/crawling/spider prohibition corroborated via Kaggle's Acceptable Use Policy and independent sources, not read first-party. Needs a manual browser confirmation.",
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://www.kaggle.com/docs/api",
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "official_api",
    complianceNotes:
      "Official API only. Action item: manually load kaggle.com/terms in a real browser before treating this as fully closed.",
    reviewRequired: true,
  },
  {
    sourceName: "Eventbrite",
    sourceUrl: "https://www.eventbrite.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://www.eventbrite.com/tos/",
    tosSummary:
      'Section 13.1: "You have no right to, and you agree not to, scrape, crawl, or employ any automated means to extract data from the Sites." API governed by a separate API Terms of Use.',
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://www.eventbrite.com/platform/api",
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.eventbrite.com/sitemap_xml/sitemap_index.xml",
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "1,000 calls/hour per OAuth token",
    permittedAdapterType: "official_api",
    complianceNotes:
      "CRITICAL adapter constraint: cannot cache/store past-event content without explicit permission — an Eventbrite-origin opportunity likely needs deletion, not just a status transition, once its event date passes. Must display a live link back to Eventbrite and the event title; no branding implying affiliation.",
    reviewRequired: false,
  },
  {
    sourceName: "Idealist.org",
    sourceUrl: "https://www.idealist.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.idealist.org/en/terms-of-service",
    tosSummary:
      'Section 3.d explicitly prohibits "any automated program... bot... spiders, robots, scrapers, crawlers... data mining tools" and republishing/licensing/selling site data.',
    apiAvailable: true,
    apiPreferred: true,
    apiDocsUrl: "https://www.idealist.org/en/open-network-api",
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.idealist.org/sitemap.xml",
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "official_api",
    complianceNotes:
      "Purpose-built Volunteer Match API for exactly this aggregator use case (80,000+ opportunities), but gated behind a partnership application — not self-serve. Direct scraping is explicitly NOT_ALLOWED regardless of the permissive robots.txt.",
    reviewRequired: true,
  },
  {
    sourceName: "HigherEdJobs",
    sourceUrl: "https://www.higheredjobs.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosUrl: "https://www.higheredjobs.com/company/terms.cfm",
    tosSummary:
      "Automated fetch of the terms page failed to render twice (not a confirmed 404). Not conclusively reviewed — flagged for a manual browser check.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: true,
    rssUrl: "https://www.higheredjobs.com/search/rss.cfm?JobCat=37",
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "rss",
    complianceNotes:
      "Official per-category RSS feeds confirmed live — reuses the existing rssAdapter unmodified, one of the easiest sources to implement. Open compliance loose end: the ToS page needs a manual human read before this record is closed out.",
    reviewRequired: true,
  },
  {
    sourceName: "EU Funding & Tenders Portal",
    sourceUrl: "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://commission.europa.eu/legal-notice_en",
    tosSummary:
      "General EC content is CC BY 4.0 licensed (reuse allowed with attribution). The Portal's own opportunity-search mechanism is a JS SPA that defeated automated verification — a claimed Search API/RSS feed (per third-party guides) is unconfirmed against official EU documentation.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Favorable licensing signal (unlike most UNCLEAR cases) — worth the manual follow-up: confirm the Search API via the official Portal Reference Documents or EU service desk before building anything.",
    reviewRequired: true,
  },
  {
    sourceName: "MLH (Major League Hacking)",
    sourceUrl: "https://www.mlh.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.mlh.com/terms",
    tosSummary:
      'No explicit scraping/bot clause found. Closest language: a license grant limited to "personal purposes and non-commercial use" — in real tension with product aggregation.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      'Needs an actual legal/product judgment call — does a free aggregator product count as "non-commercial use"? Not resolvable by further automated research.',
    reviewRequired: true,
  },
  {
    sourceName: "DAAD (German Academic Exchange Service)",
    sourceUrl: "https://www.daad.de/en/",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No dedicated public Terms of Use page found; only an Imprint with a general copyright notice over all text/image content. No explicit scraping ban located, but no public API/license statement either.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.daad.de/sitemap.xml",
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    rateLimit: "Crawl-delay: 2 (explicit in robots.txt)",
    permittedAdapterType: "none",
    complianceNotes:
      "Germany's primary state scholarship clearinghouse — high value if cleared. If cleared, extract structured facts (dates, program names, eligibility) rather than description prose, which carries materially lower copyright risk.",
    reviewRequired: true,
  },
  {
    sourceName: "LinkedIn Jobs",
    sourceUrl: "https://www.linkedin.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: true,
    tosUrl: "https://www.linkedin.com/legal/user-agreement",
    tosSummary:
      'robots.txt header: "The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited." User Agreement Section 8 independently bans scraping tools and use/distribution of automatically-obtained data.',
    apiAvailable: true,
    apiPreferred: false,
    apiDocsUrl: undefined,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Clearest, most unambiguous prohibition of any source researched — both robots.txt and the User Agreement independently and explicitly forbid this. The Talent Solutions API exists but is fully gated to approved ATS partners, not accessible here. Closed unless a formal LinkedIn partnership changes the terms.",
    reviewRequired: false,
  },
  {
    sourceName: "Devpost",
    sourceUrl: "https://devpost.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://info.devpost.com/terms",
    tosSummary:
      'Section 4 (Code of Conduct) explicitly prohibits "manual or automated software, devices, scripts robots... to scrape, crawl or spider" the site or its content.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "The largest hackathon-listing aggregator on the web and a strong product fit, but not accessible without a direct business/data-licensing relationship.",
    reviewRequired: false,
  },
  {
    sourceName: "Wellfound (AngelList Talent)",
    sourceUrl: "https://wellfound.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://wellfound.com/terms",
    tosSummary:
      'Section III bans automated systems producing "greater load... than a human can reasonably produce" and separately bans "harvesting, collection or scraping" of content.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://wellfound.com/sitemap.xml.gz",
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes: "Would feed the startup-jobs category; blocked without a data partnership.",
    reviewRequired: false,
  },
  {
    sourceName: "Y Combinator Work at a Startup",
    sourceUrl: "https://www.workatastartup.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.ycombinator.com/legal",
    tosSummary:
      'YC Terms of Use (governs this site, which has no distinct public ToS) explicitly ban "data mining, robots, scraping" and derivative works, plus an anti-circumvention clause against bypassing access blocks.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "ToS explicitly overrides the technically wide-open robots.txt. Listings also typically require an authenticated login, independently complicating anonymous access.",
    reviewRequired: false,
  },
  {
    sourceName: "IIE / Fulbright Program",
    sourceUrl: "https://www.iie.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.iie.org/terms-and-conditions/",
    tosSummary:
      'Near-identical clause on both iie.org and us.fulbrightonline.org (same operating entity): "You may not use spiders, robots, data mining techniques or other automated devices or programs to catalog, download or otherwise reproduce, store, analyze or distribute content."',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.iie.org/sitemap_index.xml",
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Fulbright is the flagship US international fellowship program — high value if a licensing/data-sharing relationship can be negotiated directly with IIE; not obtainable by scraping under the reviewed terms.",
    reviewRequired: false,
  },
  {
    sourceName: "ResearchGate",
    sourceUrl: "https://www.researchgate.net",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.researchgate.net/terms-of-service",
    tosSummary:
      'Direct fetch returned HTTP 403 (bot-blocked); prohibition corroborated via independent sources: bans "any robot, spider, scraper, data mining tools... except with the prior express permission of ResearchGate in writing." Needs a manual browser confirmation.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Lower priority for Polaris regardless (marginal fit) — not worth pursuing without a direct licensing conversation even once the ToS text is manually confirmed.",
    reviewRequired: true,
  },
  {
    sourceName: "UN Careers",
    sourceUrl: "https://careers.un.org",
    robotsTxtStatus: "not_found",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: true,
    tosUrl: "https://www.un.org/en/about-us/terms-of-use",
    tosSummary:
      'Inherits the site-wide UN terms: use limited to "personal, non-commercial use, without any right to resell or redistribute them or to compile or create derivative works therefrom" — a direct prohibition on exactly what an aggregator does.',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Would be the best source for official UN jobs/internships/volunteer roles — worth a direct outreach to UN OICT/HR for a data-sharing exception, since scraping is not an option under current terms.",
    reviewRequired: false,
  },
  {
    sourceName: "unjobs.org (third-party, unofficial)",
    sourceUrl: "https://unjobs.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: false,
    tosSummary:
      'robots.txt has an explicit blanket "Disallow: /" for all unnamed user-agents, with narrow named exceptions (Google, Bing, Twitterbot) that would not apply to a Polaris adapter. No distinct ToS page found. Footer self-identifies as "Not an official document of the United Nations."',
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Third-party re-aggregation whose own source data's licensing Polaris wouldn't control either — no reason to pursue over a direct UN Careers relationship.",
    reviewRequired: false,
  },
];

export async function seedComplianceRecords(prisma: PrismaClient) {
  let created = 0;
  for (const record of COMPLIANCE_SEED_RECORDS) {
    const existing = await prisma.sourceComplianceRecord.findFirst({
      where: { sourceUrl: record.sourceUrl },
    });
    if (existing) continue;

    await prisma.sourceComplianceRecord.create({
      data: {
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        robotsTxtStatus: record.robotsTxtStatus,
        robotsTxtCrawlPermission: record.robotsTxtCrawlPermission,
        robotsTxtCheckedAt: POLICY_CHECK_DATE,
        tosReviewed: record.tosReviewed,
        tosUrl: record.tosUrl,
        tosSummary: record.tosSummary,
        apiAvailable: record.apiAvailable,
        apiPreferred: record.apiPreferred,
        apiDocsUrl: record.apiDocsUrl,
        rssAvailable: record.rssAvailable,
        rssUrl: record.rssUrl,
        sitemapAvailable: record.sitemapAvailable,
        sitemapUrl: record.sitemapUrl,
        automatedAccessStatus: record.automatedAccessStatus,
        rateLimit: record.rateLimit,
        permittedAdapterType: record.permittedAdapterType,
        complianceNotes: record.complianceNotes,
        lastPolicyCheckAt: POLICY_CHECK_DATE,
        reviewRequired: record.reviewRequired,
      },
    });
    created++;
  }
  console.log(`Seeded ${created} new source compliance records (${COMPLIANCE_SEED_RECORDS.length - created} already existed).`);
}
