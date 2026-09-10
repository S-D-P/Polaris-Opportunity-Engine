import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { formatDeadlineLabel } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import { paletteFor } from "@/lib/concepts/palette";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { OpportunityTile } from "@/components/concepts/c/opportunity-tile";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";

export default async function ConceptCDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  const session = await auth();
  let matchScore: number | null = null;
  if (session?.user) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const match = scoreOpportunity(toMatchProfile(profile), toMatchOpportunity(opportunity));
      matchScore = match.eligible ? match.score : null;
    }
  }

  const categories = fromJsonArray(opportunity.categories);
  const fields = fromJsonArray(opportunity.fields);
  const universeTags = [...categories, ...fields];

  const candidates = await prisma.opportunity.findMany({
    where: { status: { in: ["OPEN", "CLOSING_SOON"] }, id: { not: opportunity.id } },
    take: 100,
    orderBy: { dateDiscovered: "desc" },
  });
  const related = candidates
    .filter((c) => {
      const cTags = [...fromJsonArray(c.categories), ...fromJsonArray(c.fields)];
      return cTags.some((t) => universeTags.map((u) => u.toLowerCase()).includes(t.toLowerCase()));
    })
    .slice(0, 4);

  return (
    <div>
      <ConceptSwitcher active="c" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/c" labels={{ home: "Explore", search: "Browse", profile: "Your universe" }} />
        </div>
      </div>

      <div className={`bg-gradient-to-br ${paletteFor(opportunity.opportunityType)} px-4 py-10 text-white sm:px-6`}>
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
            {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]} · {opportunity.organization}
          </p>
          <h1 className="mt-1 font-display text-3xl">{opportunity.title}</h1>
          {matchScore != null && <p className="mt-2 text-sm">{matchScore}% match to your universe</p>}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-sm font-medium text-foreground">This belongs to</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {universeTags.map((t) => (
            <Badge key={t} tone="accent">
              {t}
            </Badge>
          ))}
        </div>

        <p className="mt-6 whitespace-pre-line text-foreground-muted">{opportunity.description}</p>
        <p className="mt-4 text-sm font-medium text-foreground">{formatDeadlineLabel(opportunity.deadline)}</p>

        <ButtonLink href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer" className="mt-6">
          Apply ↗
        </ButtonLink>

        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-xl text-foreground">Nearby in this universe</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {related.map((r) => (
                <OpportunityTile key={r.id} opportunity={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
