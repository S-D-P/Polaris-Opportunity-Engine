# Polaris — Three UI/UX Concepts

Three substantially different product philosophies for the same core experience, built as
switchable, navigable prototypes under `/concepts/*` against the real backend (real
`generateFeed`, real `searchOpportunities`, real opportunity data — no mock APIs, no
duplicated architecture). The existing production routes (`/feed`, `/search`,
`/opportunities/[id]`, `/profile`, etc.) are untouched.

Each concept implements the four required surfaces (Home/Discovery, Opportunity detail,
Search, Profile) and at least one of the brief's "wow experience" ideas as its signature
differentiator, rather than spreading all five ideas thinly across all three.

## Concept A — "Personal Compass"

**Philosophy**: Polaris as a trusted personal advisor. The home screen answers *"where
should I focus my attention right now"* directly, in that order of priority, not as a filterable
database.

- **Home**: time-aware greeting → a "compass" card summarizing the user's stated goal and
  interest tags as a single visual anchor → **Best opportunities for you** (top scored,
  small set) → **Closing soon** (deadline-urgent, regardless of score, because urgency is
  its own kind of relevance) → **Because you're interested in X** (one section per top
  interest tag) → **Your path** (signature feature — a heuristic ordering of the user's own
  real matched opportunities into a suggested sequence, e.g. mentorship → conference →
  fellowship, using real data grouped by type, not fabricated content) → a tracker-progress
  snippet.
- **Search**: framed as "Ask your compass" — same hybrid search backend, narrower UI, match
  score kept prominent because relevance-to-you is the framing.
- **Detail**: leads with a narrative "why this is worth your time" paragraph assembled from
  the same real match reasons (not freely generated), structured facts follow, closes with
  how it fits the user's path.
- **Profile**: the compass visualization itself — aspiration as a headline, interests as
  compass points — editable, not just displayed.

## Concept B — "Opportunity Intelligence"

**Philosophy**: a research tool, not a feed. *"I can ask Polaris anything about
opportunities."* Perplexity/Google-shaped, not app-shaped.

- **Home**: a large centered search bar is the primary UI element, example prompts below it
  (real natural-language queries a user could paste in), minimal other chrome — deliberately
  not a personalized feed-first layout, because this concept's bet is that search *is* the
  product.
- **Search**: structured filter panel alongside AI-parsed-query feedback ("Polaris understood
  this as: type=Fellowship, remote, free"), sortable structured results, and the signature
  feature — select up to 3 results and open a **side-by-side comparison** (match/deadline/
  funding/location/experience-requirement table) reading real opportunity fields.
- **Detail**: fact-first — a structured spec-sheet (eligibility/funding/dates/requirements)
  above the fold, AI summary secondary, a visible source-credibility line, "Add to compare."
- **Profile**: presented as *search context* — the structured facts that silently shape
  filters and boosts, shown as a dense, editable settings table rather than a narrative.

## Concept C — "Opportunity Universe"

**Philosophy**: exploration and serendipity. *"I didn't know these opportunities existed."*
Media/discovery-app shaped (tile browsing), not list-shaped.

- **Home**: Trending strip → **Explore by field** (category tiles) → **Explore by career
  stage** → **Explore by geography** → curated **Collections** (e.g. "Fully-funded
  fellowships," "Remote hackathons") assembled from real filtered queries, not hardcoded
  lists → the signature feature, **You might have missed this** — real eligible,
  well-scored opportunities outside the user's current browsing focus, visibly justified
  ("this isn't a search-engineering role, but it matches your interest in AI + public
  policy").
- **Search**: results as a tile wall with category-forward visual treatment; facets
  presented as explorable tiles rather than a form; the same "you might have missed this"
  rail appended after primary results.
- **Detail**: leads with what collections/universe this opportunity belongs to and a
  related-opportunities rail; match score is present but secondary to framing.
- **Profile**: "your universe settings" — same underlying fields as every other concept,
  presented as the dials that shape what tiles the user sees.

## Wow-experience ideas, and where each lives

Per the brief, these aren't spread evenly — each gets one concept as its clearest home so it
can be evaluated properly rather than diluted:

| Idea | Home concept | Why there |
|---|---|---|
| "Why you" narrative (not just a %) | All three, differently | Cheapest, highest-leverage change — worth showing in every concept's own voice (narrative in A, structured criteria in B, tags in C) rather than picking one |
| Opportunity comparison | **B** | Matches B's research-tool framing exactly — comparison is what you do after search, not after browsing |
| Opportunity paths | **A** | Matches A's advisor framing — "what should I do next" is a compass question, prototyped with real matched data, not a fabricated curriculum |
| "You might have missed this" | **C** | Matches C's serendipity framing — surfacing the unexpected is the concept's entire premise |
| Deadline intelligence (actionable framing) | All three, differently | Applies everywhere via one shared helper; treated as urgency-first in A, a sortable fact in B, a tile badge in C |

All three read from the same backend functions the production app already uses
(`generateFeed`, `searchOpportunities`, `scoreOpportunity`, `prisma.opportunity.*`) — no
mock data, no parallel matching logic. Where a concept needs data grouped differently (e.g.
Concept A's sections, Concept C's collections), that's a presentation-layer grouping over
the same query results, not a new data source.
