"use client";

import { useState, type FormEvent } from "react";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { CompassCard } from "@/components/concepts/a/compass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { matchFromApiFields, type ConceptOpportunity } from "@/lib/concepts/types";

interface SearchRow extends ConceptOpportunity {
  matchScore?: number | null;
  matchReasons?: string[];
}

export default function ConceptASearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      setResults(json.data?.opportunities ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ConceptSwitcher active="a" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/a" labels={{ home: "Compass", search: "Ask", profile: "You" }} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-2xl text-foreground">Ask your compass</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Tell Polaris what you&apos;re looking for, in your own words.
        </p>

        <form onSubmit={ask} className="mt-6 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. something to help me break into AI policy"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            {loading ? "Thinking…" : "Ask"}
          </Button>
        </form>

        <div className="mt-8 space-y-4">
          {searched && !loading && results.length === 0 && (
            <EmptyState title="Nothing found" description="Try describing your goal differently." />
          )}
          {results.map((opp) => (
            <CompassCard key={opp.id} opportunity={opp} match={matchFromApiFields(opp)} />
          ))}
        </div>
      </div>
    </div>
  );
}
