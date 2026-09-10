/**
 * Turns the same real match reasons the production bullet list already shows into a short
 * natural-language sentence — purely a template over existing signals, never freely
 * generated, so it can never state a reason that isn't backed by an actual score
 * contribution (brief §5.1 "Why you"). Additive: the production feed/detail pages keep
 * their existing bullet-list presentation; this is used by the /concepts prototypes.
 *
 * Accepts a minimal shape (not the full `MatchResult`) so it works equally for a
 * server-computed match and for the matchScore/matchReasons fields returned by the existing
 * search/opportunities API routes.
 */
export function buildWhyNarrative(match: {
  eligible: boolean;
  reasons: string[];
  ineligibleReasons: string[];
}): string {
  if (!match.eligible) {
    if (match.ineligibleReasons.length === 0) return "This one isn't currently open to applicants.";
    return `This isn't a fit right now: ${match.ineligibleReasons[0].toLowerCase()}.`;
  }

  const reasons = match.reasons;
  if (reasons.length === 0) {
    return "This is open and broadly relevant, though it doesn't strongly match your stated interests or goals yet.";
  }

  const lower = reasons.map((r) => lowerFirst(r));
  if (lower.length === 1) return `Worth your time because ${lower[0]}.`;

  const head = lower.slice(0, -1).join(", ");
  const tail = lower[lower.length - 1];
  return `Worth your time because ${head}, and ${tail}.`;
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}
