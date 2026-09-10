"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Save/Interested/Applied/Completed actions on the opportunity detail screen. Uses the same
 * `POST /api/tracker` upsert-by-(userId, opportunityId) endpoint the tracker board's status
 * changes ultimately share a table with — TrackedOpportunity has a single unique constraint
 * per user+opportunity (prisma/schema.prisma), so there is exactly one row regardless of
 * which screen changed it, and reading either screen after a change always reflects the
 * other's update (docs/personalization.md's tracking-state-model notes).
 */
const ACTIONS: Array<{ status: string; label: string }> = [
  { status: "SAVED", label: "Save" },
  { status: "INTERESTED", label: "Interested" },
  { status: "APPLIED", label: "Applied" },
  { status: "COMPLETED", label: "Completed" },
];

export function TrackingActions({
  opportunityId,
  initialStatus,
}: {
  opportunityId: string;
  initialStatus: string | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function setTrackStatus(next: string) {
    const previous = status;
    // Clicking the already-active status un-saves it (removes tracking entirely) — matches
    // the existing SaveButton's toggle behavior for the SAVED case, extended consistently.
    const removing = status === next;
    setStatus(removing ? null : next);
    startTransition(async () => {
      try {
        if (removing) {
          await fetch("/api/tracker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opportunityId, status: "NOT_RELEVANT" }),
            keepalive: true,
          });
        } else {
          await fetch("/api/tracker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opportunityId, status: next }),
            keepalive: true,
          });
        }
        router.refresh();
      } catch {
        setStatus(previous);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((action) => {
        const active = status === action.status;
        return (
          <button
            key={action.status}
            type="button"
            disabled={isPending}
            onClick={() => setTrackStatus(action.status)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              active
                ? "border-accent bg-accent/15 text-accent"
                : "border-border bg-surface text-foreground-muted hover:border-accent hover:text-accent"
            }`}
          >
            {active ? `✓ ${action.label}` : action.label}
          </button>
        );
      })}
    </div>
  );
}
