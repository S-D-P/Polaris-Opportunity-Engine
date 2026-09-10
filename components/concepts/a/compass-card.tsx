import Link from "next/link";
import type { ConceptMatch, ConceptOpportunity } from "@/lib/concepts/types";
import { buildWhyNarrative } from "@/lib/matching/narrative";
import { formatDeadlineLabel, getDeadlineAction } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";

export function CompassCard({
  opportunity,
  match,
  compact = false,
}: {
  opportunity: ConceptOpportunity;
  match: ConceptMatch;
  compact?: boolean;
}) {
  const action = getDeadlineAction(opportunity.deadline);

  return (
    <Link
      href={`/concepts/a/opportunities/${opportunity.id}`}
      className="block rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-foreground-muted">
            {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]} ·{" "}
            {opportunity.organization}
          </p>
          <h3 className="mt-1 font-display text-lg text-foreground">{opportunity.title}</h3>
        </div>
        {match.score > 0 && <div className="shrink-0 font-display text-xl text-accent">{match.score}%</div>}
      </div>

      <p className="mt-2 text-sm text-foreground-muted">{buildWhyNarrative(match)}</p>

      {!compact && (
        <p className="mt-3 text-xs text-foreground-muted">{formatDeadlineLabel(opportunity.deadline)}</p>
      )}
      {action && <p className="mt-1 text-xs font-medium text-primary">{action}</p>}
    </Link>
  );
}
