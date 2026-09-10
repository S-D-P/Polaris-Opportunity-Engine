"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { OpportunityCard, type OpportunityCardData } from "@/components/feed/opportunity-card";
import { OpportunityCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OPPORTUNITY_TYPE_LABELS, USER_SELECTABLE_OPPORTUNITY_TYPES, type OpportunityTypeValue } from "@/lib/taxonomy";

interface ResultOpportunity extends OpportunityCardData {
  matchScore?: number | null;
  matchReasons?: string[];
}

export default function SearchPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [types, setTypes] = useState<string[]>([]);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [freeOnly, setFreeOnly] = useState(false);
  const [results, setResults] = useState<ResultOpportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (submittedQuery) params.set("q", submittedQuery);
      for (const t of types) params.append("type", t);
      if (remoteOnly) params.set("remote", "true");
      if (freeOnly) params.set("isFree", "true");

      const endpoint = submittedQuery ? "/api/search" : "/api/opportunities";
      const res = await fetch(`${endpoint}?${params.toString()}`);
      const json = await res.json();
      setResults(json.data?.opportunities ?? []);
      setTotal(json.data?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [submittedQuery, types, remoteOnly, freeOnly]);

  useEffect(() => {
    // Client-side data fetch on mount/filter-change, not a state sync — setState happens
    // asynchronously after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runSearch();
  }, [runSearch]);

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Search opportunities</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Try something natural, like &quot;fully funded fellowships in Europe for early-career
        professionals.&quot;
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedQuery(query);
        }}
        className="mt-6 flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search opportunities…"
          className="flex-1"
        />
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterChip active={remoteOnly} onClick={() => setRemoteOnly((v) => !v)}>
          Remote
        </FilterChip>
        <FilterChip active={freeOnly} onClick={() => setFreeOnly((v) => !v)}>
          Free
        </FilterChip>
        {USER_SELECTABLE_OPPORTUNITY_TYPES.map((t) => (
          <FilterChip key={t} active={types.includes(t)} onClick={() => toggleType(t)}>
            {OPPORTUNITY_TYPE_LABELS[t as OpportunityTypeValue]}
          </FilterChip>
        ))}
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <OpportunityCardSkeleton key={i} />
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            title="No opportunities found"
            description="Try a broader search or clear some filters."
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-foreground-muted">{total} result{total === 1 ? "" : "s"}</p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  matchScore={session?.user ? opp.matchScore : undefined}
                  matchReasons={opp.matchReasons}
                  showSave={Boolean(session?.user)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-primary"
      }`}
    >
      {children}
    </button>
  );
}
