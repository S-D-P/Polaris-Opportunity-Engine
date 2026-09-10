import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { buildWhyNarrative } from "@/lib/matching/narrative";
import { formatDeadlineLabel, getDeadlineAction } from "@/lib/deadline";
import { fromJsonArray } from "@/lib/db/json";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function ConceptADetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  const session = await auth();
  let narrative =
    "Log in to see why Polaris would (or wouldn't) point you toward this one specifically.";
  let scorePct: number | null = null;

  if (session?.user) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const match = scoreOpportunity(toMatchProfile(profile), toMatchOpportunity(opportunity));
      narrative = buildWhyNarrative(match);
      scorePct = match.eligible ? match.score : null;
    }
  }

  const action = getDeadlineAction(opportunity.deadline);
  const benefits = fromJsonArray(opportunity.benefits);

  return (
    <div>
      <ConceptSwitcher active="a" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/a" labels={{ home: "Compass", search: "Ask", profile: "You" }} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium text-foreground-muted">
          {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]} ·{" "}
          {opportunity.organization}
        </p>
        <h1 className="mt-1 font-display text-3xl text-foreground">{opportunity.title}</h1>

        <div className="mt-6 rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-6">
          <div className="flex items-start gap-4">
            {scorePct != null && (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface font-display text-accent">
                {scorePct}%
              </div>
            )}
            <p className="font-display text-lg leading-snug text-foreground">{narrative}</p>
          </div>
        </div>

        {action && (
          <p className="mt-4 rounded-lg bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            {action}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <ButtonLink href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer">
            Apply on {opportunity.organization}&apos;s site ↗
          </ButtonLink>
          <ButtonLink href={`/opportunities/${opportunity.id}`} variant="outline">
            Full details (real app) →
          </ButtonLink>
        </div>

        <p className="mt-8 whitespace-pre-line text-foreground-muted">{opportunity.description}</p>

        {benefits.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {benefits.map((b) => (
              <Badge key={b} tone="accent">
                {b}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-foreground-muted">{formatDeadlineLabel(opportunity.deadline)}</p>

        <p className="mt-10 text-xs text-foreground-muted">
          Source:{" "}
          <Link href={opportunity.sourceUrl} target="_blank" className="underline">
            {opportunity.sourceName}
          </Link>
        </p>
      </div>
    </div>
  );
}
