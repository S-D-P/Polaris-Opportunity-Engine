import { z } from "zod";
import { generateStructured } from "@/lib/ai/provider";
import { OPPORTUNITY_TYPES } from "@/lib/taxonomy";

const parsedQuerySchema = z.object({
  types: z.array(z.enum(OPPORTUNITY_TYPES)).max(21).optional(),
  countries: z.array(z.string()).max(20).optional(),
  remoteOnly: z.boolean().optional(),
  freeOnly: z.boolean().optional(),
  audience: z.array(z.string()).max(10).optional(),
  semanticQuery: z.string().max(300),
});

export type ParsedSearchQuery = z.infer<typeof parsedQuerySchema>;

/**
 * Parses a natural-language search query into structured filters + a cleaned semantic
 * string. This is intent *parsing* only — retrieval/ranking is done deterministically
 * (SQL filters + FTS + embedding similarity, see lib/search) per the requirement that
 * search not rely solely on an LLM. Falls back to treating the whole query as the
 * semantic string when AI is unavailable or fails.
 */
export async function parseSearchQuery(query: string): Promise<ParsedSearchQuery> {
  const fallback: ParsedSearchQuery = { semanticQuery: query };
  const result = await generateStructured({
    scope: "ai.query-parser",
    maxTokens: 400,
    system:
      "You convert a natural-language opportunity search query into structured filters " +
      "for a search system. Only set a field when the query clearly implies it.",
    prompt:
      `Query: "${query}"\n\n` +
      `Return a JSON object with: types (subset of ${OPPORTUNITY_TYPES.join(", ")}, ` +
      "omit if unclear), countries (string[] of country or region names mentioned), " +
      "remoteOnly (boolean, only if explicitly implied), freeOnly (boolean, only if " +
      '"fully funded"/"free"/"no cost" is implied), audience (string[] like ' +
      '"early-career", "undergraduate", "women", if mentioned), and semanticQuery ' +
      "(the query rewritten as a clean topical phrase for semantic matching, with " +
      "filter words like country/type/cost removed).",
    schema: parsedQuerySchema,
  });
  return result ?? fallback;
}
