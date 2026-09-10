import type { Opportunity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { searchFts } from "@/lib/search/fts";
import { cosineSimilarity, embedText, jsonToEmbedding } from "@/lib/ai/embeddings";
import { fromJsonArray } from "@/lib/db/json";

export interface SearchFilters {
  types?: string[];
  countries?: string[];
  remote?: boolean;
  hybrid?: boolean;
  inPerson?: boolean;
  isFree?: boolean;
  deadlineBefore?: Date;
  includeClosed?: boolean;
}

export interface SearchParams {
  keywordQuery?: string;
  semanticQuery?: string;
  filters?: SearchFilters;
  sort?: "deadline" | "recent"; // only these two are actually implemented — see lib/validation/opportunity.ts
  page?: number;
  pageSize?: number;
}

export interface RankedOpportunity {
  opportunity: Opportunity;
  relevance: number; // 0-1, only meaningful when a query was supplied
}

/**
 * Hybrid search: SQL filters narrow the candidate set (a hard constraint, never a ranking
 * signal that can be "talked around" by relevance), then Postgres full-text keyword rank and
 * embedding cosine similarity are blended for the final order when a query is present
 * (docs/architecture.md §6). With no query, results are sorted deterministically by deadline
 * or by discovery recency.
 */
export async function searchOpportunities(
  params: SearchParams
): Promise<{ results: RankedOpportunity[]; total: number }> {
  const { filters = {}, sort = "recent", page = 1, pageSize = 20 } = params;

  const where: Prisma.OpportunityWhereInput = {
    status: filters.includeClosed ? undefined : { in: ["OPEN", "CLOSING_SOON"] },
    // Demo/seed fixtures (prisma/seed.ts) exist for tests, evaluation, and local development —
    // never in normal user-facing discovery (docs/personalization.md). Admin's own queries
    // (app/api/admin/opportunities) are separate and unaffected by this filter.
    isSeedData: false,
    // COURSE is the pipeline's fallback classification when Gemini extraction fails entirely
    // (lib/ingestion/pipeline.ts) — combined with NEEDS_REVIEW (extraction genuinely failed,
    // not just low-confidence), this specific pairing is where mistitled/non-opportunity
    // items were actually found (e.g. a blog post landing as "Course / Program"). Excluding
    // only this exact combination, not all NEEDS_REVIEW, keeps genuinely low-confidence-but-
    // correctly-typed items in discovery while keeping out the fallback-default class.
    NOT: { opportunityType: "COURSE", verificationStatus: "NEEDS_REVIEW" },
  };
  if (filters.types && filters.types.length > 0) {
    where.opportunityType = { in: filters.types as Opportunity["opportunityType"][] };
  }
  if (filters.remote) where.remote = true;
  if (filters.hybrid) where.hybrid = true;
  if (filters.inPerson) where.inPerson = true;
  if (filters.isFree) where.isFree = true;
  if (filters.deadlineBefore) where.deadline = { lte: filters.deadlineBefore };
  if (filters.countries && filters.countries.length > 0) {
    where.OR = filters.countries.map((c) => ({ countries: { contains: c } }));
  }

  const hasQuery = Boolean((params.keywordQuery || params.semanticQuery || "").trim());

  if (!hasQuery) {
    const orderBy: Prisma.OpportunityOrderByWithRelationInput =
      sort === "deadline" ? { deadline: "asc" } : { dateDiscovered: "desc" };
    const [rows, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.opportunity.count({ where }),
    ]);
    return { results: rows.map((o) => ({ opportunity: o, relevance: 0 })), total };
  }

  // Query present: pull a bounded candidate set matching filters, rank in-process.
  const candidates = await prisma.opportunity.findMany({
    where,
    take: 500,
    orderBy: { dateDiscovered: "desc" },
  });

  const keywordHits = await searchFts(params.keywordQuery || params.semanticQuery || "", 500);
  const keywordRank = new Map(keywordHits.map((h, i) => [h.id, 1 - i / Math.max(keywordHits.length, 1)]));

  const semanticText = params.semanticQuery || params.keywordQuery || "";
  const queryEmbedding = embedText(semanticText);
  // A single-token query has exactly one nonzero dimension in its (normalized) hashed
  // embedding, so a random hash-bucket collision with an unrelated word can alone produce
  // a deceptively high cosine similarity (verified empirically — a nonsense one-word query
  // was matching a real opportunity purely by hash collision). Multi-token queries don't
  // have this problem: a spurious collision on one token gets diluted by the rest. So for
  // single-token queries, only trust the semantic score above a much higher bar; a
  // genuine short query about content that actually exists still gets found via the FTS
  // keyword half regardless.
  const queryTokenCount = semanticText.trim().split(/\s+/).filter(Boolean).length;
  const semanticTrustThreshold = queryTokenCount >= 2 ? 0 : 0.5;

  const scored = candidates.map((opp) => {
    const kw = keywordRank.get(opp.id) ?? 0;
    const oppEmbedding = jsonToEmbedding(opp.embedding);
    const rawSemantic = oppEmbedding ? Math.max(0, cosineSimilarity(queryEmbedding, oppEmbedding)) : 0;
    const semantic = rawSemantic >= semanticTrustThreshold ? rawSemantic : 0;
    const relevance = kw * 0.5 + semantic * 0.5;
    return { opportunity: opp, relevance };
  });

  const filtered = scored.filter((s) => s.relevance > 0.05);
  filtered.sort((a, b) => b.relevance - a.relevance);

  const total = filtered.length;
  const page_ = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
  return { results: page_, total };
}

export function tagsToSearchText(aiTags: string | null): string {
  return fromJsonArray(aiTags).join(" ");
}
