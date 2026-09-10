import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { runIngestion } from "@/lib/ingestion/pipeline";
import { ok, withErrorHandling } from "@/lib/api-response";
import { logger } from "@/lib/logger";

const runBodySchema = z.object({ manualReview: z.boolean().optional() });

export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await params;

    let manualReview = false;
    try {
      const body = await req.json();
      manualReview = runBodySchema.parse(body).manualReview ?? false;
    } catch {
      // No body / empty body is the normal case for a routine trigger — manualReview
      // defaults to false, which is required for anything but ALLOWED/ALLOWED_WITH_RESTRICTIONS.
    }

    if (manualReview) {
      // Explicit, logged, admin-initiated override — never set by a scheduler.
      logger.warn("ingestion.manual-review-override", "Admin triggered a manual-review override run", {
        sourceId: id,
        adminId: admin.id,
      });
    }

    const result = await runIngestion(id, { manualReview });
    return ok(result);
  }
);
