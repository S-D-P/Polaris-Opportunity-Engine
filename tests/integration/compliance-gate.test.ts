import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDb } from "../db";
import { runIngestion } from "@/lib/ingestion/pipeline";
import { manualAdapter } from "@/lib/ingestion/adapters/manual";
import type { ComplianceStatus } from "@prisma/client";

// Proves the compliance gate (lib/ingestion/compliance.ts) actually prevents network/adapter
// activity for non-compliant sources — not just that the job "fails," but that fetchRaw is
// never invoked at all. docs/backend-roadmap.md Part 15 and the original request both call
// this out specifically: "assert the mock/fetch layer was never invoked, not just that the
// job failed."
describe("ingestion compliance gate (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  const fetchRawSpy = vi.spyOn(manualAdapter, "fetchRaw");
  afterEach(() => fetchRawSpy.mockClear());

  async function makeSourceWithCompliance(status: ComplianceStatus | null) {
    let complianceRecordId: string | undefined;
    if (status) {
      const record = await testDb.sourceComplianceRecord.create({
        data: {
          sourceName: "Compliance Test Source",
          sourceUrl: "https://example.org/gate-test",
          automatedAccessStatus: status,
          complianceNotes: "Test fixture.",
          lastPolicyCheckAt: new Date(),
        },
      });
      complianceRecordId = record.id;
    }
    return testDb.source.create({
      data: {
        name: "Compliance Test Source",
        sourceType: "MANUAL",
        url: "https://example.org/gate-test",
        config: JSON.stringify({ items: [] }),
        complianceRecordId,
      },
    });
  }

  it("a source with no compliance record at all is blocked — fetchRaw is never called", async () => {
    const source = await makeSourceWithCompliance(null);
    const result = await runIngestion(source.id);

    expect(fetchRawSpy).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/no compliance record/i);
    const job = await testDb.ingestionJob.findFirst({ where: { sourceId: source.id } });
    expect(job?.status).toBe("FAILED");
  });

  it("NOT_ALLOWED sources are blocked unconditionally — fetchRaw is never called", async () => {
    const source = await makeSourceWithCompliance("NOT_ALLOWED");
    const result = await runIngestion(source.id);

    expect(fetchRawSpy).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/NOT_ALLOWED/);
  });

  it("NOT_ALLOWED sources stay blocked even with a manual-review override — no exception exists", async () => {
    const source = await makeSourceWithCompliance("NOT_ALLOWED");
    const result = await runIngestion(source.id, { manualReview: true });

    expect(fetchRawSpy).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/NOT_ALLOWED/);
  });

  it("UNCLEAR_REQUIRES_REVIEW sources are blocked from automatic runs — fetchRaw is never called", async () => {
    const source = await makeSourceWithCompliance("UNCLEAR_REQUIRES_REVIEW");
    const result = await runIngestion(source.id);

    expect(fetchRawSpy).not.toHaveBeenCalled();
    expect(result.errors[0]).toMatch(/UNCLEAR_REQUIRES_REVIEW/);
  });

  it("UNCLEAR_REQUIRES_REVIEW sources DO run via an explicit manual-review override", async () => {
    const source = await makeSourceWithCompliance("UNCLEAR_REQUIRES_REVIEW");
    const result = await runIngestion(source.id, { manualReview: true });

    expect(fetchRawSpy).toHaveBeenCalledTimes(1);
    expect(result.errors).toHaveLength(0);
  });

  it("ALLOWED sources run automatically", async () => {
    const source = await makeSourceWithCompliance("ALLOWED");
    await runIngestion(source.id);
    expect(fetchRawSpy).toHaveBeenCalledTimes(1);
  });

  it("ALLOWED_WITH_RESTRICTIONS sources run automatically", async () => {
    const source = await makeSourceWithCompliance("ALLOWED_WITH_RESTRICTIONS");
    await runIngestion(source.id);
    expect(fetchRawSpy).toHaveBeenCalledTimes(1);
  });
});
