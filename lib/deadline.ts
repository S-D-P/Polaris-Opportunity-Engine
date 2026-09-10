const DAY_MS = 1000 * 60 * 60 * 24;

export type DeadlineUrgency = "expired" | "today" | "soon" | "this-week" | "this-month" | "later" | "none";

export function getDeadlineUrgency(deadline: Date | string | null): DeadlineUrgency {
  if (!deadline) return "none";
  const d = new Date(deadline);
  const days = Math.floor((d.getTime() - Date.now()) / DAY_MS);
  if (days < 0) return "expired";
  if (days === 0) return "today";
  if (days <= 3) return "soon";
  if (days <= 7) return "this-week";
  if (days <= 30) return "this-month";
  return "later";
}

/**
 * `deadlineType` (Opportunity.deadlineType — FIXED/ROLLING/ONGOING/NOT_STATED, see
 * docs/personalization.md) disambiguates *why* there's no date: labeling every null deadline
 * "Rolling" regardless of type was a real bug — a source that simply never mentioned timing
 * (NOT_STATED) is not the same claim as one that explicitly said "rolling admissions".
 */
export function formatDeadlineLabel(
  deadline: Date | string | null,
  deadlineType?: string | null
): string {
  if (!deadline) {
    if (deadlineType === "ROLLING") return "Rolling admissions";
    if (deadlineType === "ONGOING") return "Ongoing — no application deadline";
    return "No deadline listed";
  }
  const d = new Date(deadline);
  const days = Math.floor((d.getTime() - Date.now()) / DAY_MS);
  const absolute = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (days < 0) return `Deadline passed · ${absolute}`;
  if (days === 0) return `Deadline today · ${absolute}`;
  if (days === 1) return `Deadline tomorrow · ${absolute}`;
  if (days <= 30) return `Deadline in ${days} days · ${absolute}`;
  return `Deadline ${absolute}`;
}

export function isExpired(deadline: Date | string | null): boolean {
  return getDeadlineUrgency(deadline) === "expired";
}

export function getDaysRemaining(deadline: Date | string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  return Math.floor((d.getTime() - Date.now()) / DAY_MS);
}

/**
 * Turns deadline urgency into an actionable prompt rather than a passive date (brief §5.5
 * "deadline intelligence") — deterministic, no notification infra required. Used by the
 * /concepts prototypes; the production deadline badge (formatDeadlineLabel) is untouched.
 */
export function getDeadlineAction(deadline: Date | string | null): string | null {
  const days = getDaysRemaining(deadline);
  if (days == null || days < 0) return null;
  if (days === 0) return "Last chance — applications close today";
  if (days <= 2) return `Only ${days} day${days === 1 ? "" : "s"} left — apply now`;
  if (days <= 9) return "You should start this application this week";
  if (days <= 16) return "You should start this application this weekend";
  if (days <= 30) return "Worth blocking time for in the next couple of weeks";
  return "Plenty of time — good to bookmark and revisit";
}
