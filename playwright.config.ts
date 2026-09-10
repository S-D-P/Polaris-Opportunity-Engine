import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Cloud SQL round-trips through the local Auth Proxy are real network calls (unlike SQLite's
  // near-zero local file I/O) — login (bcrypt + a Postgres query) and the feed (scoring 76+
  // opportunities, several Prisma queries) were measured taking 5-7s each against Cloud SQL,
  // comfortably over Playwright's 5s default assertion timeout. Bumped, not papered over —
  // the underlying app behavior is correct (verified manually), this just matches the
  // timeout to the real latency of a real cloud database (docs/data-architecture.md).
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
