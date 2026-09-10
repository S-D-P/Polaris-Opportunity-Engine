import Link from "next/link";
import { prisma } from "@/lib/db/client";
import { buildSpecRows } from "@/lib/concepts/spec";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default async function ConceptBCompare({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const idList = (ids ?? "").split(",").filter(Boolean).slice(0, 3);

  const opportunities = idList.length
    ? await prisma.opportunity.findMany({ where: { id: { in: idList } } })
    : [];
  // Preserve selection order rather than DB order
  const ordered = idList.map((id) => opportunities.find((o) => o.id === id)).filter((o) => o != null);

  const rowLabels = ordered.length > 0 ? buildSpecRows(ordered[0]).map((r) => r.label) : [];
  const specsByOpportunity = ordered.map((o) => buildSpecRows(o));

  return (
    <div className="min-h-screen bg-[#0b0d12] text-[#e6e8ec]">
      <ConceptSwitcher active="b" />
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/b" labels={{ home: "Ask", search: "Search", profile: "Context" }} />
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-medium text-white">Compare</h1>

        {ordered.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="Nothing selected"
              description="Select up to 3 opportunities from search results to compare them here."
              action={
                <ButtonLink href="/concepts/b/search" size="sm">
                  Back to search
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="w-40 border-b border-white/10 pb-3 pr-4 text-xs uppercase tracking-wide text-[#6b7280]">
                    &nbsp;
                  </th>
                  {ordered.map((o) => (
                    <th key={o.id} className="border-b border-white/10 pb-3 pr-6 align-top">
                      <Link href={`/concepts/b/opportunities/${o.id}`} className="font-medium text-white hover:underline">
                        {o.title}
                      </Link>
                      <p className="mt-1 text-xs font-normal text-[#6b7280]">{o.organization}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowLabels.map((label, rowIdx) => (
                  <tr key={label}>
                    <td className="border-b border-white/5 py-3 pr-4 text-xs uppercase tracking-wide text-[#6b7280]">
                      {label}
                    </td>
                    {specsByOpportunity.map((specs, colIdx) => (
                      <td key={colIdx} className="border-b border-white/5 py-3 pr-6 text-[#e6e8ec]">
                        {specs[rowIdx]?.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
