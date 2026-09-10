import { describe, expect, it } from "vitest";
import { evaluateComplianceGate } from "@/lib/ingestion/compliance";
import type { ComplianceStatus } from "@prisma/client";

function record(status: ComplianceStatus, rateLimit: string | null = null) {
  return { automatedAccessStatus: status, rateLimit };
}

describe("evaluateComplianceGate", () => {
  it("blocks a source with no compliance record at all — fails closed, never open", () => {
    const result = evaluateComplianceGate(null);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("NO_RECORD");
  });

  it("allows ALLOWED sources", () => {
    const result = evaluateComplianceGate(record("ALLOWED"));
    expect(result.allowed).toBe(true);
  });

  it("allows ALLOWED_WITH_RESTRICTIONS sources and surfaces the rate limit in the reason", () => {
    const result = evaluateComplianceGate(record("ALLOWED_WITH_RESTRICTIONS", "1000 req/hour"));
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain("1000 req/hour");
  });

  it("blocks UNCLEAR_REQUIRES_REVIEW by default (no manual review flag)", () => {
    const result = evaluateComplianceGate(record("UNCLEAR_REQUIRES_REVIEW"));
    expect(result.allowed).toBe(false);
    expect(result.status).toBe("UNCLEAR_REQUIRES_REVIEW");
  });

  it("allows UNCLEAR_REQUIRES_REVIEW only via an explicit manual-review override", () => {
    const result = evaluateComplianceGate(record("UNCLEAR_REQUIRES_REVIEW"), { manualReview: true });
    expect(result.allowed).toBe(true);
  });

  it("NEVER allows NOT_ALLOWED, even with a manual-review override — this is the one absolute rule", () => {
    const withoutOverride = evaluateComplianceGate(record("NOT_ALLOWED"));
    const withOverride = evaluateComplianceGate(record("NOT_ALLOWED"), { manualReview: true });
    expect(withoutOverride.allowed).toBe(false);
    expect(withOverride.allowed).toBe(false);
    expect(withOverride.status).toBe("NOT_ALLOWED");
  });
});
