import Parser from "rss-parser";
import type { Source } from "@prisma/client";
import type { NormalizedOpportunity, RawItem, SourceAdapter } from "@/lib/ingestion/types";
import { extractDeadline, extractStartDate } from "@/lib/ingestion/date-extract";
import { assertSafeFetchUrl } from "@/lib/ingestion/url-safety";

const parser = new Parser({ timeout: 15000 });

/**
 * Real, working adapter for RSS/Atom feeds — an organization publishing an opportunities
 * feed (fellowship announcements, grant listings, etc.). This is the one fully-functional
 * ingestion source for the MVP (docs/architecture.md §3): it makes a real network request
 * and parses real feed XML, it is not a mock.
 *
 * Fetch errors are intentionally left to propagate — the pipeline (lib/ingestion/pipeline.ts)
 * catches them, records the IngestionJob as FAILED with the error message, and logs it.
 * Swallowing the error here would report a broken feed URL as a "successful" run that
 * happened to find 0 items, which would hide real outages from the admin dashboard.
 */
export const rssAdapter: SourceAdapter = {
  sourceType: "RSS",

  async fetchRaw(source: Source): Promise<RawItem[]> {
    assertSafeFetchUrl(source.url);
    const feed = await parser.parseURL(source.url);
    return (feed.items ?? []).map((item) => ({
      title: (item.title ?? "").trim(),
      link: item.link ?? source.url,
      content: (item.contentSnippet || item.content || item.summary || "").trim(),
      publishedAt: item.isoDate ? new Date(item.isoDate) : null,
      guid: item.guid ?? item.link ?? item.title ?? crypto.randomUUID(),
    }));
  },

  normalize(raw: RawItem, source: Source): NormalizedOpportunity | null {
    if (!raw.title || !raw.link) return null;
    const fullText = `${raw.title}\n${raw.content}`;
    return {
      title: raw.title,
      organization: source.name,
      rawText: raw.content || raw.title,
      applicationUrl: raw.link,
      sourceUrl: raw.link,
      deadline: extractDeadline(fullText),
      startDate: extractStartDate(fullText),
    };
  },
};
