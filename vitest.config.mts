import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// vitest doesn't auto-load .env the way Next.js does — load it explicitly so DATABASE_URL is
// available to tests/global-setup.ts and beyond. (AI is kept disabled for the whole run via
// lib/ai/provider.ts checking process.env.VITEST directly — see that file for why a
// delete-GOOGLE_CLOUD_PROJECT-in-a-setup-file approach was tried first and didn't reliably work.)
config();

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/evaluation/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    testTimeout: 15000,
    // Integration tests share a single Postgres test database (tests/global-setup.ts);
    // running test files in parallel would cause spurious cross-file interference as one
    // file's beforeEach(resetDb) truncates tables mid-test in another file. Run test files
    // sequentially instead.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
