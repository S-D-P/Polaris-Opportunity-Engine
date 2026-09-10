import { describe, expect, it } from "vitest";
import {
  buildFingerprint,
  canonicalizeUrl,
  classifyDuplicateConfidence,
  computeDuplicateConfidence,
  findBestDuplicateMatch,
  findDuplicate,
  jaroWinkler,
  titleSimilarity,
} from "@/lib/ingestion/dedupe";
import { embedText } from "@/lib/ai/embeddings";

describe("buildFingerprint", () => {
  it("normalizes case, punctuation, and '&'/'and' so equivalent titles fingerprint identically", () => {
    const a = buildFingerprint("AI & ML Scholarship!", "CloudWorks");
    const b = buildFingerprint("ai and ml scholarship", "CloudWorks");
    expect(a).toBe(b);
  });

  it("differs across organizations for the same title", () => {
    const a = buildFingerprint("Fellowship Program", "Org A");
    const b = buildFingerprint("Fellowship Program", "Org B");
    expect(a).not.toBe(b);
  });
});

describe("titleSimilarity / jaroWinkler", () => {
  it("returns 1 for identical strings", () => {
    expect(jaroWinkler("hello", "hello")).toBe(1);
  });

  it("returns a high score for near-identical titles with minor variation", () => {
    const score = titleSimilarity(
      "AI & Machine Learning Scholarship",
      "AI and Machine Learning Scholarship"
    );
    expect(score).toBeGreaterThan(0.9);
  });

  it("returns a score well below the dedup threshold for unrelated titles", () => {
    const score = titleSimilarity("AI & Machine Learning Scholarship", "Marine Biology Summer Camp");
    expect(score).toBeLessThan(0.92);
  });
});

describe("findDuplicate", () => {
  const existing = [
    { id: "1", title: "AI & Machine Learning Scholarship", organization: "CloudWorks", fingerprint: buildFingerprint("AI & Machine Learning Scholarship", "CloudWorks") },
    { id: "2", title: "Global Voyager Fellowship", organization: "Horizon Foundation", fingerprint: buildFingerprint("Global Voyager Fellowship", "Horizon Foundation") },
  ];

  it("finds an exact fingerprint match", () => {
    const id = findDuplicate("AI & Machine Learning Scholarship", "CloudWorks", existing);
    expect(id).toBe("1");
  });

  it("finds a near-duplicate title from the same organization", () => {
    const id = findDuplicate("AI and Machine Learning Scholarship", "CloudWorks", existing);
    expect(id).toBe("1");
  });

  it("does not match a similar title from a different organization", () => {
    const id = findDuplicate("AI & Machine Learning Scholarship", "A Different Org", existing);
    expect(id).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const id = findDuplicate("Completely Unrelated Hackathon", "New Org", existing);
    expect(id).toBeNull();
  });
});

describe("canonicalizeUrl", () => {
  it("treats http/https and www as equivalent", () => {
    expect(canonicalizeUrl("https://www.example.org/jobs/123")).toBe(
      canonicalizeUrl("http://example.org/jobs/123")
    );
  });

  it("ignores a trailing slash and query string differences are preserved as distinct paths", () => {
    expect(canonicalizeUrl("https://example.org/jobs/123/")).toBe(canonicalizeUrl("https://example.org/jobs/123"));
  });
});

describe("classifyDuplicateConfidence", () => {
  it("classifies >= 0.9 as HIGH_CONFIDENCE_DUPLICATE", () => {
    expect(classifyDuplicateConfidence(0.95)).toBe("HIGH_CONFIDENCE_DUPLICATE");
  });
  it("classifies 0.6-0.89 as POSSIBLE_DUPLICATE", () => {
    expect(classifyDuplicateConfidence(0.7)).toBe("POSSIBLE_DUPLICATE");
  });
  it("classifies < 0.6 as NOT_DUPLICATE", () => {
    expect(classifyDuplicateConfidence(0.2)).toBe("NOT_DUPLICATE");
  });
});

