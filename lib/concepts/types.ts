// Minimal shapes shared by the /concepts prototypes so the same card/detail components can
// render either a real Prisma `Opportunity` row (server pages) or the JSON an existing API
// route returns (client pages) without duplicating matching logic in either place.

export interface ConceptOpportunity {
  id: string;
  title: string;
  organization: string;
  opportunityType: string;
  deadline: string | Date | null;
  applicationUrl: string;
  sourceUrl: string;
  sourceName: string;
  description: string;
  shortDescription: string;
  categories: string;
  fields: string;
  benefits: string | null;
  isFree: boolean;
  cost?: string | null;
  location?: string | null;
  remote: boolean;
  hybrid: boolean;
  inPerson: boolean;
}

export interface ConceptMatch {
  eligible: boolean;
  score: number;
  reasons: string[];
  ineligibleReasons: string[];
}

export const NO_MATCH: ConceptMatch = { eligible: true, score: 0, reasons: [], ineligibleReasons: [] };

/** Builds a ConceptMatch from the matchScore/matchReasons fields /api/search and
 *  /api/opportunities already attach when the caller is signed in. */
export function matchFromApiFields(row: {
  matchScore?: number | null;
  matchReasons?: string[] | null;
}): ConceptMatch {
  if (row.matchScore == null) return NO_MATCH;
  return { eligible: true, score: row.matchScore, reasons: row.matchReasons ?? [], ineligibleReasons: [] };
}
