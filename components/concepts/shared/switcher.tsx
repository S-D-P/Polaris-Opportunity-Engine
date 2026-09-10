import Link from "next/link";

const CONCEPTS = [
  { slug: "a", label: "A · Personal Compass" },
  { slug: "b", label: "B · Opportunity Intelligence" },
  { slug: "c", label: "C · Opportunity Universe" },
];

/**
 * Dev-only concept switcher (gated in app/concepts/layout.tsx). Lets a reviewer jump
 * between the three prototype directions and back to the real app without hunting for URLs.
 */
export function ConceptSwitcher({ active }: { active?: "a" | "b" | "c" }) {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-semibold text-amber-900">Prototype mode</span>
        <Link href="/concepts" className="text-amber-800 hover:underline">
          Overview
        </Link>
        {CONCEPTS.map((c) => (
          <Link
            key={c.slug}
            href={`/concepts/${c.slug}`}
            className={
              active === c.slug
                ? "font-semibold text-amber-900 underline"
                : "text-amber-800 hover:underline"
            }
          >
            {c.label}
          </Link>
        ))}
        <Link href="/feed" className="ml-auto text-amber-800 hover:underline">
          Exit to real app →
        </Link>
      </div>
    </div>
  );
}
