// Runs live ingestion against the India + global demo-dataset sources
// (prisma/seed-india-global-sources.ts) and reports what actually happened. See
// docs/demo-dataset-plan.md for the research and prioritization behind this source list.
import { PrismaClient } from "@prisma/client";
import { runIngestion } from "../lib/ingestion/pipeline";

const prisma = new PrismaClient();

const SOURCE_IDS = [
  "source-mygov-in-rss",
  "source-aim-india",
  "source-smart-india-hackathon",
  "source-unstop-hackathons",
  "source-devfolio-open-hackathons",
  "source-hackerearth-challenges",
  "source-mlh-events",
];

async function main() {
  console.log(`Running live ingestion for ${SOURCE_IDS.length} India/global sources...\n`);

  for (const id of SOURCE_IDS) {
    const source = await prisma.source.findUnique({ where: { id } });
    if (!source) {
      console.log(`${id}: NOT FOUND`);
      continue;
    }
    console.log(`--- ${source.name} (${source.sourceType}) ---`);
    try {
      const result = await runIngestion(id);
      console.log(
        `  found=${result.itemsFound} stored=${result.itemsStored} updated=${result.itemsUpdated} duplicate=${result.itemsDuplicate} filtered=${result.itemsFiltered} failed=${result.itemsFailed}`
      );
      if (result.errors.length > 0) console.log(`  errors: ${result.errors.slice(0, 3).join(" | ")}`);
    } catch (err) {
      console.log(`  UNCAUGHT ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const opportunities = await prisma.opportunity.findMany({
    where: { sourceId: { in: SOURCE_IDS } },
    select: { title: true, organization: true, sourceName: true, geographicScope: true, deadline: true },
  });

  console.log(`\n=== ${opportunities.length} opportunities stored from these sources ===`);
  for (const o of opportunities) {
    console.log(`- [${o.sourceName}] ${o.title} (${o.geographicScope}${o.deadline ? `, deadline ${o.deadline.toISOString().slice(0, 10)}` : ""})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
