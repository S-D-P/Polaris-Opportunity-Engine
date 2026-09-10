import type { Source } from "@prisma/client";
import type { NormalizedOpportunity, RawItem, SourceAdapter } from "@/lib/ingestion/types";
import { extractDeadline, extractStartDate } from "@/lib/ingestion/date-extract";
import { assertSafeFetchUrl } from "@/lib/ingestion/url-safety";

/**
 * Generic, config-driven adapter for official JSON APIs (Tier 1, docs/ingestion-roadmap.md
 * Part 3/6). One real adapter shared across every JSON-API source rather than one bespoke
 * integration per API — a new compliant API source is a new `Source.config`, not new code.
 *
 * `Source.config` (JSON) shape:
 * {
 *   "method"?: "GET" | "POST",              // default GET
 *   "headers"?: { [name]: string },          // static headers, e.g. { "Accept": "application/json" }
 *   "apiKeyEnvVar"?: string,                 // name of the env var holding the API key — never the key itself
 *   "apiKeyHeader"?: string,                 // header name to send the key as, e.g. "Authorization-Key"
 *   "apiKeyQueryParam"?: string,             // OR append the key as a query param instead of a header (e.g. Data.gov's X-Api-Key can go either way; some APIs require query)
 *   "itemsPath": string,                     // dot-path to the array of items in the JSON response, e.g. "SearchResult.SearchResultItems"
 *   "fieldMap": {
 *     "title": string,                       // dot-path *within each item*
 *     "link": string,
 *     "content"?: string,
 *     "organization"?: string,
 *     "publishedAt"?: string,
 *     "deadline"?: string,                   // structured date field, if the API provides one directly
 *     "guid"?: string
 *   }
 * }
 *
 * If `apiKeyEnvVar` is set and the environment variable is missing, `fetchRaw` throws a
 * clear, specific error rather than silently returning no items or fabricating a response —
 * the pipeline (lib/ingestion/pipeline.ts) already catches and logs `fetchRaw` errors,
 * recording the job as FAILED with the real reason.
 */

interface JsonApiConfig {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown; // static JSON request body, for APIs whose search endpoint requires POST
  apiKeyEnvVar?: string;
  apiKeyHeader?: string;
  apiKeyQueryParam?: string;
  itemsPath: string;
  // Some APIs (e.g. Grants.gov) return an opportunity id rather than a direct URL — set
  // `linkTemplate` with a `{value}` placeholder to build a real link from `fieldMap.link`'s
  // resolved value instead of using it as a URL directly.
  linkTemplate?: string;
  fieldMap: {
    title: string;
    link: string;
    content?: string;
    organization?: string;
    publishedAt?: string;
    deadline?: string;
    guid?: string;
  };
}

function parseConfig(source: Source): JsonApiConfig {
  if (!source.config) {
    throw new Error(`Source "${source.name}" has no config — a JSON API source requires itemsPath/fieldMap config.`);
  }
  const parsed = JSON.parse(source.config) as Partial<JsonApiConfig>;
  if (!parsed.itemsPath || !parsed.fieldMap?.title || !parsed.fieldMap?.link) {
    throw new Error(`Source "${source.name}" config is missing required itemsPath/fieldMap.title/fieldMap.link.`);
  }
  return parsed as JsonApiConfig;
}

/** Resolves a dot-separated path (e.g. "SearchResult.SearchResultItems") against an object.
 *  Returns undefined for any missing segment rather than throwing — real API responses
 *  vary item-to-item, and a missing optional field should degrade to NOT_STATED, not crash
 *  the whole fetch. */
function resolvePath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function toStringField(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

function toDateField(value: unknown): Date | null {
  if (value == null) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

export const jsonApiAdapter: SourceAdapter = {
  sourceType: "JSON_API",

  async fetchRaw(source: Source): Promise<RawItem[]> {
    const config = parseConfig(source);

    const headers: Record<string, string> = { Accept: "application/json", ...config.headers };
    let url = source.url;

    if (config.apiKeyEnvVar) {
      const key = process.env[config.apiKeyEnvVar];
      if (!key) {
        throw new Error(
          `Missing required environment variable "${config.apiKeyEnvVar}" — source "${source.name}" cannot run without an API key (see docs/source-compliance.md).`
        );
      }
      if (config.apiKeyHeader) {
        headers[config.apiKeyHeader] = key;
      } else if (config.apiKeyQueryParam) {
        const u = new URL(url);
        u.searchParams.set(config.apiKeyQueryParam, key);
        url = u.toString();
      }
    }

    const requestInit: RequestInit = { method: config.method ?? "GET", headers };
    if (config.method === "POST" && config.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
      requestInit.body = JSON.stringify(config.body);
    }

    assertSafeFetchUrl(url);
    const response = await fetch(url, requestInit);
    if (!response.ok) {
      throw new Error(`Request to ${url} failed with status ${response.status} ${response.statusText}`);
    }

    const responseBody = await response.json();
    const items = resolvePath(responseBody, config.itemsPath);
    if (!Array.isArray(items)) {
      throw new Error(`Expected an array at itemsPath "${config.itemsPath}" but found ${typeof items}.`);
    }

    return items.map((item, index) => {
      const title = toStringField(resolvePath(item, config.fieldMap.title));
      const rawLinkValue = toStringField(resolvePath(item, config.fieldMap.link));
      const link = config.linkTemplate ? config.linkTemplate.replace("{value}", rawLinkValue) : rawLinkValue;
      return {
        title,
        link,
        content: config.fieldMap.content ? toStringField(resolvePath(item, config.fieldMap.content)) : "",
        organization: config.fieldMap.organization
          ? toStringField(resolvePath(item, config.fieldMap.organization)) || undefined
          : undefined,
        publishedAt: config.fieldMap.publishedAt ? toDateField(resolvePath(item, config.fieldMap.publishedAt)) : null,
        structuredDeadline: config.fieldMap.deadline ? toDateField(resolvePath(item, config.fieldMap.deadline)) : null,
        structuredApplicationUrl: link || undefined,
        guid: config.fieldMap.guid
          ? toStringField(resolvePath(item, config.fieldMap.guid)) || `${source.id}-${index}`
          : link || `${source.id}-${index}`,
      };
    });
  },

  normalize(raw: RawItem, source: Source): NormalizedOpportunity | null {
    if (!raw.title || !raw.link) return null;
    const fullText = `${raw.title}\n${raw.content}`;
    return {
      title: raw.title,
      organization: raw.organization || source.organization || source.name,
      rawText: raw.content || raw.title,
      applicationUrl: raw.structuredApplicationUrl || raw.link,
      sourceUrl: raw.link,
      // Prefer the API's own structured deadline field; only fall back to the free-text
      // regex guess (built for sources with no structured field at all) if it's absent.
      deadline: raw.structuredDeadline !== undefined ? raw.structuredDeadline : extractDeadline(fullText),
      startDate: extractStartDate(fullText),
    };
  },
};
