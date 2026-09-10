import { describe, expect, it } from "vitest";
import { isLikelyOpportunity } from "@/lib/ingestion/relevance-filter";

describe("isLikelyOpportunity", () => {
  it("accepts a title/content that clearly announces an open call for applications", () => {
    expect(
      isLikelyOpportunity(
        "Student Ambassador Program's call for applications is open!",
        "We're excited to open applications for this year's cohort."
      )
    ).toBe(true);
  });

  it("accepts content mentioning a fellowship, hackathon, or scholarship even without other cues", () => {
    expect(isLikelyOpportunity("Announcing the 2027 Research Fellowship", "")).toBe(true);
    expect(isLikelyOpportunity("Global Hackathon returns this spring", "")).toBe(true);
    expect(isLikelyOpportunity("New Scholarship for undergraduates", "")).toBe(true);
  });

  it("rejects an ordinary technical blog post with none of the opportunity keywords", () => {
    expect(
      isLikelyOpportunity(
        "How to generate text: using different decoding methods for language generation with Transformers",
        "This post explains beam search, greedy decoding, and sampling strategies for text generation."
      )
    ).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isLikelyOpportunity("APPLY NOW for our program", "")).toBe(true);
  });

  it("supports a custom keyword list overriding the default", () => {
    expect(isLikelyOpportunity("Custom Signal Post", "special-keyword mentioned here", ["special-keyword"])).toBe(
      true
    );
    expect(isLikelyOpportunity("Fellowship announcement", "", ["special-keyword"])).toBe(false);
  });
});
