import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { testDb, resetDb } from "../db";
import { searchOpportunities } from "@/lib/search/index";
import { upsertFtsRow } from "@/lib/search/fts";
import { embedText, embeddingToJson } from "@/lib/ai/embeddings";

async function makeOpportunity(title: string, description: string, extra: Record<string, unknown> = {}) {
  const opportunity = await testDb.opportunity.create({
    data: {
      title,
      organization: "Org",
      description,
      shortDescription: description.slice(0, 100),
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
      fingerprint: `org::${title}::${Math.random()}`,
      status: "OPEN",
      embedding: embeddingToJson(embedText(`${title} ${description}`)),
      ...extra,
    },
  });
  // The pipeline/admin routes populate the FTS index as a side effect of writing an
  // opportunity; tests write directly via Prisma, so index explicitly to exercise the
  // real keyword-ranking path rather than only the embedding half of the hybrid search.
  await upsertFtsRow({
    id: opportunity.id,
    title: opportunity.title,
    organization: opportunity.organization,
    description: opportunity.description,
    tags: "",
  });
  return opportunity;
}

describe("searchOpportunities (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  it("ranks a keyword-matching opportunity above an unrelated one", async () => {
    await makeOpportunity(
      "AI Policy Fellowship",
      "A fellowship for technologists interested in AI governance and public policy."
    );
    await makeOpportunity(
      "Marine Biology Summer Camp",
      "A hands-on summer camp exploring ocean ecosystems and marine conservation."
    );

    const { results } = await searchOpportunities({ keywordQuery: "AI policy fellowship" });
    expect(results[0].opportunity.title).toBe("AI Policy Fellowship");
  });

  it("applies a hard type filter rather than treating it as a ranking signal", async () => {
    await makeOpportunity("A Scholarship", "General scholarship text.", { opportunityType: "SCHOLARSHIP" });
    await makeOpportunity("A Hackathon", "General hackathon text.", { opportunityType: "HACKATHON" });

    const { results } = await searchOpportunities({ filters: { types: ["HACKATHON"] } });
    expect(results).toHaveLength(1);
    expect(results[0].opportunity.title).toBe("A Hackathon");
  });

  it("excludes closed opportunities by default", async () => {
    await makeOpportunity("Open One", "Still open.", { status: "OPEN" });
    await makeOpportunity("Closed One", "Already closed.", { status: "CLOSED" });

    const { results } = await searchOpportunities({});
    expect(results.map((r) => r.opportunity.title)).not.toContain("Closed One");
  });

  it("returns an empty result set gracefully when nothing matches", async () => {
    await makeOpportunity("Something", "Unrelated content.");
    const { results, total } = await searchOpportunities({ keywordQuery: "xyznonexistenttopic" });
    expect(total).toBe(0);
    expect(results).toEqual([]);
  });
});
