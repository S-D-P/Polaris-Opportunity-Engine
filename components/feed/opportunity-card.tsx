import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SaveButton } from "@/components/feed/save-button";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import { formatDeadlineLabel, getDeadlineUrgency } from "@/lib/deadline";

export interface OpportunityCardData {
  id: string;
  title: string;
  organization: string;
  opportunityType: string;
  location?: string | null;
  remote: boolean;
  hybrid: boolean;
  inPerson: boolean;
  deadline: string | Date | null;
  deadlineType?: string | null;
  eligibilitySummary?: string | null;
  isFree: boolean;
  cost?: string | null;
  aiSummary?: string | null;
  shortDescription: string;
  isSeedData?: boolean;
}

export function OpportunityCard({
  opportunity,
  matchScore,
  matchReasons,
  showSave = false,
  savedInitially = false,
  href,
}: {
  opportunity: OpportunityCardData;
  matchScore?: number | null;
  matchReasons?: string[];
  showSave?: boolean;
  savedInitially?: boolean;
  href?: string;
}) {
  const urgency = getDeadlineUrgency(opportunity.deadline);
  const modeLabel = opportunity.remote
    ? "Remote"
    : opportunity.hybrid
      ? "Hybrid"
      : opportunity.inPerson
        ? "In-person"
        : null;

  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
            <span className="font-medium text-primary">
              {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue] ??
                opportunity.opportunityType}
            </span>
            <span aria-hidden>·</span>
            <span>{opportunity.organization}</span>
            {opportunity.isSeedData && (
              <Badge tone="neutral" className="ml-1">
                Demo data
              </Badge>
            )}
          </div>
          <Link href={href ?? `/opportunities/${opportunity.id}`} className="group">
            <h3 className="mt-1 font-display text-lg leading-snug text-foreground group-hover:text-primary">
              {opportunity.title}
            </h3>
          </Link>
        </div>

        {typeof matchScore === "number" && (
          <div className="flex shrink-0 flex-col items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-2 text-center">
            <span className="font-display text-lg leading-none text-accent">{matchScore}%</span>
            <span className="text-[10px] uppercase tracking-wide text-foreground-muted">Match</span>
          </div>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-foreground-muted">
        {opportunity.aiSummary || opportunity.shortDescription}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {modeLabel && <Badge tone="neutral">{modeLabel}</Badge>}
        {opportunity.location && opportunity.location !== modeLabel && (
          <Badge tone="neutral">{opportunity.location}</Badge>
        )}
        <Badge tone={opportunity.isFree ? "success" : "warning"}>
          {opportunity.isFree ? "Free" : opportunity.cost || "Paid"}
        </Badge>
        <Badge
          tone={
            urgency === "expired"
              ? "neutral"
              : urgency === "today" || urgency === "soon"
                ? "danger"
                : urgency === "this-week"
                  ? "warning"
                  : "neutral"
          }
        >
          {formatDeadlineLabel(opportunity.deadline, opportunity.deadlineType)}
        </Badge>
      </div>

      {matchReasons && matchReasons.length > 0 && (
        <div className="mt-4 rounded-lg bg-surface-muted p-3">
          <p className="mb-1.5 text-xs font-semibold text-foreground">Why this matches you</p>
          <ul className="space-y-1">
            {matchReasons.map((reason) => (
              <li key={reason} className="flex gap-1.5 text-xs text-foreground-muted">
                <span className="text-accent">•</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <Link
          href={href ?? `/opportunities/${opportunity.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          View details →
        </Link>
        {showSave && <SaveButton opportunityId={opportunity.id} initialSaved={savedInitially} />}
      </div>
    </Card>
  );
}
