import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth/guards";
import { logger } from "@/lib/logger";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json({ data }, { status: init ?? 200 });
}

export function apiError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { message, code } }, { status });
}

/** Wraps a route handler so every route gets the same error envelope for auth failures,
 *  validation failures, and unexpected errors, instead of each route hand-rolling it. */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return apiError(err.message, err.status, "AUTH_ERROR");
      }
      if (err instanceof ZodError) {
        return apiError("Invalid request", 400, "VALIDATION_ERROR");
      }
      logger.error("api", "Unhandled route error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return apiError("Internal server error", 500, "INTERNAL_ERROR");
    }
  };
}
