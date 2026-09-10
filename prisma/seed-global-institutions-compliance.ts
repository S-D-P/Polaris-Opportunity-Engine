import type { PrismaClient } from "@prisma/client";
import type { ComplianceSeedRecord } from "./seed-compliance";

/**
 * 20 organizations across Indian ecosystem, foundations, universities/science societies, and
 * international institutions — researched via live robots.txt/ToS/RSS/sitemap fetches
 * (docs/source-compliance.md, "Global Institutions Batch — 2026-09-09/10"). Same fail-closed
 * rule as every prior batch: NOT_ALLOWED is never implemented, UNCLEAR_REQUIRES_REVIEW never
 * auto-runs. Several ALLOWED/ALLOWED_WITH_RESTRICTIONS orgs are recorded here but have no
 * `Source` wired up in seed-global-institutions-sources.ts because their only relevant program
 * had no currently-open application cycle at research time (ISRO's YUVIKA already ran its 2026
 * cycle; Max Planck's summer internship is closed until December 2026) — a real, honest
 * distinction between "compliant to access" and "has something to actually show right now."
 */
const POLICY_CHECK_DATE = new Date("2026-09-10T00:00:00.000Z");

export const GLOBAL_INSTITUTIONS_COMPLIANCE_SEED_RECORDS: ComplianceSeedRecord[] = [
  // ---- ALLOWED_WITH_RESTRICTIONS (implemented — live open opportunity found) ----
  {
    sourceName: "IIT Bombay — Research Internship Award",
    sourceUrl: "https://www.iitb.ac.in",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://www.iitb.ac.in/credits-disclaimer",
    tosSummary:
      "'Reproduction, distribution, or unauthorized use of any part of this website is prohibited without prior written consent.' No robot/spider/crawler/automated-access clause found.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt disallows admin/search/user/comment paths only; the IRCC internship page itself is outside the disallow list. Verified live 2026 cycle: IITB Research Internship Award, applications Aug 23-Sep 23 2026, ₹15,000/month stipend, 4-6 month faculty-supervised research.",
    reviewRequired: false,
  },
  {
    sourceName: "Draper Richards Kaplan Foundation",
    sourceUrl: "https://www.drkfoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No dedicated Terms of Use/Terms and Conditions page locatable (/terms/, /terms-of-use/, /terms-and-conditions/ all 404). Only a Privacy Policy exists, with no automation clause. Absence of ToS is a real gap, not a confirmed permission — hence restrictions rather than full ALLOWED.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    sitemapUrl: "https://www.drkfoundation.org/sitemap_index.xml",
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt disallows only /wp-admin/. Verified live, genuinely open, year-round rolling application for early-stage social enterprises — $300K unrestricted capital over 3 years.",
    reviewRequired: true,
  },
  {
    sourceName: "UNICEF Internships",
    sourceUrl: "https://www.unicef.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "partial",
    tosReviewed: true,
    tosUrl: "https://www.unicef.org/legal",
    tosSummary:
      "'The UNICEF Web Site is provided ... for personal use and educational purposes only. Any other use ... requires express prior written permission.' No robot/spider/crawler-specific language found.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt disallows /core/, /profiles/, /admin/, /search/, /api/, login/register — the careers/internships page is outside these. Verified live: internships run 6-26 weeks, rolling year-round admissions, 18+, enrolled or graduated within 2 years.",
    reviewRequired: true,
  },

  // ---- ALLOWED / ALLOWED_WITH_RESTRICTIONS but NOT implemented (no currently-open cycle) ----
  {
    sourceName: "ISRO — Young Scientists Programme (YUVIKA)",
    sourceUrl: "https://www.isro.gov.in",
    robotsTxtStatus: "not_found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.isro.gov.in/Website_Policy.html",
    tosSummary:
      "'Material featured on this site belongs to the DOS/ISRO and the same may be reproduced free of charge in any format or media without requiring specific permission.' No automation clause.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "ALLOWED",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "No robots.txt exists (404) and the ToS is fully permissive. Not implemented: the verified live page describes YUVIKA's 6th edition, which already ran May 2026 — no currently open application window to ingest. Revisit ahead of the next cycle.",
    reviewRequired: true,
  },
  {
    sourceName: "Max Planck Institute for Astronomy — Summer Internship",
    sourceUrl: "https://www.mpia.de",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary:
      "No general Terms of Use found; imprint pages carry standard copyright ('all rights reserved') but no automation clause. A separate 'Additional Terms and Conditions' PDF could not be text-extracted and is unread — flagged, not assumed clean.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "ALLOWED_WITH_RESTRICTIONS",
    permittedAdapterType: "sitemap_static_html",
    complianceNotes:
      "robots.txt has no Disallow lines at all. Not implemented: verified live page states 'All positions for 2026 have been filled. The next application cycle will open in December 2026,' due January 2027 — no currently open window.",
    reviewRequired: true,
  },

  // ---- UNCLEAR_REQUIRES_REVIEW ----
  {
    sourceName: "SERB (Science and Engineering Research Board)",
    sourceUrl: "https://serb.gov.in",
    robotsTxtStatus: "error",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "No dedicated ToS/website-policy page located this session.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt itself returns HTTP 403 (confirmed twice, WebFetch and curl) while actual content pages return 200 normally — an ambiguous, server-side-specific block on exactly the file that would declare crawl permission. Cannot confirm rules either way.",
    reviewRequired: true,
  },
  {
    sourceName: "Malala Fund",
    sourceUrl: "https://malala.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://malala.org/terms-and-conditions",
    tosSummary: "General anti-reverse-engineering/mirroring language; no automation-specific clause found.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Permissive robots.txt and no scraping clause, but no genuinely open, dated application page exists to aggregate (grantmaking page describes the framework only, no deadline/cohort/link).",
    reviewRequired: true,
  },
  {
    sourceName: "Echoing Green Fellowship",
    sourceUrl: "https://echoinggreen.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://echoinggreen.org/policies/terms-of-use/",
    tosSummary:
      "Prohibits unauthorized 'distribution, reproduction, copying, retransmission, publication ... exploitation' of site content — broad but not automation-specific. A separate, unreviewed 'Content Rights & License' page may narrow this further.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "Live 2026 Fellowship apply page confirmed 'Applications ... now closed' — no open cycle even if compliance were resolved.",
    reviewRequired: true,
  },
  {
    sourceName: "MIT PRIMES",
    sourceUrl: "https://math.mit.edu",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary: "No applicable Terms of Use located for math.mit.edu specifically (mit.edu/privacy is a privacy statement, not a ToS).",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    rateLimit: "Crawl-delay: 5",
    permittedAdapterType: "none",
    complianceNotes: "Permissive robots.txt (Crawl-delay: 5) but no applicable ToS could confirm scraping is sanctioned.",
    reviewRequired: true,
  },
  {
    sourceName: "OECD Internship Programme",
    sourceUrl: "https://www.oecd.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary: "ToS page located but every fetch (WebFetch and curl, standard browser UA) hit a genuine Cloudflare managed-challenge page.",
    apiAvailable: true,
    apiPreferred: false,
    apiDocsUrl: "https://sdmx.oecd.org/public/rest/",
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    permittedAdapterType: "none",
    complianceNotes:
      "robots.txt itself is openly accessible and permissive, but the actual opportunity content and ToS are behind a real anti-bot wall that blocked verification (not attempted to bypass).",
    reviewRequired: true,
  },
  {
    sourceName: "UNDP",
    sourceUrl: "https://www.undp.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary: "ToS page exists but every fetch attempt, including the bare homepage, returned HTTP 403 across tools.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "UNCLEAR_REQUIRES_REVIEW",
    rateLimit: "Crawl-delay: 10",
    permittedAdapterType: "none",
    complianceNotes: "Consistent access block on undp.org content pages; nothing about its actual terms could be verified.",
    reviewRequired: true,
  },

  // ---- NOT_ALLOWED ----
  {
    sourceName: "Skoll Foundation",
    sourceUrl: "https://skoll.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: false,
    tosSummary: "ToS is a PDF whose text could not be extracted — not conclusively reviewed, but moot given robots.txt.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes: "robots.txt is a blanket 'User-agent: * / Disallow: /' — as unambiguous a signal as exists. Skoll Awards are nomination-only anyway.",
    reviewRequired: false,
  },
  {
    sourceName: "Clinton Global Initiative / Clinton Foundation",
    sourceUrl: "https://www.clintonfoundation.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: false,
    tosSummary: "ToS URL located but every fetch (WebFetch and curl) hit a genuine Cloudflare managed-challenge page.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Text-level robots.txt is permissive, but both the CGI Fellowship program page and the ToS page are behind an active Cloudflare bot-management challenge — reliable automated access isn't achievable regardless of the text policy.",
    reviewRequired: true,
  },
  {
    sourceName: "Stanford Pre-Collegiate Summer Institutes",
    sourceUrl: "https://summerinstitutes.spcs.stanford.edu",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: true,
    tosUrl: "https://www.stanford.edu/terms",
    tosSummary: "'User may download material ... only for User's own personal, non-commercial use.'",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "Crawl-delay: 10 for unrecognized bots",
    permittedAdapterType: "none",
    complianceNotes: "robots.txt explicitly names and blocks ClaudeBot and anthropic-ai with Disallow: /. ToS also restricts use to personal/non-commercial purposes.",
    reviewRequired: false,
  },
  {
    sourceName: "AAAS Science & Technology Policy Fellowships",
    sourceUrl: "https://www.aaas.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: true,
    tosUrl: "https://www.aaas.org/terms-of-use",
    tosSummary:
      "'You agree not to use or launch any automated system ... that accesses the Web site ... You agree not to ... systematically retrieve data ... and you will not compile a database or directory of information extracted from the Web site.'",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    rateLimit: "Crawl-delay: 10",
    permittedAdapterType: "none",
    complianceNotes: "robots.txt names ClaudeBot/anthropic-ai among 60+ blocked agents under a blanket Disallow: /, and the ToS explicitly prohibits systematic retrieval/database compilation — the clearest rejection in this batch.",
    reviewRequired: false,
  },
  {
    sourceName: "American Physical Society — LeRoy Apker Award",
    sourceUrl: "https://www.aps.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "disallowed",
    tosReviewed: false,
    tosSummary: "No stable ToS URL locatable this session (all candidate paths 404 or 403).",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes: "robots.txt explicitly disallows ClaudeBot among ~40 named AI bots via content-signal directives. Missing ToS is an additional unresolved gap, not a mitigating factor.",
    reviewRequired: false,
  },
  {
    sourceName: "UNEP Young Champions of the Earth",
    sourceUrl: "https://www.unep.org",
    robotsTxtStatus: "found",
    robotsTxtCrawlPermission: "allowed",
    tosReviewed: true,
    tosUrl: "https://www.unep.org/terms-use",
    tosSummary:
      "'... without any right to resell or redistribute them or to compile or create derivative works therefrom.'",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: true,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "Explicit no-derivative-works/no-compiling clause matches the same pattern that disqualified UN Careers/unjobs.org in an earlier batch. Also: the verified live page states the 2026 cycle is already closed.",
    reviewRequired: false,
  },
  {
    sourceName: "Asian Development Bank",
    sourceUrl: "https://www.adb.org",
    robotsTxtStatus: "error",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "Every fetch attempt, including robots.txt itself, returned a genuine Cloudflare managed-challenge page.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes: "Real anti-bot wall at the transport layer on every URL tried, including robots.txt itself — nothing about ADB's actual policy could be verified, treated as effectively blocked.",
    reviewRequired: true,
  },
  {
    sourceName: "Infosys Foundation",
    sourceUrl: "https://www.infosys.com",
    robotsTxtStatus: "error",
    robotsTxtCrawlPermission: "unknown",
    tosReviewed: false,
    tosSummary: "Every fetch (robots.txt, foundation page, newsroom) returned HTTP 403 from an Akamai edge WAF, reproducible with both WebFetch and curl using a standard browser UA.",
    apiAvailable: false,
    apiPreferred: false,
    rssAvailable: false,
    sitemapAvailable: false,
    automatedAccessStatus: "NOT_ALLOWED",
    permittedAdapterType: "none",
    complianceNotes:
      "The suggested domain (infosysfoundation.org) doesn't exist (DNS failure); both real Infosys domains (.com, .org) are WAF-blocked for automated access. No page ever successfully fetched.",
    reviewRequired: true,
  },
];

export async function seedGlobalInstitutionsComplianceRecords(prisma: PrismaClient) {
  let created = 0;
  for (const record of GLOBAL_INSTITUTIONS_COMPLIANCE_SEED_RECORDS) {
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
    `Seeded ${created} new global-institutions compliance records (${GLOBAL_INSTITUTIONS_COMPLIANCE_SEED_RECORDS.length - created} already existed).`
  );
}
