/**
 * Deterministic (non-AI) pre-filter for sources whose feed mixes general content with real
 * opportunities — discovered empirically running the first corporate-source ingestion batch
 * (docs/corporate-ingestion-baseline.md): Hugging Face's blog RSS, for example, is ~99%
 * ordinary ML tutorial/announcement posts and a handful of genuine program announcements
 * ("Student Ambassador Program's call for applications is open!"). Storing the tutorials as
 * "opportunities" would directly violate the product's non-negotiable quality bar ("Quality
 * is more important than count... Fabricated information is NOT acceptable") — this isn't
 * fabrication, but it's the same failure mode: presenting non-opportunity content as an
 * opportunity record. This is intentionally simple keyword matching, not an LLM call — a
 * false negative here just means a real opportunity gets skipped and can be manually added
 * or the keyword list extended; it never fabricates or misclassifies content that WAS stored.
 *
 * Only applied to sources whose `Source.config.requireOpportunityKeywords` is `true` — a
 * source pointing at one specific, already-verified program page (the common corporate
 * STATIC_PAGE case) does not need this, since its content is scoped by construction.
 */
export const DEFAULT_OPPORTUNITY_KEYWORDS: string[] = [
  "apply now",
  "application",
  "applications open",
  "applications are open",
  "call for applications",
  "call for proposals",
  "now accepting",
  "deadline",
  "fellowship",
  "scholarship",
  "internship",
  "hackathon",
  "case competition",
  "innovation challenge",
  "cohort",
  "mentorship",
  "mentor program",
  "grant",
  "accelerator program",
  "startup accelerator",
  "bootcamp",
  "workshop series",
  "student program",
  "student ambassador",
  "developer program",
  "leadership program",
  "call for speakers",
  "call for judges",
  "call for mentors",
];

export function isLikelyOpportunity(
  title: string,
  content: string,
  keywords: string[] = DEFAULT_OPPORTUNITY_KEYWORDS
): boolean {
  const haystack = `${title} ${content}`.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
}
