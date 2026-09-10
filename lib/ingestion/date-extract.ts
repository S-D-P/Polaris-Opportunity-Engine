// Deterministic best-effort date extraction from free text, used before AI classification
// so deadlines/start dates come from plain parsing wherever possible (docs/architecture §3).

const MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";

const DATE_PATTERN = new RegExp(
  `(${MONTHS})\\s+(\\d{1,2}),?\\s+(\\d{4})|(\\d{1,2})\\s+(${MONTHS})\\s+(\\d{4})|(\\d{4})-(\\d{2})-(\\d{2})`,
  "gi"
);

function parseMatch(match: RegExpMatchArray): Date | null {
  const text = match[0];
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function findLabeledDate(text: string, labels: string[]): Date | null {
  for (const label of labels) {
    const labelRegex = new RegExp(`${label}[:\\s]+([^.\\n]{0,40})`, "i");
    const labelMatch = text.match(labelRegex);
    if (labelMatch) {
      const dateMatch = labelMatch[1].match(DATE_PATTERN);
      if (dateMatch) {
        const parsed = parseMatch(dateMatch as unknown as RegExpMatchArray);
        if (parsed) return parsed;
      }
    }
  }
  return null;
}

export function extractDeadline(text: string): Date | null {
  return (
    findLabeledDate(text, ["deadline", "apply by", "applications? close", "due date"]) ??
    null
  );
}

export function extractStartDate(text: string): Date | null {
  return findLabeledDate(text, ["start date", "starts on", "program begins", "begins"]);
}
