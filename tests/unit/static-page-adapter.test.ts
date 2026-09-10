import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Source } from "@prisma/client";
import { staticPageAdapter } from "@/lib/ingestion/adapters/static-page";

vi.mock("playwright-core", () => {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue(
      "<html><head><title>Rendered Program</title></head><body><h1>Rendered Program</h1><p>This program was rendered by client-side JavaScript and would be invisible to a plain fetch.</p></body></html>"
    ),
  };
  const browser = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    chromium: { launch: vi.fn().mockResolvedValue(browser) },
  };
});

function makeSource(config: unknown, overrides: Partial<Source> = {}): Source {
  return {
    id: "src-1",
    name: "Test Corporate Source",
    organization: "Test Org",
    sourceType: "STATIC_PAGE",
    url: "https://example.org/program",
    config: JSON.stringify(config),
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

const SAMPLE_HTML = `
<html>
  <head>
    <title>Page Title Tag</title>
    <meta name="description" content="Meta description fallback text for the program." />
  </head>
  <body>
    <h1 class="program-title">Real Program Title</h1>
    <p class="short">Too short</p>
    <p class="program-desc">This is a real, substantial description of the program that is long enough to be picked up by the fallback paragraph heuristic.</p>
  </body>
</html>
`;

describe("staticPageAdapter.fetchRaw — static mode", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => SAMPLE_HTML,
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws a clear error when the source has no config", async () => {
    const source = makeSource(null, { config: null });
    await expect(staticPageAdapter.fetchRaw(source)).rejects.toThrow(/no config/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a clear error when config has no pages array", async () => {
    const source = makeSource({ fieldMap: {} });
    await expect(staticPageAdapter.fetchRaw(source)).rejects.toThrow(/pages/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("extracts title/description via configured CSS selectors when provided", async () => {
    const source = makeSource({
      pages: [{ url: "https://example.org/program" }],
      fieldMap: { title: "h1.program-title", description: "p.program-desc" },
    });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Real Program Title");
    expect(items[0].content).toMatch(/substantial description/);
    expect(items[0].link).toBe("https://example.org/program");
  });

  it("falls back to <h1> and meta description when no fieldMap or og: tags are present", async () => {
    const source = makeSource({ pages: [{ url: "https://example.org/program" }] });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items[0].title).toBe("Real Program Title");
    expect(items[0].content).toBe("Meta description fallback text for the program.");
  });

  it("prefers og:title/og:description over <h1>/<title> when present", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `<html><head><title>Site | Brand</title><meta property="og:title" content="The Real Program Name" /><meta property="og:description" content="The real og:description summary." /></head><body><h1>Generic Heading</h1></body></html>`,
    });
    const source = makeSource({ pages: [{ url: "https://example.org/program" }] });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items[0].title).toBe("The Real Program Name");
    expect(items[0].content).toBe("The real og:description summary.");
  });

  it("skips a generic og:title/<title> like 'About Us' and falls through to a real heading", async () => {
    // Regression test for a real bad record: a media-release page's og:title was just its
    // site section name ("About Us"), which silently became the stored opportunity title.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        `<html><head><title>About Us</title><meta property="og:title" content="About Us" /></head><body><h1>Reliance Foundation Scholarships 2026-27</h1><p class="d">A real, substantial description of the scholarship program that is long enough to be picked up.</p></body></html>`,
    });
    const source = makeSource({ pages: [{ url: "https://example.org/program" }] });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items[0].title).toBe("Reliance Foundation Scholarships 2026-27");
  });

  it("accepts a generic title only when every fallback tier is equally generic", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<html><head><title>Home</title></head><body></body></html>`,
    });
    const source = makeSource({ pages: [{ url: "https://example.org/program" }] });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items[0].title).toBe("Home");
  });

  it("respects a per-page organization override", async () => {
    const source = makeSource({
      pages: [{ url: "https://example.org/a", organization: "Org A" }, { url: "https://example.org/b" }],
    });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items).toHaveLength(2);
    expect(items[0].organization).toBe("Org A");
    expect(items[1].organization).toBeUndefined();
  });

  it("throws a clear error including the status code on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    const source = makeSource({ pages: [{ url: "https://example.org/blocked" }] });
    await expect(staticPageAdapter.fetchRaw(source)).rejects.toThrow(/403/);
  });
});

describe("staticPageAdapter.fetchRaw — listingPages", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const LISTING_HTML = `
    <html><body>
      <a class="card" href="/opportunities/alpha">Alpha</a>
      <a class="card" href="https://example.org/opportunities/beta">Beta</a>
      <a class="card" href="/opportunities/alpha">Alpha duplicate</a>
      <a class="unrelated" href="/about">About</a>
    </body></html>
  `;
  const ITEM_HTML = (name: string) =>
    `<html><head><meta property="og:title" content="${name} Program" /><meta property="og:description" content="A real program called ${name}." /></head><body></body></html>`;

  it("discovers links via the configured selector, dedupes, and fetches each item", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://example.org/opportunities") {
        return { ok: true, text: async () => LISTING_HTML };
      }
      if (url.includes("alpha")) return { ok: true, text: async () => ITEM_HTML("Alpha") };
      if (url.includes("beta")) return { ok: true, text: async () => ITEM_HTML("Beta") };
      throw new Error(`unexpected fetch: ${url}`);
    });

    const source = makeSource({
      listingPages: [
        {
          url: "https://example.org/opportunities",
          linkSelector: "a.card",
          organization: "Listing Org",
        },
      ],
    });
    const items = await staticPageAdapter.fetchRaw(source);

    // 2 unique items despite 3 matching anchors (one duplicate href)
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.title).sort()).toEqual(["Alpha Program", "Beta Program"]);
    expect(items.every((i) => i.organization === "Listing Org")).toBe(true);
    // relative href resolved against the listing page's own URL
    expect(items.find((i) => i.title === "Alpha Program")?.link).toBe("https://example.org/opportunities/alpha");
  });

  it("caps discovered items at itemLimit", async () => {
    const manyLinksHtml = `<html><body>${Array.from({ length: 10 }, (_, i) => `<a class="card" href="/item-${i}">Item ${i}</a>`).join("")}</body></html>`;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://example.org/opportunities") return { ok: true, text: async () => manyLinksHtml };
      return { ok: true, text: async () => ITEM_HTML("X") };
    });

    const source = makeSource({
      listingPages: [{ url: "https://example.org/opportunities", linkSelector: "a.card", itemLimit: 3 }],
    });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items).toHaveLength(3);
  });

  it("skips an individual item whose fetch fails, without failing the whole listing", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url === "https://example.org/opportunities") return { ok: true, text: async () => LISTING_HTML };
      if (url.includes("alpha")) throw new Error("network error");
      return { ok: true, text: async () => ITEM_HTML("Beta") };
    });

    const source = makeSource({
      listingPages: [{ url: "https://example.org/opportunities", linkSelector: "a.card" }],
    });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Beta Program");
  });
});

describe("staticPageAdapter.fetchRaw — js render mode", () => {
  it("uses a headless browser to render the page before extracting fields", async () => {
    const source = makeSource({ renderMode: "js", pages: [{ url: "https://example.org/rendered" }] });
    const items = await staticPageAdapter.fetchRaw(source);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Rendered Program");
    expect(items[0].content).toMatch(/rendered by client-side JavaScript/);
  });
});

describe("staticPageAdapter.normalize", () => {
  const source = makeSource({ pages: [{ url: "https://example.org/program" }] });

  it("builds a normalized opportunity from a raw fetched page", () => {
    const raw = {
      title: "Innovation Challenge",
      link: "https://example.org/program",
      content: "Deadline: December 1, 2026. A great corporate program.",
      publishedAt: null,
      guid: "https://example.org/program",
      organization: "Acme Corp",
      structuredApplicationUrl: "https://example.org/program",
    };
    const normalized = staticPageAdapter.normalize(raw, source);
    expect(normalized).not.toBeNull();
    expect(normalized?.title).toBe("Innovation Challenge");
    expect(normalized?.organization).toBe("Acme Corp");
    expect(normalized?.applicationUrl).toBe("https://example.org/program");
    expect(normalized?.deadline?.getFullYear()).toBe(2026);
  });

  it("falls back to the source's organization when the page has none", () => {
    const raw = {
      title: "Program",
      link: "https://example.org/program",
      content: "Text",
      publishedAt: null,
      guid: "https://example.org/program",
    };
    const normalized = staticPageAdapter.normalize(raw, source);
    expect(normalized?.organization).toBe("Test Org");
  });

  it("returns null when the raw item has no title or link", () => {
    const raw = { title: "", link: "", content: "", publishedAt: null, guid: "x" };
    expect(staticPageAdapter.normalize(raw, source)).toBeNull();
  });
});
