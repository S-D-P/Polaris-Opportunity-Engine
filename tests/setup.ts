// Runs before each test file's module graph loads. Pointing DATABASE_URL at the
// dedicated test database (migrated once in tests/global-setup.ts, same URL-derivation
// logic) here — before any test file imports lib/db/client — means integration tests can
// import the app's real Prisma singleton and real pipeline/matching functions unmodified,
// while never touching the `polaris` dev database. Unit tests don't use a database at all,
// so this is a no-op for them.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace("/polaris?", "/polaris_test?") : undefined);

// AI is disabled for the whole test run via lib/ai/provider.ts checking process.env.VITEST
// directly (set by Vitest itself, so it can't race with setupFiles/module-caching timing the
// way deleting GOOGLE_CLOUD_PROJECT here did) — see that file for why.
