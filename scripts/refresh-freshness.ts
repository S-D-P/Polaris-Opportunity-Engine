// Manual/local entry point for the freshness sweep — the shared implementation lives in
// lib/ingestion/freshness.ts's runFreshnessSweep(), also called by the Cloud Scheduler-facing
// app/api/internal/freshness/route.ts. See that file's docstring for the full rationale.
import { PrismaClient } from "@prisma/client";
import { runFreshnessSweep } from "../lib/ingestion/freshness";

const prisma = new PrismaClient();

async function main() {
  const result = await runFreshnessSweep(prisma);
  for (const t of result.transitions) console.log(`${t.id}: ${t.from} -> ${t.to}`);
  console.log(`Freshness sweep complete: ${result.transitioned}/${result.checked} opportunities transitioned.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
