import { describe, expect, it } from "vitest";
import { cosineSimilarity, embedText, embeddingToJson, jsonToEmbedding } from "@/lib/ai/embeddings";

describe("embedText / cosineSimilarity", () => {
  it("gives identical texts a similarity of ~1", () => {
    const a = embedText("AI policy fellowship for early-career technologists");
    const b = embedText("AI policy fellowship for early-career technologists");
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it("gives topically-related texts a higher similarity than unrelated texts", () => {
    const goal = embedText("I want to work in AI policy and technology governance");
    const related = embedText("A fellowship for technology policy and AI governance leaders");
    const unrelated = embedText("A summer camp for marine biology and ocean conservation");

    const relatedScore = cosineSimilarity(goal, related);
    const unrelatedScore = cosineSimilarity(goal, unrelated);

    expect(relatedScore).toBeGreaterThan(unrelatedScore);
  });

  it("returns a vector of consistent fixed length", () => {
    const a = embedText("short text");
    const b = embedText(
      "a much longer piece of text with many more words to embed into the same fixed length vector space"
    );
    expect(a.length).toBe(b.length);
  });

  it("round-trips through JSON serialization", () => {
    const vector = embedText("round trip test");
    const json = embeddingToJson(vector);
    const restored = jsonToEmbedding(json);
    expect(restored).toEqual(vector);
  });

  it("returns null for invalid JSON", () => {
    expect(jsonToEmbedding("not json")).toBeNull();
    expect(jsonToEmbedding(null)).toBeNull();
  });
});
