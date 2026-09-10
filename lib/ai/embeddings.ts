/**
 * EmbeddingProvider — local, deterministic, dependency-free embedding used for semantic
 * search and goal↔opportunity similarity (see docs/architecture.md §1/§4 for why this
 * replaces a hosted embeddings API for the MVP).
 *
 * Approach: hashing-trick bag-of-words into a fixed-length vector, weighted by simple
 * term frequency, L2-normalized. This is a real, working, swappable implementation —
 * not a stub — good enough to rank "is this text about AI policy vs. marine biology"
 * correctly, which is what it's used for. Swap to a hosted model by replacing the body
 * of `embedText` (interface stays identical) with an API call.
 */

// 2048 rather than a smaller power of two to keep hash-bucket collisions rare: at 256
// dimensions, an unrelated single-token query could randomly collide with a populated
// bucket in a short opportunity's vector and produce a misleadingly high cosine
// similarity (observed in testing — see the token-count guard in lib/search/index.ts,
// which is the other half of this fix).
const DIMENSIONS = 2048;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "is", "are",
  "be", "this", "that", "it", "as", "at", "by", "from", "will", "your", "you", "we",
  "our", "i", "my", "their", "them", "who", "what", "into", "than", "then", "over",
  "about", "such", "can", "also",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function hashToken(token: string): number {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % DIMENSIONS;
}

export function embedText(text: string): number[] {
  const vector = new Array(DIMENSIONS).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const idx = hashToken(token);
    vector[idx] += 1;
    // also hash bigrams so short phrase overlap ("public policy") counts extra
  }
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + "_" + tokens[i + 1];
    vector[hashToken(bigram)] += 0.5;
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  // vectors are already L2-normalized by embedText, so dot product == cosine similarity
  return dot;
}

export function embeddingToJson(vector: number[]): string {
  return JSON.stringify(vector);
}

export function jsonToEmbedding(json: string | null | undefined): number[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
