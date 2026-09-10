import Link from "next/link";
import { getGeoSummary } from "@/lib/geo/aggregate";
import { WorldMap } from "@/components/explore/world-map";
import { Card } from "@/components/ui/card";

export default async function ExplorePage() {
  const summary = await getGeoSummary();
  const globalTotal = summary.globalCount + summary.remoteGlobalCount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Explore by location</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Browse active opportunities by where they are, as an alternative to your feed or a
        keyword search. Bubble size is the number of opportunities in that country — click one
        to see them.
      </p>

      <div className="mt-8">
        <WorldMap countries={summary.countries} />
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Global &amp; remote</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Open worldwide or remote-eligible — not tied to any one place, so these aren&apos;t
            pinned to the map.
          </p>
          <p className="mt-3 font-display text-3xl text-accent">{globalTotal}</p>
          <p className="text-xs text-foreground-muted">
            {summary.globalCount} global · {summary.remoteGlobalCount} remote
          </p>
          <Link href="/search" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Search all opportunities →
          </Link>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Regional programs</h2>
          <p className="mt-1 text-sm text-foreground-muted">
            Restricted to a named region or area that doesn&apos;t map to a single country, so
            these are listed rather than plotted.
          </p>
          {summary.regions.length === 0 ? (
            <p className="mt-3 text-sm text-foreground-muted">None right now.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {summary.regions.map((r) => (
                <li key={r.detail} className="flex items-center justify-between gap-2 text-sm">
                  <Link
                    href={`/search?q=${encodeURIComponent(r.detail)}`}
                    className="text-primary hover:underline"
                  >
                    {r.detail}
                  </Link>
                  <span className="text-foreground-muted">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm text-foreground-muted">
        Location not stated for {summary.unknownCount} of {summary.totalActive} active
        opportunities.
      </p>
    </div>
  );
}
