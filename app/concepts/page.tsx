import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

const CONCEPTS = [
  {
    slug: "a",
    name: "A · Personal Compass",
    pitch: "Polaris as a trusted personal advisor. Answers: where should I focus right now?",
    signature: 'Signature feature: "Your path," a suggested sequence through your own real matches.',
  },
  {
    slug: "b",
    name: "B · Opportunity Intelligence",
    pitch: "Polaris as a research tool. Search-first, structured, comparative, like Perplexity for opportunities.",
    signature: "Signature feature: side-by-side opportunity comparison.",
  },
  {
    slug: "c",
    name: "C · Opportunity Universe",
    pitch: "Polaris as a discovery platform. Explore by field, stage, geography, and curated collections.",
    signature: '"You might have missed this": real matches outside your current filter.',
  },
];

export default function ConceptsOverviewPage() {
  return (
    <div>
      <ConceptSwitcher />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="font-display text-3xl text-foreground">Three directions for Polaris</h1>
        <p className="mt-2 max-w-2xl text-foreground-muted">
          Same backend, same real opportunity data, three different product philosophies.
          See <code className="rounded bg-surface-muted px-1.5 py-0.5 text-sm">docs/ui-concepts.md</code>{" "}
          in the repo for the full rationale. Pick one to explore. Each has a Home, Search,
          Opportunity detail, and Profile.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {CONCEPTS.map((c) => (
            <Card key={c.slug} className="flex flex-col p-5">
              <h2 className="font-display text-lg text-foreground">{c.name}</h2>
              <p className="mt-2 flex-1 text-sm text-foreground-muted">{c.pitch}</p>
              <p className="mt-3 text-xs font-medium text-accent">{c.signature}</p>
              <ButtonLink href={`/concepts/${c.slug}`} className="mt-4" size="sm">
                Explore
              </ButtonLink>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
