import type { DeadlineType, OpportunityStatus, PrismaClient } from "@prisma/client";

/**
 * Freshness / lifecycle logic (docs/ingestion-roadmap.md Part 11). Two entry points:
 *  - `deriveDeadlineStatus` — pure date-only inference, used by the scheduled sweep
 *    (scripts/refresh-freshness.ts) for opportunities that were never re-fetched.
 *  - `computeRefetchUpdate` — used by the pipeline when a re-fetch matches an existing
 *    opportunity (a duplicate hit), where the source itself is the signal, not just the
 *    calendar — so it's allowed to reopen a CLOSED/EXPIRED record on a new future deadline,
 *    which the date-only sweep must never do on its own.
 */

const EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface DeadlineStatusInput {
  deadline: Date | null;
  currentStatus: OpportunityStatus;
  now?: Date;
}

/**
 * Derives the deadline-driven status for an opportunity. Only ever moves between
 * OPEN / CLOSING_SOON / EXPIRED — never touches DRAFT (not yet published) or CLOSED (an
 * explicit statement from the source/admin that date inference must not silently overwrite;
 * that's the entire reason EXPIRED exists as distinct from CLOSED). Returns null when no
 * transition applies.
 */
export function deriveDeadlineStatus({
  deadline,
  currentStatus,
  now = new Date(),
}: DeadlineStatusInput): OpportunityStatus | null {
  if (currentStatus === "DRAFT" || currentStatus === "CLOSED") return null;
  if (!deadline) return null;

  const msRemaining = deadline.getTime() - now.getTime();
  let next: OpportunityStatus;
  if (msRemaining < 0) {
    next = "EXPIRED";
  } else if (msRemaining <= EXPIRING_SOON_WINDOW_MS) {
    next = "CLOSING_SOON";
  } else {
    next = "OPEN";
  }
  return next === currentStatus ? null : next;
}

export interface RefetchDiffInput {
  existing: { status: OpportunityStatus; deadline: Date | null; description: string };
  incoming: { deadline: Date | null; description: string };
  now?: Date;
}

export interface RefetchDiffResult {
  changed: boolean;
  deadline?: Date | null;
  deadlineType?: DeadlineType;
  description?: string;
  status?: OpportunityStatus;
  verifiedAt: Date;
}

/**
 * Applied when a re-fetch matches an already-stored opportunity. `verifiedAt` is always
 * set to `now` — a matched re-fetch is exactly the "re-fetch confirms the listing is still
 * live" case `verifiedAt` exists to capture, distinct from `lastCheckedAt` which the caller
 * bumps on every attempt regardless of outcome.
 */
export function computeRefetchUpdate({
  existing,
  incoming,
  now = new Date(),
}: RefetchDiffInput): RefetchDiffResult {
  const result: RefetchDiffResult = { changed: false, verifiedAt: now };

  if ((incoming.deadline?.getTime() ?? null) !== (existing.deadline?.getTime() ?? null)) {
    result.deadline = incoming.deadline;
    // A newly-parsed real date is deterministically FIXED regardless of what the source's
    // free text previously implied (docs/personalization.md) — only relevant when a date
    // now exists; a re-fetch that loses its date doesn't downgrade an already-FIXED type.
    if (incoming.deadline) result.deadlineType = "FIXED";
    result.changed = true;
  }
  if (incoming.description && incoming.description !== existing.description) {
    result.description = incoming.description;
    result.changed = true;
  }

  const effectiveDeadline = result.deadline !== undefined ? result.deadline : existing.deadline;
  const reopening =
    (existing.status === "CLOSED" || existing.status === "EXPIRED") &&
    effectiveDeadline != null &&
    effectiveDeadline.getTime() > now.getTime();

  if (reopening) {
    result.status = "OPEN";
    result.changed = true;
  } else {
    const derived = deriveDeadlineStatus({ deadline: effectiveDeadline, currentStatus: existing.status, now });
    if (derived) {
      result.status = derived;
      result.changed = true;
    }
  }

  return result;
}

/**
 * Pure auth check for the Cloud Scheduler-facing endpoint (app/api/internal/freshness/route.ts)
 * — extracted so it's testable without importing the Next.js route module itself (which pulls
 * in next-auth's server-only import chain and can't load under Vitest's environment). Rejects
 * whenever the secret isn't configured at all, not just when it doesn't match — an unconfigured
 * secret must never be treated as "no auth required."
 */
export function verifySchedulerSecret(configured: string | undefined, provided: string | null | undefined): boolean {
  return Boolean(configured) && Boolean(provided) && provided === configured;
}

export interface FreshnessSweepResult {
  checked: number;
  transitioned: number;
  transitions: { id: string; from: OpportunityStatus; to: OpportunityStatus }[];
}

/**
 * Shared implementation for `scripts/refresh-freshness.ts` (manual/local) and
 * `app/api/internal/freshness/route.ts` (Cloud Scheduler) — one date-only sweep, two callers.
 * Deliberately the same date-based logic `checkEligibility` also applies at recommendation
 * time (lib/matching/eligibility.ts) — this sweep keeps `status` itself accurate for
 * display/sorting/admin visibility; it's a second, independent guarantee, not the only one.
 */
export async function runFreshnessSweep(prisma: PrismaClient): Promise<FreshnessSweepResult> {
  const candidates = await prisma.opportunity.findMany({
    where: { status: { in: ["OPEN", "CLOSING_SOON", "EXPIRED"] } },
    select: { id: true, status: true, deadline: true },
  });

  const transitions: FreshnessSweepResult["transitions"] = [];
  for (const opp of candidates) {
    const next = deriveDeadlineStatus({ deadline: opp.deadline, currentStatus: opp.status });
    if (next) {
      await prisma.opportunity.update({ where: { id: opp.id }, data: { status: next } });
      transitions.push({ id: opp.id, from: opp.status, to: next });
    }
  }

  return { checked: candidates.length, transitioned: transitions.length, transitions };
}
