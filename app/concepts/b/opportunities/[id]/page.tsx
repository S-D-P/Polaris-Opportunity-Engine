import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { buildSpecRows } from "@/lib/concepts/spec";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { ButtonLink } from "@/components/ui/button";

export default async function ConceptBDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  const session = await auth();
  let matchScore: number | null = null;
  if (session?.user) {
    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    if (profile) {
      const match = scoreOpportunity(toMatchProfile(profile), toMatchOpportunity(opportunity));
      matchScore = match.eligible ? match.score : null;
    }
  }

  const specs = buildSpecRows(opportunity);

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#e6e8ec]">
      <ConceptSwitcher active="b" />
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/b" labels={{ home: "Ask", search: "Search", profile: "Context" }} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="font-mono text-xs uppercase tracking-wide text-[#6b7280]">{opportunity.organization}</p>
        <h1 className="mt-1 text-2xl font-medium text-white">{opportunity.title}</h1>
        {matchScore != null && (
          <p className="mt-2 font-mono text-sm text-accent">{matchScore}% match to your profile</p>
        )}

        <table className="mt-6 w-full border-collapse text-sm">
          <tbody>
            {specs.map((row) => (
              <tr key={row.label}>
                <td className="w-44 border-b border-white/5 py-2.5 pr-4 align-top font-mono text-xs uppercase tracking-wide text-[#6b7280]">
                  {row.label}
                </td>
                <td className="border-b border-white/5 py-2.5 text-[#e6e8ec]">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer">
            Apply ↗
          </ButtonLink>
          <ButtonLink href={`/concepts/b/compare?ids=${opportunity.id}`} variant="outline">
            Add to compare
          </ButtonLink>
        </div>

        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-[#6b7280]">AI summary</p>
          <p className="mt-2 text-[#c9cdd3]">{opportunity.aiSummary || opportunity.shortDescription}</p>
        </div>

        <div className="mt-8 rounded-lg border border-white/10 p-4 text-xs text-[#6b7280]">
          Source credibility: this listing is{" "}
          <strong className="text-[#e6e8ec]">
            {opportunity.verificationStatus === "VERIFIED"
              ? "verified"
              : opportunity.verificationStatus === "AI_EXTRACTED"
                ? "AI-extracted, not yet human-verified"
                : "flagged for review, details unconfirmed"}
          </strong>
          , sourced from{" "}
          <Link href={opportunity.sourceUrl} target="_blank" className="underline">
            {opportunity.sourceName}
          </Link>{" "}
          on {new Date(opportunity.lastCheckedAt).toLocaleDateString()}.
        </div>
      </div>
    </div>
  );
}
