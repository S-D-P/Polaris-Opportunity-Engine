import type { PrismaClient } from "@prisma/client";

/**
 * The 4 "zero remaining compliance questions" sources identified in
 * docs/ingestion-roadmap.md (P0 #3) and docs/source-compliance.md. Each is linked to its
 * already-seeded SourceComplianceRecord (prisma/seed-compliance.ts).
 *
 * NSF and HigherEdJobs are wired up **fully active** — both are RSS, need no credentials,
 * and reuse the existing, already-proven `rssAdapter` unmodified.
 *
 * USAJobs.gov and Grants.gov are registered but **inactive** — both require an API key this
 * environment doesn't have (USAJOBS_API_KEY / GRANTS_GOV_API_KEY), and obtaining one means
 * a human applying through USAJobs'/Grants.gov's own developer portal, which is not
 * something this system does on its own. Their `config` documents the real, correct
 * integration (endpoint, auth mechanism, field mapping based on each API's public docs) so
 * flipping them on later is "set the env var + isActive: true", not new code. The
 * USAJobs field mapping is exercised by a real test against a fixture shaped like their
 * documented response (tests/unit/json-api-adapter.test.ts); the Grants.gov field mapping
 * is best-effort from their public API guide and explicitly flagged as unverified against
 * a live call, since no key exists to verify it with.
 */
