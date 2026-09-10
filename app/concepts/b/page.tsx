"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const EXAMPLE_PROMPTS = [
  "Fully funded fellowships in AI policy",
  "Remote hackathons open this month",
  "Leadership programs for women in technology",
  "Paid internships for undergraduates in software engineering",
];

export default function ConceptBHome() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/concepts/b/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#e6e8ec]">
      <ConceptSwitcher active="b" />
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 text-[#e6e8ec] sm:px-6">
          <ConceptSubNav
            base="/concepts/b"
            labels={{ home: "Ask", search: "Search", profile: "Context" }}
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-28 text-center sm:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#6b7280]">
          Opportunity Intelligence
        </p>
        <h1 className="mt-4 text-3xl font-medium tracking-tight text-white sm:text-4xl">
          Ask Polaris anything about opportunities.
        </h1>

        <form onSubmit={onSubmit} className="mt-8 w-full">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="fully funded fellowships in AI policy for early-career professionals…"
            className="border-white/15 bg-white/5 py-3 text-white placeholder:text-[#6b7280] focus:ring-white/30"
          />
          <Button type="submit" className="mt-3 w-full">
            Search
          </Button>
        </form>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => router.push(`/concepts/b/search?q=${encodeURIComponent(p)}`)}
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#9ca3af] hover:border-white/30 hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
