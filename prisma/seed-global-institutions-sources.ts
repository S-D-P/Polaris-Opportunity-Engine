import type { PrismaClient } from "@prisma/client";

/**
 * 3 sources approved for implementation from
 * prisma/seed-global-institutions-compliance.ts's "Global Institutions Batch" — the only 3 of
 * 20 researched organizations that were both compliant (ALLOWED_WITH_RESTRICTIONS) AND had a
 * genuinely open, currently-actionable opportunity at research time. Two more
 * (ISRO, Max Planck) passed compliance but have no open cycle right now — deliberately not
 * wired up here; see that file's header comment.
 */
export async function seedGlobalInstitutionsSources(prisma: PrismaClient) {
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
      id: "source-iitb-research-internship",
      name: "IIT Bombay Research Internship Award",
      organization: "Indian Institute of Technology Bombay",
      url: "https://www.ircc.iitb.ac.in/IRCC-Webpage/IITBInternship/",
      complianceSourceUrl: "https://www.iitb.ac.in",
      categoryCoverage: ["Research", "Internship"],
      geographicCoverage: ["India"],
      config: {
        geographicScope: "INDIA_ONLY",
        pages: [
          {
            url: "https://www.ircc.iitb.ac.in/IRCC-Webpage/IITBInternship/",
            organization: "Indian Institute of Technology Bombay",
          },
        ],
      },
    },
    {
      id: "source-drk-foundation-apply",
      name: "Draper Richards Kaplan Foundation — Apply",
      organization: "Draper Richards Kaplan Foundation",
      url: "https://www.drkfoundation.org/apply/",
      complianceSourceUrl: "https://www.drkfoundation.org",
      categoryCoverage: ["Grant"],
      geographicCoverage: ["global"],
      config: {
        geographicScope: "GLOBAL",
        pages: [
          {
            url: "https://www.drkfoundation.org/apply/",
            organization: "Draper Richards Kaplan Foundation",
          },
        ],
      },
    },
    {
      id: "source-unicef-internships",
      name: "UNICEF Internships",
      organization: "UNICEF",
      url: "https://www.unicef.org/careers/internships",
      complianceSourceUrl: "https://www.unicef.org",
      categoryCoverage: ["Internship"],
      geographicCoverage: ["global"],
      config: {
        geographicScope: "GLOBAL",
        pages: [
          {
            url: "https://www.unicef.org/careers/internships",
            organization: "UNICEF",
          },
        ],
      },
    },
  ];

  for (const s of sources) {
    const compliance = await findCompliance(s.complianceSourceUrl);
    if (!compliance) {
      console.log(`Skipping "${s.name}" — no compliance record found for ${s.complianceSourceUrl}. Run seedGlobalInstitutionsComplianceRecords first.`);
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

  console.log(`Seeded/updated ${sources.length} global-institution sources.`);
}
