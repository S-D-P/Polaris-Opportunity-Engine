import type { CatalogItem, GroundTruthEntry } from "./catalog";

/**
 * "Effective relevance" for ranking-quality metrics (Precision/Recall/NDCG): an item's
 * hand-labeled relevance grade counts only if it's also hand-labeled eligible. An item we
 * believe is truly ineligible contributes 0, even if it's topically on-point — showing an
 * ineligible opportunity is a wrong recommendation, not a partially-good one, regardless of
 * topic match. Items labeled "ambiguous" or "structural-gap" are excluded from ranking
 * metrics entirely (treated as unknown, not as 0 and not as their raw relevance) rather than
 * guessed — this is why they're handled by a separate filter, not folded into this function.
 */
function effectiveRelevance(entry: GroundTruthEntry): number {
  if (entry.eligible !== true) return 0;
  return entry.relevance;
}

function hasConfidentTruth(entry: GroundTruthEntry): boolean {
  return entry.eligible === true || entry.eligible === false;
}

export function relevantIdSet(catalog: CatalogItem[], personaId: string): Set<string> {
  const ids = catalog
    .filter((c) => {
      const gt = c.groundTruth[personaId as keyof typeof c.groundTruth];
      return gt.eligible === true && gt.relevance >= 2;
    })
    .map((c) => c.opportunity.id);
  return new Set(ids);
}

export function precisionAtK(rankedIds: string[], relevantIds: Set<string>, k: number): number {
  const topK = rankedIds.slice(0, k);
  const hits = topK.filter((id) => relevantIds.has(id)).length;
  return hits / k;
}

export function recallAtK(rankedIds: string[], relevantIds: Set<string>, k: number): number | null {
  if (relevantIds.size === 0) return null;
  const topK = rankedIds.slice(0, k);
  const hits = topK.filter((id) => relevantIds.has(id)).length;
  return hits / relevantIds.size;
}

/**
 * NDCG@k using linear gain (rel_i) over a log2(rank+1) discount — the simplified variant
 * (as opposed to the (2^rel - 1) exponential-gain version), chosen because our relevance
 * grades are small integers (0-3) where linear and exponential gain rank similarly, and the
 * simpler formula is easier to audit by hand. Stated explicitly here so the number is
 * reproducible, not a black box.
 */
export function ndcgAtK(
  rankedIds: string[],
  catalog: CatalogItem[],
  personaId: string,
  k: number
): number | null {
  const gtById = new Map(
    catalog.map((c) => [c.opportunity.id, c.groundTruth[personaId as keyof typeof c.groundTruth]])
  );

  const dcg = rankedIds
    .slice(0, k)
    .reduce((sum, id, i) => {
      const entry = gtById.get(id);
      const rel = entry ? effectiveRelevance(entry) : 0;
      return sum + rel / Math.log2(i + 2);
    }, 0);

  const idealGrades = catalog
    .map((c) => effectiveRelevance(c.groundTruth[personaId as keyof typeof c.groundTruth]))
    .sort((a, b) => b - a)
    .slice(0, k);
  const idcg = idealGrades.reduce((sum, rel, i) => sum + rel / Math.log2(i + 2), 0);

  if (idcg === 0) return null; // no relevant items at all for this persona — NDCG undefined
  return dcg / idcg;
}

export interface EligibilityComparison {
  id: string;
  title: string;
  expected: boolean;
  actual: boolean;
  match: boolean;
}

/** Compares engine output to ground truth, only over pairs with a confident (non-ambiguous,
 *  non-structural-gap) expected answer — see the module doc for why those are excluded. */
export function eligibilityAccuracy(
  catalog: CatalogItem[],
  personaId: string,
  actualEligibleById: Map<string, boolean>
): { accuracy: number; comparisons: EligibilityComparison[]; mismatches: EligibilityComparison[]; excludedCount: number } {
  const comparisons: EligibilityComparison[] = [];
  let excludedCount = 0;

  for (const item of catalog) {
    const gt = item.groundTruth[personaId as keyof typeof item.groundTruth];
    if (!hasConfidentTruth(gt)) {
      excludedCount++;
      continue;
    }
    const actual = actualEligibleById.get(item.opportunity.id) ?? false;
    comparisons.push({
      id: item.opportunity.id,
      title: item.opportunity.title,
      expected: gt.eligible as boolean,
      actual,
      match: actual === gt.eligible,
    });
  }

  const correct = comparisons.filter((c) => c.match).length;
  return {
    accuracy: comparisons.length > 0 ? correct / comparisons.length : NaN,
    comparisons,
    mismatches: comparisons.filter((c) => !c.match),
    excludedCount,
  };
}
