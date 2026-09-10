import type { PrismaClient } from "@prisma/client";
import type { ComplianceSeedRecord } from "./seed-compliance";

/**
 * The 16 India + global-accessible-to-India source compliance records researched and recorded
 * in docs/source-compliance.md under "India + Global Sources (Batch 3 — 2026-09-03, demo
 * dataset expansion)".
 *
 * Same methodology and fail-closed rule as Batches 1-2: live robots.txt/ToS/RSS/sitemap/API
 * fetches, not memory; NOT_ALLOWED is never implemented, UNCLEAR_REQUIRES_REVIEW never
 * auto-runs.
 *
 * Two domain corrections from the brief's assumed values, confirmed live during this batch's
 * research: TCS CodeVita is at codevita.tcsapps.com (not codevita.tcs.com), and Infosys
 * Springboard is at infyspringboard.onwingspan.com (not springboard.infosys.com).
 *
 * `lastPolicyCheckAt` matches the date the live research in docs/source-compliance.md was
 * actually performed — do not bump this without re-doing the research.
 */
const POLICY_CHECK_DATE = new Date("2026-09-03T00:00:00.000Z");

export const INDIA_GLOBAL_COMPLIANCE_SEED_RECORDS: ComplianceSeedRecord[] = [
  // ---- ALLOWED ----
  {
    sourceName: "MyGov.in",
    sourceUrl: "https://mygov.in",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosSummary:
      "Website Policy page states content 'may be reproduced free of charge' with attribution; no scraping-specific prohibition found.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: true,
    rssUrl: "https://mygov.in/rss.xml",
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED",
    rateLimit: "Crawl-delay: 10 (robots.txt) — must be honored.",
    permittedAdapterType: "rss",
    complianceNotes:
      "robots.txt blocks /admin/, /user/, /api/, /jsonrpc/, /cron.php and sets Crawl-delay: 10; RSS at mygov.in/rss.xml confirmed live with real, dated (Sept 2026) contests. geographicScope: INDIA_ONLY (citizen engagement platform — Government of India).",
    reviewRequired: false,
  },

  // ---- ALLOWED_WITH_RESTRICTIONS ----
  {
    sourceName: "Smart India Hackathon",
    sourceUrl: "https://sih.gov.in",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "Website-policies page not located, so ToS not conclusively reviewed.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt is fully permissive (Disallow: for all agents). Verified real, current SIH 2026 cycle content. geographicScope: INDIA_ONLY (student teams via Indian institutions; no international eligibility stated).",
    reviewRequired: false,
  },
  {
    sourceName: "Atal Innovation Mission",
    sourceUrl: "https://aim.gov.in",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "No ToS/website-policy page was located.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "No robots.txt file exists (404 treated as default-allow, not an affirmative permission statement). Verified real, current named programs (Tinkerpreneur 2026, ATL Tranche 3, ICDK-6 Water Innovation Challenge). geographicScope: INDIA_ONLY (NITI Aayog national program).",
    reviewRequired: false,
  },
  {
    sourceName: "DST (Department of Science and Technology)",
    sourceUrl: "https://dst.gov.in",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "No ToS/website-policy page was located.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "Ministry site only, not the applicant-facing INSPIRE portal (that's a separate UNCLEAR_REQUIRES_REVIEW record below, on online-inspire.gov.in, due to TLS certificate failures). No robots.txt file exists. Real INSPIRE fellowship references and press notes confirmed live, scoped to dst.gov.in news/press pages only. geographicScope: INDIA_ONLY.",
    reviewRequired: false,
  },
  {
    sourceName: "Unstop",
    sourceUrl: "https://unstop.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "ToS page loaded but only a cookie/privacy notice was visible in the fetched content — full document not conclusively reviewed.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt explicitly Allows /competitions/, /hackathons/, /internship/, /courses/, /quiz/, and explicitly names and permits Claude-Web and anthropic-ai while blocking CCBot, Bytespider, HTTrack, Wget. Sitemap index live and current (156 opportunity-sitemap files). Content is JS-rendered (Angular SPA, renderMode: js). Mixed geography — no source-level default (hosts both India-only and internationally-open listings). Read the full ToS before scaling beyond the initial small itemLimit used here.",
    reviewRequired: false,
  },
  {
    sourceName: "Devfolio",
    sourceUrl: "https://devfolio.co",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://devfolio.co/terms-of-use",
    tosSummary:
      "No explicit scraping/bot clause found — only a DDoS/malware-interference clause was present.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt is empty Disallow: (fully permissive), no sitemap directive. Individual hackathons are hosted on *.devfolio.co subdomains (e.g. recursion-edition.devfolio.co) with real, distinct og:title tags confirmed live. React app, renderMode: js. Mixed geography — no source-level default. No published rate limit.",
    reviewRequired: false,
  },
  {
    sourceName: "HackerEarth",
    sourceUrl: "https://hackerearth.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosSummary:
      "Review found only a generic no-infringing-use clause, no explicit anti-scraping language.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt is Allow: / with narrow disallows (/*?login=, /*AJAX, a few language subdirectories); sitemap.xml exists. Public API v4 is a code-compile/execute service only (confirmed via its docs), not a listings API, so it can't substitute for HTML extraction. renderMode: js. Mixed geography — no source-level default.",
    reviewRequired: false,
  },
  {
    sourceName: "MLH (Major League Hacking)",
    sourceUrl: "https://mlh.io",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosSummary:
      "No explicit scraping ban found; the closest clause bars reverse-engineering.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "Redirects to www.mlh.com. robots.txt is Allow: / with disallows only on /account/, /tools/, /_/, /auth/, /admin/, /graphql, and promo-code paths — nothing touching the events listing. No sitemap/RSS/API. Confirmed genuine mixed geography on the live events page (US/Canada/UK events alongside 3 India-based hackathons: HackNex Season 2 in West Bengal, Innohacks 4.0 in Uttar Pradesh, hackCBS 9.O in New Delhi), each linking out to its own independently-run site. Mixed geography — no source-level default.",
    reviewRequired: false,
  },
  {
    sourceName: "Google for Startups (India)",
    sourceUrl: "https://startup.google.com",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "Not separately reviewed for this record — see the existing Google ToS record from Batch 2.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "none",
    complianceNotes:
      "Reviewed specifically for an India-specific program distinct from the general Google programs already in Batch 2; found only the same global-scope programs (Accelerators, Gemini Startup Forum, Startup School, Events) at startup.google.com/programs/. robots.txt fully permissive. No new India-specific source identified — not implemented, nothing to add beyond the existing Google record.",
    reviewRequired: false,
  },

  // ---- UNCLEAR_REQUIRES_REVIEW ----
  {
    sourceName: "Startup India",
    sourceUrl: "https://startupindia.gov.in",
    robotsTxtStatus: "unreadable (TLS failure)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: true,
    tosSummary:
      "Terms of Use and Website Policy pages loaded and describe real current programs (Seed Fund Scheme, MAARG, National Startup Awards), with a reproduction-permission clause worth flagging to legal separately from the scraping question.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt could not be fetched — repeated TLS certificate-verification failures across 3 separate attempts (https, www, http). A genuine access gap, not a deliberate block, but crawl rules can't be confirmed either way. Retry robots.txt with a different fetcher/network path before concluding anything.",
    reviewRequired: true,
  },
  {
    sourceName: "AICTE",
    sourceUrl: "https://aicte.gov.in",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "Not reviewed — domain authenticity flagged first.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "The researched domain aicte-india.org 301-redirects to aicte.gov.in, a different domain than expected for this institution; destination content is plausible (GoI seal, SIH/SWAYAM references) but domain authenticity could not be independently confirmed from this research alone. robots.txt at aicte.gov.in is 404. Verify this is genuinely AICTE's authoritative domain before any technical work.",
    reviewRequired: true,
  },
  {
    sourceName: "DST INSPIRE portal",
    sourceUrl: "https://online-inspire.gov.in",
    robotsTxtStatus: "unreadable (TLS failure)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "Not reviewed — blocked before any page could be read.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "The actual applicant-facing INSPIRE fellowship portal (distinct from dst.gov.in) failed TLS certificate verification on every attempt, both http and https — a reproducible access failure, not a guess. Retest with a properly configured fetcher.",
    reviewRequired: true,
  },
  {
    sourceName: "TCS CodeVita",
    sourceUrl: "https://codevita.tcsapps.com",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "ToS page also 404'd — could not verify any scraping restriction.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Domain correction: the brief's assumed codevita.tcs.com doesn't resolve — the real, confirmed-live domain is codevita.tcsapps.com. robots.txt 404 and ToS page 404. Eligibility text confirmed genuinely global/India-inclusive ('from any recognized institute across the globe'), but the ToS gap makes automated access unverifiable.",
    reviewRequired: true,
  },
  {
    sourceName: "Infosys Springboard",
    sourceUrl: "https://infyspringboard.onwingspan.com",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "ToS not located.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Domain correction: the brief's assumed springboard.infosys.com doesn't resolve — the real, confirmed-live domain is infyspringboard.onwingspan.com. robots.txt 404; sitemap.xml returns 403 AccessDenied from a CDN; most content sits behind a login wall. Do not attempt automated access until directly reviewed, ideally by a human with an account.",
    reviewRequired: true,
  },
  {
    sourceName: "E-Cell IIT Bombay",
    sourceUrl: "https://ecell.in",
    robotsTxtStatus: "unreliable (SPA fallback)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary:
      "/terms 301-redirects to an unrelated third-party Razorpay merchant policy page — clearly not E-Cell's actual terms.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Could not obtain a genuine robots.txt, sitemap, or ToS: an Angular SPA whose router serves the app shell (or an unrelated redirect) for almost any probed path. The Eureka! program page itself is real and current; its FAQ states no residency restriction, which per the 'don't infer' rule means this should not be classified INDIA_ONLY just because the organizer is India-based, nor GLOBAL from the presence of international bonus tracks. Locate actual governing terms before any automated access.",
    reviewRequired: true,
  },

  // ---- NOT_ALLOWED ----
  {
    sourceName: "MeitY / Digital India",
    sourceUrl: "https://meity.gov.in",
    robotsTxtStatus: "blocked (403)",
    robotsTxtCrawlPermission: "blocked (403)",
    tosReviewed: false,
    tosSummary: "Not reviewed — infrastructure-level block on both domains.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "Both meity.gov.in and www.meity.gov.in, and both domains' robots.txt, returned HTTP 403 Forbidden consistently across attempts. No workaround attempted, per the standing rule. This is an infrastructure-level block, not a legal ambiguity to resolve.",
    reviewRequired: false,
  },
];

export async function seedIndiaGlobalComplianceRecords(prisma: PrismaClient) {
  let created = 0;
  for (const record of INDIA_GLOBAL_COMPLIANCE_SEED_RECORDS) {
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
  console.log(
    `Seeded ${created} new India + global compliance records (${INDIA_GLOBAL_COMPLIANCE_SEED_RECORDS.length - created} already existed).`,
  );
}
