import * as cheerio from "cheerio";
import type { Source } from "@prisma/client";
import type { NormalizedOpportunity, RawItem, SourceAdapter } from "@/lib/ingestion/types";
import { extractDeadline, extractStartDate } from "@/lib/ingestion/date-extract";
import { assertSafeFetchUrl } from "@/lib/ingestion/url-safety";

/**
 * Adapter for corporate/platform program pages with no feed or API — the dominant shape found
 * researching both corporate sources (docs/corporate-opportunity-sources.md) and India/global
 * platform sources (docs/demo-dataset-plan.md). Two modes, combinable in one source:
 *
 *  - `pages`: an explicit, hand-picked list of program pages — one opportunity each. Used for
 *    a single well-known program (e.g. a company's one flagship fellowship page).
 *  - `listingPages`: a listing/index page (e.g. a platform's "open hackathons" page) whose
 *    individual opportunity links are discovered via a CSS selector, then each discovered
 *    page is fetched and extracted the same way as `pages` — for platforms that host many
 *    real, independently-run opportunities (Unstop, Devfolio, HackerEarth, MLH). `itemLimit`
 *    caps how many are fetched per run, matching the "curated, not maximum volume" demo
 *    dataset goal rather than exhaustively crawling a platform.
 *
 * `Source.config` (JSON) shape:
 * {
 *   "renderMode"?: "static" | "js",     // default "static" — plain fetch(). "js" launches a
 *                                        // real headless Chromium (playwright-core) to render
 *                                        // client-side content first, for SPAs (Trailhead,
 *                                        // Unstop) that serve no real content to a plain fetch.
 *   "pages"?: [ { "url": string, "organization"?: string } ],
 *   "listingPages"?: [
 *     {
 *       "url": string,                  // the listing/index page to discover links from
 *       "linkSelector": string,         // CSS selector matching <a> elements to follow
 *       "itemLimit"?: number,           // default 15
 *       "organization"?: string,
 *       "renderMode"?: "static" | "js"  // overrides the top-level renderMode for this listing
 *     }
 *   ],
 *   "fieldMap"?: {
 *     "title"?: string,                 // CSS selector; falls back to og:title, <h1>, <title>
 *     "description"?: string            // CSS selector; falls back to og:description,
 *                                        // meta[name=description], first substantial <p>
 *   }
 * }
 *
 * This adapter never re-checks robots.txt/ToS live — like RSS and JSON_API, it trusts the
 * compliance gate (lib/ingestion/compliance.ts), which already verified the linked
 * SourceComplianceRecord before fetchRaw is ever called.
 */

interface StaticPageConfig {
  renderMode?: "static" | "js";
  pages?: Array<{ url: string; organization?: string }>;
  listingPages?: Array<{
    url: string;
    linkSelector: string;
    itemLimit?: number;
    organization?: string;
    renderMode?: "static" | "js";
  }>;
  fieldMap?: {
    title?: string;
    description?: string;
  };
}

const DEFAULT_LISTING_ITEM_LIMIT = 15;

function parseConfig(source: Source): StaticPageConfig {
  if (!source.config) {
    throw new Error(`Source "${source.name}" has no config — a STATIC_PAGE source requires "pages" and/or "listingPages".`);
  }
  const parsed = JSON.parse(source.config) as Partial<StaticPageConfig>;
  const hasPages = Array.isArray(parsed.pages) && parsed.pages.length > 0;
  const hasListingPages = Array.isArray(parsed.listingPages) && parsed.listingPages.length > 0;
  if (!hasPages && !hasListingPages) {
    throw new Error(`Source "${source.name}" config has neither a non-empty "pages" array nor "listingPages" array.`);
  }
  return parsed as StaticPageConfig;
}

