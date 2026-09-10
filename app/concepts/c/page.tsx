import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { findMissedOpportunities } from "@/lib/concepts/missed";
import { STAGES, STAGE_LABELS } from "@/lib/taxonomy";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { OpportunityTile } from "@/components/concepts/c/opportunity-tile";
import { CategoryTile } from "@/components/concepts/c/category-tile";
import { buildWhyNarrative } from "@/lib/matching/narrative";
import { getDaysRemaining } from "@/lib/deadline";

export default async function ConceptCHome() {
  const session = await auth();

  const opportunities = await prisma.opportunity.findMany({
    where: { status: { in: ["OPEN", "CLOSING_SOON"] } },
    orderBy: { dateDiscovered: "desc" },
    take: 100,
  });

  const trending = opportunities.slice(0, 6);

  const categoryCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  for (const o of opportunities) {
    for (const c of fromJsonArray(o.categories)) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
    for (const c of fromJsonArray(o.countries)) countryCounts.set(c, (countryCounts.get(c) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const closingThisMonth = opportunities.filter((o) => {
    const days = getDaysRemaining(o.deadline);
    return days != null && days >= 0 && days <= 30;
  });
  const freeOpportunities = opportunities.filter((o) => o.isFree);

  let missed: { opportunity: (typeof opportunities)[number]; reason: string; score: number }[] = [];
  if (session?.user) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const found = await findMissedOpportunities({
        userId: session.user.id,
        excludeIds: trending.map((o) => o.id),
        limit: 3,
      });
      missed = found.map((f) => ({
        opportunity: f.opportunity,
        reason: buildWhyNarrative(f.match),
        score: f.match.score,
      }));
    }
  }

  return (
    <div>
      <ConceptSwitcher active="c" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/c" labels={{ home: "Explore", search: "Browse", profile: "Your universe" }} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6">
        <section>
          <h1 className="font-display text-2xl text-foreground">Trending</h1>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {trending.map((o) => (
              <OpportunityTile key={o.id} opportunity={o} />
            ))}
          </div>
        </section>

        {missed.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-foreground">You might have missed this</h2>
            <p className="text-sm text-foreground-muted">Not in your trending feed, but a strong fit for you.</p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {missed.map((m) => (
                <OpportunityTile
                  key={m.opportunity.id}
                  opportunity={m.opportunity}
                  matchScore={m.score}
                  reason={m.reason}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl text-foreground">Explore by field</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {topCategories.map(([cat, count]) => (
              <CategoryTile
                key={cat}
                label={cat}
                count={count}
                href={`/concepts/c/search?q=${encodeURIComponent(cat)}`}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-display text-xl text-foreground">Explore by career stage</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {STAGES.map((s) => (
              <CategoryTile
                key={s}
                label={STAGE_LABELS[s]}
                href={`/concepts/c/search?q=${encodeURIComponent(STAGE_LABELS[s])}`}
              />
            ))}
          </div>
        </section>

        {topCountries.length > 0 && (
          <section>
            <h2 className="font-display text-xl text-foreground">Explore by geography</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {topCountries.map(([country, count]) => (
                <CategoryTile
                  key={country}
                  label={country}
                  count={count}
                  href={`/concepts/c/search?q=${encodeURIComponent(country)}`}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-xl text-foreground">Collections</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CollectionRow title="Closing this month" items={closingThisMonth} />
            <CollectionRow title="Free to apply" items={freeOpportunities} />
          </div>
        </section>
      </div>
    </div>
  );
}

function CollectionRow({
  title,
  items,
}: {
  title: string;
  items: Awaited<ReturnType<typeof prisma.opportunity.findMany>>;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="font-display text-base text-foreground">{title}</p>
      <p className="text-xs text-foreground-muted">{items.length} opportunities</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {items.slice(0, 4).map((o) => (
          <OpportunityTile key={o.id} opportunity={o} />
        ))}
      </div>
    </div>
  );
}
