import Link from "next/link";
import type { ConceptMatch, ConceptOpportunity } from "@/lib/concepts/types";
import { formatDeadlineLabel } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";

export function IntelRow({
  opportunity,
  match,
  selected,
  onToggleSelect,
}: {
  opportunity: ConceptOpportunity;
  match: ConceptMatch;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-4">
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(opportunity.id)}
          className="mt-1.5 h-4 w-4 shrink-0"
          aria-label={`Select ${opportunity.title} to compare`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <span className="font-mono uppercase tracking-wide">
            {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]}
          </span>
          <span>·</span>
          <span>{opportunity.organization}</span>
        </div>
        <Link
          href={`/concepts/b/opportunities/${opportunity.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {opportunity.title}
        </Link>
        <p className="mt-1 line-clamp-1 text-sm text-foreground-muted">{opportunity.shortDescription}</p>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
          <span>{formatDeadlineLabel(opportunity.deadline)}</span>
          <span>{opportunity.isFree ? "Free" : opportunity.cost || "Paid"}</span>
          {opportunity.remote && <span>Remote</span>}
        </div>
      </div>
      {match.score > 0 && (
        <div className="shrink-0 text-right">
          <div className="font-mono text-lg text-accent">{match.score}%</div>
          <div className="text-[10px] uppercase text-foreground-muted">match</div>
        </div>
      )}
    </div>
  );
}
