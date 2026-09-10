import type { PrismaClient } from "@prisma/client";

/**
 * Batch 3 (2026-09-09) — the 3 genuinely new sources this batch adds.
 *
 * As explained in seed-corporate-batch3-compliance.ts's header, this batch's 26 assigned
 * organizations (consulting/tech/finance) were already fully researched in Batch 2
 * (2026-09-03) and mostly already implemented. Cross-checked directly against the live
 * database before writing this file: of the 26, exactly three have a live
 * `SourceComplianceRecord` at `ALLOWED_WITH_RESTRICTIONS` but never got a `Source` row —
 * Google (parent, distinct from the already-implemented Google DeepMind), Microsoft, and AWS.
 * Those three are what this file registers. Every other organization is either already
 * implemented (skip — don't duplicate), NOT_ALLOWED (skip — compliance gate is fail-closed),
 * or UNCLEAR_REQUIRES_REVIEW (skip — never auto-wired per the standing rule).
 *
 * Each of the 3 was re-verified live on 2026-09-09 (not just reasoned about from Batch 2's
 * 6-day-old notes) before being registered here:
 *
 * - Google — `developers.google.com/community/gdsc` ("Google Developer Groups on Campus").
 *   `developers.google.com/robots.txt` fetched fresh: `Disallow: /youtube/partner/` only —
 *   `/community/` is unrestricted. Page fetched fresh and confirmed live with real content (a
 *   working join link to `app.advocu.com/gdg/join`). Deliberately NOT Google Summer of Code
 *   (`summerofcode.withgoogle.com`) — fetched fresh and found to explicitly state "Organization
 *   registration closed" with no current-cycle dates, i.e. registering it now would misrepresent
 *   a closed program as an open opportunity, which the anti-fabrication rule for this session
 *   rules out even though the page itself would technically pass the compliance gate.
 * - Microsoft — `learn.microsoft.com/en-us/training/student-hub/` ("Microsoft Learn Student
 *   Hub"). Already covered by the existing Microsoft compliance record's own research, which
 *   separately confirmed `learn.microsoft.com/robots.txt` disallows only Q&A-forum subpaths and
 *   one wildcarded PDF-build path — not this page. Page fetched fresh 2026-09-09 and confirmed live with
 *   real, current program content (Imagine Cup 2026, Azure credits for students, GitHub Student
 *   Developer Pack). Deliberately NOT the Microsoft Research "AI & Society Fellows" page
 *   (`microsoft.com/en-us/research/academic-program/ai-society-fellows/`) despite it being a
 *   real, live fellowship — kept out because it sits on the apex `microsoft.com` domain and is
 *   specifically an AI-research program, i.e. the exact case the existing compliance record
 *   flags as an unresolved ToS ambiguity ("web scraping... for AI services" — unclear if scoped
 *   to Microsoft's own AI products or broader). `learn.microsoft.com` avoids that ambiguity
 *   entirely, which is why it was chosen instead.
 * - AWS — `aws.amazon.com/education/awseducate/` ("AWS Educate"). `aws.amazon.com/robots.txt`
 *   fetched fresh and checked line-by-line for this specific path per the existing compliance
 *   record's explicit warning that AWS's blog and `/activate/hackathons|accelerators|events`
 *   paths are robots.txt-disallowed even though they're the "obvious" choice — confirmed
 *   `/education/` and `/education/awseducate/` appear in none of the ~100+ Disallow rules. Page
 *   fetched fresh and confirmed live (free, open-eligibility cloud-skills training, ages 13+).
 *
 * All three use `staticPageAdapter` with a single `pages` entry, matching every prior batch's
 * pattern for a hand-picked, verified program page (not a listing crawl).
 */
export async function seedCorporateBatch3Sources(prisma: PrismaClient) {
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
  }

  const sources: SourceSpec[] = [
    {
      id: "source-google-gdg-on-campus",
      name: "Google Developer Groups on Campus",
      organization: "Google",
      url: "https://developers.google.com/community/gdsc",
      complianceSourceUrl: "https://google.com",
      categoryCoverage: ["Leadership Program", "Technology", "Developer Community"],
      config: {
        pages: [
          {
            url: "https://developers.google.com/community/gdsc",
            organization: "Google",
          },
        ],
      },
    },
    {
      id: "source-microsoft-learn-student-hub",
      name: "Microsoft Learn Student Hub",
      organization: "Microsoft",
      url: "https://learn.microsoft.com/en-us/training/student-hub/",
      complianceSourceUrl: "https://microsoft.com",
      categoryCoverage: ["Learning Program", "Technology", "Student Programs"],
      config: {
        pages: [
          {
            url: "https://learn.microsoft.com/en-us/training/student-hub/",
            organization: "Microsoft",
          },
        ],
      },
    },
    {
      id: "source-aws-educate",
      name: "AWS Educate",
      organization: "AWS (Amazon Web Services)",
      url: "https://aws.amazon.com/education/awseducate/",
      complianceSourceUrl: "https://aws.amazon.com",
      categoryCoverage: ["Learning Program", "Technology", "Cloud Computing"],
      config: {
        pages: [
          {
            url: "https://aws.amazon.com/education/awseducate/",
            organization: "AWS (Amazon Web Services)",
          },
        ],
      },
    },
  ];

  for (const s of sources) {
    const compliance = await findCompliance(s.complianceSourceUrl);
    if (!compliance) {
      console.log(
        `Skipping "${s.name}" — no compliance record found for ${s.complianceSourceUrl}. Expected it to already exist from Batch 2 (prisma/seed-corporate-compliance.ts) — run that first.`
      );
      continue;
    }
    if (compliance.automatedAccessStatus !== "ALLOWED" && compliance.automatedAccessStatus !== "ALLOWED_WITH_RESTRICTIONS") {
      console.log(
        `Skipping "${s.name}" — compliance status is ${compliance.automatedAccessStatus}, not ALLOWED/ALLOWED_WITH_RESTRICTIONS. Fail-closed.`
      );
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
        geographicCoverage: JSON.stringify(["global"]),
        crawlFrequency: "weekly",
        extractionMethod: "sitemap_html",
        reliabilityScore: 1.0,
      },
    });
  }

  console.log(`Seeded/updated ${sources.length} corporate batch-3 sources (Google, Microsoft, AWS).`);
}
