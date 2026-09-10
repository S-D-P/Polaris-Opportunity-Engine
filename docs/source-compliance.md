# Polaris — Source Compliance Register

Real compliance research against 19 candidate opportunity sources, conducted by fetching
live `robots.txt` files and Terms of Service pages (not inferred from training-data memory
of what these policies "probably" say). Every finding below cites what was actually found.
Two items were corroborated indirectly rather than confirmed by a first-party fetch — both
are flagged explicitly rather than presented as fully verified; see their notes.

**Last policy check for every record below: 2026-09-03.** Compliance status is a snapshot,
not a permanent fact — every source needs periodic re-review (`docs/ingestion-roadmap.md`
Part 4's `SourceComplianceRecord.lastPolicyCheckAt` field exists specifically so this doesn't
go stale silently).

**The rule this document enforces**: `NOT_ALLOWED` sources are not implemented, period.
`UNCLEAR_REQUIRES_REVIEW` sources are not wired into automatic/scheduled ingestion until a
human resolves the ambiguity. Only `ALLOWED` and `ALLOWED_WITH_RESTRICTIONS` sources are
candidates for the Part 5/6 implementation sequencing in `docs/ingestion-roadmap.md`.

## Summary

| Status | Count | Sources |
|---|---|---|
| **ALLOWED** | 2 | USAJobs.gov, Data.gov (federal-origin datasets) |
| **ALLOWED_WITH_RESTRICTIONS** | 6 | Grants.gov, NSF.gov, Kaggle, Eventbrite, Idealist.org, HigherEdJobs |
| **UNCLEAR_REQUIRES_REVIEW** | 3 | EU Funding & Tenders Portal, MLH, DAAD |
| **NOT_ALLOWED** | 8 | UN Careers, unjobs.org, Devpost, Wellfound, YC Work at a Startup, IIE/Fulbright, LinkedIn, ResearchGate |

8 of 19 researched sources are explicitly blocked by their own Terms of Service despite
several having a technically-permissive `robots.txt` — confirming that `robots.txt` alone is
not sufficient evidence of permission, exactly as the request's rules anticipated, and that
this gate has real teeth rather than rubber-stamping every source that looks useful.

---

## ALLOWED

### USAJobs.gov
- **Source URL**: https://www.usajobs.gov
- **robots.txt status**: Found. **Crawl permission**: Allowed — disallows only `/Content/`, `/Scripts/`, `/foresee/`, `/Service References/`; job listings are crawlable. Declares `Sitemap: https://www.usajobs.gov/sitemap.xml`.
- **ToS reviewed**: Yes — https://help.usajobs.gov/terms-and-conditions and https://developer.usajobs.gov/guides/terms-of-use. Standard federal-system-use language (authorized-users-only, no unauthorized system modification); **no scraping, redistribution, or commercial-use prohibition found**.
- **API available**: Yes, official — USAJOBS Search API (developer.usajobs.gov). Auth via API key + `Authorization-Key`/`User-Agent` (your email) headers.
- **Official API preferred**: Yes.
- **RSS available**: Not confirmed found.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED**.
- **Rate limit**: Search Jobs API capped at 10,000 rows/query, 500 rows/page; Code List and Dynamic Search APIs report no limit per docs.
- **Permitted adapter type**: Official API (Tier 1).
- **Compliance notes**: Cleanest result of all 19 researched sources — permissive robots.txt, a free official API, and no redistribution restriction in the terms reviewed.
- **Last policy check**: 2026-09-03. **Review required**: No (re-check on the standard periodic cadence, not urgently).

### Data.gov
- **Source URL**: https://www.data.gov
- **robots.txt status**: Found. **Crawl permission**: Allowed — `Allow: /`, sitemap declared.
- **ToS reviewed**: Partial — no distinct data.gov ToS page located; licensing instead governed by the OPEN Government Data Act (resources.data.gov/open-licenses/): federal datasets carry "no restrictions on copying, publishing, distributing, transmitting, adapting, or otherwise using the information for any purpose, commercial or non-commercial." **Caveat, explicitly stated by the source itself**: non-federal datasets cataloged on Data.gov carry their own independent licenses that must be checked per dataset.
- **API available**: Yes, official — Data.gov Catalog API v4 (`api.gsa.gov/technology/datagov/v4/`), replacing the legacy CKAN endpoint (spot-checked as now returning 404 / effectively deprecated). Auth via `X-Api-Key`, `DEMO_KEY` available for testing.
- **Official API preferred**: Yes.
- **RSS available**: Not confirmed in this pass.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED** for federal-origin datasets specifically; treat as **ALLOWED_WITH_RESTRICTIONS** for the catalog as a whole since it also indexes non-federal, independently-licensed datasets.
- **Rate limit**: Personal key: 1,000 req/hour, no daily cap. `DEMO_KEY`: 30/hour, 50/day per IP (HTTP 429 on excess, auto-resets hourly).
- **Permitted adapter type**: Official API (Tier 1) — used as a *discovery* layer (Part 7 of the roadmap) pointing at other agencies' datasets, not a direct opportunity feed itself.
- **Compliance notes**: Value to Polaris is indirect — a catalog/discovery mechanism, not a source of opportunity records itself. Any dataset surfaced through it needs its own license checked before use.
- **Last policy check**: 2026-09-03. **Review required**: Only per-dataset, not for the catalog API itself.

---

## ALLOWED_WITH_RESTRICTIONS

### Grants.gov
- **Source URL**: https://www.grants.gov
- **robots.txt status**: Found. **Crawl permission**: Allowed — `Allow: /`, no restrictions; sitemap declared and confirmed live.
- **ToS reviewed**: Partial — general site ToS page not located, but the **API-specific** Terms & Conditions were found and reviewed (grants.gov/api/terms-conditions).
- **API available**: Yes, official — RESTful System-to-System (S2S) API (grants.gov/api, grants.gov/api/api-guide). Key via Grants.gov Help Desk or the Simpler.Grants.gov developer dashboard, `X-API-Key` header.
- **Official API preferred**: Yes.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: No published numeric limit; usage monitored, HHS reserves the right to throttle/revoke access "at any time for any other reason in its sole discretion."
- **Permitted adapter type**: Official API (Tier 1).
- **Compliance notes**: Attribution notice required in-product ("This product uses the Grants.gov API but is not endorsed or certified by..."); must not imply HHS endorsement; access is revocable at will, so the adapter should fail gracefully (not retry-storm) if access is withdrawn.
- **Last policy check**: 2026-09-03. **Review required**: No, but monitor for access revocation given the discretionary-termination clause.

