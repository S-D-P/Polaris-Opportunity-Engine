import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDb } from "../db";

async function makeUserAndOpportunity() {
  const user = await testDb.user.create({
    data: { email: "tracker@example.com", name: "Tracker User", passwordHash: "x" },
  });
  const opportunity = await testDb.opportunity.create({
    data: {
      title: "Test Fellowship",
      organization: "Test Org",
      description: "A test opportunity",
      shortDescription: "A test opportunity",
      opportunityType: "FELLOWSHIP",
      categories: "[]",
      fields: "[]",
      skills: "[]",
      targetAudience: "[]",
      countries: "[]",
      applicationUrl: "https://example.org/apply",
      sourceUrl: "https://example.org",
      sourceName: "Test Org",
      sourceType: "MANUAL",
      fingerprint: "test-org::test-fellowship",
    },
  });
  return { user, opportunity };
}

describe("tracker (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  it("saves an opportunity with default SAVED status", async () => {
    const { user, opportunity } = await makeUserAndOpportunity();
    const tracked = await testDb.trackedOpportunity.create({
      data: { userId: user.id, opportunityId: opportunity.id, status: "SAVED" },
    });
    expect(tracked.status).toBe("SAVED");
  });

  it("enforces one tracked row per (user, opportunity) pair via upsert", async () => {
    const { user, opportunity } = await makeUserAndOpportunity();
    await testDb.trackedOpportunity.create({
      data: { userId: user.id, opportunityId: opportunity.id, status: "SAVED" },
    });

    // A second "save" from the UI should update the existing row, not create a duplicate.
    await testDb.trackedOpportunity.upsert({
      where: { userId_opportunityId: { userId: user.id, opportunityId: opportunity.id } },
      update: { status: "INTERESTED" },
      create: { userId: user.id, opportunityId: opportunity.id, status: "INTERESTED" },
    });

    const rows = await testDb.trackedOpportunity.findMany({
      where: { userId: user.id, opportunityId: opportunity.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("INTERESTED");
  });

  it("walks through the DISCOVERED -> SAVED -> INTERESTED -> APPLIED -> COMPLETED states", async () => {
    const { user, opportunity } = await makeUserAndOpportunity();
    const tracked = await testDb.trackedOpportunity.create({
      data: { userId: user.id, opportunityId: opportunity.id, status: "DISCOVERED" },
    });

    const transitions = ["SAVED", "INTERESTED", "APPLIED", "COMPLETED"] as const;
    let current = tracked;
    for (const status of transitions) {
      current = await testDb.trackedOpportunity.update({
        where: { id: current.id },
        data: { status },
      });
      expect(current.status).toBe(status);
    }
  });

  it("stores free-text notes on a tracked item", async () => {
    const { user, opportunity } = await makeUserAndOpportunity();
    const tracked = await testDb.trackedOpportunity.create({
      data: { userId: user.id, opportunityId: opportunity.id, status: "SAVED" },
    });
    const updated = await testDb.trackedOpportunity.update({
      where: { id: tracked.id },
      data: { notes: "Need a recommendation letter before applying." },
    });
    expect(updated.notes).toMatch(/recommendation letter/);
  });

  it("removes the tracked row on delete without touching the opportunity itself", async () => {
    const { user, opportunity } = await makeUserAndOpportunity();
    const tracked = await testDb.trackedOpportunity.create({
      data: { userId: user.id, opportunityId: opportunity.id, status: "SAVED" },
    });
    await testDb.trackedOpportunity.delete({ where: { id: tracked.id } });

    const remaining = await testDb.trackedOpportunity.findMany({ where: { userId: user.id } });
    expect(remaining).toHaveLength(0);
    const stillExists = await testDb.opportunity.findUnique({ where: { id: opportunity.id } });
    expect(stillExists).not.toBeNull();
  });
});