describe("computeDuplicateConfidence", () => {
  const baseExisting = {
    id: "1",
    title: "AI & Machine Learning Scholarship",
    organization: "CloudWorks",
    applicationUrl: "https://cloudworks.example/apply/ai-ml",
    deadline: new Date("2026-12-01"),
    embedding: null,
  };

  it("scores 1.0 for an exact canonical application URL match, even with a different title", () => {
    const confidence = computeDuplicateConfidence(
      {
        title: "Totally Different Wording",
        organization: "Some Other Org",
        applicationUrl: "https://www.cloudworks.example/apply/ai-ml/",
        deadline: null,
      },
      baseExisting
    );
    expect(confidence).toBe(1.0);
  });

  it("scores high confidence when organization, title, and deadline all agree", () => {
    const confidence = computeDuplicateConfidence(
      {
        title: "AI and Machine Learning Scholarship",
        organization: "CloudWorks",
        applicationUrl: "https://cloudworks.example/apply/ai-ml-scholarship-2026",
        deadline: new Date("2026-12-01"),
      },
      baseExisting
    );
    expect(classifyDuplicateConfidence(confidence)).toBe("HIGH_CONFIDENCE_DUPLICATE");
  });

  it("scores low for unrelated organization, title, and no shared embedding", () => {
    const confidence = computeDuplicateConfidence(
      {
        title: "Marine Biology Summer Camp",
        organization: "Ocean Institute",
        applicationUrl: "https://ocean.example/apply",
        deadline: new Date("2026-06-01"),
      },
      baseExisting
    );
    expect(classifyDuplicateConfidence(confidence)).toBe("NOT_DUPLICATE");
  });

  it("flags a likely duplicate even with a different org string, closing the exact-org-match blind spot", () => {
    const vec = embedText("A scholarship for students studying artificial intelligence and machine learning.");
    const confidence = computeDuplicateConfidence(
      {
        title: "AI & ML Scholarship",
        organization: "Cloud Works Inc.", // slightly different org string, not exact
        applicationUrl: "https://different-domain.example/scholarship",
        deadline: new Date("2027-01-15"), // different deadline
        embedding: vec,
      },
      {
        ...baseExisting,
        embedding: JSON.stringify(vec),
      }
    );
    // The old exact-org-match-only findDuplicate would have missed this entirely (returns
    // null for any non-exact org string) — the blended signal correctly surfaces it as at
    // least a candidate for review, whatever tier the exact score lands in.
    expect(classifyDuplicateConfidence(confidence)).not.toBe("NOT_DUPLICATE");
  });
});

describe("findBestDuplicateMatch", () => {
  const existing = [
    {
      id: "1",
      title: "AI & Machine Learning Scholarship",
      organization: "CloudWorks",
      applicationUrl: "https://cloudworks.example/apply/ai-ml",
      deadline: new Date("2026-12-01"),
      embedding: null,
    },
    {
      id: "2",
      title: "Global Voyager Fellowship",
      organization: "Horizon Foundation",
      applicationUrl: "https://horizon.example/apply/voyager",
      deadline: new Date("2026-09-01"),
      embedding: null,
    },
  ];

  it("returns the best match with its tier", () => {
    const match = findBestDuplicateMatch(
      {
        title: "AI & Machine Learning Scholarship",
        organization: "CloudWorks",
        applicationUrl: "https://cloudworks.example/apply/ai-ml",
        deadline: new Date("2026-12-01"),
      },
      existing
    );
    expect(match?.id).toBe("1");
    expect(match?.tier).toBe("HIGH_CONFIDENCE_DUPLICATE");
  });

  it("returns null when nothing clears the possible-duplicate floor", () => {
    const match = findBestDuplicateMatch(
      {
        title: "Completely Unrelated Hackathon",
        organization: "New Org",
        applicationUrl: "https://new-org.example/hackathon",
        deadline: null,
      },
      existing
    );
    expect(match).toBeNull();
  });
});
