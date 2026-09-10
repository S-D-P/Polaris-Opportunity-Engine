// Runs live ingestion against the first-wave corporate opportunity sources
// (prisma/seed-corporate-sources.ts) and reports what actually happened — discovered,
// accepted, rejected, duplicate, and field-completeness counts — as the input to
// docs/corporate-ingestion-baseline.md. See docs/corporate-opportunity-sources.md for the
// research and prioritization behind this specific source list.
import { PrismaClient } from "@prisma/client";
import { runIngestion } from "../lib/ingestion/pipeline";

const prisma = new PrismaClient();

const CORPORATE_SOURCE_IDS = [
  "source-huggingface-blog-rss",
  "source-ibm-skillsbuild",
  "source-jpmorganchase-programs",
  "source-bcg-rise",
  "source-ey-nextgen-women",
  "source-deepmind-student-researcher",
  "source-deloitte-case-competition",
  "source-accenture-innovation-challenge",
  "source-salesforce-trailhead",
];

const TRACKED_FIELDS = [
  "deadline",
  "startDate",
  "eligibilitySummary",
  "minimumAge",
  "educationRequirements",
  "experienceRequirements",
  "citizenshipRequirements",
  "funding",
] as const;

async function main() {
  console.log(`Running live ingestion for ${CORPORATE_SOURCE_IDS.length} corporate sources...\n`);

  const perSourceResults: Array<{ id: string; name: string; sourceType: string; result: Awaited<ReturnType<typeof runIngestion>> | null; error?: string }> = [];

  for (const id of CORPORATE_SOURCE_IDS) {
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) {
      perSourceResults.push({ id, name: id, sourceType: "?", result: null, error: "Source not found in DB" });
      continue;
    }
    console.log(`--- ${source.name} (${source.sourceType}) ---`);
    try {
      const result = await runIngestion(id);
      console.log(
        `  found=${result.itemsFound} stored=${result.itemsStored} updated=${result.itemsUpdated} duplicate=${result.itemsDuplicate} failed=${result.itemsFailed}`
      );
      if (result.errors.length > 0) {
        console.log(`  errors: ${result.errors.slice(0, 3).join(" | ")}`);
      }
      perSourceResults.push({ id, name: source.name, sourceType: source.sourceType, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  UNCAUGHT ERROR: ${message}`);
      perSourceResults.push({ id, name: source.name, sourceType: source.sourceType, result: null, error: message });
    }
  }

  const totals = perSourceResults.reduce(
    (acc, r) => {
      if (!r.result) {
        acc.sourcesFailed++;
        return acc;
      }
      acc.found += r.result.itemsFound;
      acc.stored += r.result.itemsStored;
      acc.updated += r.result.itemsUpdated;
      acc.duplicate += r.result.itemsDuplicate;
      acc.failed += r.result.itemsFailed;
      return acc;
    },
    { found: 0, stored: 0, updated: 0, duplicate: 0, failed: 0, sourcesFailed: 0 }
  );

  console.log("\n=== Totals across all corporate sources ===");
  console.log(JSON.stringify(totals, null, 2));

  const opportunities = await prisma.opportunity.findMany({
    where: { sourceId: { in: CORPORATE_SOURCE_IDS } },
    select: {
      id: true,
      title: true,
      organization: true,
      sourceId: true,
      sourceName: true,
      verificationStatus: true,
      deadline: true,
      startDate: true,
      eligibilitySummary: true,
      minimumAge: true,
      educationRequirements: true,
      experienceRequirements: true,
      citizenshipRequirements: true,
      funding: true,
    },
  });

  console.log(`\n=== ${opportunities.length} corporate opportunities now in the database ===`);
  for (const opp of opportunities) {
    console.log(`- [${opp.sourceName}] ${opp.title} (${opp.verificationStatus})`);
  }

  console.log("\n=== Field completeness (of the corporate opportunities above) ===");
  for (const field of TRACKED_FIELDS) {
    const present = opportunities.filter((o) => {
      const v = o[field as keyof typeof o];
      return v !== null && v !== undefined && v !== "" && v !== "[]";
    }).length;
    console.log(`  ${field}: ${present}/${opportunities.length}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
