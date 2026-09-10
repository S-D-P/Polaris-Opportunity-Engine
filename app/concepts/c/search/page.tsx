import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { searchOpportunities } from "@/lib/search/index";
import { findMissedOpportunities } from "@/lib/concepts/missed";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { buildWhyNarrative } from "@/lib/matching/narrative";
import { OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { OpportunityTile } from "@/components/concepts/c/opportunity-tile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

export default async function ConceptCSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q = "", type } = await searchParams;
  const session = await auth();

  const { results } = await searchOpportunities({
    keywordQuery: q || undefined,
    filters: type ? { types: [type] } : undefined,
    pageSize: 24,
  });

  let matchByOpportunityId = new Map<string, ReturnType<typeof scoreOpportunity>>();
  if (session?.user) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const matchProfile = toMatchProfile(profile);
      matchByOpportunityId = new Map(
        results.map((r) => [r.opportunity.id, scoreOpportunity(matchProfile, toMatchOpportunity(r.opportunity))])
      );
    }
  }

  const missed = session?.user
    ? await findMissedOpportunities({
        userId: session.user.id,
        excludeIds: results.map((r) => r.opportunity.id),
        excludeTypes: type ? [type] : [],
        limit: 3,
      })
    : [];

  return (
    <div>
      <ConceptSwitcher active="c" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/c" labels={{ home: "Explore", search: "Browse", profile: "Your universe" }} />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <form action="/concepts/c/search" method="get" className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Browse the universe…" className="flex-1" />
          {type && <input type="hidden" name="type" value={type} />}
          <Button type="submit">Browse</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/concepts/c/search${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${!type ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground-muted"}`}
          >
            All
          </Link>
          {OPPORTUNITY_TYPES.map((t) => (
            <Link
              key={t}
              href={`/concepts/c/search?type=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${type === t ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground-muted"}`}
            >
              {OPPORTUNITY_TYPE_LABELS[t as OpportunityTypeValue]}
            </Link>
          ))}
        </div>

        <div className="mt-8">
          {results.length === 0 ? (
            <EmptyState title="Nothing here yet" description="Try a different field, stage, or search term." />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {results.map(({ opportunity }) => (
                <OpportunityTile
                  key={opportunity.id}
                  opportunity={opportunity}
                  matchScore={matchByOpportunityId.get(opportunity.id)?.score}
                />
              ))}
            </div>
          )}
        </div>

        {missed.length > 0 && (
          <div className="mt-10">
            <h2 className="font-display text-xl text-foreground">You might have missed this</h2>
            <p className="text-sm text-foreground-muted">
              Outside what you&apos;re browsing right now, but a strong fit for your goals.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {missed.map((m) => (
                <OpportunityTile
                  key={m.opportunity.id}
                  opportunity={m.opportunity}
                  matchScore={m.match.score}
                  reason={buildWhyNarrative(m.match)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
