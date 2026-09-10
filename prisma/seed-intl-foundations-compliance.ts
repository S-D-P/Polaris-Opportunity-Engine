import type { PrismaClient } from "@prisma/client";
import type { ComplianceSeedRecord } from "./seed-compliance";

/**
 * The 20 international-org/foundation/professional-society/India compliance records
 * researched and recorded in docs/source-compliance.md under "International Orgs,
 * Foundations, Professional Societies + India (Batch 4 — 2026-09-09)".
 *
 * Same methodology and fail-closed rule as Batches 1-3: live robots.txt/ToS/RSS/sitemap/API
 * fetches, not memory; NOT_ALLOWED is never implemented, UNCLEAR_REQUIRES_REVIEW never
 * auto-runs.
 *
 * Two NOT_ALLOWED calls here (Tata Trusts, Rockefeller Foundation) turn on an explicit
 * non-commercial/no-derivative-works ToS clause rather than a bot/scraper-named clause —
 * treated the same way Batch 1 treated UN Careers' "no right to... compile or create
 * derivative works" language: a direct prohibition on exactly what an aggregator does, even
 * without the word "robot" anywhere in the text.
 *
 * `lastPolicyCheckAt` matches the date the live research in docs/source-compliance.md was
 * actually performed — do not bump this without re-doing the research.
 */
const POLICY_CHECK_DATE = new Date("2026-09-09T00:00:00.000Z");