export async function seedRealSources(prisma: PrismaClient) {
  const nsfCompliance = await prisma.sourceComplianceRecord.findFirst({
    where: { sourceUrl: "https://www.nsf.gov" },
  });
  const higherEdJobsCompliance = await prisma.sourceComplianceRecord.findFirst({
    where: { sourceUrl: "https://www.higheredjobs.com" },
  });
  const usaJobsCompliance = await prisma.sourceComplianceRecord.findFirst({
    where: { sourceUrl: "https://www.usajobs.gov" },
  });
  const grantsGovCompliance = await prisma.sourceComplianceRecord.findFirst({
    where: { sourceUrl: "https://www.grants.gov" },
  });

  if (nsfCompliance) {
    await prisma.source.upsert({
      where: { id: "source-nsf-funding-rss" },
      update: {
        complianceRecordId: nsfCompliance.id,
        complianceStatus: nsfCompliance.automatedAccessStatus,
        lastPolicyCheckAt: nsfCompliance.lastPolicyCheckAt,
      },
      create: {
        id: "source-nsf-funding-rss",
        name: "NSF Funding Opportunities (RSS)",
        organization: "National Science Foundation",
        sourceType: "RSS",
        url: "https://www.nsf.gov/rss/rss_www_funding_pgm_annc_inf.xml",
        isActive: true,
        complianceRecordId: nsfCompliance.id,
        complianceStatus: nsfCompliance.automatedAccessStatus,
        lastPolicyCheckAt: nsfCompliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(["Research", "Grants", "STEM"]),
        geographicCoverage: JSON.stringify(["United States"]),
        crawlFrequency: "daily",
        extractionMethod: "rss",
        reliabilityScore: 1.0,
      },
    });
  }

  if (higherEdJobsCompliance) {
    await prisma.source.upsert({
      where: { id: "source-higheredjobs-rss" },
      update: {
        complianceRecordId: higherEdJobsCompliance.id,
        complianceStatus: higherEdJobsCompliance.automatedAccessStatus,
        lastPolicyCheckAt: higherEdJobsCompliance.lastPolicyCheckAt,
      },
      create: {
        id: "source-higheredjobs-rss",
        name: "HigherEdJobs (RSS)",
        organization: "Internet Employment Linkage, Inc.",
        sourceType: "RSS",
        // JobCat=37 is the specific category confirmed live during compliance research
        // (docs/source-compliance.md) — swap the JobCat value to target a different
        // category; the adapter/config pattern doesn't change.
        url: "https://www.higheredjobs.com/search/rss.cfm?JobCat=37",
        isActive: true,
        complianceRecordId: higherEdJobsCompliance.id,
        complianceStatus: higherEdJobsCompliance.automatedAccessStatus,
        lastPolicyCheckAt: higherEdJobsCompliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(["Jobs", "Research"]),
        geographicCoverage: JSON.stringify(["United States"]),
        crawlFrequency: "daily",
        extractionMethod: "rss",
        reliabilityScore: 1.0,
      },
    });
  }

  if (usaJobsCompliance) {
    await prisma.source.upsert({
      where: { id: "source-usajobs-api" },
      update: {
        complianceRecordId: usaJobsCompliance.id,
        complianceStatus: usaJobsCompliance.automatedAccessStatus,
        lastPolicyCheckAt: usaJobsCompliance.lastPolicyCheckAt,
      },
      create: {
        id: "source-usajobs-api",
        name: "USAJobs.gov (official API — requires USAJOBS_API_KEY)",
        organization: "US Office of Personnel Management",
        sourceType: "JSON_API",
        url: "https://data.usajobs.gov/api/search?ResultsPerPage=25",
        // Inactive: requires USAJOBS_API_KEY, which this environment does not have — apply
        // at https://developer.usajobs.gov. Flip isActive to true once the key is set.
        isActive: false,
        complianceRecordId: usaJobsCompliance.id,
        complianceStatus: usaJobsCompliance.automatedAccessStatus,
        lastPolicyCheckAt: usaJobsCompliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(["Jobs", "Government"]),
        geographicCoverage: JSON.stringify(["United States"]),
        crawlFrequency: "daily",
        extractionMethod: "official_api",
        reliabilityScore: 1.0,
        config: JSON.stringify({
          apiKeyEnvVar: "USAJOBS_API_KEY",
          apiKeyHeader: "Authorization-Key",
          // USAJobs also requires a "Host: data.usajobs.gov" header and a "User-Agent" set
          // to the email address registered for the API key — add both here once known.
          headers: { Host: "data.usajobs.gov" },
          itemsPath: "SearchResult.SearchResultItems",
          fieldMap: {
            title: "MatchedObjectDescriptor.PositionTitle",
            link: "MatchedObjectDescriptor.PositionURI",
            content: "MatchedObjectDescriptor.UserArea.Details.JobSummary",
            organization: "MatchedObjectDescriptor.OrganizationName",
            publishedAt: "MatchedObjectDescriptor.PublicationStartDate",
            deadline: "MatchedObjectDescriptor.ApplicationCloseDate",
          },
        }),
      },
    });
  }

  if (grantsGovCompliance) {
    await prisma.source.upsert({
      where: { id: "source-grants-gov-api" },
      update: {
        complianceRecordId: grantsGovCompliance.id,
        complianceStatus: grantsGovCompliance.automatedAccessStatus,
        lastPolicyCheckAt: grantsGovCompliance.lastPolicyCheckAt,
      },
      create: {
        id: "source-grants-gov-api",
        name: "Grants.gov (official API — requires GRANTS_GOV_API_KEY)",
        organization: "US Department of Health and Human Services",
        sourceType: "JSON_API",
        url: "https://api.grants.gov/v1/api/search2",
        // Inactive: requires GRANTS_GOV_API_KEY, which this environment does not have —
        // apply via the Grants.gov Help Desk or the Simpler.Grants.gov developer dashboard.
        // The field mapping below is best-effort from Grants.gov's public API guide and is
        // explicitly UNVERIFIED against a live response — confirm and adjust before
        // flipping isActive to true.
        isActive: false,
        complianceRecordId: grantsGovCompliance.id,
        complianceStatus: grantsGovCompliance.automatedAccessStatus,
        lastPolicyCheckAt: grantsGovCompliance.lastPolicyCheckAt,
        categoryCoverage: JSON.stringify(["Grants", "Research", "Nonprofit"]),
        geographicCoverage: JSON.stringify(["United States"]),
        crawlFrequency: "daily",
        extractionMethod: "official_api",
        reliabilityScore: 1.0,
        config: JSON.stringify({
          method: "POST",
          apiKeyEnvVar: "GRANTS_GOV_API_KEY",
          apiKeyHeader: "X-API-Key",
          body: { rows: 25, oppStatuses: "forecasted|posted" },
          itemsPath: "data.oppHits",
          // The search response returns an opportunity id, not a direct URL — linkTemplate
          // builds the real application/detail URL from it.
          linkTemplate: "https://www.grants.gov/search-results-detail/{value}",
          fieldMap: {
            title: "title",
            link: "id",
            content: "description",
            organization: "agencyName",
            publishedAt: "openDate",
            deadline: "closeDate",
          },
        }),
      },
    });
  }

  console.log("Seeded/updated the 4 P0#3 registry sources (NSF + HigherEdJobs active, USAJobs.gov + Grants.gov registered pending an API key).");
}
