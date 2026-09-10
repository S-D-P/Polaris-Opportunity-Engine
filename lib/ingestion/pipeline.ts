import type { Source } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { toJsonArray } from "@/lib/db/json";
import { embedText, embeddingToJson } from "@/lib/ai/embeddings";
import { extractOpportunity } from "@/lib/ai/extraction";
import { buildFingerprint, findBestDuplicateMatch } from "@/lib/ingestion/dedupe";
import { computeRefetchUpdate } from "@/lib/ingestion/freshness";
import { isLikelyOpportunity } from "@/lib/ingestion/relevance-filter";
import { rssAdapter } from "@/lib/ingestion/adapters/rss";
import { manualAdapter } from "@/lib/ingestion/adapters/manual";
import { jsonApiAdapter } from "@/lib/ingestion/adapters/json-api";
import { staticPageAdapter } from "@/lib/ingestion/adapters/static-page";
import { evaluateComplianceGate } from "@/lib/ingestion/compliance";
import { upsertFtsRow } from "@/lib/search/fts";
import type { NormalizedOpportunity, PipelineResult, SourceAdapter } from "@/lib/ingestion/types";

const ADAPTERS: Partial<Record<Source["sourceType"], SourceAdapter>> = {
  RSS: rssAdapter,
  MANUAL: manualAdapter,
  JSON_API: jsonApiAdapter,
  STATIC_PAGE: staticPageAdapter,
};

/**
 * Runs the full SOURCE → COMPLIANCE CHECK → FETCH → EXTRACT → NORMALIZE → DEDUPLICATE →
 * AI CLASSIFY → VALIDATE → STORE → INDEX pipeline for one source, and records an
 * IngestionJob with the outcome (docs/ingestion-roadmap.md Part 2/4). Unimplemented source
 * types and blocked-by-compliance sources both fail loudly with a clear error rather than
 * silently no-op'ing or faking success.
 *
 * `opts.manualReview` allows a human-initiated, logged exception for a source whose
 * compliance status is `UNCLEAR_REQUIRES_REVIEW` only — it can never override
 * `NOT_ALLOWED`, and must never be set by a scheduler or any automatic trigger (see
 * `lib/ingestion/compliance.ts`).
 */
