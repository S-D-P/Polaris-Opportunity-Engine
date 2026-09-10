import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonApiAdapter } from "@/lib/ingestion/adapters/json-api";
import type { Source } from "@prisma/client";

// Fixture shaped like USAJobs.gov's documented public Search API response
// (developer.usajobs.gov) — a realistic shape to prove the generic dot-path adapter code
// works correctly, not a claim that this exact response was captured from a live call
// (no API key is configured in this environment — see docs/source-compliance.md).
const USAJOBS_FIXTURE = {
  SearchResult: {
    SearchResultCount: 1,
    SearchResultItems: [
      {
        MatchedObjectDescriptor: {
          PositionTitle: "Data Scientist",
          PositionURI: "https://www.usajobs.gov/job/123456700",
          OrganizationName: "National Science Foundation",
          PublicationStartDate: "2026-09-01T00:00:00.000Z",
          ApplicationCloseDate: "2026-10-15T00:00:00.000Z",
          UserArea: {
            Details: {
              JobSummary: "Analyze large datasets to support NSF research initiatives.",
            },
          },
        },
      },
    ],
  },
};

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "src-1",
    name: "USAJobs.gov",
    organization: "US Office of Personnel Management",
    sourceType: "JSON_API",
    url: "https://data.usajobs.gov/api/search?Keyword=data%20scientist",
    config: JSON.stringify({
      apiKeyEnvVar: "USAJOBS_API_KEY",
      apiKeyHeader: "Authorization-Key",
      itemsPath: "SearchResult.SearchResultItems",
      fieldMap: {
        title: "MatchedObjectDescriptor.PositionTitle",
        link: "MatchedObjectDescriptor.PositionURI",
        content: "MatchedObjectDescriptor.UserArea.Details.JobSummary",
        organization: "MatchedObjectDescriptor.OrganizationName",
        publishedAt: "MatchedObjectDescriptor.PublicationStartDate",
        deadline: "MatchedObjectDescriptor.ApplicationCloseDate",
      },
    }),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    categoryCoverage: null,
    geographicCoverage: null,
    reliabilityScore: 1,
    complianceStatus: null,
    lastPolicyCheckAt: null,
    crawlFrequency: null,
    rateLimit: null,
    lastSuccessfulIngestionAt: null,
    lastFailureAt: null,
    extractionMethod: null,
    complianceRecordId: null,
    ...overrides,
  } as Source;
}

describe("jsonApiAdapter", () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.USAJOBS_API_KEY;

  beforeEach(() => {
    global.fetch = vi.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalEnv === undefined) delete process.env.USAJOBS_API_KEY;
    else process.env.USAJOBS_API_KEY = originalEnv;
  });

  it("throws a clear error when the required API key env var is missing, rather than fetching anyway", async () => {
    delete process.env.USAJOBS_API_KEY;
    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/USAJOBS_API_KEY/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends the API key as the configured header and extracts items via the configured field map", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => USAJOBS_FIXTURE,
    });

    const source = makeSource();
    const items = await jsonApiAdapter.fetchRaw(source);

    expect(global.fetch).toHaveBeenCalledWith(
      source.url,
      expect.objectContaining({ headers: expect.objectContaining({ "Authorization-Key": "test-key-123" }) })
    );
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Data Scientist");
    expect(items[0].link).toBe("https://www.usajobs.gov/job/123456700");
    expect(items[0].organization).toBe("National Science Foundation");
    expect(items[0].structuredDeadline?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
  });

  it("throws a clear error when the HTTP response is not ok", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/401/);
  });

  it("normalize() prefers the structured deadline field over free-text date guessing", () => {
    const source = makeSource();
    const normalized = jsonApiAdapter.normalize(
      {
        title: "Data Scientist",
        link: "https://www.usajobs.gov/job/123456700",
        content: "Analyze large datasets. No deadline mentioned in the summary text.",
        publishedAt: null,
        guid: "g1",
        organization: "National Science Foundation",
        structuredDeadline: new Date("2026-10-15T00:00:00.000Z"),
        structuredApplicationUrl: "https://www.usajobs.gov/job/123456700",
      },
      source
    );

    expect(normalized?.deadline?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(normalized?.organization).toBe("National Science Foundation");
  });

  it("normalize() returns null for an item missing a title or link", () => {
    const source = makeSource();
    const normalized = jsonApiAdapter.normalize(
      { title: "", link: "", content: "", publishedAt: null, guid: "g1" },
      source
    );
    expect(normalized).toBeNull();
  });

  it("builds a real URL from an id field via linkTemplate, for APIs that return ids rather than direct links", async () => {
    const source = makeSource({
      name: "Grants.gov",
      config: JSON.stringify({
        itemsPath: "data.oppHits",
        linkTemplate: "https://www.grants.gov/search-results-detail/{value}",
        fieldMap: { title: "title", link: "id", content: "description" },
      }),
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { oppHits: [{ id: "12345", title: "Research Grant", description: "..." }] } }),
    });

    const items = await jsonApiAdapter.fetchRaw(source);
    expect(items[0].link).toBe("https://www.grants.gov/search-results-detail/12345");
  });

  it("throws a clear error when the response shape doesn't match the configured itemsPath", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    });

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/itemsPath/);
  });

  it("throws a clear error including the status code on a rate-limit (429) response", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    });

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/429/);
  });

  it("throws a clear error including the status code on a server (5xx) error", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/503/);
  });

  it("propagates a DNS/connection failure rather than swallowing it", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("fetch failed: getaddrinfo ENOTFOUND"));

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/ENOTFOUND/);
  });

  it("propagates a request timeout rather than swallowing it", async () => {
    process.env.USAJOBS_API_KEY = "test-key-123";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("The operation was aborted due to timeout"));

    const source = makeSource();
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/timeout/);
  });

  it("throws a clear error when the source has no config at all", async () => {
    const source = makeSource({ config: null });
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/no config/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a clear error when config is missing the required itemsPath/fieldMap", async () => {
    const source = makeSource({ config: JSON.stringify({ fieldMap: { title: "x", link: "y" } }) });
    await expect(jsonApiAdapter.fetchRaw(source)).rejects.toThrow(/itemsPath/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
