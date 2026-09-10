import { execSync } from "node:child_process";
import path from "node:path";

// Runs once before the whole integration test suite: gives integration tests a real,
// freshly-migrated Postgres database (a dedicated `polaris_test` database on the same Cloud
// SQL instance as dev, reached via the local Cloud SQL Auth Proxy — see
// docs/data-architecture.md) rather than mocking Prisma. `TEST_DATABASE_URL` must be set in
// the environment; falls back to swapping `/polaris` for `/polaris_test` in `DATABASE_URL` if
// not set explicitly.
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace("/polaris?", "/polaris_test?") : undefined);

export default async function globalSetup() {
  if (!TEST_DB_URL) {
    throw new Error("TEST_DATABASE_URL (or DATABASE_URL) must be set to run the integration test suite.");
  }

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "inherit",
  });
}
