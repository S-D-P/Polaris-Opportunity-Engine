import Link from "next/link";
import type { ConceptOpportunity } from "@/lib/concepts/types";
import { paletteFor } from "@/lib/concepts/palette";
import { formatDeadlineLabel } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";

export function OpportunityTile({
  opportunity,
  matchScore,
  reason,
}: {
  opportunity: ConceptOpportunity;
  matchScore?: number | null;
  reason?: string;
}) {
  return (
    <Link
      href={`/concepts/c/opportunities/${opportunity.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-shadow hover:shadow-lg"
    >
      <div className={`h-20 bg-gradient-to-br ${paletteFor(opportunity.opportunityType)} p-3`}>
        <span className="rounded-full bg-white/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-foreground-muted">{opportunity.organization}</p>
        <h3 className="mt-1 font-display text-base leading-snug text-foreground group-hover:text-primary">
          {opportunity.title}
        </h3>
        <p className="mt-2 text-xs text-foreground-muted">{formatDeadlineLabel(opportunity.deadline)}</p>
        {typeof matchScore === "number" && matchScore > 0 && (
          <p className="mt-1 text-xs font-medium text-accent">{matchScore}% match</p>
        )}
        {reason && <p className="mt-2 text-xs italic text-foreground-muted">{reason}</p>}
      </div>
    </Link>
  );
}
