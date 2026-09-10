import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDb } from "../db";
import { runFreshnessSweep } from "@/lib/ingestion/freshness";

async function makeOpportunity(overrides: Partial<Parameters<typeof testDb.opportunity.create>[0]["data"]>) {
  return testDb.opportunity.create({
    data: {
      title: "Untitled",
      organization: "Org",
      description: "Description",
      shortDescription: "Short",
      opportunityType: "SCHOLARSHIP",
      categories: "[]",
      fields: "[]",
      skills: "[]",
      targetAudience: "[]",
      countries: "[]",
      applicationUrl: "https://example.org/apply",
      sourceUrl: "https://example.org",
      sourceName: "Org",
      sourceType: "MANUAL",
      fingerprint: `org::${Math.random()}`,
      status: "OPEN",
      ...overrides,
    },
  });
}

describe("runFreshnessSweep (integration) — Cloud Scheduler's core logic", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  it("transitions a stale OPEN row with a passed deadline to EXPIRED", async () => {
    const opp = await makeOpportunity({ status: "OPEN", deadline: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) });
    const result = await runFreshnessSweep(testDb);
    expect(result.transitions.some((t) => t.id === opp.id && t.to === "EXPIRED")).toBe(true);
    const updated = await testDb.opportunity.findUnique({ where: { id: opp.id } });
    expect(updated!.status).toBe("EXPIRED");
  });

  it("transitions an OPEN row within the closing-soon window to CLOSING_SOON", async () => {
    const opp = await makeOpportunity({ status: "OPEN", deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) });
    await runFreshnessSweep(testDb);
    const updated = await testDb.opportunity.findUnique({ where: { id: opp.id } });
    expect(updated!.status).toBe("CLOSING_SOON");
  });

  it("leaves a future OPEN row untouched", async () => {
    const opp = await makeOpportunity({ status: "OPEN", deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
    await runFreshnessSweep(testDb);
    const updated = await testDb.opportunity.findUnique({ where: { id: opp.id } });
    expect(updated!.status).toBe("OPEN");
  });

  it("never touches a row with no deadline (rolling/ongoing/not-stated)", async () => {
    const opp = await makeOpportunity({ status: "OPEN", deadline: null, deadlineType: "ROLLING" });
    await runFreshnessSweep(testDb);
    const updated = await testDb.opportunity.findUnique({ where: { id: opp.id } });
    expect(updated!.status).toBe("OPEN");
  });

  it("never touches a DRAFT or explicitly CLOSED row even with a passed deadline", async () => {
    const draft = await makeOpportunity({ status: "DRAFT", deadline: new Date(Date.now() - 1000) });
    const closed = await makeOpportunity({ status: "CLOSED", deadline: new Date(Date.now() - 1000) });
    await runFreshnessSweep(testDb);
    expect((await testDb.opportunity.findUnique({ where: { id: draft.id } }))!.status).toBe("DRAFT");
    expect((await testDb.opportunity.findUnique({ where: { id: closed.id } }))!.status).toBe("CLOSED");
  });
});
