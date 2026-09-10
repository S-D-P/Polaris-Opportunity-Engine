import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { runFreshnessSweep, verifySchedulerSecret } from "@/lib/ingestion/freshness";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";
import { logger } from "@/lib/logger";

/**
 * SYSTEM-only endpoint for Cloud Scheduler (docs/agent-architecture.md's sibling doc,
 * docs/security-audit.md's Ingestion security section). The Cloud Run service itself is
 * deployed `--allow-unauthenticated` (required for public browsing/search), so this route
 * enforces its own authentication rather than relying on platform-level ingress — a shared
 * secret (`INTERNAL_SCHEDULER_SECRET`, Secret Manager) compared against the request's
 * `Authorization: Bearer <secret>` header. Never triggerable by a normal user request: no
 * session cookie or user role grants access here, only the exact secret.
 *
 * Deliberately narrow: runs only the fast, local, no-external-fetch freshness sweep
 * (`lib/ingestion/freshness.ts`'s `runFreshnessSweep`) — a DB read plus a handful of status
 * updates, safely inside Cloud Run's request timeout. Scheduled *ingestion* (external fetches
 * + Gemini calls across ~24 sources) is deliberately NOT wired to this same pattern — running
 * every active source sequentially in one HTTP request risks exceeding the deployed 60s Cloud
 * Run timeout; see docs/scalability.md for the documented next step (Cloud Run Jobs or a
 * Cloud Tasks queue) rather than forcing something that could time out unpredictably.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const provided = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!verifySchedulerSecret(process.env.INTERNAL_SCHEDULER_SECRET, provided)) {
    logger.warn("internal.freshness", "Rejected freshness sweep request: missing or invalid scheduler secret");
    return apiError("Unauthorized", 401);
  }

  const result = await runFreshnessSweep(prisma);
  logger.info("internal.freshness", "Freshness sweep completed", {
    checked: result.checked,
    transitioned: result.transitioned,
  });
  return ok(result);
});
