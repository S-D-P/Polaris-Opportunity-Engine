import Link from "next/link";
import type { PathStep } from "@/lib/concepts/path";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";

export function PathTimeline({ steps }: { steps: PathStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        Your path: a suggested order through your own matches
      </p>
      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => (
          <li key={step.opportunity.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
            </div>
            <div className="pb-2">
              <p className="text-xs font-medium text-foreground-muted">{step.stageLabel}</p>
              <Link
                href={`/concepts/a/opportunities/${step.opportunity.id}`}
                className="font-medium text-foreground hover:text-primary"
              >
                {step.opportunity.title}
              </Link>
              <p className="text-xs text-foreground-muted">
                {OPPORTUNITY_TYPE_LABELS[step.opportunity.opportunityType as OpportunityTypeValue]} ·{" "}
                {step.match.score}% match
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
