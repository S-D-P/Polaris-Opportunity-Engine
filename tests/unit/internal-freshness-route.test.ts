import { describe, expect, it } from "vitest";
import { verifySchedulerSecret } from "@/lib/ingestion/freshness";

// The Cloud Scheduler-facing endpoint's auth check (app/api/internal/freshness/route.ts).
// Tested here as a pure function rather than importing the route module directly — the route
// pulls in next-auth's server-only import chain, which can't load under Vitest.
describe("verifySchedulerSecret", () => {
  it("rejects when no header was provided", () => {
    expect(verifySchedulerSecret("configured-secret", undefined)).toBe(false);
    expect(verifySchedulerSecret("configured-secret", null)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    expect(verifySchedulerSecret("configured-secret", "wrong-secret")).toBe(false);
  });

  it("rejects every request when the secret env var isn't configured at all — an unset secret is never 'no auth required'", () => {
    expect(verifySchedulerSecret(undefined, "anything")).toBe(false);
    expect(verifySchedulerSecret("", "anything")).toBe(false);
  });

  it("accepts an exact match", () => {
    expect(verifySchedulerSecret("configured-secret", "configured-secret")).toBe(true);
  });
});
