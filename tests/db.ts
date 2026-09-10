import { prisma } from "@/lib/db/client";

// Re-exported for readability in integration tests — this is the same singleton the app
// uses, pointed at the dedicated test database via DATABASE_URL (see tests/setup.ts).
export const testDb = prisma;

export async function resetDb() {
  await testDb.trackedOpportunity.deleteMany();
  await testDb.searchQueryLog.deleteMany();
  await testDb.opportunity.deleteMany();
  await testDb.ingestionJob.deleteMany();
  await testDb.source.deleteMany();
  await testDb.profile.deleteMany();
  await testDb.user.deleteMany();
  // Unlike the old SQLite FTS5 virtual table, Postgres's search_vector column lives directly
  // on Opportunity, so opportunity.deleteMany() above already clears it — no separate step.
}
