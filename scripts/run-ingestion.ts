// CLI entry point for triggering ingestion outside the admin UI, e.g. from a scheduler
// (cron, GitHub Actions, cloud scheduler) once deployed — see docs/architecture.md §3/§10.
import { PrismaClient } from "@prisma/client";
import { runIngestion } from "../lib/ingestion/pipeline";

const prisma = new PrismaClient();

async function main() {
  const sourceIdArg = process.argv[2];
  const sources = sourceIdArg
    ? await prisma.source.findMany({ where: { id: sourceIdArg } })
    : await prisma.source.findMany({ where: { isActive: true } });

  if (sources.length === 0) {
    console.log("No matching active sources to ingest.");
    return;
  }

  for (const source of sources) {
    console.log(`Running ingestion for "${source.name}" (${source.sourceType})...`);
    const result = await runIngestion(source.id);
    console.log(
      `  found=${result.itemsFound} stored=${result.itemsStored} ` +
        `duplicate=${result.itemsDuplicate} failed=${result.itemsFailed}`
    );
    if (result.errors.length > 0) {
      console.log(`  errors: ${result.errors.slice(0, 5).join(" | ")}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
