import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { signupSchema } from "@/lib/validation/auth";
import { ok, apiError, withErrorHandling } from "@/lib/api-response";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (!checkRateLimit(`signup:${ip}`, RATE_LIMITS.AUTH)) {
    return apiError("Too many attempts, please try again shortly", 429);
  }

  const body = await req.json();
  const input = signupSchema.parse(body);

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return apiError("An account with this email already exists", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      profile: { create: {} },
    },
    select: { id: true, email: true, name: true },
  });

  return ok(user, 201);
});
