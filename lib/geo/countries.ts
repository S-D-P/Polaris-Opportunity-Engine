import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopology from "world-atlas/countries-110m.json";

interface CountryProps {
  name: string;
}

type WorldTopology = Topology<{ countries: GeometryCollection<CountryProps> }>;

/**
 * Public-domain Natural Earth country boundaries (world-atlas, bundled via npm — not fetched
 * from any external service at request time). `WORLD_COUNTRIES` names are the canonical form
 * every opportunity's resolved country must match against for the map (lib/geo/aggregate.ts).
 */
const topology = worldTopology as unknown as WorldTopology;
export const WORLD_COUNTRIES = feature(topology, topology.objects.countries).features;

const CANONICAL_NAMES = new Set(WORLD_COUNTRIES.map((f) => f.properties.name));

// Common name variants that realistically show up in free-text `geographicDetail`/`location`
// fields (AI-extracted or source-authored English text) but don't match the topojson's
// Natural-Earth-style canonical name exactly. Deliberately not a full ISO-3166 gazetteer —
// only real aliases, never a guess at what a country "probably" is.
const ALIASES: Record<string, string> = {
  usa: "United States of America",
  "us": "United States of America",
  "u.s.": "United States of America",
  "u.s.a.": "United States of America",
  "united states": "United States of America",
  "uk": "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  "england": "United Kingdom",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  korea: "South Korea",
  "north korea": "North Korea",
  "democratic republic of the congo": "Dem. Rep. Congo",
  "drc": "Dem. Rep. Congo",
  "republic of the congo": "Congo",
  "czech republic": "Czechia",
  "ivory coast": "Côte d'Ivoire",
  "cote d'ivoire": "Côte d'Ivoire",
  "swaziland": "eSwatini",
  eswatini: "eSwatini",
  "macedonia": "Macedonia",
  "north macedonia": "Macedonia",
  "uae": "United Arab Emirates",
  "u.a.e.": "United Arab Emirates",
  "russian federation": "Russia",
  "vietnam": "Vietnam",
  "viet nam": "Vietnam",
  "syrian arab republic": "Syria",
  "lao pdr": "Laos",
  "burma": "Myanmar",
  "bosnia": "Bosnia and Herz.",
  "bosnia and herzegovina": "Bosnia and Herz.",
  "dominican republic": "Dominican Rep.",
  "central african republic": "Central African Rep.",
  "equatorial guinea": "Eq. Guinea",
  "solomon islands": "Solomon Is.",
  "south sudan": "S. Sudan",
  "trinidad & tobago": "Trinidad and Tobago",
  "brunei darussalam": "Brunei",
};

/**
 * Resolves free text (already-collected `geographicDetail`/`location`) to a canonical
 * country name the map can render, or null if it isn't recognized. Never guesses — an
 * unrecognized string stays out of the map rather than being pinned to a wrong country.
 */
export function normalizeCountryName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (CANONICAL_NAMES.has(trimmed)) return trimmed;
  const alias = ALIASES[trimmed.toLowerCase()];
  if (alias && CANONICAL_NAMES.has(alias)) return alias;
  return null;
}
