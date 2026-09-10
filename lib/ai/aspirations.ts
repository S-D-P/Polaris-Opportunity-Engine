import { z } from "zod";
import { generateStructured } from "@/lib/ai/provider";

const aspirationSchema = z.object({
  summary: z.string().max(300),
  goalTags: z.array(z.string()).max(10),
});

export type AspirationExtraction = z.infer<typeof aspirationSchema>;

/**
 * Turns a user's free-text "where I want to go" answer into a normalized one-sentence
 * goal statement + short tags used by the matching engine's goal_score. The raw text
 * remains the stored source of truth (lib/validation/profile.ts) — this is a derived,
 * best-effort structuring, not a replacement.
 */
export async function extractAspiration(rawText: string): Promise<AspirationExtraction | null> {
  if (!rawText.trim()) return null;
  return generateStructured({
    scope: "ai.aspirations",
    maxTokens: 400,
    system:
      "You extract a normalized goal statement and short topic tags from a person's " +
      "free-text description of their career/education aspirations, for matching them " +
      "to relevant opportunities. Do not add goals the person didn't state.",
    prompt:
      `Aspiration text: "${rawText.slice(0, 1500)}"\n\n` +
      "Return a JSON object with: summary (one sentence, normalized, third-person, e.g. " +
      '"Wants to build a career combining AI/ML engineering and public policy"), and ' +
      "goalTags (string[], up to 10 short topic/field tags this person's goal touches).",
    schema: aspirationSchema,
  });
}
