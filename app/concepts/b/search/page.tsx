"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { IntelRow } from "@/components/concepts/b/intel-row";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { matchFromApiFields, type ConceptOpportunity } from "@/lib/concepts/types";
import { OPPORTUNITY_TYPES, OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";

interface Row extends ConceptOpportunity {
  matchScore?: number | null;
  matchReasons?: string[];
  relevance?: number;
  dateDiscovered?: string;
}

interface ParsedFilters {
  types?: string[];
  countries?: string[];
  remoteOnly?: boolean;
  freeOnly?: boolean;
  audience?: string[];
  semanticQuery?: string;
}

type SortMode = "relevance" | "match" | "deadline" | "recent";

function ConceptBSearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<string>("");
  const [results, setResults] = useState<Row[]>([]);
  const [parsed, setParsed] = useState<ParsedFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const endpoint = q.trim() ? `/api/search?q=${encodeURIComponent(q)}` : `/api/opportunities`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setResults(json.data?.opportunities ?? []);
      setParsed(json.data?.parsedFilters ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch driven by the URL's ?q, not a state sync
    runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.replace(`/concepts/b/search?q=${encodeURIComponent(query)}`);
    runSearch(query);
  }

  const filtered = useMemo(
    () => (type ? results.filter((r) => r.opportunityType === type) : results),
    [results, type]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    // Sorting is done client-side in this prototype: the production `sort` param for
    // match/popular is a documented no-op server-side today (see recommendation-roadmap.md
    // / feature-priority-matrix.md P1) — this demonstrates the intended UX without
    // depending on that backend fix.
    switch (sortMode) {
      case "match":
        return copy.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1));
      case "deadline":
        return copy.sort((a, b) => {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
      case "recent":
        return copy.sort(
          (a, b) => new Date(b.dateDiscovered ?? 0).getTime() - new Date(a.dateDiscovered ?? 0).getTime()
        );
      default:
        return copy.sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
    }
  }, [filtered, sortMode]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#e6e8ec]">
      <ConceptSwitcher active="b" />
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/b" labels={{ home: "Ask", search: "Search", profile: "Context" }} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about opportunities…"
            className="border-white/15 bg-white/5 text-white placeholder:text-[#6b7280] focus:ring-white/30"
          />
          <Button type="submit">Search</Button>
        </form>

        {parsed && (parsed.types?.length || parsed.countries?.length || parsed.remoteOnly || parsed.freeOnly) ? (
          <p className="mt-3 font-mono text-xs text-[#9ca3af]">
            Polaris understood this as:{" "}
            {[
              parsed.types?.length ? `type=${parsed.types.join("|")}` : null,
              parsed.countries?.length ? `country=${parsed.countries.join("|")}` : null,
              parsed.remoteOnly ? "remote=true" : null,
              parsed.freeOnly ? "free=true" : null,
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6 md:grid-cols-[200px_1fr]">
          <aside className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6b7280]">Type</p>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="border-white/15 bg-white/5 text-white"
              >
                <option value="">All types</option>
                {OPPORTUNITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {OPPORTUNITY_TYPE_LABELS[t as OpportunityTypeValue]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#6b7280]">Sort</p>
              <Select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="border-white/15 bg-white/5 text-white"
              >
                <option value="relevance">Relevance</option>
                <option value="match">Best match</option>
                <option value="deadline">Deadline soonest</option>
                <option value="recent">Recently added</option>
              </Select>
            </div>
            {selected.size > 0 && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => router.push(`/concepts/b/compare?ids=${Array.from(selected).join(",")}`)}
              >
                Compare ({selected.size})
              </Button>
            )}
          </aside>

          <div>
            {loading ? (
              <p className="py-8 text-sm text-[#6b7280]">Searching…</p>
            ) : sorted.length === 0 ? (
              <EmptyState title="No results" description="Try a broader query or fewer filters." />
            ) : (
              <div>
                {sorted.map((opp) => (
                  <IntelRow
                    key={opp.id}
                    opportunity={opp}
                    match={matchFromApiFields(opp)}
                    selected={selected.has(opp.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConceptBSearch() {
  return (
    <Suspense>
      <ConceptBSearchInner />
    </Suspense>
  );
}
