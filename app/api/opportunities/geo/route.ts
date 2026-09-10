import type { NextRequest } from "next/server";
import { getGeoSummary, getOpportunitiesForCountry } from "@/lib/geo/aggregate";
import { ok, withErrorHandling } from "@/lib/api-response";

/**
 * Backs the Explore/map page (docs/personalization.md). PUBLIC — same visibility as
 * /api/opportunities (browsing works logged-out); no personal data returned.
 *
 * GET /api/opportunities/geo            -> aggregate counts (world view)
 * GET /api/opportunities/geo?country=X  -> opportunities resolving to that canonical country
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const country = req.nextUrl.searchParams.get("country");

  if (country) {
    const opportunities = await getOpportunitiesForCountry(country);
    return ok({ country, opportunities });
  }

  const summary = await getGeoSummary();
  return ok(summary);
});
