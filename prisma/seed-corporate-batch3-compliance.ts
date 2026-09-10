import type { PrismaClient } from "@prisma/client";
import type { ComplianceSeedRecord } from "./seed-compliance";

/**
 * Batch 3 (2026-09-09) — Consulting/Technology/Finance corporate expansion.
 *
 * IMPORTANT CONTEXT DISCOVERED DURING RESEARCH, not assumed going in: the 24-24 (26, counting
 * Google/Google DeepMind separately) organizations assigned to this batch —
 * McKinsey/BCG/Bain/Deloitte/EY/PwC/Accenture/KPMG, Google/Google DeepMind/Microsoft/IBM/
 * Salesforce/Adobe/NVIDIA/Meta/AWS/Hugging Face/Cisco/Intel, and JPMorgan/Goldman Sachs/
 * Morgan Stanley/Mastercard/Visa/Bloomberg — are the *exact same set* already fully researched
 * on 2026-09-03 as "Corporate Opportunity Sources (Batch 2)" in docs/source-compliance.md, with
 * compliance records already live in `SourceComplianceRecord` (verified directly against the
 * running database: 89 existing records include every one of these 26 by URL) and 9 of them
 * already implemented as active `Source` rows ingesting real opportunities today (BCG, Deloitte,
 * EY, Accenture, JPMorganChase, IBM, Google DeepMind, Salesforce, Hugging Face — see
 * prisma/seed-corporate-compliance.ts / seed-corporate-sources.ts / docs/corporate-ingestion-baseline.md).
 *
 * Re-running full live compliance research on all 26 and writing a second, competing set of
 * `SourceComplianceRecord`s for the same URLs would not add signal — it would risk contradicting
 * a determination made six days earlier for no reason other than not having checked first, and
 * (per this session's explicit "please don't break application" instruction) risks the exact
 * kind of duplicate/conflicting registration against a *live production database* that the
 * no-`db-seed`, no-`seed.ts`-edit safety rules for this session exist to prevent.
 *
 * So: THIS FILE INTENTIONALLY ADDS NO NEW COMPLIANCE RECORDS. Every one of the 26 assigned
 * organizations already has a live, correctly-classified `SourceComplianceRecord`:
 *   - NOT_ALLOWED (verbatim ToS prohibitions found in Batch 2, unlikely to have changed in 6
 *     days): McKinsey, Bain, PwC, Adobe, NVIDIA, Meta, Intel, Goldman Sachs, Morgan Stanley,
 *     Bloomberg, Mastercard.
 *   - UNCLEAR_REQUIRES_REVIEW (needs a human legal call, not more automated fetching): KPMG,
 *     Cisco, Visa.
 *   - ALLOWED_WITH_RESTRICTIONS, already implemented with a live `Source`: BCG (RISE — do NOT
 *     re-touch per this session's explicit brief, which flagged it as previously hitting
 *     anti-bot trouble), Deloitte, EY, Accenture, JPMorgan/JPMorganChase, IBM, Salesforce,
 *     Google DeepMind. ALLOWED (cleanest tier), already implemented: Hugging Face.
 *   - ALLOWED_WITH_RESTRICTIONS, compliance record present but genuinely NEVER implemented as a
 *     `Source` (verified directly against the live DB — this is the real, non-duplicative gap):
 *     Google (parent, google.com), Microsoft (microsoft.com), AWS (aws.amazon.com). These three
 *     are the actual new work this batch does — see seed-corporate-batch3-sources.ts, which
 *     links each new Source to its *existing* compliance record by sourceUrl rather than
 *     creating a new one.
 *
 * A light, real re-verification (fresh robots.txt + live page fetches, 2026-09-09) was done for
 * exactly those three specific program pages before registering them — documented in
 * docs/source-compliance.md's "Batch 3 addendum" rather than fabricated as a full fresh
 * from-scratch compliance record here, since the underlying policy determination (robots.txt
 * permission + ToS review) is Batch 2's, not new work performed in this session.
 */
export const CORPORATE_BATCH3_COMPLIANCE_SEED_RECORDS: ComplianceSeedRecord[] = [];

export async function seedCorporateBatch3ComplianceRecords(prisma: PrismaClient) {
  if (CORPORATE_BATCH3_COMPLIANCE_SEED_RECORDS.length === 0) {
    console.log(
      "seedCorporateBatch3ComplianceRecords: no-op by design — all 26 assigned organizations " +
        "already have a SourceComplianceRecord from Batch 2 (2026-09-03). See this file's header " +
        "comment and docs/source-compliance.md's Batch 3 addendum for the full explanation."
    );
    return;
  }
  let created = 0;
  for (const record of CORPORATE_BATCH3_COMPLIANCE_SEED_RECORDS) {
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
        robotsTxtCheckedAt: new Date(),
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
        lastPolicyCheckAt: new Date(),
        reviewRequired: record.reviewRequired,
      },
    });
    created++;
  }
  console.log(`Seeded ${created} new corporate batch-3 compliance records.`);
}
