import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb, resetDb } from "../db";
import { runIngestion } from "@/lib/ingestion/pipeline";
import * as extraction from "@/lib/ai/extraction";

// Uses the MANUAL adapter (curated JSON items) rather than the RSS adapter so this test
// is deterministic and network-free, while still exercising the real pipeline: fetch ->
// normalize -> dedupe -> AI classify (degrades gracefully, no GOOGLE_CLOUD_PROJECT in tests)
// -> validate -> store -> index -> IngestionJob bookkeeping.
describe("ingestion pipeline (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  async function makeAllowedComplianceRecord() {
    return testDb.sourceComplianceRecord.create({
      data: {
        sourceName: "Test Manual Source",
        sourceUrl: "https://example.org/curated",
        automatedAccessStatus: "ALLOWED",
        complianceNotes: "Test fixture — pre-approved for pipeline behavior tests unrelated to compliance itself.",
        lastPolicyCheckAt: new Date(),
      },
    });
  }

  async function makeSource(items: unknown[]) {
    const compliance = await makeAllowedComplianceRecord();
    return testDb.source.create({
      data: {
        name: "Test Manual Source",
        sourceType: "MANUAL",
        url: "https://example.org/curated",
        config: JSON.stringify({ items }),
        complianceRecordId: compliance.id,
      },
    });
  }

  it("stores valid items and records a SUCCEEDED job", async () => {
    const source = await makeSource([
      {
        title: "Test Fellowship Program",
        organization: "Test Org",
        rawText: "A fellowship for early-career professionals. Deadline: December 1, 2026.",
        applicationUrl: "https://example.org/fellowship",
      },
    ]);

    const result = await runIngestion(source.id);

    expect(result.itemsFound).toBe(1);
    expect(result.itemsStored).toBe(1);
    expect(result.itemsFailed).toBe(0);

    const stored = await testDb.opportunity.findFirst({ where: { sourceId: source.id } });
    expect(stored?.title).toBe("Test Fellowship Program");
    expect(stored?.verificationStatus).toBe("NEEDS_REVIEW"); // no AI key in test env

    const job = await testDb.ingestionJob.findFirst({ where: { sourceId: source.id } });
    expect(job?.status).toBe("SUCCEEDED");
    expect(job?.itemsStored).toBe(1);
  });

  it("rejects an item missing a required field instead of storing garbage", async () => {
    const source = await makeSource([
      { title: "No URL Opportunity", organization: "Test Org", rawText: "Missing application URL.", applicationUrl: "" },
    ]);

    const result = await runIngestion(source.id);

    expect(result.itemsStored).toBe(0);
    expect(result.itemsFailed).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("defaults geographicScope to LOCATION_UNKNOWN when the source states no default", async () => {
    const source = await makeSource([
      {
        title: "Unscoped Opportunity",
        organization: "Test Org",
        rawText: "No geographic eligibility stated anywhere in config.",
        applicationUrl: "https://example.org/unscoped",
      },
    ]);
    await runIngestion(source.id);
    const stored = await testDb.opportunity.findFirstOrThrow({ where: { sourceId: source.id } });
    expect(stored.geographicScope).toBe("LOCATION_UNKNOWN");
  });

  it("applies the source-level geographicScope default from config to every stored item", async () => {
    const compliance = await makeAllowedComplianceRecord();
    const source = await testDb.source.create({
      data: {
        name: "India-Only Test Source",
        sourceType: "MANUAL",
        url: "https://example.org/india-only",
        config: JSON.stringify({
          geographicScope: "INDIA_ONLY",
          geographicDetail: null,
          items: [
            {
              title: "India Government Scheme",
              organization: "Test Ministry",
              rawText: "Open only to Indian citizens.",
              applicationUrl: "https://example.org/india-only/scheme",
            },
          ],
        }),
        complianceRecordId: compliance.id,
      },
    });
    await runIngestion(source.id);
    const stored = await testDb.opportunity.findFirstOrThrow({ where: { sourceId: source.id } });
    expect(stored.geographicScope).toBe("INDIA_ONLY");
  });

  it("filters out non-opportunity items when the source opts into the relevance keyword filter", async () => {
    const compliance = await makeAllowedComplianceRecord();
    const source = await testDb.source.create({
      data: {
        name: "Mixed-Content Blog Source",
        sourceType: "MANUAL",
        url: "https://example.org/blog",
        config: JSON.stringify({
          requireOpportunityKeywords: true,
          items: [
            {
              title: "How We Sped Up Inference by 2x",
              organization: "Test Org",
              rawText: "A deep dive into kernel fusion and quantization techniques.",
              applicationUrl: "https://example.org/blog/inference-speedup",
            },
            {
              title: "Fellowship Program applications are open",
              organization: "Test Org",
              rawText: "Apply now for the 2027 cohort of our research fellowship.",
              applicationUrl: "https://example.org/blog/fellowship",
            },
          ],
        }),
        complianceRecordId: compliance.id,
      },
    });

    const result = await runIngestion(source.id);
    expect(result.itemsFound).toBe(2);
    expect(result.itemsFiltered).toBe(1);
    expect(result.itemsStored).toBe(1);
    expect(result.itemsFailed).toBe(0);

    const stored = await testDb.opportunity.findMany({ where: { sourceId: source.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe("Fellowship Program applications are open");

    const job = await testDb.ingestionJob.findFirst({ where: { sourceId: source.id } });
    expect(job?.itemsFiltered).toBe(1);
  });

  it("rejects an item the AI classifies as a JOB, even from an otherwise-compliant source", async () => {
    // Discovered live: MyGov.in's RSS mixes citizen-engagement contests with genuine hiring
    // listings ("Video Editor (5-10Yrs)", docs/demo-dataset-plan.md). "No jobs" is a hard
    // product rule that can only be enforced post-extraction, since only the AI classification
    // can tell a job apart from a program on a source that isn't job-only — so this test mocks
    // a successful JOB classification directly rather than relying on a real model call.
    const extractSpy = vi.spyOn(extraction, "extractOpportunity").mockResolvedValueOnce({
      opportunityType: "JOB",
      categories: ["Media"],
      fields: [],
      skills: [],
      targetAudience: [],
      shortDescription: "A paid graphic designer position.",
      aiSummary: "A paid graphic designer position, not a program or opportunity.",
      aiTags: [],
      confidence: "high",
    });

    const source = await makeSource([
      {
        title: "Graphic Designer",
        organization: "Test Org",
        rawText: "We are hiring a Graphic Designer, 3-5 years experience required.",
        applicationUrl: "https://example.org/jobs/graphic-designer",
      },
    ]);

    const result = await runIngestion(source.id);
    expect(result.itemsFound).toBe(1);
    expect(result.itemsFiltered).toBe(1);
    expect(result.itemsStored).toBe(0);

    const stored = await testDb.opportunity.findMany({ where: { sourceId: source.id } });
    expect(stored).toHaveLength(0);

    extractSpy.mockRestore();
  });

  it("detects a duplicate on a second ingestion run instead of creating a second row", async () => {
    const source = await makeSource([
      {
        title: "Repeatable Fellowship",
        organization: "Test Org",
        rawText: "Runs twice to test dedup.",
        applicationUrl: "https://example.org/repeatable",
      },
    ]);

    const first = await runIngestion(source.id);
    expect(first.itemsStored).toBe(1);

    const second = await runIngestion(source.id);
    expect(second.itemsStored).toBe(0);
    expect(second.itemsDuplicate).toBe(1);

    const all = await testDb.opportunity.findMany({ where: { sourceId: source.id } });
    expect(all).toHaveLength(1);
    expect(all[0].verifiedAt).not.toBeNull();
  });

  it("updates the deadline and reopens a closed opportunity when a duplicate re-fetch reports new data", async () => {
    const source = await makeSource([
      {
        title: "Extended Fellowship",
        organization: "Test Org",
        rawText: "Runs twice; deadline changes between runs.",
        applicationUrl: "https://example.org/extended",
        deadline: "2026-01-01",
      },
    ]);

    await runIngestion(source.id);
    const stored = await testDb.opportunity.findFirstOrThrow({ where: { sourceId: source.id } });
    await testDb.opportunity.update({ where: { id: stored.id }, data: { status: "CLOSED" } });

    const source2 = await testDb.source.update({
      where: { id: source.id },
      data: {
        config: JSON.stringify({
          items: [
            {
              title: "Extended Fellowship",
              organization: "Test Org",
              rawText: "Runs twice; deadline changes between runs.",
              applicationUrl: "https://example.org/extended",
              deadline: "2099-01-01",
            },
          ],
        }),
      },
    });

    const second = await runIngestion(source2.id);
    expect(second.itemsDuplicate).toBe(1);
    expect(second.itemsUpdated).toBe(1);

    const updated = await testDb.opportunity.findUniqueOrThrow({ where: { id: stored.id } });
    expect(updated.status).toBe("OPEN");
    expect(updated.deadline?.toISOString()).toBe(new Date("2099-01-01").toISOString());
  });

  it("detects a duplicate within a single run, not just across runs", async () => {
    const source = await makeSource([
      {
        title: "Repeated In One Batch",
        organization: "Test Org",
        rawText: "Appears twice in the same feed pull.",
        applicationUrl: "https://example.org/repeated-batch",
      },
      {
        title: "Repeated In One Batch",
        organization: "Test Org",
        rawText: "Appears twice in the same feed pull.",
        applicationUrl: "https://example.org/repeated-batch",
      },
    ]);

    const result = await runIngestion(source.id);
    expect(result.itemsFound).toBe(2);
    expect(result.itemsStored).toBe(1);
    expect(result.itemsDuplicate).toBe(1);

    const all = await testDb.opportunity.findMany({ where: { sourceId: source.id } });
    expect(all).toHaveLength(1);
  });

  it("detects the same opportunity when it appears via two different sources", async () => {
    const sourceA = await makeSource([
      {
        title: "Cross-Source Fellowship",
        organization: "Shared Org",
        rawText: "Listed on the first source.",
        applicationUrl: "https://example.org/cross-source",
      },
    ]);
    const complianceB = await makeAllowedComplianceRecord();
    const sourceB = await testDb.source.create({
      data: {
        name: "Test Manual Source B",
        sourceType: "MANUAL",
        url: "https://example.org/curated-b",
        config: JSON.stringify({
          items: [
            {
              title: "Cross-Source Fellowship",
              organization: "Shared Org",
              rawText: "The same listing, re-published on a second source.",
              applicationUrl: "https://example.org/cross-source",
            },
          ],
        }),
        complianceRecordId: complianceB.id,
      },
    });

    await runIngestion(sourceA.id);
    const result = await runIngestion(sourceB.id);

    expect(result.itemsStored).toBe(0);
    expect(result.itemsDuplicate).toBe(1);

    const stored = await testDb.opportunity.findMany({ where: { title: "Cross-Source Fellowship" } });
    expect(stored).toHaveLength(1);
  });

  it("rejects an item with a malformed application URL instead of storing garbage", async () => {
    const source = await makeSource([
      {
        title: "Bad URL Opportunity",
        organization: "Test Org",
        rawText: "The application URL isn't a real URL.",
        applicationUrl: "not-a-valid-url",
      },
    ]);

    const result = await runIngestion(source.id);
    expect(result.itemsStored).toBe(0);
    expect(result.itemsFailed).toBe(1);

    const stored = await testDb.opportunity.findMany({ where: { sourceId: source.id } });
    expect(stored).toHaveLength(0);
  });

  // Note: the pipeline's defensive "no adapter implemented for source type X" branch
  // (lib/ingestion/pipeline.ts) no longer has a dedicated test — every SourceType enum value
  // (RSS, JSON_API, STATIC_PAGE, MANUAL) now has a real adapter registered, and Prisma
  // validates the enum on both write and read, so there's no way to construct a Source row
  // with an unimplemented type through the real client to exercise it. The branch itself is
  // kept as defense-in-depth for if a future SourceType enum value is added before its
  // adapter is built (STATIC_PAGE itself sat in exactly that state for a while).
});
