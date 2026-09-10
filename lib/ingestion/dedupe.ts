/**
 * Deterministic deduplication (docs/architecture.md §3) — a well-defined string-matching
 * problem, deliberately not delegated to an LLM call per opportunity.
 */
import { cosineSimilarity, jsonToEmbedding } from "@/lib/ai/embeddings";

export function normalizeForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ") // "AI & ML" and "AI and ML" are the same title in practice
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildFingerprint(title: string, organization: string): string {
  return normalizeForFingerprint(`${organization}::${title}`);
}

/** Jaro-Winkler similarity, 0..1. Small, dependency-free implementation — good enough for
 *  title-similarity dedup at MVP scale (a handful of sources, not millions of rows). */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const s1 = a;
  const s2 = b;
  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export function titleSimilarity(a: string, b: string): number {
  return jaroWinkler(normalizeForFingerprint(a), normalizeForFingerprint(b));
}

const SIMILARITY_THRESHOLD = 0.92;

export interface DuplicateCandidate {
  id: string;
  title: string;
  organization: string;
  fingerprint: string;
}

/** Returns the id of the best duplicate match among `existing`, or null. */
export function findDuplicate(
  title: string,
  organization: string,
  existing: DuplicateCandidate[]
): string | null {
  const fingerprint = buildFingerprint(title, organization);
  const exact = existing.find((e) => e.fingerprint === fingerprint);
  if (exact) return exact.id;

  for (const candidate of existing) {
    if (candidate.organization.toLowerCase() !== organization.toLowerCase()) continue;
    if (titleSimilarity(title, candidate.title) >= SIMILARITY_THRESHOLD) return candidate.id;
  }
  return null;
}

/**
 * Confidence-banded duplicate detection (docs/ingestion-roadmap.md Part 10). Replaces the
 * binary skip-or-store decision above with a 0..1 confidence score plus a three-tier
 * classification, so a weak match can be surfaced for human review instead of either being
 * silently merged or silently duplicated.
 */
export type DuplicateTier = "HIGH_CONFIDENCE_DUPLICATE" | "POSSIBLE_DUPLICATE" | "NOT_DUPLICATE";

const HIGH_CONFIDENCE_THRESHOLD = 0.9;
const POSSIBLE_DUPLICATE_THRESHOLD = 0.6;

export function classifyDuplicateConfidence(confidence: number): DuplicateTier {
  if (confidence >= HIGH_CONFIDENCE_THRESHOLD) return "HIGH_CONFIDENCE_DUPLICATE";
  if (confidence >= POSSIBLE_DUPLICATE_THRESHOLD) return "POSSIBLE_DUPLICATE";
  return "NOT_DUPLICATE";
}

/** Normalizes a URL to host+path for comparison, ignoring scheme/www/query/trailing slash —
 *  good enough to recognize "the same page" without pulling in a URL-canonicalization lib. */
export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function sameHostname(a: string, b: string): boolean {
  try {
    return (
      new URL(a).hostname.toLowerCase().replace(/^www\./, "") ===
      new URL(b).hostname.toLowerCase().replace(/^www\./, "")
    );
  } catch {
    return false;
  }
}

export interface DuplicateConfidenceCandidate {
  id: string;
  title: string;
  organization: string;
  applicationUrl: string;
  deadline: Date | null;
  embedding?: string | null; // JSON number[], as stored on Opportunity
}

export interface DuplicateConfidenceInput {
  title: string;
  organization: string;
  applicationUrl: string;
  deadline: Date | null;
  embedding?: number[] | null;
}

/** Scores how likely `candidate` is a duplicate of `existing`, per the signal table in
 *  docs/ingestion-roadmap.md Part 10. Order of checks matters: each returns as soon as a
 *  tier-defining signal fires, falling through to a blended "possible" score otherwise. */
export function computeDuplicateConfidence(
  candidate: DuplicateConfidenceInput,
  existing: DuplicateConfidenceCandidate
): number {
  // Strong: canonical application URL is an exact match.
  if (canonicalizeUrl(candidate.applicationUrl) === canonicalizeUrl(existing.applicationUrl)) {
    return 1.0;
  }

  const sameOrgExact =
    candidate.organization.trim().toLowerCase() === existing.organization.trim().toLowerCase();
  const titleSim = titleSimilarity(candidate.title, existing.title);
  const sameDeadline =
    candidate.deadline && existing.deadline
      ? Math.abs(candidate.deadline.getTime() - existing.deadline.getTime()) < 24 * 60 * 60 * 1000
      : candidate.deadline == null && existing.deadline == null;

  // High confidence: organization + title + deadline all agree.
  if (sameOrgExact && titleSim >= SIMILARITY_THRESHOLD && sameDeadline) {
    return 0.95;
  }

  // High confidence: same organization, same publishing domain, strongly similar title —
  // e.g. two different specific URLs on the same org's site for the same listing.
  if (sameOrgExact && sameHostname(candidate.applicationUrl, existing.applicationUrl) && titleSim >= 0.85) {
    return 0.9;
  }

  // Possible: blend weaker signals — title similarity, organization *name* similarity (not
  // exact match, closing the "different org string" blind spot), and semantic similarity of
  // the two descriptions' embeddings when both are available.
  const orgSim = titleSimilarity(candidate.organization, existing.organization);
  let semanticSim = 0;
  const existingEmbedding = jsonToEmbedding(existing.embedding ?? null);
  if (candidate.embedding && existingEmbedding) {
    semanticSim = cosineSimilarity(candidate.embedding, existingEmbedding);
  }

  return titleSim * 0.5 + orgSim * 0.2 + semanticSim * 0.3;
}

export interface DuplicateMatch {
  id: string;
  confidence: number;
  tier: DuplicateTier;
}

/** Finds the best-scoring duplicate candidate among `existing`, or null if none clears the
 *  POSSIBLE_DUPLICATE floor. Callers should pre-filter `existing` for performance (e.g. by
 *  organization) the same way the legacy `findDuplicate` does, since Strong/High-confidence
 *  matches all require organization or URL agreement anyway. */
export function findBestDuplicateMatch(
  candidate: DuplicateConfidenceInput,
  existing: DuplicateConfidenceCandidate[]
): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  for (const item of existing) {
    const confidence = computeDuplicateConfidence(candidate, item);
    const tier = classifyDuplicateConfidence(confidence);
    if (tier === "NOT_DUPLICATE") continue;
    if (!best || confidence > best.confidence) {
      best = { id: item.id, confidence, tier };
    }
  }
  return best;
}
