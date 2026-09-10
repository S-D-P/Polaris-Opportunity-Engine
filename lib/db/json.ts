// Small helpers for the JSON-encoded-string columns used throughout the schema (SQLite
// has no native array/JSON column type — see docs/architecture.md §1).

export function toJsonArray(value: string[] | undefined | null): string {
  return JSON.stringify(value ?? []);
}

export function fromJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function toJsonOrNull(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export function fromJsonOrNull<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
