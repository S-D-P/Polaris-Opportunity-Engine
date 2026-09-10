"use client";

import { useMemo, useState } from "react";
import { geoNaturalEarth1, geoPath, geoCentroid, type GeoSphere } from "d3-geo";
import { WORLD_COUNTRIES } from "@/lib/geo/countries";
import { OpportunityCard, type OpportunityCardData } from "@/components/feed/opportunity-card";
import { EmptyState } from "@/components/ui/empty-state";
import { OpportunityCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface CountryBucket {
  country: string;
  count: number;
}

const WIDTH = 960;
const HEIGHT = 500;
const WORLD_VIEW_BOX = `0 0 ${WIDTH} ${HEIGHT}`;
const MIN_RADIUS = 4;
const MAX_RADIUS = 22;
const SPHERE: GeoSphere = { type: "Sphere" };

/**
 * SVG world map for the Explore page. Renders `WORLD_COUNTRIES` (bundled Natural Earth
 * polygons — no runtime fetch of map data) with a bubble per country present in `countries`,
 * sized by `sqrt(count)` and centered on `geoCentroid`. Clicking a bubble or a shaded country
 * shape zooms the SVG viewBox to that country's bounds and loads its opportunities. Country-level
 * is the deepest zoom this supports — there's no reliable city-level coordinate data to zoom
 * into or pin, so we deliberately stop here rather than fabricate a pin (see lib/geo/countries.ts).
 */
export function WorldMap({ countries }: { countries: CountryBucket[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const countByName = useMemo(() => new Map(countries.map((c) => [c.country, c.count])), [countries]);
  const maxCount = useMemo(() => Math.max(1, ...countries.map((c) => c.count)), [countries]);

  const projection = useMemo(() => geoNaturalEarth1().fitSize([WIDTH, HEIGHT], SPHERE), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  const selectedFeature = useMemo(
    () => (selected ? (WORLD_COUNTRIES.find((f) => f.properties.name === selected) ?? null) : null),
    [selected]
  );

  const viewBox = useMemo(() => {
    if (!selectedFeature) return WORLD_VIEW_BOX;
    const bounds = path.bounds(selectedFeature);
    const [[x0, y0], [x1, y1]] = bounds;
    const padX = Math.max((x1 - x0) * 0.3, 15);
    const padY = Math.max((y1 - y0) * 0.3, 15);
    const bx0 = Math.max(0, x0 - padX);
    const by0 = Math.max(0, y0 - padY);
    const bx1 = Math.min(WIDTH, x1 + padX);
    const by1 = Math.min(HEIGHT, y1 + padY);
    return `${bx0} ${by0} ${Math.max(bx1 - bx0, 10)} ${Math.max(by1 - by0, 10)}`;
  }, [selectedFeature, path]);

  function radiusFor(count: number) {
    const t = Math.sqrt(count) / Math.sqrt(maxCount);
    return MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
  }

  async function selectCountry(name: string) {
    setSelected(name);
    setLoading(true);
    setLoadError(false);
    setOpportunities([]);
    try {
      const res = await fetch(`/api/opportunities/geo?country=${encodeURIComponent(name)}`);
      if (!res.ok) throw new Error("request failed");
      const json = await res.json();
      setOpportunities(json.data?.opportunities ?? []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setSelected(null);
    setOpportunities([]);
    setLoadError(false);
  }

  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
        {selected && (
          <button
            type="button"
            onClick={reset}
            className="absolute right-6 top-6 z-10 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground-muted shadow-sm hover:border-primary hover:text-foreground"
          >
            ← World view
          </button>
        )}
        <svg
          viewBox={viewBox}
          className="h-auto w-full transition-[view-box] duration-500 ease-in-out"
          role="img"
          aria-label="World map of active opportunities by country"
        >
          <g>
            {WORLD_COUNTRIES.map((f) => {
              const name = f.properties.name;
              const count = countByName.get(name) ?? 0;
              const d = path(f) ?? undefined;
              return (
                <path
                  key={name}
                  d={d}
                  fill="var(--color-surface-muted)"
                  stroke="var(--color-border)"
                  strokeWidth={0.5}
                  className={count > 0 ? "cursor-pointer transition-opacity hover:opacity-80" : undefined}
                  onClick={count > 0 ? () => selectCountry(name) : undefined}
                >
                  <title>
                    {name}
                    {count > 0 ? ` — ${count} opportunit${count === 1 ? "y" : "ies"}` : ""}
                  </title>
                </path>
              );
            })}
          </g>
          <g>
            {countries.map(({ country, count }) => {
              const feature = WORLD_COUNTRIES.find((f) => f.properties.name === country);
              if (!feature) return null;
              const centroid = geoCentroid(feature);
              if (centroid.some((n) => Number.isNaN(n))) return null;
              const projected = projection(centroid);
              if (!projected) return null;
              const [cx, cy] = projected;
              return (
                <circle
                  key={country}
                  cx={cx}
                  cy={cy}
                  r={radiusFor(count)}
                  fill="var(--color-accent)"
                  fillOpacity={selected === country ? 0.75 : 0.5}
                  stroke="var(--color-accent)"
                  strokeWidth={1}
                  className="cursor-pointer transition-opacity hover:fill-opacity-75"
                  onClick={() => selectCountry(country)}
                >
                  <title>
                    {country} — {count} opportunit{count === 1 ? "y" : "ies"}
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>
      </div>

      {selected && (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="font-display text-xl text-foreground">{selected}</h2>
            <Button variant="outline" size="sm" onClick={reset}>
              World view
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <OpportunityCardSkeleton key={i} />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              title="Couldn't load opportunities"
              description="Something went wrong fetching opportunities for this country. Try selecting it again."
            />
          ) : opportunities.length === 0 ? (
            <EmptyState
              title="No opportunities found for this country yet"
              description="Check back as more sources are added, or try search."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
