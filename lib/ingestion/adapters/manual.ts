import type { Source } from "@prisma/client";
import type { NormalizedOpportunity, RawItem, SourceAdapter } from "@/lib/ingestion/types";

interface ManualItem {
  title: string;
  organization?: string;
  rawText: string;
  applicationUrl: string;
  sourceUrl?: string;
  deadline?: string;
  startDate?: string;
}

/**
 * Adapter for curated/manually-entered opportunities — used for sources where no
 * machine-readable feed exists but content has been manually transcribed by an admin
 * (source.config.items, a JSON array). This is a real, working path (used by seed data
 * and by admins pasting in a single opportunity), not a placeholder for a scraper that
 * doesn't exist — it never claims to have fetched a live page.
 */
export const manualAdapter: SourceAdapter = {
  sourceType: "MANUAL",

  async fetchRaw(source: Source): Promise<RawItem[]> {
    if (!source.config) return [];
    let items: ManualItem[] = [];
    try {
      const parsed = JSON.parse(source.config);
      items = Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
    return items.map((item, idx) => ({
      title: item.title,
      link: item.applicationUrl,
      content: item.rawText,
      publishedAt: null,
      guid: `${source.id}-manual-${idx}`,
      __manual: item,
    })) as (RawItem & { __manual: ManualItem })[];
  },

  normalize(raw: RawItem, source: Source): NormalizedOpportunity | null {
    const manual = (raw as RawItem & { __manual?: ManualItem }).__manual;
    if (!manual || !manual.title || !manual.applicationUrl) return null;
    return {
      title: manual.title,
      organization: manual.organization || source.name,
      rawText: manual.rawText,
      applicationUrl: manual.applicationUrl,
      sourceUrl: manual.sourceUrl || manual.applicationUrl,
      deadline: manual.deadline ? new Date(manual.deadline) : null,
      startDate: manual.startDate ? new Date(manual.startDate) : null,
    };
  },
};
