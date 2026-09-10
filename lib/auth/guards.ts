import { auth } from "@/lib/auth";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/** Every mutating/personalized API route calls this first — never trusts client-supplied
 *  user ids, always re-derives identity from the server session. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("Authentication required", 401);
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("Admin access required", 403);
  return user;
}

export async function optionalUser() {
  const session = await auth();
  return session?.user ?? null;
}
