import { describe, expect, it, vi } from "vitest";
import Parser from "rss-parser";
import { rssAdapter } from "@/lib/ingestion/adapters/rss";
import { extractDeadline, extractStartDate } from "@/lib/ingestion/date-extract";
import type { Source } from "@prisma/client";

const source = {
  id: "src-1",
  name: "Test Source",
  sourceType: "RSS",
  url: "https://example.org/feed.xml",
  config: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Source;

describe("date-extract", () => {
  it("extracts a labeled deadline in 'Month Day, Year' format", () => {
    const deadline = extractDeadline("Applications close. Deadline: October 18, 2026. Apply now.");
    expect(deadline?.getFullYear()).toBe(2026);
    expect(deadline?.getMonth()).toBe(9); // October = index 9
    expect(deadline?.getDate()).toBe(18);
  });

  it("extracts a labeled start date", () => {
    const start = extractStartDate("Program begins: January 5, 2027 in Boston.");
    expect(start?.getFullYear()).toBe(2027);
  });

  it("returns null when no labeled date is present", () => {
    expect(extractDeadline("A general description with no dates at all.")).toBeNull();
  });
});

describe("rssAdapter.normalize", () => {
  it("builds a normalized opportunity from a raw RSS item", () => {
    const raw = {
      title: "Open Fellowship Program",
      link: "https://example.org/fellowship",
      content: "Deadline: December 1, 2026. A great opportunity.",
      publishedAt: new Date(),
      guid: "guid-1",
    };
    const normalized = rssAdapter.normalize(raw, source);
    expect(normalized).not.toBeNull();
    expect(normalized?.title).toBe("Open Fellowship Program");
    expect(normalized?.organization).toBe("Test Source");
    expect(normalized?.applicationUrl).toBe("https://example.org/fellowship");
    expect(normalized?.deadline?.getFullYear()).toBe(2026);
  });

  it("returns null when the raw item has no title or link", () => {
    const raw = { title: "", link: "", content: "", publishedAt: null, guid: "x" };
    expect(rssAdapter.normalize(raw, source)).toBeNull();
  });
});

describe("rssAdapter.fetchRaw — failure propagation", () => {
  // fetchRaw deliberately does not swallow errors (see the comment in
  // lib/ingestion/adapters/rss.ts) — the pipeline is what turns these into a FAILED
  // IngestionJob with a clear message. These tests prove fetchRaw itself never quietly
  // returns an empty/successful-looking result for a broken feed.

  it("propagates a malformed-XML parse error rather than returning an empty result", async () => {
    const spy = vi
      .spyOn(Parser.prototype, "parseURL")
      .mockRejectedValueOnce(new Error("Invalid XML: Unexpected close tag"));
    await expect(rssAdapter.fetchRaw(source)).rejects.toThrow(/Unexpected close tag/);
    spy.mockRestore();
  });

  it("propagates a DNS/connection failure", async () => {
    const spy = vi
      .spyOn(Parser.prototype, "parseURL")
      .mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND example.org"));
    await expect(rssAdapter.fetchRaw(source)).rejects.toThrow(/ENOTFOUND/);
    spy.mockRestore();
  });

  it("propagates a request timeout", async () => {
    const spy = vi.spyOn(Parser.prototype, "parseURL").mockRejectedValueOnce(new Error("Request timed out"));
    await expect(rssAdapter.fetchRaw(source)).rejects.toThrow(/timed out/);
    spy.mockRestore();
  });
});
