# Polaris — Geographic Eligibility Model

Schema design for distinguishing *who is eligible* to apply, separate from where a program
physically happens. Added for the India + global demo dataset strategy, but deliberately built
as a general, extensible model — not hard-coded to India.

## The fields

`Opportunity.geographicScope` (enum, `prisma/schema.prisma`):

| Value | Meaning |
|---|---|
| `INDIA_ONLY` | The source explicitly states eligibility is restricted to India (citizens/residents/applicants located in India). |
| `GLOBAL` | The source explicitly states the program is open worldwide, no stated restriction. |
| `REGION_SPECIFIC` | Explicitly restricted to a named multi-country region other than "global" (e.g. "Sub-Saharan Africa", "Southeast Asia"). Region name goes in `geographicDetail`. |
| `COUNTRY_SPECIFIC` | Explicitly restricted to one specific country other than India (e.g. "United States residents only"). Country name goes in `geographicDetail`. |
| `REMOTE_GLOBAL` | Explicitly remote/online **and** explicitly open to international applicants — a program that's both location-independent and eligibility-independent, which is different from a program that just happens to be remote for people in one country. |
| `LOCATION_UNKNOWN` | The default. The source didn't state eligibility clearly enough to classify. This is the honest, correct value for the vast majority of pre-existing opportunities (ingested before this field existed) and will stay the default for any future source whose eligibility language is genuinely ambiguous. |

`Opportunity.geographicDetail` (nullable string): the specific region/country name when
`geographicScope` is `REGION_SPECIFIC` or `COUNTRY_SPECIFIC` — free text, not an enum, so
adding support for a new region is a data decision, not a schema migration.

## The hard rule this enforces

**Geographic eligibility is never inferred from the organization.** A US company's program is
not automatically `COUNTRY_SPECIFIC: United States`. A program calling itself "global" is not
automatically `GLOBAL` in the sense of "open to India" unless the source says so. Every
non-`LOCATION_UNKNOWN` value must trace back to something the source actually stated — the
same evidentiary standard already applied to compliance research
(`docs/source-compliance.md`) and to eligibility extraction generally.

## How it's populated

Two mechanisms, both requiring explicit evidence, never a guess:

1. **Source-level default** (`Source.config.geographicScope` / `geographicDetail`) — set when
   an entire source is scoped by construction, e.g. a source that only indexes an Indian
   government scheme (`INDIA_ONLY`), or one whose every listing is a globally-open online
   course (`REMOTE_GLOBAL`). Applied to every item from that source unless overridden per-item.
2. **Per-item override** (`NormalizedOpportunity.geographicScope` / `geographicDetail`,
   returned by an adapter's `normalize()`) — for sources whose items individually state
   different eligibility (e.g. a JSON API with a per-listing country field). Always wins over
   the source-level default when present.

Neither mechanism is AI-driven — this is deterministic, config/adapter-level classification,
consistent with the project's "AI classifies content, deterministic code classifies structure"
split (`docs/architecture.md` §3).

## Why this isn't hard-coded to India

The long-term architecture needs to expand geographically (India → Asia → North America →
Europe → Africa → Middle East → Latin America → Global) without a schema change each time.
`REGION_SPECIFIC`/`COUNTRY_SPECIFIC` plus the free-text `geographicDetail` field is the
mechanism: India is not a special enum value with unique handling elsewhere in the codebase
except for `INDIA_ONLY` itself, which exists as its own value only because it's the current
demo's primary market and deserves first-class filtering (a query for "opportunities for
India" is `geographicScope IN (INDIA_ONLY, GLOBAL, REMOTE_GLOBAL)`, not a `LIKE` scan over
`geographicDetail`). A future "opportunities for Kenya" query would be
`geographicScope IN (GLOBAL, REMOTE_GLOBAL) OR (geographicScope = COUNTRY_SPECIFIC AND
geographicDetail = 'Kenya')` — the same shape, no new enum value required.