async function fetchStaticHtml(url: string): Promise<string> {
  assertSafeFetchUrl(url);
  const response = await fetch(url, {
    headers: { "User-Agent": "PolarisBot/1.0 (+opportunity-discovery; compliance-reviewed)" },
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/** Renders a page with a real headless browser for sources whose content is populated by
 *  client-side JavaScript and would otherwise be invisible to a plain fetch (e.g. Trailhead,
 *  Unstop). Launches and closes a fresh browser per call — these sources are fetched on a
 *  daily/weekly cadence at most, not a volume where keeping a browser warm across calls
 *  matters. */
async function fetchRenderedHtml(url: string): Promise<string> {
  assertSafeFetchUrl(url);
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // "networkidle" never fires on many modern SPAs that keep background connections open
    // (analytics beacons, polling, websockets) — "domcontentloaded" plus a short settle delay
    // is enough for client-side-rendered content to appear without waiting on network
    // activity that may never actually go quiet.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchHtml(url: string, renderMode: "static" | "js" | undefined): Promise<string> {
  return renderMode === "js" ? await fetchRenderedHtml(url) : await fetchStaticHtml(url);
}

/** Extracts a single opportunity's title/description from a fetched page's HTML, using
 *  config-provided selectors first and falling back through og: tags, <h1>/<title>, and the
 *  first substantial paragraph — the raw <title>/<meta name=description> tags are frequently
 *  just site-branding boilerplate with no real information (an empirically-discovered quality
 *  issue — docs/corporate-ingestion-baseline.md). */
function extractItem(
  html: string,
  url: string,
  organization: string | undefined,
  fieldMap: StaticPageConfig["fieldMap"]
): RawItem {
  const $ = cheerio.load(html);

  // Each fallback tier is skipped, not accepted, when it resolves to a generic site-wide
  // label rather than page-specific content — found via a real bad record ("About Us" landed
  // as an opportunity's title because a media-release page's own og:title/<title> was just
  // its site section name, not the release headline). h1 is checked before falling further.
  const isGenericTitle = (t: string) =>
    /^(about( us)?|home|contact( us)?|welcome|untitled|overview|news|media|press( release)?s?|index)$/i.test(
      t.trim()
    );
  const titleCandidates = [
    fieldMap?.title ? $(fieldMap.title).first().text().trim() : "",
    $('meta[property="og:title"]').attr("content")?.trim() ?? "",
    $("h1").first().text().trim(),
    $("title").first().text().trim(),
  ];
  const title = titleCandidates.find((t) => t && !isGenericTitle(t)) ?? titleCandidates.find((t) => t) ?? "";

  const description =
    (fieldMap?.description ? $(fieldMap.description).first().text() : "").trim() ||
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    $("p")
      .toArray()
      .map((el) => $(el).text().trim())
      .find((text) => text.length > 60) ||
    "";

  return {
    title,
    link: url,
    content: description,
    publishedAt: null,
    guid: url,
    organization,
    structuredApplicationUrl: url,
  };
}

/** Fetches a listing page, discovers up to `itemLimit` distinct opportunity links via
 *  `linkSelector`, and fetches+extracts each one. Relative hrefs are resolved against the
 *  listing page's own URL. Per-item fetch failures are logged and skipped rather than failing
 *  the whole listing — one broken link on a platform with dozens of real ones shouldn't lose
 *  the rest. */
async function fetchListingPage(
  listing: NonNullable<StaticPageConfig["listingPages"]>[number],
  topLevelRenderMode: StaticPageConfig["renderMode"],
  fieldMap: StaticPageConfig["fieldMap"]
): Promise<RawItem[]> {
  const renderMode = listing.renderMode ?? topLevelRenderMode;
  const listingHtml = await fetchHtml(listing.url, renderMode);
  const $ = cheerio.load(listingHtml);

  const hrefs = $(listing.linkSelector)
    .toArray()
    .map((el) => $(el).attr("href"))
    .filter((href): href is string => Boolean(href))
    .map((href) => {
      try {
        return new URL(href, listing.url).toString();
      } catch {
        return null;
      }
    })
    .filter((url): url is string => Boolean(url));

  const uniqueUrls = Array.from(new Set(hrefs)).slice(0, listing.itemLimit ?? DEFAULT_LISTING_ITEM_LIMIT);

  const items: RawItem[] = [];
  for (const url of uniqueUrls) {
    try {
      const html = await fetchHtml(url, renderMode);
      items.push(extractItem(html, url, listing.organization, fieldMap));
    } catch {
      // One item page failing (dead link, temporary error) doesn't invalidate the rest of a
      // real listing with dozens of independently-run opportunities — skip and continue.
      continue;
    }
  }
  return items;
}

export const staticPageAdapter: SourceAdapter = {
  sourceType: "STATIC_PAGE",

  async fetchRaw(source: Source): Promise<RawItem[]> {
    const config = parseConfig(source);
    const items: RawItem[] = [];

    for (const pageConfig of config.pages ?? []) {
      const html = await fetchHtml(pageConfig.url, config.renderMode);
      items.push(extractItem(html, pageConfig.url, pageConfig.organization, config.fieldMap));
    }

    for (const listing of config.listingPages ?? []) {
      const listingItems = await fetchListingPage(listing, config.renderMode, config.fieldMap);
      items.push(...listingItems);
    }

    return items;
  },

  normalize(raw: RawItem, source: Source): NormalizedOpportunity | null {
    if (!raw.title || !raw.link) return null;
    const fullText = `${raw.title}\n${raw.content}`;
    return {
      title: raw.title,
      organization: raw.organization || source.organization || source.name,
      rawText: raw.content || raw.title,
      applicationUrl: raw.structuredApplicationUrl || raw.link,
      sourceUrl: raw.link,
      deadline: extractDeadline(fullText),
      startDate: extractStartDate(fullText),
    };
  },
};