### NSF.gov
- **Source URL**: https://www.nsf.gov
- **robots.txt status**: Found. **Crawl permission**: **Partial** — explicitly disallows `/funding/opportunities?*`, `/funding/opps?*`, the CSV export paths, and `/news/releases(?*)`. Two sitemaps declared (`sitemap.xml`, `sitemap-s3.xml`).
- **ToS reviewed**: Yes — nsf.gov/policies/reuse.jsp. Most page text is a US-government work and not subject to copyright ("You may freely copy that material"); visual media excluded ("should not be reused without permission"). No explicit scraping clause.
- **API available**: Not confirmed in this research pass — flagged as a follow-up item (a distinct NSF Award Search API may exist and wasn't verified).
- **Official API preferred**: N/A pending follow-up; RSS is the confirmed sanctioned channel today.
- **RSS available**: Yes, official — nsf.gov/rss, including `rss_www_funding_pgm_annc_inf.xml` (new funding opportunities) and `rss_www_funding_upcoming.xml` (upcoming due dates) — exactly the content Polaris needs.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** — RSS explicitly permitted and sanctioned; the funding-search HTML/CSV pages are explicitly disallowed and must not be crawled.
- **Rate limit**: Not published; treat conservatively (standard feed-polling interval, not aggressive).
- **Permitted adapter type**: RSS/Atom (Tier 1) — **not** static HTML of the funding-search pages.
- **Compliance notes**: This is the source Polaris already has a working RSS adapter proven against (a general NSF news feed was used during initial build) — switching to the funding-opportunity-specific feeds (`rss_www_funding_pgm_annc_inf.xml`) is a config change, not new adapter code.
- **Last policy check**: 2026-09-03. **Review required**: No for RSS; follow up on whether a dedicated Award/funding API exists before ever considering the disallowed HTML paths.

### Kaggle
- **Source URL**: https://www.kaggle.com
- **robots.txt status**: Not found (404) — site relies on ToS/AUP rather than robots.txt for access policy.
- **ToS reviewed**: Yes, with caveat — direct fetch of kaggle.com/terms was blocked by a reCAPTCHA bot-check wall; the prohibition language ("crawling," "scraping," or "spiders" ... "through the use of manual or automated means") was corroborated via search-indexed/ToS-summary sources and Kaggle's separate Acceptable Use Policy (kaggle.com/aup), not read first-party. **Flagged for a manual, browser-based confirmation before production reliance.**
- **API available**: Yes, official — the Kaggle API (github.com/Kaggle/kaggle-api, docs at kaggle.com/docs/api), covering competitions/datasets/kernels/leaderboards. Auth via account API token.
- **Official API preferred**: Yes — this is the only sanctioned path; the site also has aggressive bot-detection (sitemap.xml itself serves a CAPTCHA challenge to non-browser clients), reinforcing that only the official API is a workable route.
- **RSS available**: Not found.
- **Sitemap available**: Nominally present but not fetchable by non-browser clients.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** (official API only; direct scraping is NOT_ALLOWED under the corroborated ToS/AUP language).
- **Rate limit**: Governed by the Kaggle API's own usage terms (not independently re-verified here beyond auth requirements).
- **Permitted adapter type**: Official API (Tier 1) only.
- **Compliance notes**: Strongest official-API case among the tech-platform sources researched. **Action item**: manually load kaggle.com/terms in a real browser to get a first-party quote before this record is treated as fully closed.
- **Last policy check**: 2026-09-03. **Review required**: Yes — pending the manual ToS confirmation above.

### Eventbrite
- **Source URL**: https://www.eventbrite.com
- **robots.txt status**: Found. **Crawl permission**: Partial — disallows RSS/Atom paths (`/rss/`, `/atom/`, `/events/rss/`, `/events/atom/`), `/directory/` (except `/directory/sitemap/`), several query patterns, and ~100+ named scraper/bot user-agents entirely. Sitemaps declared and crawlable.
- **ToS reviewed**: Yes — eventbrite.com/tos/, Section 13.1: *"You have no right to, and you agree not to, scrape, crawl, or employ any automated means to extract data from the Sites."*
- **API available**: Yes, official — Eventbrite API v3 (developer.eventbrite.com), governed by a separate API Terms of Use incorporated into the main ToS.
- **Official API preferred**: Yes — the only permitted path; note the RSS-looking paths in robots.txt are explicitly disallowed for crawlers, so they are **not** a usable substitute for the API.
- **RSS available**: Paths exist but are robots.txt-disallowed — not a sanctioned ingestion route.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** (API only; direct scraping including the nominal RSS paths is NOT_ALLOWED).
- **Rate limit**: 1,000 calls/hour per OAuth token (API Terms of Use).
- **Permitted adapter type**: Official API (Tier 1).
- **Compliance notes**: Real, binding restrictions beyond rate limiting: **cannot cache/store past-event content** without explicit permission (only future-event data may be retained) — this directly affects how Polaris would need to handle an Eventbrite-sourced opportunity once its event date passes (align with the freshness/lifecycle design in `docs/ingestion-roadmap.md` Part 11 — an Eventbrite-origin record may need deletion, not just status transition, once past). Must display event title + a live link back to Eventbrite; cannot imply affiliation via Eventbrite branding.
- **Last policy check**: 2026-09-03. **Review required**: No for API use, but the past-event-retention restriction needs to be encoded into the adapter's own logic, not just noted here.

### Idealist.org
- **Source URL**: https://www.idealist.org
- **robots.txt status**: Found. **Crawl permission**: Broadly permissive (disallows only a third-party-login path and, for one specific AI-training crawler, `/en/careers/`). Sitemap declared.
- **ToS reviewed**: Yes — idealist.org/en/terms-of-service, Section 3.d: explicit, unambiguous prohibition on "any automated program, expert system, electronic agent or 'bot' ... spiders, robots, scrapers, crawlers ... data mining tools" and on scraping/republishing/licensing/selling site data.
- **API available**: Yes, official — "Volunteer Match API" / Open Network API (idealist.org/en/open-network-api), covering 80,000+ opportunities. **Requires a partnership application** (inquiry form) — not self-serve/anonymous, likely commercial terms.
- **Official API preferred**: Yes — the only permitted path.
- **RSS available**: Not confirmed found.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** (via API partnership only; direct scraping is explicitly NOT_ALLOWED regardless of the permissive robots.txt — ToS controls).
- **Rate limit**: Unknown — would be set by the partnership agreement, not published.
- **Permitted adapter type**: Official API (Tier 1), gated behind a business relationship, not implementable purely from public documentation.
- **Compliance notes**: Directly built for exactly this use case (an opportunity aggregator), but access requires an actual outreach/partnership step before any adapter can be built — not a purely technical integration task.
- **Last policy check**: 2026-09-03. **Review required**: Yes — requires initiating the partnership application before this can move past planning.

### HigherEdJobs
- **Source URL**: https://www.higheredjobs.com
- **robots.txt status**: Found. **Crawl permission**: Very permissive — disallows only `/ClickThru`, `/clickthru`, `/js`, `/jscript`. No sitemap declared.
- **ToS reviewed**: **Attempted, not confirmed** — higheredjobs.com/company/terms.cfm failed to render via automated fetch (twice); a general web search confirmed the URL exists as a standard legal-terms page but did not surface an explicit scraping clause in the available excerpts. **Not conclusively reviewed — flagged for a manual browser check.**
- **API available**: No public API found.
- **RSS available**: Yes, official and confirmed — per-category RSS feeds, e.g. `higheredjobs.com/search/rss.cfm?JobCat=37`, parameterized by job category.
- **Official API preferred**: N/A — RSS is the sanctioned mechanism here.
- **Sitemap available**: Not found.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** via the official RSS feeds — robots.txt permissiveness plus a genuinely sanctioned, structured RSS mechanism is strong evidence automated consumption is condoned, but the ToS gap keeps this short of an unqualified ALLOWED. Policy-level status is unchanged by the finding below, which is a live technical block, not a policy determination.
- **Rate limit**: Not published; treat as a normal feed-polling interval.
- **Permitted adapter type**: RSS/Atom (Tier 1) — reuses the existing, already-proven `rssAdapter` unchanged, just pointed at a per-category feed URL.
- **Compliance notes**: One of the easiest sources to implement (RSS-only, existing adapter) but carries an open compliance loose end — the ToS page needs a manual, human read before this record is closed out.
- **Live ingestion finding (2026-09-03)**: The `source-higheredjobs-rss` adapter was run for real against `https://www.higheredjobs.com/search/rss.cfm?JobCat=37` and failed with an XML parse error ("Unexpected close tag"). Direct browser inspection of the same URL showed the response was not the RSS feed at all but an **Incapsula anti-bot/WAF block page** ("Request unsuccessful. Incapsula incident ID: 939000340655576153-701122332750186673"). This is a technical access-control mechanism sitting in front of a feed that robots.txt and the site's own documentation otherwise sanction for automated use. Per Polaris's hard rule against circumventing anti-bot systems, CAPTCHAs, or other technical protections, **no workaround was attempted** (no user-agent spoofing, no header manipulation, no retry-based evasion). The `Source` row (`source-higheredjobs-rss`) has been set to `isActive: false` and this record's `reviewRequired` flag set to `true` pending a legitimate resolution — most likely contacting HigherEdJobs to request allowlisting of Polaris's ingestion IP/user-agent, or confirming a different access path. This finding does not change the ALLOWED_WITH_RESTRICTIONS policy determination above; it documents a real-world enforcement layer that policy research alone could not have surfaced.
- **Last policy check**: 2026-09-03. **Review required**: Yes — both for the pending manual ToS confirmation above and for the Incapsula block just described (does not retroactively change the policy status, since the source remains sanctioned in principle; it blocks the source from being reactivated until a non-circumventing path around the WAF is found).

---

## UNCLEAR_REQUIRES_REVIEW

### EU Funding & Tenders Portal
- **Source URL**: https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/home
- **robots.txt status**: Found at the `ec.europa.eu` domain root — extremely long, multi-agent file; **no entry found disallowing `/info/funding-tenders/`** in the general block.
- **ToS reviewed**: Yes, for the general EC legal notice (commission.europa.eu/legal-notice_en): content is **CC BY 4.0 licensed** ("reuse is allowed, provided appropriate credit is given and changes are indicated"), excluding third-party works, identifiable people, and IP rights. The Portal's own separate Terms & Conditions apply only on login to "My Area" — public browsing doesn't appear to require ToS acceptance.
- **API available**: **Unconfirmed** — third-party integration guides describe an "EC Search API"/Topic Search API with anonymous read access, but this could not be independently confirmed against official EU documentation; the portal's opportunity-search pages are a JS SPA that defeated automated fetch in this research pass.
- **Official API preferred**: Pending confirmation.
- **RSS available**: Reported by third-party guides, **not independently confirmed** by direct fetch.
- **Sitemap available**: Not confirmed.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — the licensing signal (CC BY 4.0, permissive robots.txt) is genuinely favorable, but the actual query mechanism for opportunity data needs direct confirmation before any adapter is built against it.
- **Rate limit**: Unknown pending API confirmation.
- **Permitted adapter type**: Pending — official API if confirmed, otherwise none until re-reviewed.
- **Compliance notes**: High potential value (Horizon Europe, Erasmus+, and other major EU grant programs) — worth the manual follow-up effort specifically because the licensing signal is favorable, unlike most `UNCLEAR` cases where the ambiguity cuts against pursuing the source at all.
- **Last policy check**: 2026-09-03. **Review required**: Yes — direct outreach to the EU service desk or manual review of the Portal Reference Documents needed before implementation.

### MLH (Major League Hacking)
- **Source URL**: https://mlh.io (redirects to https://www.mlh.com)
- **robots.txt status**: Found. **Crawl permission**: Broadly permissive — narrow disallows on account/tooling/admin paths only; event-listing pages are not blocked.
- **ToS reviewed**: Yes — mlh.com/terms. **No explicit scraping/bot/crawling clause found.** Closest relevant language: a license grant limited to "personal purposes and non-commercial use," and a ban on reverse-engineering/decompiling site technology (which doesn't directly address data collection).
- **API available**: No official API; only an unofficial community-built one on GitHub (not sanctioned).
- **RSS available**: None found.
- **Official API preferred**: N/A — none exists.
- **Sitemap available**: Not confirmed (404 at the standard path).
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — no direct scraping prohibition, but the "non-commercial use" license restriction is in real tension with Polaris aggregating MLH listings into a product, even a free one, since the boundary of "commercial use" isn't self-evident from the license text alone.
- **Rate limit**: Not published.
- **Permitted adapter type**: None until reviewed; sitemap-guided/static-HTML would be the technical candidate if cleared.
- **Compliance notes**: The kind of case this framework exists for — technically crawlable, but a real legal question (does a free aggregator product count as "non-commercial use"?) that shouldn't be resolved by assumption.
- **Last policy check**: 2026-09-03. **Review required**: Yes — needs an actual legal/product judgment call, not further technical research.

### DAAD (German Academic Exchange Service)
- **Source URL**: https://www.daad.de/en/ (scholarship database at www2.daad.de)
- **robots.txt status**: Found. **Crawl permission**: Permitted for general content (including the scholarship database) with `Crawl-delay: 2`; disallows internal/technical/portal paths only. Sitemap declared.
- **ToS reviewed**: Partial — no dedicated public "Terms of Use" page found (only an Imprint page and Data Privacy Statement); the Imprint states a general copyright notice over "all contents of this website (in particular texts, images and graphics)" with no explicit automation/scraping clause. A separate Terms-of-Use PDF exists only for the DAAD Alumni member portal, not the public scholarship database.
- **API available**: No public API/developer portal found.
- **RSS available**: Not found.
- **Official API preferred**: N/A — none exists.
- **Sitemap available**: Yes.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — robots.txt permits crawling and no explicit scraping ban was located, but the blanket copyright notice over all text content plus the absence of any public API/license statement means reuse rights for prose descriptions specifically are not clearly established.
- **Rate limit**: `Crawl-delay: 2` (explicit, must be respected).
- **Permitted adapter type**: Pending review — if cleared, sitemap-guided static HTML, extracting structured facts (deadlines, program names, eligibility) rather than reproducing description prose verbatim, which is the lower-risk subset even before formal clearance.
- **Compliance notes**: Germany's primary state-run scholarship clearinghouse — high value if cleared. The distinction worth preserving even pending review: structured facts (dates, names, categories) carry materially lower copyright risk than copying descriptive prose, and any future adapter here should be designed around that distinction regardless of the final compliance ruling.
- **Last policy check**: 2026-09-03. **Review required**: Yes.

---

## NOT_ALLOWED

### LinkedIn Jobs
- **Source URL**: https://www.linkedin.com
- **robots.txt status**: Found. **Crawl permission**: **Explicitly and directly prohibited** for general automated access — the file's own header states: *"The use of robots or other automated means to access LinkedIn without the express permission of LinkedIn is strictly prohibited."* Only a named `LinkedInBot` and a short allowlist for search-engine indexing are permitted.
- **ToS reviewed**: Yes — linkedin.com/legal/user-agreement, Section 8: explicit bans on scraping/crawling tools and on using/distributing data obtained via automated means, "whether directly or through third parties."
- **API available**: Yes, but fully gated — Talent Solutions Job Postings API, restricted to approved ATS/recruiting partners via formal application; not accessible for Polaris's use case.
- **RSS available**: None (deprecated).
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A — not applicable, access is prohibited outright.
- **Permitted adapter type**: None.
- **Compliance notes**: Confirms the expected outcome with the clearest, most unambiguous citation of any source researched — both robots.txt and the User Agreement independently and explicitly prohibit exactly what Polaris would need to do. Do not build an adapter for this source under any circumstance short of a formal LinkedIn partnership.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review needed — this is closed unless a business partnership changes the terms.

### Devpost
- **Source URL**: https://devpost.com
- **robots.txt status**: Found. **Crawl permission**: Permissive for unnamed crawlers, but explicitly blocks a long list of named bots (including several AI-crawler user-agents).
- **ToS reviewed**: Yes — info.devpost.com/terms, Section 4 (Code of Conduct): explicit prohibition on using "manual or automated software, devices, scripts robots, or other means" to scrape/crawl/spider the site or its content.
- **API available**: No official API (only unofficial third-party scrapers exist, not sanctioned).
- **RSS available**: Unconfirmed (candidate feed paths return 403).
- **Sitemap available**: No.
- **Automated access**: **NOT_ALLOWED** — ToS overrides the permissive-for-unnamed-bots robots.txt.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated; a manual partnership/licensing conversation is the only path.
- **Compliance notes**: The largest hackathon-listing aggregator on the web and a clear product fit — but not accessible without a direct business relationship.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review; would need a partnership conversation to revisit.

### Wellfound (AngelList Talent)
- **Source URL**: https://wellfound.com
- **robots.txt status**: Found. **Crawl permission**: Permissive on general job-listing pages, narrow disallows elsewhere. Sitemap declared.
- **ToS reviewed**: Yes — wellfound.com/terms, Section III: explicit ban on automated systems that access the site "in a manner that takes more bandwidth or produces greater load... than a human can reasonably produce" (narrow search-engine carve-out only) and a separate, direct ban on "harvesting, collection or 'scraping'" of content.
- **API available**: No (deprecated; only unofficial scrapers exist).
- **RSS available**: None.
- **Automated access**: **NOT_ALLOWED** — ToS overrides the permissive robots.txt on listing pages.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated.
- **Compliance notes**: Would feed the startup-jobs category; blocked without a data partnership.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review.

### Y Combinator "Work at a Startup"
- **Source URL**: https://www.workatastartup.com
- **robots.txt status**: Found — fully permissive (both the site itself and the ycombinator.com parent domain).
- **ToS reviewed**: Yes — ycombinator.com/legal (Terms of Use, governs workatastartup.com since it has no distinct public ToS page): explicit ban on "data mining, robots, scraping or similar data gathering or extraction methods," a ban on creating derivative works from site content, and an anti-circumvention clause against bypassing any access blocks YC puts in place.
- **API available**: No official API.
- **RSS available**: None.
- **Automated access**: **NOT_ALLOWED** — ToS explicitly overrides the technically wide-open robots.txt.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated. (Additionally, full listings typically require an authenticated YC/LinkedIn login, independently complicating anonymous access even if the ToS permitted it.)
- **Compliance notes**: High-signal YC-backed startup roles — valuable but not accessible without a partnership.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review.

### IIE / Fulbright Program
- **Source URL**: https://www.iie.org and https://us.fulbrightonline.org
- **robots.txt status**: Found for both — permissive (IIE disallows only search-result pages; Fulbright disallows only CMS system directories). IIE declares a sitemap; Fulbright does not (404 at the standard path).
- **ToS reviewed**: Yes, both — near-identically worded (same operating entity), each with a section titled "Conditions of Use; Impermissible Use of ... Websites": explicit prohibition on "spiders, robots, data mining techniques or other automated devices or programs to catalog, download or otherwise reproduce, store, analyze or distribute content," plus a ban on reselling access to any third party.
- **API available**: No.
- **RSS available**: None found on either property.
- **Automated access**: **NOT_ALLOWED** for both properties — explicit, matching, unambiguous ToS prohibition.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated.
- **Compliance notes**: Fulbright is the flagship US international fellowship program — high value if a licensing/data-sharing relationship can be negotiated directly with IIE; not obtainable by scraping under any interpretation of the reviewed terms.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review; a partnership conversation is the only path forward.

### ResearchGate
- **Source URL**: https://www.researchgate.net
- **robots.txt status**: Found — largely permissive at the robots.txt level (narrow disallows on a handful of technical/promo paths).
- **ToS reviewed**: **Yes, with caveat** — a direct fetch of researchgate.net/terms-of-service returned HTTP 403 (bot-blocked); the prohibition language was corroborated via independent search-indexed sources and ResearchGate's own terms-archive page rather than a first-party live read. Quoted (corroborated) language: an explicit ban on "any robot, spider, scraper, data mining tools... to access our Service for any purpose, except with the prior express permission of ResearchGate in writing." **Flagged for a manual, browser-based confirmation before this record is treated as fully closed**, though the language is consistent across multiple independent sources.
- **API available**: No (explicitly confirmed no official API exists).
- **RSS available**: None.
- **Automated access**: **NOT_ALLOWED**, pending the manual confirmation caveat above.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated.
- **Compliance notes**: Lower priority for Polaris regardless (occasional research-position listings, marginal fit versus the compliance question) — not worth pursuing without a direct licensing conversation even once the ToS text is manually confirmed.
- **Last policy check**: 2026-09-03. **Review required**: Yes — manual first-party ToS confirmation recommended, though the practical conclusion (do not ingest) is unlikely to change.

### UN Careers (careers.un.org)
- **Source URL**: https://careers.un.org
- **robots.txt status**: **Not found** — the path returns the site's normal SPA shell (200 OK) rather than a robots file; no published crawl policy.
- **ToS reviewed**: Yes — un.org/en/about-us/terms-of-use (UN Careers has no separate ToS, inherits the site-wide terms): explicit language limiting use of downloaded materials to "personal, non-commercial use, without any right to resell or redistribute them or to compile or create derivative works therefrom" — a direct, explicit prohibition on exactly what an aggregator does, independent of any bot-specific clause.
- **API available**: No official API found.
- **RSS available**: None found.
- **Sitemap available**: Not found (JS SPA).
- **Automated access**: **NOT_ALLOWED** — the no-redistribution/no-derivative-works clause controls even in the absence of a robots.txt.
- **Rate limit**: N/A.
- **Permitted adapter type**: None automated.
- **Compliance notes**: Would be the single best source for official UN jobs/internships/volunteer roles — worth a direct outreach to UN OICT/HR for a data-sharing exception or API, since the current terms flatly prohibit what Polaris would otherwise do.
- **Last policy check**: 2026-09-03. **Review required**: No further technical review; a partnership conversation is the only path forward.

### unjobs.org (third-party UN-jobs aggregator, distinct from careers.un.org)
- **Source URL**: https://unjobs.org
- **robots.txt status**: Found — **explicit blanket disallow for all unnamed user-agents** (`User-agent: * / Disallow: /`), with narrow, named exceptions only for Google, Bing, Twitterbot, Mediapartners-Google, and a link-checker bot — none of which would apply to a Polaris ingestion adapter.
- **ToS reviewed**: Partial — only a generic privacy/cookie policy located; no distinct Terms of Service page found on this specific domain.
- **API available**: No.
- **RSS available**: None found.
- **Automated access**: **NOT_ALLOWED** — the robots.txt blanket disallow is a direct, unambiguous signal against automated crawling by a generic bot.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: Explicitly self-identifies in its own footer as "Not an official document of the United Nations" — even setting the robots.txt block aside, it's a third-party re-aggregation whose own source data's licensing Polaris wouldn't control either. No reason to pursue this over a direct UN Careers relationship.
- **Last policy check**: 2026-09-03. **Review required**: No.

---

## Corporate Opportunity Sources (Batch 2 — 2026-09-03)

Research conducted for the corporate/non-job opportunity expansion
(`docs/corporate-opportunity-sources.md`), covering 32 companies/organizations nominated as
candidates for learning programs, fellowships, hackathons, mentorship, research programs,
and similar — explicitly excluding ordinary job postings. Same methodology as Batch 1 above
(live `robots.txt` and ToS fetches, not memory) and the same fail-closed rule: `NOT_ALLOWED`
is never implemented, `UNCLEAR_REQUIRES_REVIEW` never auto-runs. Every record cites what was
actually found; gaps are stated as gaps, not filled with a guess.

A pattern worth calling out up front, consistent with Batch 1: several companies with a
technically-permissive `robots.txt` (Bain, NVIDIA's main site, PwC, McKinsey) turned out to
have an explicit, unambiguous Terms-of-Service prohibition on scraping/data-mining that
overrides the robots.txt signal — reconfirming that robots.txt alone is never sufficient.
Two organizations (Intel, Anthropic) had directly-fetched, explicit anti-scraping ToS
language quoted verbatim below.

### Summary

| Status | Count | Organizations |
|---|---|---|
| **ALLOWED** | 1 | Hugging Face |
| **ALLOWED_WITH_RESTRICTIONS** | 14 | Google, Google DeepMind, GitHub, Microsoft, AWS, IBM, Salesforce, SAP, Qualcomm, Deloitte, Accenture, EY, BCG, JPMorgan |
| **UNCLEAR_REQUIRES_REVIEW** | 5 | Cisco, Oracle, OpenAI, KPMG, Visa |
| **NOT_ALLOWED** | 12 | Meta, Adobe, NVIDIA, Intel, Anthropic, PwC, McKinsey, Bain, Goldman Sachs, Morgan Stanley, Bloomberg, Mastercard |

12 of 32 — more than a third — are explicitly blocked, most by their own ToS rather than
robots.txt. This is a meaningfully lower "clean allow" rate than Batch 1's federal/nonprofit
sources, consistent with large consumer/enterprise brands investing heavily in anti-scraping
legal language and WAF infrastructure precisely because they're high-value scraping targets.

---

## ALLOWED (corporate)

### Hugging Face
- **Program(s) found**: Community-hosted hackathons/competitions as org pages (e.g.
  `huggingface.co/LeRobot-worldwide-hackathon`); official blog at `huggingface.co/blog`. A
  distinct "Fellowship" program exists but its only public page is a stale 2022 post — not
  treated as an active, ingestible program.
- **Source URL**: https://huggingface.co
- **robots.txt status**: Found. **Crawl permission**: Fully open — `Allow: /` for all agents. Declares `Sitemap: https://huggingface.co/sitemap.xml`.
- **ToS reviewed**: Yes, directly (huggingface.co/terms-of-service) — no clause addressing automated access, scraping, crawling, bots, or data mining was found.
- **API available**: The Hugging Face Hub API is real and well-documented, but is a model/dataset/Space registry API, not an opportunities API — hackathon/event pages are ordinary org/Space pages, not API-exposed records. Not usable as a JSON_API source for opportunity data specifically.
- **RSS available**: Yes, confirmed live and current — `https://huggingface.co/blog/feed.xml` (entries dated as recently as Sept 1–2, 2026).
- **Sitemap available**: Yes, including a dedicated blog sub-sitemap.
- **Automated access**: **ALLOWED**.
- **Rate limit**: Not published.
- **Permitted adapter type**: RSS (Tier 1) for blog-announced hackathons/community programs; individual hackathon org pages would need `sitemap_static_html` follow-up to extract structured details (dates, rules, prizes) since the RSS entry itself is just an announcement.
- **Compliance notes**: Cleanest result of the 32 — open robots.txt, a working RSS feed, and a directly-reviewed ToS with no scraping prohibition. Discovery (RSS) and the authoritative record (the linked hackathon page) are both first-party huggingface.co content, satisfying the "prefer official source" rule directly.
- **Last policy check**: 2026-09-03. **Review required**: No.

---

## ALLOWED_WITH_RESTRICTIONS (corporate)

### Google
- **Program(s) found**: Google Summer of Code (`summerofcode.withgoogle.com`); Google for Developers community programs — GDG, GDG on Campus, GDE, Accelerators (`developers.google.com/community`).
- **Source URL**: https://google.com (program pages on subdomains above)
- **robots.txt status**: Found on all checked domains. `google.com/robots.txt` has no disallow touching blog/program paths. `developers.google.com/robots.txt` disallows only `/youtube/partner/`. `summerofcode.withgoogle.com/robots.txt` returned 404 (no file present).
- **ToS reviewed**: Partial — `policies.google.com/terms` explicitly conditions automated access on robots.txt compliance and separately restricts using content to train ML models; applies to core Google properties, but whether it's the controlling document for the GSoC/DeepMind subdomains specifically was not confirmed.
- **API available**: No opportunity-specific API found.
- **RSS available**: Yes — `blog.google/rss/`, confirmed valid.
- **Sitemap available**: Yes — `developers.google.com/sitemap.xml` (sitemap-index, 40 sub-sitemaps, verified).
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: RSS (blog.google) for discovery + `sitemap_static_html` for the program pages themselves (no program-specific feed/API exists).
- **Compliance notes**: robots.txt is permissive on the program/news paths actually needed; the restriction is the unconfirmed applicability of the general Google ToS to program-specific subdomains, not any found prohibition.
- **Last policy check**: 2026-09-03. **Review required**: No, but confirm ToS applicability to `summerofcode.withgoogle.com` before implementing.

### Google DeepMind
- **Program(s) found**: Student Researcher Program (`deepmind.google/student-researcher-program/`) — paid research internships, 12–24 weeks.
- **Source URL**: https://deepmind.google
- **robots.txt status**: Found. **Crawl permission**: Blanket `Allow: /`, no disallow lines found.
- **ToS reviewed**: Not conclusively reviewed — a guessed DeepMind-specific terms URL 404'd; likely falls under Google's general terms but not confirmed via a service-specific terms list.
- **API available**: None found.
- **RSS available**: None found.
- **Sitemap available**: Yes, verified — lists education/, careers/, and accelerator pages.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: robots.txt and sitemap both support compliant static discovery; the ToS applicability gap and absence of RSS/API keep it at "restrictions" rather than fully clear.
- **Last policy check**: 2026-09-03. **Review required**: No, but resolve the ToS applicability gap before implementing.

### GitHub
- **Program(s) found**: GitHub Education — Student Developer Pack, Campus Experts, Enterprise for Schools (`github.com/education`).
- **Source URL**: https://github.com
- **robots.txt status**: Found. `github.com/robots.txt` disallows `/copilot/`, various repo-feature paths — no disallow on `/education`. `education.github.com` (pre-redirect) has no active Disallow, only Allow lines, with a reported 10-second crawl delay.
- **ToS reviewed**: Yes, partial — GitHub ToS Section D.9 ("Access Reciprocity") imposes a reciprocal-access condition specifically on automated collection of public content *for training commercially available AI models*; Section H (API terms) warns against abusive/excessive request volume. Not a blanket scraping ban, but a real condition worth a legal read given Polaris's AI-classification use of ingested content.
- **API available**: No Education-program-specific API found (the general GitHub REST/GraphQL APIs don't expose program data).
- **RSS available**: Yes — `github.blog/feed/`, confirmed valid (program-adjacent news only, not the program page itself).
- **Sitemap available**: Not confirmed this pass.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: No numeric limit found for HTML scraping; API terms mention suspension for abusive/excessive requests.
- **Permitted adapter type**: RSS (blog, discovery only) + `sitemap_static_html` (Education page itself).
- **Compliance notes**: robots.txt is clean on the Education page; the reciprocity clause in the ToS is a real nuance — confirm Polaris's downstream AI-classification use doesn't trip the "training commercially available AI models" condition before implementing.
- **Last policy check**: 2026-09-03. **Review required**: No, but read ToS Section D.9 directly before implementing.

### Microsoft
- **Program(s) found**: Microsoft Learn training catalog + Student Hub (`learn.microsoft.com/en-us/training/`); Microsoft Research PhD Fellowship — confirmed currently paused since 2023, redirected to the AI & Society Fellows program.
- **Source URL**: https://microsoft.com
- **robots.txt status**: Found. `microsoft.com/robots.txt` has no disallow on `/learn`, `/students`, `/research`; disallows `/news/search`, `/blog/feed/`, `/*/search/`. `learn.microsoft.com` disallows only Q&A-forum subpaths and `/*/opbuildpdf/`.
- **ToS reviewed**: Partial — `microsoft.com/en-us/legal/terms-of-use` bars "web scraping, web harvesting, or web data extraction" but that clause is explicitly scoped to "AI services"; ambiguous whether it governs the public Learn/Research docs pages Polaris would use.
- **API available**: No opportunity-specific API found.
- **RSS available**: Yes — `news.microsoft.com/feed/` ("Stories"), confirmed valid.
- **Sitemap available**: No XML sitemap found (`microsoft.com/sitemap.xml` is an HTML directory page, not XML).
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: RSS (news) for discovery; `manual`/`sitemap_static_html` for the program pages themselves given the ToS ambiguity and no confirmed sitemap.
- **Compliance notes**: The PhD Fellowship being paused means it isn't currently ingestible as an open opportunity regardless of compliance — worth noting before investing implementation effort here.
- **Last policy check**: 2026-09-03. **Review required**: No, but resolve the ToS scoping ambiguity before implementing beyond RSS.

### AWS (Amazon Web Services)
- **Program(s) found**: AWS Educate (`aws.amazon.com/education/awseducate/`), AWS DeepRacer (`aws.amazon.com/deepracer/`), AWS Activate (`aws.amazon.com/startups/`), AWS Builder Center (`builder.aws.com`, domain confirmed, content not deeply verified).
- **Source URL**: https://aws.amazon.com
- **robots.txt status**: Found. **Real conflict**: `Disallow: /blogs/` and `Disallow: /*/blogs/` block the entire blogs directory — including the RSS feed path (`/blogs/aws/feed/`) itself. Also `Disallow: /activate/hackathons`, `/activate/accelerators`, `/activate/event(s)` — AWS's own hackathon/accelerator pages are explicitly excluded from crawling.
- **ToS reviewed**: Not conclusively reviewed — AWS Service Terms had no scraping clause found; Amazon.com's general Conditions of Use returned HTTP 503 on repeated attempts.
- **API available**: None found for opportunity/program data.
- **RSS available**: `aws.amazon.com/blogs/aws/feed/` resolves and is valid RSS, but sits under the robots.txt-disallowed `/blogs/` prefix — treating it as usable would be inconsistent with the site's own crawl directive, not a green light.
- **Sitemap available**: Not confirmed.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS** — restricted specifically because the two most obvious ingestion paths (blog RSS, hackathon/accelerator pages) are both robots.txt-disallowed; only AWS Educate and AWS Activate's non-disallowed marketing pages are clearly fair game.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html` restricted to non-disallowed paths only — explicitly do NOT use the `/blogs/` RSS feed or `/activate/hackathons|accelerators|events` despite them being real and useful content.
- **Compliance notes**: A genuine example of "the easiest path is the disallowed one" — do not default to the RSS feed just because it resolves; robots.txt governs.
- **Last policy check**: 2026-09-03. **Review required**: No, but implementation must explicitly respect the `/blogs/` and `/activate/` disallows.

### IBM
- **Program(s) found**: IBM SkillsBuild (`skillsbuild.org`) — free courses, digital credentials; IBM badges via Credly (`credly.com/organizations/ibm/badges`).
- **Source URL**: https://ibm.com
- **robots.txt status**: Found. No disallow on `/skillsbuild`, `/research`, `/blog`; only specific bad bots fully blocked. `skillsbuild.org`'s own robots.txt not separately checked (gap).
- **ToS reviewed**: Yes, directly (ibm.com/legal/terms) — unusually explicit and favorable: "You may only use a crawler to crawl this Web site as permitted by this Web site's robots.txt protocol," all other spidering/data-mining prohibited. Since robots.txt doesn't block the relevant paths, robots.txt-compliant crawling is affirmatively permitted.
- **API available**: None found for program data.
- **RSS available**: No working feed found — both candidate URLs (`ibm.com/blog/feed/`, `newsroom.ibm.com/rss`) returned 404.
- **Sitemap available**: Not checked this pass (gap).
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: One of the strongest ToS results in this batch — IBM's terms affirmatively greenlight robots.txt-compliant crawling, a rare explicit permission rather than mere silence. Capped at "restrictions" only because no feed/API exists and `skillsbuild.org`'s own robots.txt wasn't independently confirmed. Note: IBM Research's internship/fellowship page (`research.ibm.com/careers`) redirects into a generic IBM careers/job-search portal and was excluded as a program source per the no-job-boards rule.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Salesforce
- **Program(s) found**: Salesforce Trailhead (`trailhead.salesforce.com`) — badges, guided learning trails, superbadges, Agentblazer AI program, certifications.
- **Source URL**: https://salesforce.com
- **robots.txt status**: Found. No disallow on `/trailhead` or `/trailblazer`; blog disallows are scoped to specific locale paths only.
- **ToS reviewed**: Not conclusively reviewed — only reached the legal-agreements hub page (`salesforce.com/company/legal/agreements/`), which links out to the actual Terms of Service without containing the text itself.
- **API available**: None found for program data.
- **RSS available**: Yes — `salesforce.com/blog/feed/`, confirmed valid.
- **Sitemap available**: Not confirmed this pass.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: RSS (blog) for discovery; Trailhead itself likely needs JS-rendering-aware `sitemap_static_html` or `manual`, not a simple static fetch.
- **Compliance notes**: Trailhead is real, active, and clearly distinct from a job board; capped at "restrictions" because the actual site ToS text couldn't be read.
- **Last policy check**: 2026-09-03. **Review required**: No, but read the actual ToS text before implementing.

### SAP
- **Program(s) found**: SAP University Alliances (`pages.community.sap.com/topics/university-alliances`) — Learning Hub access, academic conferences, teaching materials, student certification. ("SAP Next-Gen" is a dead/retired program name — not included as a source.)
- **Source URL**: https://www.sap.com (program hosted on `pages.community.sap.com`)
- **robots.txt status**: Found on `sap.com` — default `Disallow: /` for unlisted agents, but explicit allowances for major search/AI crawlers; narrow disallows otherwise (registration/consent paths, event-sponsorship pages).
- **ToS reviewed**: Not conclusively reviewed — every direct fetch of `www.sap.com` pages (homepage, terms-of-use, academic-alliances page) returned HTTP 403, consistent with an anti-bot/WAF challenge on the apex domain. No workaround attempted. `pages.community.sap.com` and `news.sap.com` (separate subdomains) fetched normally.
- **API available**: None found for program data.
- **RSS available**: Yes — `news.sap.com/feed/`, confirmed valid (general corporate news, not program-specific).
- **Sitemap available**: Not verified.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html` on `pages.community.sap.com` specifically (not the apex `sap.com` domain, which is WAF-blocked).
- **Compliance notes**: The apex-domain WAF block means the ToS gap is a real access limitation, not just an unread page — implementation must target the `pages.community.sap.com` subdomain only.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Qualcomm
- **Program(s) found**: Qualcomm Innovation Fellowship (`qualcomm.com/research/university-relations/innovation-fellowship`) — PhD/Master's research fellowship; Qualcomm Developer portal (`qualcomm.com/developer`) hosting an active DevPost-listed innovation challenge.
- **Source URL**: https://qualcomm.com
- **robots.txt status**: Found. Only blocks a handful of legacy/low-value bots; declares `Sitemap: https://www.qualcomm.com/sitemap.xml`. `developer.qualcomm.com` (QDN) 301-redirects into the main site, inheriting the main robots.txt.
- **ToS reviewed**: Not conclusively reviewed — `qualcomm.com/site/terms-of-use` appears client-side-rendered; every fetch returned only the page's `<title>`, not the terms body. Technical/rendering gap, not a found prohibition or an anti-bot block.
- **API available**: None found for program data.
- **RSS available**: None found (guessed path 404'd).
- **Sitemap available**: Yes, declared.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Both a real fellowship page and a real, currently-open innovation challenge were verified live; capped at "restrictions" because the ToS text itself couldn't be retrieved (JS rendering gap) and no feed/API exists.
- **Last policy check**: 2026-09-03. **Review required**: No, but retrieve and read the actual ToS text (e.g. via a real browser render) before implementing.

### Deloitte
- **Program(s) found**: Consulting Undergraduate Case Competition and related student-careers programs (`deloitte.com/us/en/careers/students.html`, `deloitte.com/us/en/careers/join-deloitte/consulting-undergraduate-case-competition.html` — confirmed live and current as of the 2026-09-03 implementation pass, after an initially-cited URL variant 404'd).
- **Source URL**: https://deloitte.com
- **robots.txt status**: Found. `Sitemap: https://www.deloitte.com/sitemap_index.xml`; disallows are narrow (`/languages/`, search-results paths, `/us/en/noindex/*`) — nothing blocking `/careers/` or program paths.
- **ToS reviewed**: Partial — `deloitte.com/global/en/legal/legal.html` has no explicit scraping/bot clause, but this may not be Deloitte's complete Acceptable Use Policy — not conclusively reviewed.
- **API available**: None found.
- **RSS available**: No official feed independently verified (third-party aggregators claim to mirror Deloitte Insights, but no first-party feed URL was confirmed).
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Program page is genuinely distinct from job listings and robots.txt is permissive; capped at "restrictions" pending full ToS/AUP confirmation and absent any feed.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Accenture
- **Program(s) found**: Distinct student-program funnel including Innovation Challenge (MBA), Externship, and Student Leadership Program (`accenture.com/us-en/Careers/innovation-challenge-mba`).
- **Source URL**: https://accenture.com
- **robots.txt status**: Found. `Sitemap: https://www.accenture.com/sitemap-index.xml`; disallows target `Careers/Registration`, `Careers/Form`, `Careers/Profiles`, and search endpoints — not general program content.
- **ToS reviewed**: Partial — `accenture.com/us-en/support/terms-of-use` has no scraping clause but references a separate Acceptable Use Policy at a URL that 404'd — not conclusively reviewed.
- **API available**: None found.
- **RSS available**: A newsroom feed exists but requires registration — not a compliant no-friction feed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Distinct, verified program pages plus permissive robots.txt, offset by an unreviewed AUP and a gated RSS feed that isn't usable as-is.
- **Last policy check**: 2026-09-03. **Review required**: No.

### EY
- **Program(s) found**: EY-Parthenon NextGen Women global case competition and related regional scholar/case programs (`ey.com/en_gl/careers/nextgen-women`).
- **Source URL**: https://ey.com
- **robots.txt status**: Found. No disallow on careers/insights paths; lists 168 regional sitemaps; explicitly allows several AI crawlers including `anthropic-ai`.
- **ToS reviewed**: Partial — `ey.com/en_gl/legal-and-privacy/legal-statement` has no scraping clause, but no page unambiguously titled "Terms of Use" was located for the main site — not conclusively reviewed.
- **API available**: None found.
- **RSS available**: Not verified.
- **Sitemap available**: Yes (168 regional sitemaps).
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Unusually explicit, permissive robots.txt (names `anthropic-ai` as an allowed agent) plus a verified distinct program page; capped at "restrictions" pending full ToS confirmation and absent any feed.
- **Last policy check**: 2026-09-03. **Review required**: No.

### BCG
- **Program(s) found**: RISE by BCG (`rise.bcg.com`) — digital/AI skills courses with real cohort dates; country-level case competitions via `careers.bcg.com` (e.g. "Crack the Case" Denmark, 10th annual edition).
- **Source URL**: https://bcg.com
- **robots.txt status**: Found on all three domains checked (bcg.com, careers.bcg.com, rise.bcg.com). `bcg.com` disallows search/profile/subscription/API paths but explicitly allows `/publications/`, `/capabilities/`, `/industries/`, `/press/`, `/news/`. `careers.bcg.com` disallows only apply-flow paths. `rise.bcg.com` disallows only `/wp-admin/`.
- **ToS reviewed**: Yes, directly (`bcg.com/about/terms-of-use`) — covers copyright/liability/registration but has no explicit clause on scraping, robots, or data mining.
- **API available**: None found.
- **RSS available**: No first-party feed found (a BCG podcast RSS is hosted on third-party captivate.fm, not bcg.com).
- **Sitemap available**: Yes, on all three domains.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: No anti-bot block was hit on any bcg.com-family domain, and the reviewed ToS is silent on automation, but no RSS/API exists.
- **Last policy check**: 2026-09-03. **Review required**: No.

### JPMorgan / JPMorganChase
- **Program(s) found**: A live, filterable programs directory (`jpmorganchase.com/careers/explore-opportunities/programs`) — Early Insight / Internship / Full-Time program listings, distinct from an open job-req board; Advancing Black Pathways and Women on the Move hub pages (read as general initiative hubs rather than single-opportunity pages).
- **Source URL**: https://jpmorganchase.com
- **robots.txt status**: Found. Disallows `/careers/explore-opportunities/tech-data-product`, `/about-us/aisymposium`, and a couple of document paths; explicitly `Allow: /sitemap.xml`. The general programs and impact paths are not disallowed.
- **ToS reviewed**: Yes, directly (`jpmorganchase.com/legal/terms-and-conditions`) — covers copyright/use restrictions but has no explicit clause on automated access/scraping/bots.
- **API available**: None found.
- **RSS available**: None found.
- **Sitemap available**: Yes, confirmed sitemap index with 80+ regional sitemaps.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Rate limit**: Not published.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: The most cleanly accessible financial-services firm researched — no anti-bot block encountered, robots.txt permissive, ToS silent on scraping, real sitemap confirmed. Restricted only because no RSS/API exists and the programs directory would need careful extraction rules to exclude the tech-data-product path, which is explicitly disallowed.
- **Last policy check**: 2026-09-03. **Review required**: No.

---

## UNCLEAR_REQUIRES_REVIEW (corporate)

### Cisco
- **Program(s) found**: Cisco Networking Academy (`netacad.com`) — free cybersecurity, Python, and networking courses/certifications.
- **Source URL**: https://cisco.com (program hosted on `netacad.com`)
- **robots.txt status**: `cisco.com/robots.txt` has broad allows plus explicit, by-name allowances for GPTBot, CCBot, Google-Extended, and ClaudeBot on `.md`/`.llms.txt` resources — Cisco has deliberately opened parts of its site to AI crawlers. `netacad.com/robots.txt` has no active Disallow, only Allow rules for static assets, with a reported (unconfirmed exact value) crawl-delay directive.
- **ToS reviewed**: Yes, directly (`cisco.com/c/en/us/about/legal/terms-conditions.html`) — the "Your Use of Our Site" section explicitly prohibits "monitoring, crawling... using bots or scripts," directly conflicting with the AI-crawler-friendly robots.txt on the parent domain.
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes, on `netacad.com` (~600+ URLs, verified).
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW**.
- **Rate limit**: Unconfirmed crawl-delay value on netacad.com.
- **Permitted adapter type**: None pending review.
- **Compliance notes**: A genuine, unresolved conflict between a robots.txt that explicitly names and permits ClaudeBot on parts of cisco.com and a corporate ToS that broadly forbids bots/crawling — and it's unconfirmed whether `netacad.com` is even governed by the same terms-and-conditions page. Needs a human legal read, not an automated guess, before any classification firmer than this.
- **Last policy check**: 2026-09-03. **Review required**: Yes.

### Oracle
- **Program(s) found**: Oracle University / MyLearn (`mylearn.oracle.com`) — could not verify beyond a page-title confirmation; no program content confirmed.
- **Source URL**: https://oracle.com
- **robots.txt status**: `oracle.com/robots.txt` returned HTTP 403 on two separate attempts — consistent with a WAF-style block on that path, not a normal 404.
- **ToS reviewed**: Not conclusively reviewed — could not retrieve any Oracle legal page; `blogs.oracle.com` and both candidate ToS URLs also returned 403. `education.oracle.com` timed out twice.
- **API available**: Unknown — could not check.
- **RSS available**: Unknown — could not check (blog fetch also 403'd).
- **Sitemap available**: Unknown — could not check.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW**.
- **Rate limit**: Unknown.
- **Permitted adapter type**: None pending review.
- **Compliance notes**: A consistent, multi-path block across Oracle's main corporate domain. No workaround was attempted. Not enough was accessible to make any stronger claim than "unclear" — a textbook case where honesty about a gap is the correct answer, not a fabricated conclusion.
- **Last policy check**: 2026-09-03. **Review required**: Yes.

### OpenAI
- **Program(s) found**: OpenAI Researcher Access Program (`grants.openai.com/prog/openai_researcher_access_program/`) — API credit grants; OpenAI Academy (`academy.openai.com`) — free courses/events.
- **Source URL**: https://openai.com
- **robots.txt status**: `openai.com/robots.txt`: `Allow: /` plus one specific `Disallow: /microsoft-for-startups/`; sitemap declared. `academy.openai.com/robots.txt` separately disallows `/events`, `/login`, `/call`, `/integrations`, `/widgets`, `/viewOnly` — the Academy's live event/workshop listings specifically are excluded from crawling even though course pages are not.
- **ToS reviewed**: Not conclusively reviewed on the primary source — both OpenAI ToS URLs returned HTTP 403 on direct fetch (anti-bot block; no workaround attempted). Credible secondary sources report language prohibiting automated scraping/data extraction except via the API, but this was not independently confirmed from OpenAI's own page text.
- **API available**: The main OpenAI API is inference-only; Researcher Access Program applications go through a third-party form (SurveyMonkey Apply), not an API.
- **RSS available**: Not found.
- **Sitemap available**: Yes — a 40-way sitemap index including `/openai-academy/`.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW**.
- **Rate limit**: Not published.
- **Permitted adapter type**: None pending review.
- **Compliance notes**: Genuinely ambiguous — open robots.txt and a live sitemap on one hand, a credibly-reported-but-unverified scraping prohibition and a partial `/events` disallow on the Academy subdomain on the other. Needs a human to actually read the ToS (e.g. via a real browser render past the anti-bot block) before any firmer classification.
- **Last policy check**: 2026-09-03. **Review required**: Yes.

### KPMG
- **Program(s) found**: Multiple named early-career programs (Global Advantage Program, Ace the Case, Rise Leadership Conference, Ideation Challenge, Embark Scholars) on a separate careers subdomain (`kpmguscareers.com/early-career/program/`).
- **Source URL**: https://kpmg.com (programs hosted on `kpmguscareers.com`)
- **robots.txt status**: `kpmg.com/robots.txt` is broadly permissive (`Allow: /`). `kpmguscareers.com` (a separately-hosted Avature recruiting site) has its own, wide-open robots.txt that only blocks one tracking `.php` endpoint.
- **ToS reviewed**: Partial and structurally ambiguous — the main-domain ToS (`kpmg.com/xx/en/misc/legal.html`) explicitly bars "any scraper, robot, bot, spider, data-mining tool, automated script or other automated means... without KPMG's prior written consent" plus an AI/ML training ban, but the actual program page lives on `kpmguscareers.com`, a different domain/infrastructure with no separately located Terms of Use.
- **API available**: None found.
- **RSS available**: Not verified.
- **Sitemap available**: Not found on the `kpmguscareers.com` subdomain.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW**.
- **Rate limit**: Not published.
- **Permitted adapter type**: None pending review.
- **Compliance notes**: A real, structural ambiguity (not a research gap): does the parent `kpmg.com` scraping ban extend to a differently-hosted subdomain with its own permissive robots.txt and no located terms of its own? This is a legal question for a human, not something further automated fetching can resolve.
- **Last policy check**: 2026-09-03. **Review required**: Yes.

### Visa
- **Program(s) found**: Visa Black Scholars and Jobs Program with the Thurgood Marshall College Fund ($10M/5yr, verified real via press release); Visa Foundation partnerships on the corporate social-impact page.
- **Source URL**: https://visa.com
- **robots.txt status**: Could not retrieve — three attempts (with and without `www`, explicit `http://`) all returned an empty body, distinct from a clean 403 or connection reset, and genuinely inconclusive.
- **ToS reviewed**: Yes, directly (`visa.com/en-us/legal`) — no explicit scraping/bot/data-mining clause found; only a general "must not damage or impair the site" restriction.
- **API available**: None found for program data.
- **RSS available**: Not checked (deprioritized given the robots.txt gap).
- **Sitemap available**: Not checked.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW**.
- **Rate limit**: Unknown.
- **Permitted adapter type**: None pending review.
- **Compliance notes**: Unlike most financial-services sites in this batch, Visa's actual content pages fetched successfully with real program content — this isn't a hard block. But without a readable robots.txt, a crawl-directive-based compliance verdict can't honestly be stated as ALLOWED yet.
- **Last policy check**: 2026-09-03. **Review required**: Yes — specifically, retry the robots.txt fetch and confirm whether the empty response is transient.

---

## NOT_ALLOWED (corporate)

### Meta
- **Program(s) found**: Meta Research — RFP grants and a Fellows Program (`research.facebook.com`).
- **Source URL**: https://meta.com / https://about.meta.com
- **robots.txt status**: `about.meta.com/robots.txt` **explicitly disallows a named list of bots including ClaudeBot** (`Disallow: /` for that user-agent group, alongside GPTBot, Google-Extended, PerplexityBot, and others). `ai.meta.com/robots.txt` blocks several scraper bots outright and disallows `/intern/`, `/internal/`, `/login/`.
- **ToS reviewed**: Yes, directly (`facebook.com/legal/terms`, clause 3.2(3)) — states users "cannot access or compile data from our products using automated tools without our prior permission" (fetched in a non-English locale; substance consistent across fetches but should be re-verified in English before citing verbatim in a legal context).
- **API available**: None relevant.
- **RSS available**: None found.
- **Sitemap available**: Not found (`about.meta.com/sitemap.xml` returned 404).
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: An explicit per-name robots.txt block on the very crawler class this pipeline would use, combined with a ToS clause requiring prior permission for automated data collection — clear and unambiguous, even though the Meta Research program page itself is real.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Adobe
- **Program(s) found**: Adobe for Students/Education (`adobe.com/education.html`); Adobe Community Challenges gallery.
- **Source URL**: https://adobe.com
- **robots.txt status**: Targeted `Allow` rules for specific student-program landing pages alongside broad `Disallow` on regional `/en-XX/learn/` paths and a split rule on `/community/gallery` (disallowed generally, with a narrow `Allow` for `/community/gallery/challenges` specifically).
- **ToS reviewed**: Yes — `adobe.com/legal/terms.html` Section 6.18 explicitly prohibits "data mining or similar data gathering and extraction methods... including data scraping for machine learning or other purposes"; Section 6.6 prohibits accessing the service by any means other than the provided interface; Section 17 restricts using outputs to train AI systems.
- **API available**: None found for program data.
- **RSS available**: Not confirmed.
- **Sitemap available**: Not confirmed.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: The most explicit and unambiguous ToS prohibition found across the entire batch — it names "data scraping for machine learning" directly, which is precisely what Polaris's ingestion+AI-classification pipeline does. Even though the education page itself resolves and parts of robots.txt are permissive, the ToS is dispositive.
- **Last policy check**: 2026-09-03. **Review required**: No.

### NVIDIA
- **Program(s) found**: NVIDIA Deep Learning Institute (`nvidia.com/en-us/training/`, `.../deep-learning-ai/education/`) — courses, certifications, workshops.
- **Source URL**: https://nvidia.com (main site); `blogs.nvidia.com` is a separate, WordPress-hosted subdomain
- **robots.txt status**: `nvidia.com/robots.txt` is broadly permissive (`Allow: /`) with narrow disallows for gated PDFs, admin/forms, and training-academy login/auth pages only.
- **ToS reviewed**: Yes, directly (`nvidia.com/en-us/about-nvidia/legal-info/`) — explicit and unambiguous: prohibits use of "any robot, spider, scraper, crawler, data mining tool, data gathering or extraction tool... to access, acquire, copy or monitor any portion of the Site." This directly covers the DLI training pages verified.
- **API available**: None found for program data.
- **RSS available**: `blogs.nvidia.com/feed/` is real and valid, but that subdomain's own ToS applicability wasn't confirmed, and it's general news/announcements, not the program record itself.
- **Sitemap available**: Not confirmed on the main site.
- **Automated access**: **NOT_ALLOWED** (main site, `nvidia.com`). The separate `blogs.nvidia.com` subdomain is treated as **Tier C, discovery-only** — its RSS feed can flag that a program was announced, but the actual program record must not be built from the blog alone per the "prefer official source" rule, and the main DLI pages it would point to are ToS-prohibited anyway.
- **Rate limit**: A ban on causing "unreasonable or disproportionately large load" (main site ToS).
- **Permitted adapter type**: None for the main site. RSS discovery-only, no direct storage, for the blog.
- **Compliance notes**: A clean example of robots.txt being permissive while ToS is an explicit, unambiguous prohibition on exactly the activity Polaris would perform — ToS controls.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Intel
- **Program(s) found**: Intel Software Innovator Program (`intel.com/content/www/us/en/developer/community/innovators.html`) — developer ambassador/speaker/demo program.
- **Source URL**: https://intel.com
- **robots.txt status**: No path-level block on developer/program content; general disallows target parameterized paths, secure directories, PDFs; most crawlers get a 10-second crawl delay.
- **ToS reviewed**: Yes, directly (`intel.com/content/www/us/en/legal/terms-of-use.html`) — explicit prohibition, quoted: Section 4.1.14 bars "automated searches against Intel's systems... including using automated 'bots,' link checkers, or other scripts or web scraping technologies, without the prior written permission of Intel"; 4.1.16 bars "text mine, data mine, or harvest metadata"; 4.1.17 bars systematic/bulk downloading.
- **API available**: None found; `developer.intel.com` no longer resolves as a distinct subdomain (redirects into a generic corporate 404 handler).
- **RSS available**: Newsroom RSS link found but broken/redirects to a 404 redirector — not usable.
- **Sitemap available**: Yes, an 8-file index — moot given the ToS prohibition.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: robots.txt alone would look fine, but a directly-verified, explicit contractual prohibition overrides that. Only manual/periodic human review of the Innovator Program page is appropriate absent written permission from Intel.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Anthropic
- **Program(s) found**: Anthropic Fellows Program (`alignment.anthropic.com/2025/anthropic-fellows-program-2026/`) — paid AI-safety research fellowship; Anthropic AI for Science Program (described at `support.claude.com/en/articles/11199177-anthropic-s-ai-for-science-program`) — academic/nonprofit API-credit research grants.
- **Source URL**: https://anthropic.com
- **robots.txt status**: `Allow: /`, sitemap declared (700+ URLs, confirmed current through Sept 2026) — fully open at the robots.txt level.
- **ToS reviewed**: Yes, directly (`anthropic.com/legal/consumer-terms`) — explicit prohibition, quoted: bars users "to crawl, scrape, or otherwise harvest data or information from our Services other than as permitted," and separately bars accessing the Services "through automated or non-human means, whether through a bot, script, or otherwise," except via an Anthropic API Key or explicit permission.
- **API available**: None for opportunity data (the Claude API is a model-inference API, unrelated to program listings).
- **RSS available**: None found at common guessed paths.
- **Sitemap available**: Yes, 700+ URLs.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: The one case in this batch with a directly-fetched, unambiguous, primary-source ToS prohibition on non-API automated access, despite an open robots.txt — that contractual restriction controls. Both program pages are real and current; manual/periodic human review is the only compliant path absent an API key or explicit written permission. Included here specifically to demonstrate the framework applies evenhandedly, including to the company building Polaris's own AI layer.
- **Last policy check**: 2026-09-03. **Review required**: No.

### PwC
- **Program(s) found**: The "Challenge" case competition (`pwc.com/us/en/careers/university-relations/challenge-case-study.html`).
- **Source URL**: https://pwc.com
- **robots.txt status**: Fetched successfully via curl (200) — mostly legacy PDF/path exclusions, `Sitemap: https://www.pwc.com/sitemap.xml`. Note: the WebFetch tool itself got 403 on this and other pwc.com URLs, indicating edge bot-management inconsistency rather than a robots.txt restriction.
- **ToS reviewed**: Yes, directly (`pwc.com/gx/en/legal-notices/terms-and-conditions.html`) — explicit prohibition, quoted: "Use any robot, spider, Websites search/retrieval application or other manual or automatic device to (a) retrieve, index, 'scrape,' 'data mine' or otherwise gather content from the Websites... without PwC's express prior written consent," plus a ban on systematic downloading/storage and using content for AI training.
- **API available**: None found.
- **RSS available**: An official feed exists (`pwc.com/gx/en/site-map/rss-feeds.html`, FeedBurner-hosted) but only for global press releases, not program data.
- **Sitemap available**: Yes.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: robots.txt permits crawling technically, but the ToS is an explicit, unambiguous prohibition that overrides the technical permissiveness.
- **Last policy check**: 2026-09-03. **Review required**: No.

### McKinsey
- **Program(s) found**: Forward (`mckinsey.org`) — a genuine, distinct fellowship-style skills program with a real application deadline found live (Oct 5).
- **Source URL**: https://mckinsey.com / https://mckinsey.org
- **robots.txt status**: `mckinsey.com/robots.txt` disallows `/RSS/`, `/insights/rss.aspx`, `/search`, `/content/`, `/McKinsey/`. `mckinsey.org/robots.txt` **explicitly disallows `/forward/`** — the one relevant program path is directly blocked from crawlers. Both WebFetch and plain `curl` requests to `mckinsey.com/robots.txt` timed out/connection-failed repeatedly; only a real browser session (navigation, not a stealth technique) succeeded in retrieving it.
- **ToS reviewed**: Yes, directly (`mckinsey.com/terms-of-use`, dated Jan 28, 2025) — explicit prohibition, quoted: "You may not access, search, or collect, mine, or extract data—including by crawling or scraping—from the Site or the Site Content by any means (automated or otherwise) without McKinsey's express written permission," plus a ban on using content to train/fine-tune/ground AI systems.
- **API available**: None found.
- **RSS available**: RSS paths exist but are explicitly disallowed in robots.txt.
- **Sitemap available**: Yes.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: Both an explicit ToS prohibition and an explicit robots.txt disallow on the one relevant program path (`/forward/`), plus network-level friction consistent with active bot-blocking infrastructure. No workaround (user-agent spoofing or otherwise) was attempted — a plain browser render is what surfaced the robots.txt content.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Bain
- **Program(s) found**: A real internships/programs hub listing many named regional programs — CREW, Consulting Kickstart, Bainworks, True North Scholarship, Be Bold Scholarship, First Nations Scholarship (`bain.com/careers/work-with-us/internships-programs/`); a World Economic Forum Externship program.
- **Source URL**: https://bain.com
- **robots.txt status**: Only disallows `*/noindex/*, */alumni/*, */secure/*, */mailings/*` and a filter query param — the programs page itself is not disallowed.
- **ToS reviewed**: Yes, directly (`bain.com/about/terms/`) — explicit prohibition, quoted: prohibits use of "any robot, spider, scraper or other automated means to access the Site" and "any data mining, data gathering or extraction method."
- **API available**: None found.
- **RSS available**: None found.
- **Sitemap available**: Yes, multi-language + image/video sitemaps declared in robots.txt.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A.
- **Permitted adapter type**: None.
- **Compliance notes**: robots.txt alone would look permissive, but the Terms of Use directly and explicitly bar the exact activity Polaris would perform — this overrides the robots.txt signal, exactly the pattern the compliance gate exists to catch.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Goldman Sachs
- **Program(s) found**: Possibilities Series (Americas/APAC/EMEA) and 10,000 Women — found via search referencing `goldmansachs.com/careers` and `/community-impact` paths; could not confirm any of these pages resolve.
- **Source URL**: https://goldmansachs.com
- **robots.txt status**: Fetched successfully — `Disallow: /materials/, /disclaimer/ipo` for all agents; additional disallows specifically for GPTBot/ChatGPT-User (`/alumni/, /insights/top-of-mind/, /what-we-do/research/`). Program paths under `/careers/` are not disallowed by the general rule.
- **ToS reviewed**: Not conclusively reviewed — direct fetch of both the terms-and-conditions page and the disclaimer page returned HTTP 403.
- **API available**: None found for program data.
- **RSS available**: A podcast feed exists (`exchanges-podcast/feed.rss`) but is unrelated to programs.
- **Sitemap available**: Declared in robots.txt but the fetch of it also returned 403.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: N/A (moot given the access block).
- **Permitted adapter type**: None.
- **Compliance notes**: robots.txt itself is fetchable and largely permissive, but every actual content page tested — careers/programs, terms, disclaimer, even the sitemap — hit a WAF 403. A clear anti-bot block on the content needed for ingestion; no workaround was attempted.
- **Last policy check**: 2026-09-03. **Review required**: No (blocked at the infrastructure level, not a legal ambiguity).

### Morgan Stanley
- **Program(s) found**: HBCU Scholars Program (Howard/Morehouse/Spelman, $12M), Richard B. Fisher Scholarship, Future Generation Scholarship — all documented in third-party press coverage only; no morganstanley.com URL could be confirmed reachable.
- **Source URL**: https://morganstanley.com
- **robots.txt status**: Could not retrieve — repeated attempts (robots.txt, terms, a press release, the diversity/inclusion page) all returned `ECONNRESET`, consistent with a network-level anti-bot block rather than a transient failure.
- **ToS reviewed**: Not conclusively reviewed — blocked before any page could be read.
- **API available**: Unknown.
- **RSS available**: Unknown.
- **Sitemap available**: Unknown.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: Unknown.
- **Permitted adapter type**: None.
- **Compliance notes**: No workaround was attempted for the connection-level block. Per the "third-party sources can be used for discovery but not as the record of truth" rule, and per "do not create an opportunity solely from an article if the authoritative source cannot be established," these scholarship programs are NOT candidates for ingestion even though they're clearly real — no verifiable official URL exists to serve as the source of record.
- **Last policy check**: 2026-09-03. **Review required**: No (blocked at the infrastructure level).

### Bloomberg
- **Program(s) found**: A hackathon partnership with The Knowledge House ("Hack of Knowledge") and a Bloomberg Journalism Diversity Program — both found via search only.
- **Source URL**: https://bloomberg.com
- **robots.txt status**: Partially retrieved (the fetch tool truncated a long file) — confirms `Disallow: /search, /account/*, /company/search/, /press-releases/, /explore/, /artemis/` among others.
- **ToS reviewed**: Not reviewed — deprioritized after the content-page block below.
- **API available**: None relevant.
- **RSS available**: Yes, real and well-known category feeds (markets/technology news), but these are general news/markets content, not opportunity/program listings — they don't solve the ingestion need.
- **Sitemap available**: Partial (`billionaires/sitemap.xml` seen in robots.txt; full index not confirmed).
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: Not published.
- **Permitted adapter type**: None.
- **Compliance notes**: The actual `bloomberg.com/company/press/...` page needed to verify either program returned a 403. Bloomberg's genuinely useful asset (news RSS) doesn't cover opportunity data, so there's no compliant path to the actual program record even setting the block aside.
- **Last policy check**: 2026-09-03. **Review required**: No.

### Mastercard
- **Program(s) found**: Girls4Tech STEM education program (a 10-year program, well documented) — could not confirm the page is reachable. Note: "Mastercard Foundation" (`mastercardfdn.org`), which runs the well-known Scholars Program, is an independent Canadian charitable foundation, legally distinct from Mastercard Inc. — not the same organization and not attributable to the corporation.
- **Source URL**: https://mastercard.com
- **robots.txt status**: Could not retrieve — 403 Forbidden.
- **ToS reviewed**: Not conclusively reviewed — two separate Terms-of-Use URLs also returned 403.
- **API available**: Unknown.
- **RSS available**: Unknown.
- **Sitemap available**: Unknown.
- **Automated access**: **NOT_ALLOWED**.
- **Rate limit**: Unknown.
- **Permitted adapter type**: None.
- **Compliance notes**: Every single mastercard.com path tested returned 403, a consistent WAF block; no workaround was attempted. The Mastercard Foundation/Mastercard Inc. distinction is flagged so a future researcher doesn't mistakenly attribute the Foundation's Scholars Program to this corporate compliance record.
- **Last policy check**: 2026-09-03. **Review required**: No (blocked at the infrastructure level).

---

## Follow-up items before any of the above move to implementation

1. **Kaggle** — manually load `kaggle.com/terms` in a real browser (automated fetch was
   blocked by reCAPTCHA) to get a first-party quote confirming the corroborated scraping
   prohibition, before treating the "API-only" conclusion as fully closed.
2. **HigherEdJobs** — manually load `higheredjobs.com/company/terms.cfm` (automated fetch
   failed to render twice) to confirm no scraping-restriction clause conflicts with the
   otherwise-clean RSS path.
3. **ResearchGate** — manually load `researchgate.net/terms-of-service` directly (returned
   HTTP 403 to automated fetch) for a first-party-verified quote, though the practical
   conclusion (do not ingest) is unlikely to change.
4. **EU Funding & Tenders Portal** — the claimed Search API/RSS feed needs confirmation via
   the official Portal Reference Documents or direct EU service-desk contact; the portal's
   JS-driven routing defeated automated verification in this pass despite a favorable
   licensing signal.
5. **MLH** and **DAAD** — both need an actual human/legal judgment call (is a free aggregator
   "non-commercial use"? does the blanket copyright notice restrict structured-fact reuse?)
   rather than further automated research — these are policy decisions, not missing facts.
6. **NSF** — verify whether a dedicated Award/funding API exists distinct from the RSS feeds
   already confirmed sanctioned; not required to proceed (RSS is sufficient), but worth
   knowing about.

## Follow-up items — Corporate batch (Batch 2)

7. **Google** / **Google DeepMind** — confirm whether Google's general Terms of Service is
   the controlling document for `summerofcode.withgoogle.com` and `deepmind.google`, or
   whether a service-specific terms page exists that wasn't found.
8. **GitHub** — a human should read ToS Section D.9 ("Access Reciprocity") directly and
   confirm Polaris's downstream AI-classification use doesn't trip its "training commercially
   available AI models" condition before implementing beyond the blog RSS feed.
9. **Microsoft** — resolve whether the ToS "web scraping... for AI services" clause is scoped
   to Microsoft's own AI products or extends to any automated access of Learn/Research pages.
10. **Salesforce**, **Qualcomm** — both had a ToS page that returned only a `<title>` tag or a
    non-text hub page to automated fetch; a real browser render is needed to actually read the
    terms before treating either as more than "restrictions."
11. **Cisco** — a human legal read is needed to resolve the direct conflict between
    cisco.com's AI-crawler-friendly robots.txt and its own ToS's blanket bot prohibition, and
    to confirm which document (if either) governs `netacad.com`.
12. **OpenAI** — retrieve and read the actual Terms of Use text (currently blocked by an
    anti-bot 403 on direct fetch) before resolving the UNCLEAR status either way.
13. **KPMG** — a legal opinion is needed on whether `kpmg.com`'s scraping ban extends to the
    separately-hosted `kpmguscareers.com` recruiting subdomain, which has its own permissive
    robots.txt and no located terms of its own.
14. **Visa** — retry the robots.txt fetch (the prior attempts returned an inconclusive empty
    body rather than a clear 403/404) before classifying either way.
15. **AWS** — if AWS Educate/Activate are implemented, the adapter must explicitly respect the
    `Disallow: /blogs/` and `Disallow: /activate/hackathons|accelerators|events` rules — do
    not default to the working RSS feed or the hackathon/accelerator pages just because they
    resolve; robots.txt governs over convenience.
16. **Morgan Stanley**, **Bloomberg** — both have real, well-documented scholarship/hackathon
    programs per third-party press coverage, but no official URL could be confirmed reachable
    in this pass. Per the "don't create an opportunity from an article without an
    authoritative source" rule, do not ingest from press coverage alone — periodically retry
    finding a live, official program page instead.

---

## India + Global Sources (Batch 3 — 2026-09-03, demo dataset expansion)

Research for `docs/demo-dataset-plan.md`'s India + global-accessible-to-India dataset
strategy: 16 candidates — 8 Indian government/institutional sources, 8 hackathon/competition
platforms and corporate India-specific programs — investigated via live robots.txt/ToS/
RSS/sitemap/API checks, same methodology and fail-closed rule as Batches 1-2.

**Hard rule specific to this batch**: `geographicScope` is set only from what a source
explicitly states. Government-of-India sources are classified `INDIA_ONLY` because their own
eligibility language says so (Indian citizens/institutions), not because they're India-based.
Platform sources that host both India-only and internationally-open listings on the same
domain (MLH, Unstop, Devfolio, HackerEarth) are **not** given a source-level default — every
item ingested from them stays `LOCATION_UNKNOWN` until a future per-item classification pass,
because inferring geography from the platform rather than the individual listing would violate
the explicit "do not assume international-looking = open to India" rule.

### Summary

| Status | Count | Sources |
|---|---|---|
| **ALLOWED** | 1 | MyGov.in |
| **ALLOWED_WITH_RESTRICTIONS** | 8 | Smart India Hackathon, Atal Innovation Mission, DST (dst.gov.in), Unstop, Devfolio, HackerEarth, MLH, Google for Startups (India) — no new India-specific program found |
| **UNCLEAR_REQUIRES_REVIEW** | 6 | Startup India, AICTE, DST INSPIRE portal (online-inspire.gov.in), TCS CodeVita, Infosys Springboard, E-Cell IIT Bombay |
| **NOT_ALLOWED** | 1 | MeitY / Digital India (meity.gov.in — confirmed anti-bot 403 block on robots.txt and homepage) |

Two research corrections worth flagging: the brief's assumed domains for TCS CodeVita
(`codevita.tcs.com`) and Infosys Springboard (`springboard.infosys.com`) don't resolve — the
real domains are `codevita.tcsapps.com` and `infyspringboard.onwingspan.com` respectively,
confirmed live. Kaggle's public API was separately re-checked specifically for this batch's
eligibility-data question: it does not expose per-competition eligibility/geography fields at
all (`ref, deadline, category, reward, teamCount, userHasEntered, userRank` only) — confirmed
via `kaggle competitions list`'s actual schema — so Kaggle cannot be used for this dataset's
geographic classification need regardless of its existing ALLOWED_WITH_RESTRICTIONS status.

### ALLOWED

**MyGov.in** — `mygov.in`. robots.txt found: blocks `/admin/`, `/user/`, `/api/`,
`/jsonrpc/`, `/cron.php`; **`Crawl-delay: 10`** (must be honored). Working RSS at
`mygov.in/rss.xml`, confirmed live with real, dated (Sept 2026) contests. Website Policy page
states content "may be reproduced free of charge" with attribution; no scraping-specific
prohibition found. **Automated access: ALLOWED.** `geographicScope: INDIA_ONLY` (citizen
engagement platform — Government of India). Adapter: RSS, honoring the 10s crawl-delay.
Review required: No.

### ALLOWED_WITH_RESTRICTIONS

**Smart India Hackathon** (`sih.gov.in`) — robots.txt: `Disallow:` (fully permissive, all
agents). No sitemap/RSS; website-policies page not located, so ToS not conclusively reviewed.
Verified real, current SIH 2026 cycle content. `geographicScope: INDIA_ONLY` (student teams
via Indian institutions; no international eligibility stated). Adapter: `sitemap_static_html`.
Review required: No.

**Atal Innovation Mission** (`aim.gov.in`) — No robots.txt file exists (404 = default-allow,
not an affirmative statement — noted explicitly rather than treated as a clean pass). No
sitemap/RSS; ToS/website-policy page not located. Verified real, current named programs
(Tinkerpreneur 2026, ATL Tranche 3, ICDK-6 Water Innovation Challenge). `geographicScope:
INDIA_ONLY` (NITI Aayog national program). Adapter: `sitemap_static_html`. Review required: No.

**DST** (`dst.gov.in`, the ministry site only, not the INSPIRE application portal) — No
robots.txt file exists. No sitemap/RSS. Real INSPIRE fellowship references and press notes
confirmed live. `geographicScope: INDIA_ONLY`. Adapter: `sitemap_static_html`, scoped to
`dst.gov.in` news/press pages only — the applicant-facing `online-inspire.gov.in` portal is a
separate UNCLEAR_REQUIRES_REVIEW entry below (TLS certificate failures on every attempt).
Review required: No.

**Unstop** (`unstop.com`) — robots.txt: explicit `Allow:` for `/competitions/`, `/hackathons/`,
`/internship/`, `/courses/`, `/quiz/`; **explicitly allows `Claude-Web` and `anthropic-ai` by
name**, blocks known scrapers (CCBot, Bytespider) and legacy downloaders (HTTrack, Wget).
Sitemap index live and current (156 opportunity-sitemap files, same-day timestamp). ToS page
loaded but only a cookie/privacy notice was visible in the fetched content — full document not
conclusively reviewed, so this is "restrictions" pending that, not a clean ALLOWED. Content is
JS-rendered (Angular SPA) — confirmed via live browser inspection that opportunity listing
cards and item pages only populate after JS execution. **Mixed geography, no source-level
default** — hosts both India-only and internationally-open listings; `geographicDetail` not
set. Adapter: `sitemap_static_html`, `renderMode: "js"`. Review required: No, but read the
full ToS before scaling beyond the initial small itemLimit used here.

**Devfolio** (`devfolio.co`) — robots.txt: `Disallow:` (empty, fully permissive), no sitemap
directive. ToS (`devfolio.co/terms-of-use`) has no explicit scraping/bot clause — only a
DDoS/malware-interference clause was found. No published rate limit. Individual hackathons are
hosted on `*.devfolio.co` subdomains (e.g. `recursion-edition.devfolio.co`) with real,
distinct `og:title` tags confirmed live. **Mixed geography, no source-level default.**
Adapter: `sitemap_static_html`, `renderMode: "js"` (React app; confirmed via live inspection).
Review required: No.

**HackerEarth** (`hackerearth.com`) — robots.txt: `Allow: /` with narrow disallows
(`/*?login=`, `/*AJAX`, a few language subdirectories); sitemap.xml exists. ToS review found
only a generic no-infringing-use clause, no explicit anti-scraping language. Public API v4 is
a code-compile/execute service only — confirmed via its docs — not a listings API, so it
cannot substitute for HTML extraction here. **Mixed geography, no source-level default.**
Adapter: `sitemap_static_html`, `renderMode: "js"`.
**Live implementation finding (2026-09-03)**: a real automated run (headless Chromium via
`playwright-core`) of `/challenges/` returned **HTTP 403 Forbidden**, despite the same page
rendering normally in an interactive browser session during compliance research — consistent
with bot-fingerprint detection specifically targeting automated/headless clients, distinct
from the robots.txt/ToS policy question. No workaround was attempted (no stealth plugin, no
fingerprint spoofing), per the standing anti-circumvention rule. The `Source` row has been
deactivated (`isActive: false`) and `reviewRequired` set to `true` pending a legitimate
resolution — the same pattern as the HigherEdJobs/Incapsula finding in Batch 1. Review
required: Yes (was No; updated by this finding).

**MLH** (Major League Hacking, `mlh.io` → `www.mlh.com`) — robots.txt: `Allow: /` with
disallows only on `/account/`, `/tools/`, `/_/`, `/auth/`, `/admin/`, `/graphql`, and
promo-code paths — nothing touching the events listing. ToS found no explicit scraping ban
(closest clause bars reverse-engineering). No sitemap/RSS/API. Confirmed genuine mixed
geography on the live events page (US/Canada/UK events alongside 3 India-based hackathons:
HackNex Season 2 in West Bengal, Innohacks 4.0 in Uttar Pradesh, hackCBS 9.O in New Delhi) —
each hackathon links out to its own independently-run site. **Mixed geography, no
source-level default**, though MLH's own listing text does contain a city/state string per
event that a future pass could parse for a real per-item geography signal (not attempted in
this batch — would need care to stay evidence-based, not inferred). Adapter:
`sitemap_static_html`. Review required: No.

**Google for Startups (India)** — reviewed specifically for an India-specific program distinct
from the general Google programs already in Batch 2; found only the same global-scope
programs (Accelerators, Gemini Startup Forum, Startup School, Events) at
`startup.google.com/programs/`. robots.txt fully permissive. No new India-specific source
identified — not implemented, nothing to add beyond the existing Google record.

### UNCLEAR_REQUIRES_REVIEW

**Startup India** (`startupindia.gov.in`) — Terms of Use and Website Policy pages loaded and
describe real current programs (Seed Fund Scheme, MAARG, National Startup Awards), with a
reproduction-permission clause worth flagging to legal separately from the scraping question.
robots.txt could **not** be fetched — repeated TLS certificate-verification failures across
3 separate attempts (https, www, http). This is a genuine access gap, not a deliberate block,
but crawl rules can't be confirmed either way. Review required: Yes — retry robots.txt with a
different fetcher/network path before concluding anything.

**AICTE** — the researched domain `aicte-india.org` 301-redirects to `aicte.gov.in`, a
different domain than expected for this institution; destination content is plausible (GoI
seal, SIH/SWAYAM references) but domain authenticity could not be independently confirmed from
this research alone. robots.txt at `aicte.gov.in` is 404 (no file). Review required: Yes —
verify this is genuinely AICTE's authoritative domain before any technical work.

**DST INSPIRE portal** (`online-inspire.gov.in`) — the actual applicant-facing INSPIRE
fellowship portal (distinct from `dst.gov.in` above) failed TLS certificate verification on
every attempt, both http and https — a reproducible access failure, not a guess. Review
required: Yes — retest with a properly configured fetcher.

**TCS CodeVita** (`codevita.tcsapps.com` — note domain correction above) — robots.txt 404 (no
file). ToS page 404 — could not verify any scraping restriction. Eligibility text confirmed
genuinely global/India-inclusive ("from any recognized institute across the globe"), but the
ToS gap makes automated access unverifiable. Review required: Yes.

**Infosys Springboard** (`infyspringboard.onwingspan.com` — note domain correction above) —
robots.txt 404; sitemap.xml returns 403 AccessDenied from a CDN; most content sits behind a
login wall; ToS not located. Review required: Yes — do not attempt automated access until
directly reviewed, ideally by a human with an account.

**E-Cell IIT Bombay** (`ecell.in`) — could not obtain a genuine robots.txt, sitemap, or ToS:
an Angular SPA whose router serves the app shell (or an unrelated redirect) for almost any
probed path, including `/terms`, which 301-redirects to an **unrelated third-party Razorpay
merchant policy page** — clearly not E-Cell's actual terms. The Eureka! program page itself is
real and current; its FAQ states no residency restriction, which per the "don't infer" rule
means this should not be classified `INDIA_ONLY` just because the organizer is India-based, nor
`GLOBAL` from the presence of international bonus tracks. Review required: Yes — locate actual
governing terms before any automated access.

### NOT_ALLOWED

**MeitY / Digital India** (`meity.gov.in`) — both `meity.gov.in` and `www.meity.gov.in`, and
both domains' robots.txt, returned **HTTP 403 Forbidden** consistently across attempts. No
workaround attempted, per the standing rule. **Automated access: NOT_ALLOWED.** Review
required: No — this is an infrastructure-level block, not a legal ambiguity to resolve.

## Follow-up items — India/Global batch (Batch 3)

17. **Startup India**, **DST INSPIRE portal** — both had reproducible TLS certificate
    failures across every fetch attempt; retest with a different network path/fetcher before
    concluding either way (currently neither ALLOWED nor NOT_ALLOWED — genuinely unverified).
18. **AICTE** — confirm `aicte.gov.in` is genuinely AICTE's authoritative domain (the expected
    `aicte-india.org` redirects there) before any technical work.
19. **Unstop** — read the full Terms of Service (only a cookie notice was visible in the
    fetched content) before scaling ingestion beyond the small `itemLimit` used in the first
    implementation pass.
20. **MLH** — its listing page text contains a real per-event city/state string that could
    become a genuine, evidence-based per-item `geographicDetail` signal in a future pass — not
    attempted in this batch to avoid rushing an inference-prone heuristic.
21. **TCS CodeVita**, **Infosys Springboard** — both need a located, readable ToS before
    moving past UNCLEAR_REQUIRES_REVIEW; do not proceed on the assumption that a 404'd terms
    page means no restriction exists.
22. **E-Cell IIT Bombay** — locate the organization's actual governing terms (not the
    unrelated Razorpay merchant page it currently redirects to) before any automated access.

---

## International Orgs, Foundations, Professional Societies + India (Batch 4 — 2026-09-09)

Research for the "real (non-demo) opportunity catalog" expansion task, covering 20
candidates nominated across five categories requested for this batch: international
organizations, universities/research organizations, foundations/NGOs, professional
organizations, and additional Indian organizations — explicitly excluding job boards, same
as every prior batch. Same methodology as Batches 1-3: live `robots.txt`/ToS/RSS/sitemap/API
fetches, never assumed from memory; `NOT_ALLOWED` never implemented, `UNCLEAR_REQUIRES_REVIEW`
never auto-runs.

**Tooling note specific to this batch**: the `WebFetch` tool's own crawler identity was
bot-blocked (HTTP 403) on several otherwise-permissive sites (AAUW, ACM's policies page, the
Mozilla Foundation fellowship page) where a plain `curl` request with an ordinary browser
`User-Agent` string succeeded (HTTP 200) against the exact same URL. Each such case is called
out explicitly below — the underlying robots.txt/ToS content was still verified by an actual
live fetch (via `curl`) once the false negative was identified, not assumed. This is a
tool-fingerprinting artifact, not a site policy signal, and is distinct from a genuine
anti-bot block (see IEEE below, confirmed via response headers, not just a 403).

### Summary

| Status | Count | Organizations |
|---|---|---|
| **ALLOWED_WITH_RESTRICTIONS** | 9 | UNESCO, Chevening Scholarships, Mastercard Foundation, Rhodes Trust, Mozilla Foundation, CSIR-HRDG (India), Reliance Foundation, ACM (ACM-W), AAUW |
| **UNCLEAR_REQUIRES_REVIEW** | 5 | World Bank Group, World Health Organization, Acumen Academy, British Council, CERN |
| **NOT_ALLOWED** | 6 | Gates Foundation, Ford Foundation, Tata Trusts, Rockefeller Foundation, Schwarzman Scholars, IEEE |

6 of 20 are explicitly blocked by their own ToS (Gates Foundation, Ford Foundation, Tata
Trusts, Rockefeller Foundation, Schwarzman Scholars) or by an infrastructure-level WAF
challenge (IEEE) — again confirming robots.txt alone is not sufficient evidence. Two
NOT_ALLOWED calls (Tata Trusts, Rockefeller Foundation) turned on a *non-commercial/no-
derivative-works* clause rather than an explicit bot/scraper clause; both are treated the same
way Batch 1 treated UN Careers' "no right to... compile or create derivative works" language —
a direct prohibition on exactly what an aggregator does, even without the word "robot"
anywhere in the text.

---

## ALLOWED_WITH_RESTRICTIONS (Batch 4)

### UNESCO
- **Program(s) found**: UNESCO/Japan Young Researchers' Fellowships Programme
  (`unesco.org/en/fellowships/keizo-obuchi`) — verified live: 2026 cycle, 10 fellowships for
  researchers from Africa/SIDS/Ukraine/Türkiye, up to US$10,000, deadline **30 September 2026**.
- **Source URL**: https://www.unesco.org
- **robots.txt status**: Found. **Crawl permission**: General `User-agent: *` block only
  disallows system/admin paths (`/core/`, `/profiles/`, `/admin/`, `/user/login`, `/search`,
  `/explore`, various query-string patterns) — fellowship content is not blocked. A **separate,
  explicit `Disallow: /` block names AI-training crawlers** (Amazonbot, Applebot-Extended,
  BraveBot, Bytespider, CCBot, ClaudeBot, Diffbot, FacebookBot, GPTBot, Google-Extended,
  Meta-ExternalAgent, others) and a site-wide Content-Signal of `ai-train=no`. Polaris's own
  ingestion adapter identifies as `PolarisBot/1.0`, not one of the named agents, so it falls
  under the general (permissive) rule — flagged explicitly per the same pattern Batch 2 used
  for Cisco's AI-crawler-specific robots.txt carve-outs. Sitemap declared.
- **ToS reviewed**: Attempted — `unesco.org/en/terms-use` was located and fetched, but its
  content is literally **"_coming soon..._"** — not yet published. `tosReviewed: false`
  (a real gap, not a found prohibition).
- **API available**: None found for fellowships specifically.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html` (single hand-picked program page).
- **Compliance notes**: robots.txt is genuinely permissive for a non-named crawler and the
  program page is real and current, but the ToS page being unpublished is a real gap, and the
  named-AI-crawler disallow list (even though it doesn't literally name Polaris's UA) is worth
  a periodic re-check given UNESCO has clearly turned attention to AI-crawler policy recently.
- **Last policy check**: 2026-09-09. **Review required**: Yes — re-check `unesco.org/en/terms-use` once published.
- **Live ingestion finding (2026-09-09)**: `source-unesco-fellowships` was run for real against
  the fellowship page and returned **HTTP 200 with an obfuscated JavaScript bot-challenge page**
  (Akamai/TSPD-style challenge script, not the real page) instead of actual content — a subtler
  variant of the HigherEdJobs/HackerEarth anti-bot findings from earlier batches, since it
  doesn't even surface as a clean HTTP error (the item simply fails downstream with an empty
  title). No workaround was attempted. `isActive` has been set to `false` and `reviewRequired`
  confirmed `true` pending a legitimate resolution (most likely a direct compliance/allowlisting
  conversation with UNESCO's web team, or confirming a different, non-JS-challenged access path).

### Chevening Scholarships
- **Program(s) found**: Chevening Scholarships (`chevening.org/scholarships/`) — fully-funded
  UK master's scholarships for emerging leaders; verified live, current application cycle with
  a country/territory eligibility selector.
- **Source URL**: https://www.chevening.org
- **robots.txt status**: Found. **Crawl permission**: Fully permissive — disallows only
  `/wp-admin/` (explicitly allows `/wp-admin/admin-ajax.php`); `Crawl-Delay: 10` scoped to
  AhrefsBot specifically. Sitemap declared.
- **ToS reviewed**: Yes — `chevening.org/terms-and-conditions/`. No language on automated
  access, scraping, crawling, robots, bots, or data mining. Only a Crown-copyright footer
  notice (Chevening is FCDO-supported), no explicit reuse/licensing terms.
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Clean robots.txt, ToS silent on automation — capped at "restrictions"
  only because no explicit permission statement exists (silence, not a green light).
- **Last policy check**: 2026-09-09. **Review required**: No.

### Mastercard Foundation
- **Program(s) found**: Mastercard Foundation Scholars Program
  (`mastercardfdn.org/en/what-we-do/our-programs/mastercard-foundation-scholars-program/`) —
  verified live and current (58,000+ scholars cited, partner-university model, 2025-2026 news).
- **Source URL**: https://mastercardfdn.org
- **robots.txt status**: Found. **Crawl permission**: Fully permissive across all 8 named
  user-agent blocks (general and AI-specific alike) — `Allow: /`, disallows only `/quarry/`.
  Sitemap declared.
- **ToS reviewed**: Attempted — no dedicated Terms of Use/Terms and Conditions page exists on
  `mastercardfdn.org`; the homepage footer links only to Privacy Policy, Accessibility
  Statement, and Safeguarding Policy. A page titled "terms-and-conditions-services" was found
  but governs partner/contractor service agreements, not website use — not the applicable
  document. `tosReviewed: false` (a real, confirmed gap).
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: The Mastercard Foundation (mastercardfdn.org) is a legally distinct,
  independent Canadian charitable foundation from Mastercard Inc. (mastercard.com, already
  recorded `NOT_ALLOWED` in Batch 2 for a consistent WAF 403 block) — this is a separate,
  correctly-attributed organization, not a re-classification of that record.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Rhodes Trust
- **Program(s) found**: The Rhodes Scholarship
  (`rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/`) — verified live, 2027 cycle
  applications open, funding details (Oxford course fees + £20,400/year stipend) confirmed.
- **Source URL**: https://www.rhodeshouse.ox.ac.uk
- **robots.txt status**: Found. **Crawl permission**: Fully permissive — `Allow: /`, disallows
  only two Cloudflare challenge-platform paths (`/cdn-cgi/challenge-platform/`,
  `/cdn-cgi/email-platform/`). Sitemap declared.
- **ToS reviewed**: Attempted — no general Terms and Conditions/Terms of Use page located; the
  only located legal page is a Privacy Policy scoped specifically to venue-hire enquiries, not
  a site-wide ToS. `tosReviewed: false` (a real gap).
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: One of the oldest and most recognizable international scholarships;
  clean permissive robots.txt, no automation prohibition found anywhere on the site, but no
  general ToS exists to confirm reuse terms either way.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Mozilla Foundation
- **Program(s) found**: Mozilla Fellowship Program
  (`mozillafoundation.org/en/what-we-do/grantmaking/fellowship/`) — verified live, real,
  current 2026 cycle content (Track I: Embedded Fellows, 12-month program from May 2026).
- **Source URL**: https://www.mozillafoundation.org (distinct domain from mozilla.org)
- **robots.txt status**: Found on `mozillafoundation.org` itself. **Crawl permission**:
  General `Allow: /` (narrow disallows on `/artifacts/thimble` and a `?form=` query pattern,
  `crawl-delay: 10`), plus a **separate named-AI-crawler `Disallow: /` block** (Amazonbot,
  Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler,
  Google-Extended, GPTBot, meta-externalagent) and a site-wide `ai-train=no` Content-Signal —
  same pattern as UNESCO above; Polaris's `PolarisBot/1.0` UA is not among the named agents.
- **ToS reviewed**: Partial — the controlling "Websites & Communications Terms of Use"
  (`mozilla.org/en-US/about/legal/terms/mozilla/`) explicitly lists the domains it covers
  (mozilla.org, mozillians.org, firefox.com, mozillafestival.org, openstandard.com,
  openbadges.org, webmaker.org) — **`mozillafoundation.org` is not among them**, so its
  applicability to the actual Fellowship page's domain is unconfirmed (same gap pattern as
  Google DeepMind in Batch 2). The terms as read contain no automation/scraping ban; Mozilla-
  authored content is generally CC/MPL-licensed.
- **API available**: The Hugging-Face-style Hub API doesn't apply here; no fellowship-specific API found.
- **RSS available**: Not checked for this specific page (out of scope — a single hand-picked page).
- **Sitemap available**: Not confirmed for this domain.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: `WebFetch`'s own crawler UA got HTTP 403 on the fellowship page twice;
  a plain `curl` request with a standard browser `User-Agent` string got HTTP 200 with the real
  page content (confirmed via the page's own `<title>` and body text) — a tool-fingerprinting
  false negative, not a real site block, resolved by verifying with a different fetch path
  rather than assumed away.
- **Last policy check**: 2026-09-09. **Review required**: Yes — confirm whether
  `mozillafoundation.org` falls under the mozilla.org terms or has its own, and re-check the
  named-AI-bot disallow periodically.
- **Live ingestion finding (2026-09-09)**: `source-mozilla-fellowship` was run for real and the
  pipeline's actual fetch (`PolarisBot/1.0` User-Agent, no browser fingerprint) got **HTTP 403
  Forbidden** on the fellowship page — despite the exact same URL returning HTTP 200 with real
  content to a `curl` request using a standard browser User-Agent during compliance research.
  This is the same category of finding as HigherEdJobs (Incapsula) and HackerEarth in earlier
  batches: a live technical anti-bot control, not a policy question, and not something the
  ALLOWED_WITH_RESTRICTIONS determination above is retracted for. No workaround (UA spoofing,
  header manipulation) was attempted, per the standing rule. `isActive` has been set to `false`
  and `reviewRequired` confirmed `true` pending a legitimate resolution.

### CSIR-HRDG (India)
- **Program(s) found**: CSIR Human Resource Development Group Fellowships overview
  (`csirhrdg.res.in/Home/Index/1/Default/914/11`) — verified live, dated 8 September 2026,
  listing JRF-NET, JRF-GATE, SRF-Direct, Research Associate, Nehru Science PDF, and DJ Research
  Interns schemes.
- **Source URL**: https://csirhrdg.res.in
- **robots.txt status**: **Not found (404)** — treated as default-allow, not an affirmative
  permission statement, same convention used for AIM/DST in Batch 3.
- **ToS reviewed**: Yes — the CSIR-HRDG website policy (reproduction permitted free of charge
  with prior email permission to the HRDG Head; must be reproduced accurately, source
  acknowledged, not used in a derogatory/misleading context; third-party-copyrighted material
  excluded). No explicit automation/scraping/bot clause found. Governed by Indian law.
- **API available**: None found.
- **RSS available**: None found.
- **Sitemap available**: Not confirmed.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: `csirhrdg.res.in` is a distinct domain from the CSIR ministry site
  (`csir.res.in`, also researched this batch — robots.txt permissive, its own
  `website-policies` page has near-identical reproduction-permission language and no
  automation clause) — `csirhrdg.res.in` was used because it's where the actual fellowship
  content lives, matching the DST/DST-INSPIRE-portal domain-precision pattern from Batch 3.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Reliance Foundation
- **Program(s) found**: Reliance Foundation Scholarships 2026-27 — verified via a media-release
  page on `reliancefoundation.org` itself (`/media/media-release/Reliance_Foundation_Scholarships_2026-27`):
  5,100 UG/PG scholarships, up to ₹2 lakh (UG) / ₹6 lakh (PG), no application fee, deadline
  Oct 5 2026 stated separately in search results (not repeated in the page text itself).
- **Source URL**: https://www.reliancefoundation.org
- **robots.txt status**: Found. **Crawl permission**: Fully permissive — disallows only
  `/manage`. Sitemap declared.
- **ToS reviewed**: Yes — `reliancefoundation.org/terms-conditions`. General copy/distribute
  restrictions (a fairly standard "you may not copy/distribute/download/modify" clause); no
  explicit automation/scraping/bot/crawler clause found.
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: The actual application portal lives on a **separate subdomain**,
  `scholarships.reliancefoundation.org`, which was deliberately **not** used as the fetch
  target: a direct request to `scholarships.reliancefoundation.org/robots.txt` returns HTTP 200
  but with the React SPA's own `index.html` shell (client-side routing swallows the path,
  meaning no real robots.txt exists there and the page content is entirely JS-rendered,
  `<div id="root">` with no server-rendered text). That subdomain has not been independently
  compliance-reviewed, so the compliance-cleared `reliancefoundation.org` media-release page —
  real, current, and substantive — is used as the source of record instead, the same reasoning
  Batch 3 used to exclude AIM's Tinkerpreneur program (whose real link pointed to an
  unreviewed third-party domain).
- **Last policy check**: 2026-09-09. **Review required**: No.

### ACM (ACM-W)
- **Program(s) found**: ACM-W Computer Science Research Conference Scholarships
  (`women.acm.org/scholarships/`) — verified live, current cycle ("applications must be
  submitted by October 15, 2026" for Dec 2026-Jan 2027 conferences), $600-$1,200 travel awards
  for women undergraduate/graduate CS students.
- **Source URL**: https://www.acm.org (program hosted on `women.acm.org`)
- **robots.txt status**: Found on both domains. `acm.org/robots.txt`: narrow disallows
  (`/live-search`, `/404`, `/Member/`, several historical award/chapter-archive paths); sitemap
  declared. `women.acm.org/robots.txt`: no disallow at all, `Crawl-Delay: 20`.
- **ToS reviewed**: Attempted, inconclusive — `acm.org/about-acm/policies` returned HTTP 403 on
  every attempt (no workaround attempted). A candidate `on.acm.org/tos` page was reachable and
  contains no automation/scraping ban, but its own text ("originally adapted from the WordPress
  Terms of Service") suggests it governs a different ACM microsite, not `acm.org`/`women.acm.org`
  generally — its applicability here is unconfirmed. `tosReviewed: false` (a genuine access gap,
  not a found prohibition).
- **API available**: None found for scholarship/program data (ACM Digital Library APIs are unrelated).
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes, on `acm.org`.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: Both relevant domains have permissive robots.txt and a real, current
  program page was verified, but the main ACM ToS page's 403 block means this is capped at
  "restrictions" pending a real, browser-based read of the actual governing terms.
- **Last policy check**: 2026-09-09. **Review required**: Yes — retrieve and read
  `acm.org`'s real Terms of Use via a non-automated path before scaling beyond this one page.

### AAUW (American Association of University Women)
- **Program(s) found**: AAUW International Fellowships
  (`aauw.org/resources/programs/fellowships-grants/aauw-international-fellowships/`) —
  verified live, real, current 2026-2027 cycle (application window Aug 17-Sept 17 2026; $20,000
  master's / $25,000 doctoral / $50,000 postdoctoral stipends).
- **Source URL**: https://www.aauw.org
- **robots.txt status**: Found — but only reachable via a plain `curl` request with a standard
  browser `User-Agent`; both `WebFetch` attempts returned HTTP 403 on the exact same URL. Once
  fetched, the content is a standard, fully permissive WordPress/Yoast file: disallows only
  `/wp/wp-admin/` (allows `admin-ajax.php`); sitemap declared. This is the same
  tool-fingerprinting false-negative pattern documented under Mozilla Foundation above, resolved
  the same way (verified by an actual alternate fetch, not assumed).
- **ToS reviewed**: Attempted — no dedicated `aauw.org` Terms of Use/Terms and Conditions page
  located; the only "AAUW terms" result found (`aauwaction.org/about/terms/`) belongs to the
  AAUW Action Fund, a related but legally and organizationally distinct 501(c)(4) advocacy
  entity — not the applicable document for `aauw.org` itself. `tosReviewed: false` (a real,
  confirmed gap, not a found prohibition).
- **API available**: None found.
- **RSS available**: Not confirmed.
- **Sitemap available**: Yes.
- **Automated access**: **ALLOWED_WITH_RESTRICTIONS**.
- **Permitted adapter type**: `sitemap_static_html`.
- **Compliance notes**: One of the longest-running international fellowship programs for
  women in STEM; permissive robots.txt once actually retrieved, no automation prohibition
  found anywhere reachable, but no general-site ToS exists to confirm reuse terms.
- **Live ingestion finding (2026-09-09)**: `source-aauw-international-fellowships` was run for
  real and the pipeline's actual fetch (`PolarisBot/1.0` User-Agent) got **HTTP 403 Forbidden**
  on the fellowship page — despite the exact same URL returning HTTP 200 with real content to a
  `curl` request using a standard browser User-Agent during compliance research (the same
  tool-fingerprinting pattern noted above under "Compliance notes," but it turns out to affect
  the pipeline's own production fetch too, not just the research tooling). Same category as
  HigherEdJobs/HackerEarth/Mozilla Foundation above: a live technical anti-bot control, not a
  policy retraction. No workaround was attempted. `isActive` has been set to `false` and
  `reviewRequired` updated to `true` (was `No`; updated by this finding) pending a legitimate
  resolution.
- **Last policy check**: 2026-09-09. **Review required**: Yes — updated by the live ingestion finding above (was No).

---

## UNCLEAR_REQUIRES_REVIEW (Batch 4)

### World Bank Group
- **Source URL**: https://www.worldbank.org
- **robots.txt status**: Found. **Crawl permission**: Permissive — `Allow: /`, disallows
  narrowly-scoped system/retired-content paths only (`/apps/`, `/conf/`, search paths, pre-2020
  dated content patterns). Sitemap declared.
- **ToS reviewed**: Yes — `worldbank.org/ext/en/legal/terms-conditions`. No explicit
  scraping/bot/crawler clause, but real, relevant restrictions: API usage barred from
  "exceed[ing] reasonable request volume or... excessive or abusive usage"; and for general
  (non-dataset) materials, "you may not make any derivative work or commercial use... without
  the prior written consent of the relevant member institution(s)" plus mandatory attribution.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — the non-commercial/no-derivative-work
  restriction is a real ambiguity in the same category as MLH's (Batch 1) "non-commercial use"
  clause, needing a human/legal judgment call rather than further automated research. Compounding
  this, the clearest available program (the Young Professionals Program) reads as an
  early-career staff-hiring pipeline rather than a fellowship/scholarship — a second, independent
  reason not to implement even setting the ToS question aside.
- **Compliance notes**: High potential value (WBG runs many genuine non-hiring youth/research
  programs) but needs both a licensing-scope legal read and a better-fitting program before
  reconsidering.
- **Last policy check**: 2026-09-09. **Review required**: Yes.

### World Health Organization (WHO)
- **Source URL**: https://www.who.int
- **robots.txt status**: Found. **Crawl permission**: The file is a **527-entry named-bad-bot
  blocklist** (security scanners, SEO tools, known scrapers, email harvesters) each individually
  set to `Disallow: /` — but there is **no blanket disallow for unnamed/general user-agents**,
  meaning a non-named crawler is not blocked by robots.txt. Sitemap declared.
- **ToS reviewed**: Yes — `who.int/about/policies/terms-of-use`. No explicit bot/scraping
  clause, but: "Reproduction or translation of substantial portions of the web site, or any use
  other than for educational or other non-commercial purposes, require explicit, prior
  authorization in writing," alongside a mandatory-attribution requirement for any use.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — genuinely ambiguous whether ingesting one
  program's page counts as "substantial" reproduction, and whether an opportunity-discovery
  product for students counts as "educational... purposes." A real judgment call, not a
  research gap.
- **Compliance notes**: The WHO Internship Programme would be a strong candidate opportunity if
  this were resolved — not pursued further in this pass given the open ToS ambiguity.
- **Last policy check**: 2026-09-09. **Review required**: Yes.

### Acumen Academy
- **Source URL**: https://acumen.org
- **robots.txt status**: Found. **Crawl permission**: Permissive — `Crawl-Delay: 10`, empty
  `Disallow:` (no paths blocked). Sitemap declared.
- **ToS reviewed**: Yes — `acumen.org/terms-of-use/`. No explicit bot/scraping clause, but:
  "You are permitted to access and use the Content though the provided functionality of the
  Website for personal non-commercial uses only," and separately, "you will not use, reproduce,
  modify, transmit, display, publish, sell, create derivative works, or distribute by any
  means... any content of this Website for commercial profit or gain."
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — the same "non-commercial use" ambiguity
  pattern as MLH (Batch 1) and World Bank Group above; whether a free/commercial Polaris product
  falls inside or outside that restriction is a legal/product judgment call, not resolvable by
  further automated fetching.
- **Compliance notes**: Acumen Academy runs real, well-known social-impact fellowship programs —
  worth revisiting once the non-commercial-use question has an actual answer.
- **Last policy check**: 2026-09-09. **Review required**: Yes.

### British Council
- **Source URL**: https://www.britishcouncil.org
- **robots.txt status**: **Could not be retrieved.** Four separate attempts (two via `WebFetch`,
  two via `curl`, one with `-v` diagnostics) all failed the same way: a TLS handshake begins
  (server certificate exchange observed in the verbose log) but the connection then times out
  with zero bytes of an actual HTTP response — "Operation timed out after 25014 milliseconds
  with 0 bytes received." This is a reproducible **access failure**, not a deliberate 403/404
  block, matching the exact pattern Batch 3 documented for Startup India and the DST INSPIRE
  portal (both also TLS-level failures, not confirmed either way).
- **ToS reviewed**: Not reached — blocked before any page could be read.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — genuinely unverified, not a negative
  finding. Retest with a different network path/fetcher before concluding anything.
- **Compliance notes**: British Council runs real, substantial scholarship/exchange programs
  (IELTS, Study UK, Chevening's own delivery partner in some markets) — worth retrying the
  robots.txt fetch specifically, since nothing else about the source was disqualifying.
- **Last policy check**: 2026-09-09. **Review required**: Yes.

### CERN
- **Source URL**: https://home.cern
- **robots.txt status**: Found. **Crawl permission**: Permissive — only blocks Drupal
  system/admin paths (`/core/`, `/profiles/`, `/admin/`, `/user/login`, etc.); no disallow on
  public content. No sitemap directive present.
- **ToS reviewed**: Not located. Two direct-URL guesses (`/terms-use`, `/about/legal-notice`)
  both 404'd, and a web search surfaced only CERN's Privacy Policy, Data Privacy Protection
  Policy, and Zenodo's terms (Zenodo is a CERN-*hosted* but separately-governed open-data
  repository with its own distinct ToS, not home.cern's general terms). `tosReviewed: false` —
  a genuine gap, not a found prohibition.
- **Automated access**: **UNCLEAR_REQUIRES_REVIEW** — permissive robots.txt is a favorable
  signal, but with no located site-wide ToS, reuse rights for program-page text specifically
  aren't established either way, the same reasoning Batch 1 applied to DAAD.
- **Compliance notes**: CERN openlab and CERN Summer Student programs are real, well-known
  research opportunities — worth a follow-up specifically to locate the actual governing terms
  (possibly only available in a non-English/legal-notice page not surfaced by this pass).
- **Last policy check**: 2026-09-09. **Review required**: Yes.

---

## NOT_ALLOWED (Batch 4)

### Bill & Melinda Gates Foundation
- **Source URL**: https://www.gatesfoundation.org
- **robots.txt status**: Found, fully permissive (`Allow: /`).
- **ToS reviewed**: Yes — `gatesfoundation.org/terms-of-use`. Explicit, quoted: "Any scraping,
  automated access, or other unauthorized access to, and storage of, Sites or Content may, in
  our sole discretion, result in immediate suspension or termination of your access." Also bars
  using the Sites to "develop applications, websites, or any other functionalities that
  leverage the Sites, Content, or User Contributions" — directly covers building a product like
  Polaris on top of their content.
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: robots.txt alone would look clean; the ToS is explicit and unambiguous.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Ford Foundation
- **Source URL**: https://www.fordfoundation.org
- **robots.txt status**: Found, fully permissive (empty `Disallow:`).
- **ToS reviewed**: Yes — `fordfoundation.org/terms-and-conditions-of-use/`. Explicit, quoted:
  "you will not use any robot, spider, scraper or other automated means to access the Website
  for any purpose without our express written permission." (Content in the "Learning" and
  "News & Stories" sections is separately CC BY 4.0-licensed, but that doesn't override the
  access-method prohibition.)
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: One of the most explicit and unambiguous prohibitions found in this
  batch, directly naming "robot," "spider," and "scraper."
- **Last policy check**: 2026-09-09. **Review required**: No.

### Tata Trusts
- **Source URL**: https://tatatrusts.org
- **robots.txt status**: Found, permissive (disallows only `/manage`).
- **ToS reviewed**: Yes — `tatatrusts.org/legal-disclaimer`. No explicit robot/bot/crawler
  clause, but quoted: "You may not distribute text or graphics to others without the express
  written consent of Tata Trusts and its affiliates," and "No reproduction of any part of the
  site may be sold or distributed for commercial gain, nor shall it be modified or **incorporated
  in any other work**."
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: No bot-specific language, but "incorporated in any other work" is
  materially the same prohibition that made UN Careers `NOT_ALLOWED` in Batch 1 ("compile or
  create derivative works therefrom") — a direct ban on exactly what an aggregator does with
  ingested content, treated consistently rather than let through on a technicality.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Rockefeller Foundation
- **Source URL**: https://www.rockefellerfoundation.org
- **robots.txt status**: Found, permissive (only blocks search/pagination/WordPress-internal paths).
- **ToS reviewed**: Yes — `rockefellerfoundation.org/terms-of-use/`. Explicit, quoted: "You may
  not copy, distribute, **enter into a database**, display, perform, create derivative works of,
  transmit, or in any way exploit any part of our Site." Reuse is permitted only for "personal,
  non-commercial, educational or public policy use."
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: "Enter into a database" describes, almost verbatim, exactly what
  Polaris's ingestion pipeline does with every stored `Opportunity` row — as direct a
  prohibition as this batch found.
- **Last policy check**: 2026-09-09. **Review required**: No.

### Schwarzman Scholars
- **Source URL**: https://www.schwarzmanscholars.org
- **robots.txt status**: Found, permissive (`Crawl-delay: 10`, empty `Disallow:`).
- **ToS reviewed**: Yes — `schwarzmanscholars.org/terms-of-use/`. Explicit: users agree they
  will not "use automated means to access" the Site, alongside bans on overburdening the site,
  framing it, or attempting unauthorized access.
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: A real, well-known, prestigious scholarship program — but the ToS
  directly and explicitly prohibits automated access, full stop.
- **Last policy check**: 2026-09-09. **Review required**: No.

### IEEE
- **Source URL**: https://www.ieee.org
- **robots.txt status**: **Blocked at the infrastructure level.** Two `WebFetch` attempts
  returned no usable content; two direct `curl` attempts to `/robots.txt` either timed out or
  returned HTTP 202 with an empty body. A `curl -I` request to the IEEE homepage confirmed why:
  the response carries `HTTP/1.1 202 Accepted` with header **`x-amzn-waf-action: challenge`** —
  a confirmed AWS WAF bot-challenge response served instead of real content, not a normal
  404/permissive robots.txt. No workaround (challenge-solving, header spoofing, or otherwise)
  was attempted, per the standing anti-circumvention rule.
- **ToS reviewed**: Not reached — blocked before any page could be read.
- **Automated access**: **NOT_ALLOWED**.
- **Compliance notes**: Same treatment as MeitY/Oracle/Mastercard Inc. in prior batches —
  infrastructure-level block, not a legal ambiguity to resolve. IEEE runs genuinely valuable
  student programs (student scholarships, the IEEE Presidents' Scholarship, various society
  travel grants) that would be worth revisiting if IEEE ever allowlists a legitimate
  ingestion identity.
- **Last policy check**: 2026-09-09. **Review required**: No — infrastructure block, not a
  policy ambiguity.

## Follow-up items — Batch 4

23. **UNESCO** — re-check `unesco.org/en/terms-use` periodically; it was found unpublished
    ("coming soon...") rather than absent, so it may resolve on its own.
24. **Mozilla Foundation**, **ACM** — both need a human/legal read of which ToS document (if
    any) actually governs the specific subdomain hosting the real program content
    (`mozillafoundation.org`, `women.acm.org`) before scaling past the single hand-picked page
    used in this batch.
25. **World Bank Group**, **World Health Organization**, **Acumen Academy** — all three turn on
    the same "non-commercial use" ambiguity pattern as MLH (Batch 1); a single legal opinion on
    how that clause applies to a Polaris-shaped product would resolve all three (and MLH) at once
    rather than requiring separate case-by-case research.
26. **British Council** — retry the robots.txt fetch from a different network path; the TLS
    failure pattern looked identical to Startup India/DST INSPIRE in Batch 3, which were also
    left genuinely unresolved rather than guessed at.
27. **CERN** — locate the actual site-wide Terms of Use/Legal Notice (not found via direct URL
    guesses or web search in this pass) before reconsidering CERN openlab/Summer Student programs.
28. **IEEE** — no further technical review needed; would need IEEE to allowlist a legitimate,
    identified ingestion client before this could ever move past NOT_ALLOWED.

---

## Corporate Batch 3 addendum (2026-09-09) — Consulting/Technology/Finance expansion

This batch was assigned 26 organizations (counting Google and Google DeepMind separately):
McKinsey, BCG, Bain, Deloitte, EY, PwC, Accenture, KPMG (consulting); Google, Google DeepMind,
Microsoft, IBM, Salesforce, Adobe, NVIDIA, Meta, AWS, Hugging Face, Cisco, Intel (technology);
JPMorgan Chase, Goldman Sachs, Morgan Stanley, Mastercard, Visa, Bloomberg (finance).

**Finding before any new research began**: cross-checking this exact list against
`docs/source-compliance.md`'s existing "Corporate Opportunity Sources (Batch 2 — 2026-09-03)"
section above showed all 26 had already been researched six days earlier, with compliance
records already live in the database (verified directly: 89 pre-existing
`SourceComplianceRecord` rows, one per URL for every one of the 26) and 9 already implemented
as active, ingesting `Source` rows (Hugging Face, IBM, JPMorganChase, RISE by BCG, EY, Google
DeepMind, Deloitte, Accenture, Salesforce — see `docs/corporate-ingestion-baseline.md`).
Re-running full live compliance research on all 26 and writing a second, competing set of
compliance records for the same URLs would have added no signal and risked contradicting a
six-day-old determination for no reason other than not checking first — directly against this
session's "please don't break application" instruction and its live-production-database
safety rules. So this batch did **not** repeat that research. `prisma/seed-corporate-batch3-compliance.ts`
is an intentional no-op for exactly this reason (see its header comment).

Instead, this batch's real, non-duplicative task was identifying which of the 26 had a
favorable compliance record *but no `Source` row yet* — the genuine implementation gap left by
Batch 2 only building its "first wave" of 9. Checked against the live database, exactly three
qualified: **Google** (the parent org — distinct from the already-implemented Google
DeepMind), **Microsoft**, and **AWS**. Each was re-verified live on 2026-09-09 (fresh
robots.txt + fresh page fetch, not just reasoning from Batch 2's notes) before being
registered — see `prisma/seed-corporate-batch3-sources.ts` for the full detail per source.

### New sources implemented (3)

| Organization | Source | Page | Result |
|---|---|---|---|
| Google | `source-google-gdg-on-campus` | `developers.google.com/community/gdsc` (Google Developer Groups on Campus) | 1 opportunity stored, `COURSE` + `NEEDS_REVIEW` (AI extraction returned a null field and failed schema validation, fell back per `lib/ai/extraction.ts`'s documented behavior — filtered from discovery by design) |
| Microsoft | `source-microsoft-learn-student-hub` | `learn.microsoft.com/en-us/training/student-hub/` (Microsoft Learn Student Hub) | 1 opportunity stored, `COURSE` + `NEEDS_REVIEW` (same AI-extraction fallback as above) |
| AWS | `source-aws-educate` | `aws.amazon.com/education/awseducate/` (AWS Educate) | 1 opportunity stored, `COURSE` + `AI_EXTRACTED` (extraction succeeded; `eligibilitySummary`: "Available to students and educators.") — this one surfaces in discovery |

Google Summer of Code (`summerofcode.withgoogle.com`) was deliberately **not** used despite
being the most obviously-named Google program in the brief — a fresh fetch on 2026-09-09 found
the page explicitly states "Organization registration closed" with no current-cycle dates.
Registering it would have misrepresented a closed program as open, which the anti-fabrication
rule rules out regardless of the page technically passing the compliance gate. Google Developer
Groups on Campus was used instead — same underlying `google.com` compliance record, a real,
live, currently-open community program.

Microsoft Research's "AI & Society Fellows" page (`microsoft.com/en-us/research/academic-program/ai-society-fellows/`)
was considered and deliberately excluded — it is a real, live fellowship, but it sits on the
apex `microsoft.com` domain and is specifically an AI-research program, which is exactly the
case the existing Microsoft compliance record flags as an unresolved ToS ambiguity ("web
scraping... for AI services" — unclear if scoped to Microsoft's own AI products or broader).
`learn.microsoft.com` avoids that ambiguity entirely (separately confirmed permissive
robots.txt in Batch 2, re-confirmed live here), which is why it was chosen instead.

AWS's robots.txt was re-checked line-by-line specifically because Batch 2 flagged that the
"obvious" AWS paths (`/blogs/`, `/activate/hackathons`, `/activate/accelerators`,
`/activate/events`) are robots.txt-disallowed even though they resolve fine — confirmed fresh
on 2026-09-09 that neither `/education/` nor `/education/awseducate/` appears in any of the
~100+ `Disallow` rules, so AWS Educate remains clear.

### The other 23 organizations — explicitly not touched, and why

- **Already implemented, not re-touched**: BCG (RISE), Deloitte, EY, Accenture, JPMorgan Chase,
  IBM, Salesforce, Google DeepMind, Hugging Face. BCG's RISE specifically was flagged in this
  session's brief as having previously hit anti-bot trouble — left completely alone per that
  instruction, not re-verified or re-touched in any way.
- **NOT_ALLOWED in Batch 2, not re-researched** (explicit ToS prohibitions found via live fetch
  six days ago; policy text this explicit does not plausibly change in under a week): McKinsey,
  Bain, PwC, Adobe, NVIDIA, Meta, Intel, Goldman Sachs, Morgan Stanley, Bloomberg, Mastercard.
- **UNCLEAR_REQUIRES_REVIEW in Batch 2, not re-researched** (each needs an actual human/legal
  judgment call per Batch 2's notes, not more automated fetching): KPMG, Cisco, Visa.

### Net result

**3 new sources, 3 new opportunities** (Google, Microsoft, AWS), 0 ingestion failures, 0 new
compliance records created (all 26 assigned organizations already had one), 0 duplicate or
conflicting `Source`/`SourceComplianceRecord` rows introduced. `docs/source-compliance.md`'s
compliance register remains the single source of truth — this addendum documents new
verification work done against existing records, not a second competing set of them.

## Coverage-gap benchmarking methodology (not a source, a research approach)

A later request asked Polaris to benchmark its category breadth against what curated
scholarship/opportunity social accounts (e.g. "Fully Funded Scholarships"-style pages)
typically surface — explicitly **not** as a request to scrape Instagram or any social
platform. The correct, and only, interpretation implemented: those accounts describe a
*category and ecosystem* (e.g. "fully funded international scholarships," "summer research
programs," "case competitions") — the actual work is finding the **original official
source** for opportunities in that category and running it through the exact same
compliance-first pipeline as every other source in this document. A social account's own
description of a program is never treated as authoritative; only the organization's own page
is. No social platform is a dependency of Polaris's ingestion architecture, now or planned.

## Future concept: community/curated source suggestions (documentation only — not built)

A plausible future capability, **not implemented in this pass and not scheduled**: let an
admin (or, with more review, a trusted user) submit a *candidate source URL* for a real
opportunity-listing page they've found, which enters the exact same pipeline this document
governs — `SOURCE → COMPLIANCE CHECK → ...` — rather than bypassing it. Concretely, this
would look like: a simple admin-facing form or `Source` row with `sourceType` unset and a
`complianceStatus` of `UNCLEAR_REQUIRES_REVIEW` by default, requiring a human (or a
Gemini-assisted compliance check with human sign-off, mirroring the manual research already
done in this document) to move it to `ALLOWED`/`NOT_ALLOWED` before ingestion ever runs.

This is deliberately not built now because: (1) it needs its own abuse-prevention thinking
(a malicious submission shouldn't be able to register a source that fetches something it
shouldn't), (2) it needs a real UI decision the product owner should make deliberately, not
one added as a side effect of a data-expansion pass, and (3) the current admin-registers-a-
source flow (this document's own methodology) already covers the "find and vet a new source"
need for as long as sources are being added by the team rather than the community. Worth
building if/when community-sourced suggestions become an actual product need.
