import type { Source } from "@prisma/client";

/** Minimally-parsed item straight off the wire — no business logic yet. */
export interface RawItem {
  title: string;
  link: string;
  content: string;
  publishedAt: Date | null;
  guid: string;
  organization?: string;
  /** Set when the source already gives a structured date (e.g. a JSON API field) — lets
   *  normalize() skip the free-text regex guess in lib/ingestion/date-extract.ts, which
   *  exists only for sources that don't have one. */
  structuredDeadline?: Date | null;
  structuredApplicationUrl?: string;
}

/** Deterministic, pre-AI normalized shape. Every field here is derived from the raw
 *  source text by plain parsing — no AI involved (docs/architecture.md §3). */
export interface NormalizedOpportunity {
  title: string;
  organization: string;
  rawText: string;
  applicationUrl: string;
  sourceUrl: string;
  deadline: Date | null;
  startDate: Date | null;
  /** Per-item geographic eligibility override, for adapters/sources whose items individually
   *  state different eligibility (e.g. a JSON API with a per-listing country field). Falls
   *  back to the Source's own `config.geographicScope` default when unset — see
   *  docs/geographic-model.md. Never inferred; only set when the source explicitly states it. */
  geographicScope?: "INDIA_ONLY" | "GLOBAL" | "REGION_SPECIFIC" | "COUNTRY_SPECIFIC" | "REMOTE_GLOBAL";
  geographicDetail?: string;
}

export interface SourceAdapter {
  sourceType: Source["sourceType"];
  fetchRaw(source: Source): Promise<RawItem[]>;
  normalize(raw: RawItem, source: Source): NormalizedOpportunity | null;
}

export interface PipelineResult {
  itemsFound: number;
  itemsStored: number;
  itemsUpdated: number;
  itemsDuplicate: number;
  itemsFailed: number;
  itemsFiltered: number;
  errors: string[];
}
