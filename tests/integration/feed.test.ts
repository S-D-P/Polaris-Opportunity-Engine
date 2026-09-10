import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDb } from "../db";
import { generateFeed } from "@/lib/matching/feed";

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

describe("generateFeed (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  it("returns an empty feed for a user with no profile row", async () => {
    // generateFeed looks the profile up itself; a user with no profile at all (shouldn't
    // happen in practice since signup always creates one) must not throw.
    const feed = await generateFeed("nonexistent-user-id");
    expect(feed).toEqual([]);
  });

  it("excludes an opportunity that violates a stated eligibility constraint", async () => {
    const user = await testDb.user.create({
      data: { email: "feed1@example.com", name: "Feed User", passwordHash: "x" },
    });
    await testDb.profile.create({
      data: { userId: user.id, citizenship: "India", interests: JSON.stringify(["AI/ML"]) },
    });

    await makeOpportunity({
      title: "US Only Scholarship",
      categories: JSON.stringify(["AI/ML"]),
      citizenshipRequirements: JSON.stringify(["United States"]),
    });
    await makeOpportunity({
      title: "Open to Everyone Scholarship",
      categories: JSON.stringify(["AI/ML"]),
      citizenshipRequirements: JSON.stringify(["any"]),
    });

    const feed = await generateFeed(user.id);
    const titles = feed.map((f) => f.opportunity.title);
    expect(titles).not.toContain("US Only Scholarship");
    expect(titles).toContain("Open to Everyone Scholarship");
  });

  it("ranks a more topically-relevant opportunity above a less relevant one", async () => {
    const user = await testDb.user.create({
      data: { email: "feed2@example.com", name: "Feed User 2", passwordHash: "x" },
    });
    await testDb.profile.create({
      data: {
        userId: user.id,
        interests: JSON.stringify(["AI/ML", "Public Policy"]),
        skills: JSON.stringify(["Python", "Machine Learning"]),
      },
    });

    await makeOpportunity({
      title: "AI Policy Fellowship",
      categories: JSON.stringify(["AI/ML", "Public Policy"]),
      skills: JSON.stringify(["Python", "Machine Learning"]),
    });
    await makeOpportunity({
      title: "Unrelated Arts Grant",
      categories: JSON.stringify(["Arts & Humanities"]),
    });

    const feed = await generateFeed(user.id);
    expect(feed[0].opportunity.title).toBe("AI Policy Fellowship");
  });

  it("excludes closed opportunities from the feed", async () => {
    const user = await testDb.user.create({
      data: { email: "feed3@example.com", name: "Feed User 3", passwordHash: "x" },
    });
    await testDb.profile.create({ data: { userId: user.id } });

    await makeOpportunity({ title: "Closed Opportunity", status: "CLOSED" });

    const feed = await generateFeed(user.id);
    expect(feed.map((f) => f.opportunity.title)).not.toContain("Closed Opportunity");
  });
});
