/**
 * SSRF guard for every adapter that fetches a URL (rss.ts, json-api.ts, static-page.ts).
 * Source URLs only ever come from `Source.url`/`Source.config`, which only an admin can set
 * (`requireAdmin()`-protected routes — docs/security-audit.md), so the realistic threat here
 * is a compromised/mistaken admin action or a misconfigured source, not an arbitrary public
 * user — but ingestion is exactly the kind of privileged, server-side "fetch this URL" code
 * path SSRF defenses exist for, so it's checked regardless of how trusted the caller is.
 */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // link-local, includes cloud metadata endpoints (169.254.169.254)
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export class UnsafeUrlError extends Error {}

export function assertSafeFetchUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Refusing non-HTTP(S) scheme: ${url.protocol}`);
  }

  const hostname = url.hostname;
  if (BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new UnsafeUrlError(`Refusing to fetch a private/internal address: ${hostname}`);
  }
}