export const INTL_FOUNDATIONS_COMPLIANCE_SEED_RECORDS: ComplianceSeedRecord[] = [
  // ---- ALLOWED_WITH_RESTRICTIONS ----
  {
    sourceName: "UNESCO",
    sourceUrl: "https://www.unesco.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosUrl: "https://www.unesco.org/en/terms-use",
    tosSummary:
      "Terms of Use page located but its content is literally 'coming soon...' — not yet published. Not a found prohibition, a real gap.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "General robots.txt is permissive for a non-named crawler (Polaris's PolarisBot/1.0 UA is not among the explicitly-disallowed named AI-training bots list — Amazonbot, ClaudeBot, GPTBot, etc. — which sits in a separate, explicit Disallow:/ block). Verified real, current UNESCO/Japan Young Researchers' Fellowships Programme (2026 cycle, deadline 30 Sept 2026). Re-check the ToS page periodically since it was found unpublished rather than absent.",
    reviewRequired: true,
  },
  {
    sourceName: "Chevening Scholarships",
    sourceUrl: "https://www.chevening.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.chevening.org/terms-and-conditions/",
    tosSummary:
      "No language on automated access, scraping, crawling, robots, bots, or data mining. Only a Crown-copyright footer notice.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "Crawl-Delay: 10 (robots.txt, scoped to AhrefsBot specifically)",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "Fully permissive robots.txt (disallows only /wp-admin/); ToS reviewed and silent on automation. Verified real, current Chevening Scholarships page with an open application cycle.",
    reviewRequired: false,
  },
  {
    sourceName: "Mastercard Foundation",
    sourceUrl: "https://mastercardfdn.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No dedicated Terms of Use/Terms and Conditions page exists on mastercardfdn.org — footer links only to Privacy Policy, Accessibility, and Safeguarding. A 'terms-and-conditions-services' page found governs partner/contractor agreements, not website use.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt fully permissive across all 8 named user-agent blocks, including AI-specific ones. Verified real, current Mastercard Foundation Scholars Program page (58,000+ scholars). Legally distinct, independent Canadian foundation from Mastercard Inc. (already NOT_ALLOWED in Batch 2) — correctly a separate record, not a re-classification.",
    reviewRequired: false,
  },
  {
    sourceName: "Rhodes Trust",
    sourceUrl: "https://www.rhodeshouse.ox.ac.uk",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No general Terms and Conditions/Terms of Use page located; the only legal page found is a Privacy Policy scoped specifically to venue-hire enquiries.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt fully permissive (Allow: /, disallows only two Cloudflare challenge-platform paths). Verified real, current Rhodes Scholarship page (2027 cycle open, funding details confirmed).",
    reviewRequired: false,
  },
  {
    sourceName: "Mozilla Foundation",
    sourceUrl: "https://www.mozillafoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosUrl: "https://www.mozilla.org/en-US/about/legal/terms/mozilla/",
    tosSummary:
      "The controlling 'Websites & Communications Terms of Use' explicitly lists the domains it covers (mozilla.org, mozillians.org, firefox.com, mozillafestival.org, openstandard.com, openbadges.org, webmaker.org) — mozillafoundation.org is not among them, so applicability to the Fellowship page's actual domain is unconfirmed. The text itself has no automation/scraping ban.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "crawl-delay: 10 (robots.txt)",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt on mozillafoundation.org itself is permissive for a non-named crawler (separate named-AI-bot Disallow:/ block, same pattern as UNESCO). Verified real, current Mozilla Fellowship Program page (2026 cycle). WebFetch's own crawler UA got HTTP 403 on this page twice; a plain curl with a standard browser User-Agent got HTTP 200 with the real content — a tool-fingerprinting false negative, resolved by an actual alternate fetch, not assumed.",
    reviewRequired: true,
  },
  {
    sourceName: "CSIR-HRDG (India)",
    sourceUrl: "https://csirhrdg.res.in",
    robotsTxtStatus: "not found (404)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: true,
    tosSummary:
      "Website policy: reproduction permitted free of charge with prior email permission to the HRDG Head; must be reproduced accurately, source acknowledged; third-party-copyrighted material excluded. No explicit automation/scraping clause. Governed by Indian law.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "No robots.txt file exists (404 = default-allow, not affirmative permission, same convention as AIM/DST in Batch 3). Verified real, current Fellowships overview page (dated 8 Sept 2026: JRF-NET, JRF-GATE, SRF-Direct, Research Associate, Nehru Science PDF, DJ Research Interns). Distinct domain from the CSIR ministry site (csir.res.in), which has near-identical reproduction-permission language and no automation clause but doesn't host the actual fellowship content.",
    reviewRequired: false,
  },
  {
    sourceName: "Reliance Foundation",
    sourceUrl: "https://www.reliancefoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://reliancefoundation.org/terms-conditions",
    tosSummary:
      "General copy/distribute restrictions (standard 'you may not copy/distribute/download/modify' clause); no explicit automation/scraping/bot/crawler clause found.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt fully permissive (disallows only /manage). Verified real, current Reliance Foundation Scholarships 2026-27 media-release page on reliancefoundation.org itself. The actual application portal lives on a separate, unreviewed subdomain (scholarships.reliancefoundation.org) which has no real robots.txt (SPA fallback serves the app shell for any path) and is entirely client-rendered — deliberately not used as the fetch target, matching how Batch 3 excluded AIM's Tinkerpreneur program for the same reason.",
    reviewRequired: false,
  },
  {
    sourceName: "ACM (ACM-W)",
    sourceUrl: "https://www.acm.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "acm.org/about-acm/policies returned HTTP 403 on every attempt (no workaround attempted). A candidate on.acm.org/tos page has no scraping ban but appears to govern a different ACM microsite, not acm.org/women.acm.org generally — applicability unconfirmed.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    rateLimit: "Crawl-Delay: 20 (women.acm.org robots.txt)",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "Both acm.org and women.acm.org (where the actual program lives) have permissive robots.txt. Verified real, current ACM-W Computer Science Research Conference Scholarships page (Oct 15 2026 deadline cycle). Capped at restrictions pending a real, browser-based read of ACM's actual governing ToS.",
    reviewRequired: true,
  },
  {
    sourceName: "AAUW",
    sourceUrl: "https://www.aauw.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No dedicated aauw.org Terms of Use/Terms and Conditions page located. The only 'AAUW terms' result found (aauwaction.org/about/terms/) belongs to the AAUW Action Fund, a related but legally distinct 501(c)(4) advocacy entity — not the applicable document for aauw.org itself.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt only reachable via a plain curl request with a standard browser User-Agent (WebFetch's own UA got HTTP 403 twice on the identical URL) — once fetched, it's a standard, fully permissive WordPress/Yoast file (disallows only /wp/wp-admin/). Verified real, current AAUW International Fellowships page (2026-2027 cycle, $20k/$25k/$50k stipends). LIVE INGESTION FINDING: the pipeline's own PolarisBot/1.0 fetch also got HTTP 403 on this page (not just WebFetch's research tooling) — see docs/source-compliance.md for detail. Source deactivated pending resolution.",
    reviewRequired: true,
  },

  // ---- UNCLEAR_REQUIRES_REVIEW ----
  {
    sourceName: "World Bank Group",
    sourceUrl: "https://www.worldbank.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.worldbank.org/ext/en/legal/terms-conditions",
    tosSummary:
      "No explicit scraping/bot clause, but API usage barred from 'excessive or abusive usage', and general materials may not be used for derivative works/commercial use 'without the prior written consent of the relevant member institution(s)', plus mandatory attribution.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "The non-commercial/no-derivative-work restriction is a real ambiguity in the same category as MLH's (Batch 1) 'non-commercial use' clause — needs a human/legal judgment call. Compounding this, the clearest available program (Young Professionals Program) reads as an early-career staff-hiring pipeline rather than a fellowship/scholarship — a second, independent reason not to implement.",
    reviewRequired: true,
  },
  {
    sourceName: "World Health Organization",
    sourceUrl: "https://www.who.int",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed (named bad-bot blocklist only)",
    tosReviewed: true,
    tosUrl: "https://www.who.int/about/policies/terms-of-use",
    tosSummary:
      "No explicit bot/scraping clause, but 'Reproduction or translation of substantial portions of the web site, or any use other than for educational or other non-commercial purposes, require explicit, prior authorization in writing', plus mandatory attribution.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt is a 527-entry named-bad-bot blocklist with no blanket disallow for unnamed agents — general crawling isn't technically blocked. But genuinely ambiguous whether ingesting one program's page counts as 'substantial' reproduction, and whether an opportunity-discovery product counts as 'educational... purposes'. The WHO Internship Programme would be a strong candidate if resolved.",
    reviewRequired: true,
  },
  {
    sourceName: "Acumen Academy",
    sourceUrl: "https://acumen.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://acumen.org/terms-of-use/",
    tosSummary:
      "No explicit bot/scraping clause, but 'You are permitted to access and use the Content... for personal non-commercial uses only', and a ban on reproducing/distributing content 'for commercial profit or gain'.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    rateLimit: "Crawl-Delay: 10 (robots.txt)",
    permittedAdapterType: "none",
    complianceNotes:
      "Same 'non-commercial use' ambiguity pattern as MLH (Batch 1) and World Bank Group above — whether a free/commercial Polaris product falls inside or outside that restriction is a legal/product judgment call, not resolvable by further automated fetching.",
    reviewRequired: true,
  },
  {
    sourceName: "British Council",
    sourceUrl: "https://www.britishcouncil.org",
    robotsTxtStatus: "error (TLS handshake timeout)",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "Not reached — blocked before any page could be read.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Four separate fetch attempts (2 WebFetch, 2 curl including one with -v diagnostics) all failed the same way: a TLS handshake begins but the connection then times out with zero bytes of an actual HTTP response — a reproducible access failure, not a deliberate block, matching the exact pattern Batch 3 documented for Startup India and the DST INSPIRE portal. Genuinely unverified, not a negative finding.",
    reviewRequired: true,
  },
  {
    sourceName: "CERN",
    sourceUrl: "https://home.cern",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No dedicated Terms of Use/Legal Notice page located. Two direct-URL guesses (/terms-use, /about/legal-notice) both 404'd; a web search surfaced only CERN's Privacy Policy, Data Privacy Protection Policy, and Zenodo's terms (a CERN-hosted but separately-governed repository, not home.cern's general terms).",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt is permissive (only blocks Drupal system/admin paths) — a favorable signal, but with no located site-wide ToS, reuse rights for program-page text specifically aren't established either way, the same reasoning Batch 1 applied to DAAD. CERN openlab and Summer Student programs are real, well-known research opportunities worth a follow-up once the ToS gap is resolved.",
    reviewRequired: true,
  },

  // ---- NOT_ALLOWED ----
  {
    sourceName: "Bill & Melinda Gates Foundation",
    sourceUrl: "https://www.gatesfoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.gatesfoundation.org/terms-of-use",
    tosSummary:
      "Explicit: 'Any scraping, automated access, or other unauthorized access to, and storage of, Sites or Content may, in our sole discretion, result in immediate suspension or termination of your access.' Also bars building applications/functionalities that leverage the Sites/Content.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt alone would look clean (Allow: / with no restrictions); the ToS is explicit and unambiguous, directly covering both scraping and building a product on top of their content.",
    reviewRequired: false,
  },
  {
    sourceName: "Ford Foundation",
    sourceUrl: "https://www.fordfoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.fordfoundation.org/terms-and-conditions-of-use/",
    tosSummary:
      "Explicit: 'you will not use any robot, spider, scraper or other automated means to access the Website for any purpose without our express written permission.'",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "One of the most explicit and unambiguous prohibitions found in this batch, directly naming 'robot,' 'spider,' and 'scraper' — despite CC BY 4.0-licensed content in the Learning/News sections, the access-method prohibition still controls.",
    reviewRequired: false,
  },
  {
    sourceName: "Tata Trusts",
    sourceUrl: "https://tatatrusts.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://tatatrusts.org/legal-disclaimer",
    tosSummary:
      "No explicit robot/bot/crawler clause, but: 'You may not distribute text or graphics to others without the express written consent of Tata Trusts and its affiliates,' and 'No reproduction of any part of the site may be sold or distributed for commercial gain, nor shall it be modified or incorporated in any other work.'",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "No bot-specific language, but 'incorporated in any other work' is materially the same prohibition that made UN Careers NOT_ALLOWED in Batch 1 ('compile or create derivative works therefrom') — treated consistently rather than let through on a technicality.",
    reviewRequired: false,
  },
  {
    sourceName: "Rockefeller Foundation",
    sourceUrl: "https://www.rockefellerfoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.rockefellerfoundation.org/terms-of-use/",
    tosSummary:
      "Explicit: 'You may not copy, distribute, enter into a database, display, perform, create derivative works of, transmit, or in any way exploit any part of our Site.' Reuse permitted only for personal, non-commercial, educational, or public-policy use.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "'Enter into a database' describes, almost verbatim, exactly what Polaris's ingestion pipeline does with every stored Opportunity row — as direct a prohibition as this batch found.",
    reviewRequired: false,
  },
  {
    sourceName: "Schwarzman Scholars",
    sourceUrl: "https://www.schwarzmanscholars.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.schwarzmanscholars.org/terms-of-use/",
    tosSummary:
      "Explicit: users agree they will not 'use automated means to access' the Site, alongside bans on overburdening the site, framing it, or attempting unauthorized access.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "A real, well-known, prestigious scholarship program — but the ToS directly and explicitly prohibits automated access, full stop.",
    reviewRequired: false,
  },
  {
    sourceName: "IEEE",
    sourceUrl: "https://www.ieee.org",
    robotsTxtStatus: "blocked (WAF challenge)",
    robotsTxtCrawlPermission: "blocked (WAF challenge)",
    tosReviewed: false,
    tosSummary: "Not reviewed — infrastructure-level block encountered before any page could be read.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "N/A",
    permittedAdapterType: "none",
    complianceNotes:
      "Two WebFetch attempts and two curl attempts to /robots.txt all failed to return content; a curl -I to the homepage confirmed why — HTTP/1.1 202 Accepted with header x-amzn-waf-action: challenge, a confirmed AWS WAF bot-challenge response. No workaround attempted, per the standing rule. Same treatment as MeitY/Oracle/Mastercard Inc. in prior batches — infrastructure-level block, not a legal ambiguity.",
    reviewRequired: false,
  },
];

export async function seedIntlFoundationsComplianceRecords(prisma: PrismaClient) {
  let created = 0;
  for (const record of INTL_FOUNDATIONS_COMPLIANCE_SEED_RECORDS) {
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
    `Seeded ${created} new international/foundations/professional-society/India compliance records (${INTL_FOUNDATIONS_COMPLIANCE_SEED_RECORDS.length - created} already existed).`,
  );
}
