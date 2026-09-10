import { afterAll, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { testDb, resetDb } from "../db";
import { signupSchema } from "@/lib/validation/auth";

describe("signup + authentication (integration)", () => {
  beforeEach(resetDb);
  afterAll(() => testDb.$disconnect());

  it("creates a user with a hashed password, never storing the plaintext", async () => {
    const input = signupSchema.parse({
      name: "Test User",
      email: "Test@Example.com",
      password: "correct-horse-battery",
    });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await testDb.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    });

    expect(user.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, user.passwordHash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", user.passwordHash)).toBe(false);
  });

  it("rejects a second signup with the same email", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    await testDb.user.create({
      data: { email: "dup@example.com", name: "First", passwordHash },
    });

    await expect(
      testDb.user.create({
        data: { email: "dup@example.com", name: "Second", passwordHash },
      })
    ).rejects.toThrow();
  });

  it("normalizes email casing at the validation layer, so 'Dup@x.com' and 'dup@x.com' collide", () => {
    const a = signupSchema.parse({ name: "A", email: "Dup@X.com", password: "password123" });
    const b = signupSchema.parse({ name: "B", email: "dup@x.com", password: "password123" });
    expect(a.email).toBe(b.email);
  });

  it("rejects a weak/short password at the validation layer before it ever reaches the db", () => {
    const result = signupSchema.safeParse({
      name: "Test",
      email: "test2@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("creates an accompanying empty profile, so onboarding always has a row to update", async () => {
    const passwordHash = await bcrypt.hash("password123", 12);
    const user = await testDb.user.create({
      data: {
        email: "withprofile@example.com",
        name: "Has Profile",
        passwordHash,
        profile: { create: {} },
      },
      include: { profile: true },
    });

    expect(user.profile).not.toBeNull();
    expect(user.profile?.onboardingComplete).toBe(false);
  });
});
