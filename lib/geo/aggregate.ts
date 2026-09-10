import { prisma } from "@/lib/db/client";
import { normalizeCountryName } from "@/lib/geo/countries";
import type { Opportunity } from "@prisma/client";

export interface CountryBucket {
  country: string; // canonical name, matches lib/geo/countries.ts WORLD_COUNTRIES
  count: number;
}

export interface RegionBucket {
  detail: string; // free-text region/area name as stated by the source, not pinned to the map
  count: number;
}

export interface GeoSummary {
  countries: CountryBucket[];
  regions: RegionBucket[];
  globalCount: number;
  remoteGlobalCount: number;
  unknownCount: number; // includes LOCATION_UNKNOWN and any COUNTRY_SPECIFIC detail that didn't resolve
  totalActive: number;
}

let cache: { data: GeoSummary; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

/**
 * Aggregate geographic distribution of active, real (non-seed) opportunities for the
 * Explore map (docs/personalization.md). A single grouped SQL query, not a per-opportunity
 * scan — cached briefly since the underlying catalog doesn't change fast enough to justify
 * recomputing on every page view (docs/scalability.md's caching guidance).
 */
export async function getGeoSummary(): Promise<GeoSummary> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const grouped = await prisma.opportunity.groupBy({
    by: ["geographicScope", "geographicDetail"],
    // Same COURSE+NEEDS_REVIEW exclusion as lib/search/index.ts and lib/matching/feed.ts.
    where: {
      status: { in: ["OPEN", "CLOSING_SOON"] },
      isSeedData: false,
      NOT: { opportunityType: "COURSE", verificationStatus: "NEEDS_REVIEW" },
    },
    _count: true,
  });

  const countryCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  let globalCount = 0;
  let remoteGlobalCount = 0;
  let unknownCount = 0;
  let totalActive = 0;

  for (const row of grouped) {
    const n = row._count;
    totalActive += n;
    switch (row.geographicScope) {
      case "INDIA_ONLY":
        countryCounts.set("India", (countryCounts.get("India") ?? 0) + n);
        break;
      case "COUNTRY_SPECIFIC": {
        const resolved = normalizeCountryName(row.geographicDetail);
        if (resolved) countryCounts.set(resolved, (countryCounts.get(resolved) ?? 0) + n);
        else unknownCount += n; // stated but not a recognized country name — honest, not fabricated
        break;
      }
      case "REGION_SPECIFIC":
        regionCounts.set(row.geographicDetail ?? "Unspecified region", (regionCounts.get(row.geographicDetail ?? "Unspecified region") ?? 0) + n);
        break;
      case "GLOBAL":
        globalCount += n;
        break;
      case "REMOTE_GLOBAL":
        remoteGlobalCount += n;
        break;
      default:
        unknownCount += n;
    }
  }

  const data: GeoSummary = {
    countries: [...countryCounts.entries()]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    regions: [...regionCounts.entries()]
      .map(([detail, count]) => ({ detail, count }))
      .sort((a, b) => b.count - a.count),
    globalCount,
    remoteGlobalCount,
    unknownCount,
    totalActive,
  };
  cache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}

export function clearGeoSummaryCache(): void {
  cache = null;
}

/**
 * Opportunities resolving to one canonical country (map drill-down). Country-name matching
 * happens in-process via the same normalizer as the aggregate, since Postgres can't apply
 * `normalizeCountryName`'s alias table in a WHERE clause — the candidate set is bounded to
 * rows already scoped to INDIA_ONLY/COUNTRY_SPECIFIC, never a full table scan.
 */
export async function getOpportunitiesForCountry(country: string, limit = 50): Promise<Opportunity[]> {
  const candidates = await prisma.opportunity.findMany({
    where: {
      status: { in: ["OPEN", "CLOSING_SOON"] },
      isSeedData: false,
      geographicScope: country === "India" ? { in: ["INDIA_ONLY", "COUNTRY_SPECIFIC"] } : "COUNTRY_SPECIFIC",
      NOT: { opportunityType: "COURSE", verificationStatus: "NEEDS_REVIEW" },
    },
    orderBy: { dateDiscovered: "desc" },
    take: 500,
  });
  return candidates
    .filter((o) => (o.geographicScope === "INDIA_ONLY" ? "India" : normalizeCountryName(o.geographicDetail)) === country)
    .slice(0, limit);
}
