import { GoogleGenAI } from "@google/genai";
import type { ZodType } from "zod";
import { logger } from "@/lib/logger";

/**
 * AI provider — Google Gemini via Vertex AI (docs/implementation-status.md). Uses
 * Application Default Credentials, never a hardcoded key: locally via
 * `gcloud auth application-default login`, on Cloud Run via the service account identity.
 * `GOOGLE_CLOUD_PROJECT` must be set; `GOOGLE_CLOUD_LOCATION` defaults to us-central1.
 *
 * This module is the entire AI-provider abstraction every caller (`lib/ai/extraction.ts`,
 * the query parser, aspirations parsing, etc.) goes through — swapping the model provider
 * here changes nothing about the public API (`generateStructured`, `isAiAvailable`), so no
 * caller needed to change.
 */
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  // Tests must never make live Gemini calls (see isAiAvailable) — checked here too, not just
  // there, since this is the function that actually reaches the network.
  if (process.env.VITEST) return null;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) return null;
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project,
      location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    });
  }
  return client;
}

export function isAiAvailable(): boolean {
  // Tests must never make live Gemini calls — real network round-trips turned a ~10s suite
  // into 5+ minutes and caused real timeouts once Vertex AI became genuinely reachable
  // (docs/data-architecture.md). Every test's expected behavior is already "AI unavailable,
  // degrade gracefully", so this restores that deterministically. `process.env.VITEST` is set
  // by Vitest itself for any code running under it — unlike deleting GOOGLE_CLOUD_PROJECT in a
  // setup file, this doesn't depend on setupFiles' per-file execution timing (which turned out
  // not to be guaranteed the way it looked — see the git history on this file for the debugging).
  if (process.env.VITEST) return false;
  return Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/**
 * Calls Gemini with a system+user prompt and validates the JSON response against `schema`.
 * Returns null (never throws to the caller) on missing project config, an ADC/auth failure,
 * malformed JSON, or schema validation failure — every caller must have a defined fallback
 * for "AI unavailable" per the product requirement that AI failures degrade gracefully rather
 * than crash a pipeline or fabricate data (docs/ingestion-roadmap.md).
 *
 * `responseMimeType: "application/json"` asks Gemini for JSON directly (real structured
 * output, not just a prompt instruction) — the zod validation below is still the safety net,
 * since a schema-conformant-looking response can still be semantically wrong.
 */
export async function generateStructured<T>(opts: {
  scope: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
}): Promise<T | null> {
  const gemini = getClient();
  if (!gemini) {
    logger.warn(opts.scope, "AI provider unavailable: GOOGLE_CLOUD_PROJECT not set");
    return null;
  }

  try {
    const response = await gemini.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        maxOutputTokens: opts.maxTokens ?? 1024,
        // gemini-2.5-flash spends part of maxOutputTokens on an internal "thinking" pass by
        // default, which was silently eating into the budget meant for the actual JSON
        // response and truncating it mid-string. These are plain structured-extraction
        // calls, not multi-step reasoning tasks, so thinking is disabled outright — faster,
        // cheaper, and the actual failure mode this fixes.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const text = response.text;
    if (!text) {
      logger.error(opts.scope, "Gemini response contained no text");
      return null;
    }

    const jsonText = extractJson(text);
    const parsed = JSON.parse(jsonText);
    const result = opts.schema.safeParse(parsed);
    if (!result.success) {
      logger.error(opts.scope, "AI response failed schema validation", {
        issues: result.error.issues.map((i) => i.message),
      });
      return null;
    }
    return result.data;
  } catch (err) {
    logger.error(opts.scope, "AI request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// Gemini generally honors responseMimeType, but models sometimes wrap JSON in prose or code
// fences anyway — pull out the first well-formed-looking JSON object/array rather than
// failing on decoration (same tolerant behavior as before the provider swap).
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.search(/[[{]/);
  if (start === -1) return text.trim();
  return text.slice(start).trim();
}
