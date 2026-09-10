// One-off (re-runnable) backfill for opportunities ingested before per-item geographic
// classification existed in lib/ai/extraction.ts (lib/ingestion/pipeline.ts previously only
// set geographicScope from a source-level default, leaving most real rows LOCATION_UNKNOWN).
// Re-classifies from each row's own already-stored description text — never fabricates a
// location, and leaves a row LOCATION_UNKNOWN if the source genuinely doesn't state one.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { classifyGeography } from "../lib/ai/extraction";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.opportunity.findMany({
    where: {
      status: { in: ["OPEN", "CLOSING_SOON"] },
      isSeedData: false,
      geographicScope: "LOCATION_UNKNOWN",
    },
    select: { id: true, title: true, organization: true, description: true },
  });

  console.log(`${candidates.length} opportunities to re-classify.`);
  let updated = 0;
  for (const opp of candidates) {
    const result = await classifyGeography({
      title: opp.title,
      organization: opp.organization,
      rawText: opp.description,
    });
    if (result && result.geographicScope !== "LOCATION_UNKNOWN") {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { geographicScope: result.geographicScope, geographicDetail: result.geographicDetail },
      });
      updated++;
      console.log(`${opp.title}: LOCATION_UNKNOWN -> ${result.geographicScope} ${result.geographicDetail ?? ""}`);
    }
  }
  console.log(`Backfill complete: ${updated}/${candidates.length} reclassified.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