export async function runIngestion(
  sourceId: string,
  opts: { manualReview?: boolean } = {}
): Promise<PipelineResult> {
  const source = await prisma.source.findUniqueOrThrow({
    where: { id: sourceId },
    include: { complianceRecord: true },
  });
  const job = await prisma.ingestionJob.create({
    data: { sourceId: source.id, status: "RUNNING" },
  });

  const result: PipelineResult = {
    itemsFound: 0,
    itemsStored: 0,
    itemsUpdated: 0,
    itemsDuplicate: 0,
    itemsFailed: 0,
    itemsFiltered: 0,
    errors: [],
  };

  // Only sources whose feed mixes general content with real opportunities opt into this
  // (docs/corporate-ingestion-baseline.md) — most sources are already scoped by construction
  // (a JSON API search query, a single verified program page) and don't need it.
  let requireOpportunityKeywords = false;
  // Source-level default geographic scope (docs/geographic-model.md) — set only when the
  // source itself is scoped to one eligibility class by construction (e.g. a source that only
  // indexes an Indian government scheme, or a source whose every listing explicitly states
  // "open worldwide"). A per-item override from the adapter (below) always wins over this.
  let defaultGeographicScope: NormalizedOpportunity["geographicScope"] | undefined;
  let defaultGeographicDetail: string | undefined;
  if (source.config) {
    try {
      const parsedConfig = JSON.parse(source.config);
      requireOpportunityKeywords = Boolean(parsedConfig.requireOpportunityKeywords);
      defaultGeographicScope = parsedConfig.geographicScope;
      defaultGeographicDetail = parsedConfig.geographicDetail;
    } catch {
      // Adapter-specific config parsing (with its own clear error) happens inside fetchRaw;
      // this pre-check silently treats unparseable config as "no filter", not a failure.
    }
  }

  // Compliance gate — runs before anything else touches the network, per the hard
  // requirement that automated collection never proceed without a documented, reviewed
  // permission status (docs/source-compliance.md).
  const gate = evaluateComplianceGate(source.complianceRecord, opts);
  if (!gate.allowed) {
    logger.warn("ingestion.pipeline", "Ingestion blocked by compliance gate", {
      sourceId,
      status: gate.status,
    });
    result.errors.push(`Blocked by compliance gate (${gate.status}): ${gate.reason}`);
    await finishJob(job.id, source.id, "FAILED", result);
    return result;
  }
  if (gate.status === "UNCLEAR_REQUIRES_REVIEW") {
    logger.warn("ingestion.pipeline", "Running an UNCLEAR_REQUIRES_REVIEW source via manual override", {
      sourceId,
    });
  }

  const adapter = ADAPTERS[source.sourceType];
  if (!adapter) {
    const message = `No adapter implemented for source type "${source.sourceType}"`;
    result.errors.push(message);
    await finishJob(job.id, source.id, "FAILED", result);
    return result;
  }

  let rawItems: Awaited<ReturnType<SourceAdapter["fetchRaw"]>> = [];
  try {
    rawItems = await adapter.fetchRaw(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ingestion.pipeline", "fetchRaw failed", { sourceId, error: message });
    result.errors.push(`Fetch failed: ${message}`);
    await finishJob(job.id, source.id, "FAILED", result);
    return result;
  }

  result.itemsFound = rawItems.length;

  const existingCandidates = await prisma.opportunity.findMany({
    select: {
      id: true,
      title: true,
      organization: true,
      fingerprint: true,
      applicationUrl: true,
      deadline: true,
      embedding: true,
    },
  });

  for (const raw of rawItems) {
    try {
      const normalized = adapter.normalize(raw, source);
      if (!normalized || !isValid(normalized)) {
        result.itemsFailed++;
        result.errors.push(`Invalid item: "${raw.title || raw.link}"`);
        continue;
      }

      if (requireOpportunityKeywords && !isLikelyOpportunity(normalized.title, normalized.rawText)) {
        result.itemsFiltered++;
        continue;
      }

      // Dedup embedding is computed pre-extraction (from raw title+text, not the AI
      // summary) purely to feed the "possible duplicate" semantic-similarity signal below —
      // it is not what gets stored on the row if the item turns out to be new (see
      // `embedding` further down, which uses the AI summary once available).
      const dedupEmbedding = embedText(`${normalized.title} ${normalized.rawText}`);
      const match = findBestDuplicateMatch(
        {
          title: normalized.title,
          organization: normalized.organization,
          applicationUrl: normalized.applicationUrl,
          deadline: normalized.deadline,
          embedding: dedupEmbedding,
        },
        existingCandidates
      );

      if (match?.tier === "HIGH_CONFIDENCE_DUPLICATE") {
        // Sure enough of the match to merge in place — updates the existing record rather
        // than creating a second row (docs/ingestion-roadmap.md Part 10).
        const existing = await prisma.opportunity.findUniqueOrThrow({
          where: { id: match.id },
          select: { status: true, deadline: true, description: true },
        });
        const refetchUpdate = computeRefetchUpdate({
          existing,
          incoming: { deadline: normalized.deadline, description: normalized.rawText },
        });
        await prisma.opportunity.update({
          where: { id: match.id },
          data: {
            lastCheckedAt: new Date(),
            verifiedAt: refetchUpdate.verifiedAt,
            ...(refetchUpdate.deadline !== undefined ? { deadline: refetchUpdate.deadline } : {}),
            ...(refetchUpdate.deadlineType !== undefined ? { deadlineType: refetchUpdate.deadlineType } : {}),
            ...(refetchUpdate.description !== undefined ? { description: refetchUpdate.description } : {}),
            ...(refetchUpdate.status !== undefined ? { status: refetchUpdate.status } : {}),
          },
        });
        if (refetchUpdate.changed) result.itemsUpdated++;
        result.itemsDuplicate++;
        continue;
      }

      const extraction = await extractOpportunity({
        title: normalized.title,
        organization: normalized.organization,
        rawText: normalized.rawText,
      });

      // Hard product rule, not a preference: Polaris never stores ordinary job postings,
      // even from an otherwise-compliant, otherwise-relevant source (discovered live —
      // MyGov.in's RSS mixes citizen-engagement contests with genuine hiring listings like
      // "Video Editor (5-10Yrs)"). This can only run post-extraction, since only the AI
      // classification can actually tell a job apart from a program on a source that isn't
      // job-only; a source with no AI available at all can't be checked this way (degrades
      // to "AI unavailable" like any other classification field, not silently bypassed).
      if (extraction?.opportunityType === "JOB") {
        result.itemsFiltered++;
        continue;
      }

      const fingerprint = buildFingerprint(normalized.title, normalized.organization);
      const embedding = embeddingToJson(
        embedText(`${normalized.title} ${extraction?.aiSummary ?? normalized.rawText}`)
      );

      // A POSSIBLE_DUPLICATE is never auto-merged — it's stored as its own row, linked via
      // duplicateOfId for the admin review queue to surface (docs/ingestion-roadmap.md Part 10).
      const isPossibleDuplicate = match?.tier === "POSSIBLE_DUPLICATE";

      const created = await prisma.opportunity.create({
        data: {
          title: normalized.title,
          organization: normalized.organization,
          description: normalized.rawText,
          shortDescription:
            extraction?.shortDescription ?? normalized.rawText.slice(0, 240),
          opportunityType: extraction?.opportunityType ?? "COURSE",
          categories: toJsonArray(extraction?.categories),
          fields: toJsonArray(extraction?.fields),
          skills: toJsonArray(extraction?.skills),
          targetAudience: toJsonArray(extraction?.targetAudience),
          eligibilitySummary: extraction?.eligibilitySummary,
          minimumAge: extraction?.minimumAge ?? null,
          maximumAge: extraction?.maximumAge ?? null,
          educationRequirements: toJsonArray(extraction?.educationRequirements),
          experienceRequirements: toJsonArray(extraction?.experienceRequirements),
          citizenshipRequirements: toJsonArray(extraction?.citizenshipRequirements),
          genderEligibility: extraction?.genderEligibility ?? "NOT_STATED",
          genderRestrictedTo: toJsonArray(extraction?.genderRestrictedTo),
          countries: toJsonArray([]),
          // Priority: adapter-parsed structured value (most authoritative when present) >
          // Gemini's per-item classification of the actual source text > the source
          // registry's blanket default > honestly unknown. Never fabricated.
          geographicScope:
            normalized.geographicScope ?? extraction?.geographicScope ?? defaultGeographicScope ?? "LOCATION_UNKNOWN",
          geographicDetail: normalized.geographicDetail ?? extraction?.geographicDetail ?? defaultGeographicDetail,
          isFree: extraction?.isFree ?? true,
          deadline: normalized.deadline,
          // A parsed date deterministically means FIXED; otherwise trust Gemini's classification
          // of the source's own wording (ROLLING/ONGOING), defaulting to NOT_STATED (docs/personalization.md).
          deadlineType: normalized.deadline ? "FIXED" : (extraction?.deadlineType ?? "NOT_STATED"),
          startDate: normalized.startDate,
          applicationUrl: normalized.applicationUrl,
          sourceUrl: normalized.sourceUrl,
          sourceName: source.name,
          sourceType: source.sourceType,
          sourceId: source.id,
          fingerprint,
          embedding,
          aiSummary: extraction?.aiSummary,
          aiTags: toJsonArray(extraction?.aiTags),
          verificationStatus: !extraction
            ? "NEEDS_REVIEW"
            : extraction.confidence === "high"
              ? "AI_EXTRACTED"
              : "NEEDS_REVIEW",
          duplicateOfId: isPossibleDuplicate ? match!.id : undefined,
          duplicateConfidence: isPossibleDuplicate ? match!.confidence : undefined,
          duplicateReviewStatus: isPossibleDuplicate ? "needs_review" : undefined,
        },
      });

      await upsertFtsRow({
        id: created.id,
        title: created.title,
        organization: created.organization,
        description: created.description,
        tags: (extraction?.aiTags ?? []).join(" "),
      });

      existingCandidates.push({
        id: created.id,
        title: created.title,
        organization: created.organization,
        fingerprint: created.fingerprint,
        applicationUrl: created.applicationUrl,
        deadline: created.deadline,
        embedding: created.embedding,
      });
      result.itemsStored++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("ingestion.pipeline", "Failed to process item", {
        sourceId,
        title: raw.title,
        error: message,
      });
      result.itemsFailed++;
      result.errors.push(`"${raw.title}": ${message}`);
    }
  }

  await finishJob(job.id, source.id, result.itemsFailed === rawItems.length && rawItems.length > 0 ? "FAILED" : "SUCCEEDED", result);
  return result;
}

function isValid(item: NormalizedOpportunity): boolean {
  if (!item.title.trim() || item.title.length > 300) return false;
  if (!item.applicationUrl || !isUrl(item.applicationUrl)) return false;
  if (!item.rawText.trim()) return false;
  return true;
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

async function finishJob(
  jobId: string,
  sourceId: string,
  status: "SUCCEEDED" | "FAILED",
  result: PipelineResult
): Promise<void> {
  const now = new Date();
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: now,
      itemsFound: result.itemsFound,
      itemsStored: result.itemsStored,
      itemsUpdated: result.itemsUpdated,
      itemsDuplicate: result.itemsDuplicate,
      itemsFailed: result.itemsFailed,
      itemsFiltered: result.itemsFiltered,
      errors: toJsonArray(result.errors),
    },
  });
  // Keeps Source.lastSuccessfulIngestionAt/lastFailureAt live rather than dead columns
  // (docs/ingestion-roadmap.md Part 5) — every finishJob call, including compliance-gate
  // blocks and "no adapter" failures, updates the relevant timestamp.
  await prisma.source.update({
    where: { id: sourceId },
    data: status === "SUCCEEDED" ? { lastSuccessfulIngestionAt: now } : { lastFailureAt: now },
  });
}
