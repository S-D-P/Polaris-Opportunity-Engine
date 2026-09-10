import { prisma } from "@/lib/db/client";

/**
 * PostgreSQL native full-text search (docs/data-architecture.md) — replaces the SQLite FTS5
 * virtual table used before the Cloud SQL migration. Real inverted-index keyword search
 * (`ts_rank` over a GIN-indexed `tsvector`), not a `LIKE '%...%'` scan and not LLM-based
 * (docs/architecture.md §6).
 *
 * Unlike the SQLite version, this doesn't need a separate virtual table: `search_vector` is
 * an ordinary `tsvector` column added directly onto `Opportunity` via raw SQL (Prisma has no
 * native tsvector type, so it can't be modeled in schema.prisma) — which means a deleted
 * opportunity row takes its search_vector with it automatically, no separate delete needed.
 */
let ensured = false;

export async function ensureFtsTable(): Promise<void> {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS search_vector tsvector`);
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS opportunity_search_vector_idx ON "Opportunity" USING GIN (search_vector)`
  );
  ensured = true;
}

export async function upsertFtsRow(opp: {
  id: string;
  title: string;
  organization: string;
  description: string;
  tags: string; // space-joined tag text, not JSON
}): Promise<void> {
  await ensureFtsTable();
  // Weighted: title matches rank highest ('A'), then organization, then description, then
  // tags — mirrors the relative importance a keyword search should give each field.
  await prisma.$executeRawUnsafe(
    `UPDATE "Opportunity"
     SET search_vector =
       setweight(to_tsvector('english', coalesce($2, '')), 'A') ||
       setweight(to_tsvector('english', coalesce($3, '')), 'B') ||
       setweight(to_tsvector('english', coalesce($4, '')), 'C') ||
       setweight(to_tsvector('english', coalesce($5, '')), 'D')
     WHERE id = $1`,
    opp.id,
    opp.title,
    opp.organization,
    opp.description,
    opp.tags
  );
}

export async function deleteFtsRow(id: string): Promise<void> {
  // No-op under Postgres: search_vector lives on the Opportunity row itself and is removed
  // automatically when the row is deleted. Kept for API compatibility with existing callers.
  void id;
}

export interface FtsHit {
  id: string;
  rank: number;
}

export async function searchFts(query: string, limit = 100): Promise<FtsHit[]> {
  await ensureFtsTable();
  const sanitized = sanitizeFtsQuery(query);
  if (!sanitized) return [];
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string; rank: number }[]>(
      `SELECT id, ts_rank(search_vector, to_tsquery('english', $1)) as rank
       FROM "Opportunity"
       WHERE search_vector @@ to_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $2`,
      sanitized,
      limit
    );
    return rows;
  } catch {
    return [];
  }
}

// to_tsquery's syntax is strict (rejects bare punctuation, requires explicit &/| operators)
// — turn free text into a safe OR-of-prefix-terms query so arbitrary user input never throws
// a syntax error, matching the SQLite version's tolerant behavior. `:*` is tsquery's prefix
// match, equivalent to FTS5's trailing `*`.
function sanitizeFtsQuery(query: string): string {
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return "";
  return terms.map((t) => `${t}:*`).join(" | ");
}
