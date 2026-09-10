import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ConceptBProfile() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#e6e8ec]">
      <ConceptSwitcher active="b" />
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/b" labels={{ home: "Ask", search: "Search", profile: "Context" }} />
        </div>
      </div>

      {!session?.user ? (
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <EmptyState title="Log in to see your search context" action={<ButtonLink href="/login" size="sm">Log in</ButtonLink>} />
        </div>
      ) : (
        <ProfileContext userId={session.user.id} />
      )}
    </div>
  );
}

async function ProfileContext({ userId }: { userId: string }) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const rows: { key: string; value: string; appliesTo: string }[] = [
    { key: "citizenship", value: profile.citizenship || "—", appliesTo: "eligibility filter" },
    { key: "stage", value: profile.stage || "—", appliesTo: "eligibility filter" },
    { key: "interests", value: fromJsonArray(profile.interests).join(", ") || "—", appliesTo: "relevance boost" },
    { key: "skills", value: fromJsonArray(profile.skills).join(", ") || "—", appliesTo: "relevance boost" },
    {
      key: "preferredCountries",
      value: fromJsonArray(profile.preferredCountries).join(", ") || "any",
      appliesTo: "relevance boost",
    },
    { key: "paidOnly", value: profile.paidOnly ? "true" : "false", appliesTo: "relevance boost" },
    {
      key: "preferredTypes",
      value: fromJsonArray(profile.preferredTypes).join(", ") || "any",
      appliesTo: "relevance boost",
    },
    { key: "aspirationsSummary", value: profile.aspirationsSummary || "—", appliesTo: "semantic ranking" },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-medium text-white">Search context</h1>
      <p className="mt-1 text-sm text-[#6b7280]">
        These fields silently shape ranking and eligibility on every search. They aren&apos;t
        applied as visible filters unless you set them explicitly.
      </p>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-[#6b7280]">
            <th className="border-b border-white/10 pb-2 text-left">Field</th>
            <th className="border-b border-white/10 pb-2 text-left">Value</th>
            <th className="border-b border-white/10 pb-2 text-left">Applies to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border-b border-white/5 py-2.5 font-mono text-xs text-[#9ca3af]">{r.key}</td>
              <td className="border-b border-white/5 py-2.5">{r.value}</td>
              <td className="border-b border-white/5 py-2.5 text-xs text-[#6b7280]">{r.appliesTo}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ButtonLink href="/onboarding?edit=1" variant="outline" size="sm" className="mt-6">
        Edit context
      </ButtonLink>
    </div>
  );
}
