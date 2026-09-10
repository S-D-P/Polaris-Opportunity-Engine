import type { ComplianceStatus, SourceComplianceRecord } from "@prisma/client";

/**
 * The compliance gate (docs/ingestion-roadmap.md Part 4). Every ingestion run must pass
 * through this before an adapter's `fetchRaw` is ever called — see
 * `lib/ingestion/pipeline.ts`. This module is pure/DB-free so its rules are unit-testable
 * without touching Prisma.
 *
 * Hard rules, not preferences:
 * - `NOT_ALLOWED` never runs, under any circumstance, including a manual-review override.
 * - Missing compliance data (no record at all) is treated exactly like
 *   `UNCLEAR_REQUIRES_REVIEW` — fail closed, never assume permission by default.
 * - `UNCLEAR_REQUIRES_REVIEW` only runs via an explicit, logged manual-review action —
 *   never automatically (never from a scheduler or a routine trigger).
 * - `ALLOWED` and `ALLOWED_WITH_RESTRICTIONS` run automatically.
 */

export interface ComplianceGateResult {
  allowed: boolean;
  status: ComplianceStatus | "NO_RECORD";
  reason: string;
}

export function evaluateComplianceGate(
  record: Pick<SourceComplianceRecord, "automatedAccessStatus" | "rateLimit"> | null,
  opts: { manualReview?: boolean } = {}
): ComplianceGateResult {
  if (!record) {
    return {
      allowed: false,
      status: "NO_RECORD",
      reason:
        "No compliance record exists for this source. Automated collection cannot proceed " +
        "without a documented robots.txt/ToS/API review — see docs/ingestion-roadmap.md Part 4.",
    };
  }

  switch (record.automatedAccessStatus) {
    case "NOT_ALLOWED":
      return {
        allowed: false,
        status: "NOT_ALLOWED",
        reason:
          "This source's compliance record marks automated access as NOT_ALLOWED. This is " +
          "never overridable, including by manual review — see docs/source-compliance.md.",
      };
    case "UNCLEAR_REQUIRES_REVIEW":
      if (opts.manualReview) {
        return {
          allowed: true,
          status: "UNCLEAR_REQUIRES_REVIEW",
          reason: "Running via an explicit, logged manual-review override — not eligible for automatic/scheduled runs.",
        };
      }
      return {
        allowed: false,
        status: "UNCLEAR_REQUIRES_REVIEW",
        reason:
          "This source's automated-access status is unclear and requires human review before " +
          "it can run. It will not run automatically or on a schedule.",
      };
    case "ALLOWED":
    case "ALLOWED_WITH_RESTRICTIONS":
      return {
        allowed: true,
        status: record.automatedAccessStatus,
        reason:
          record.automatedAccessStatus === "ALLOWED_WITH_RESTRICTIONS"
            ? `Allowed with restrictions${record.rateLimit ? ` (rate limit: ${record.rateLimit})` : ""}.`
            : "Allowed.",
      };
  }
}
