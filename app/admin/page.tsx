import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";

async function getAnalytics() {
  const [
    totalOpportunities,
    activeOpportunities,
    expiringSoon,
    needsReview,
    totalSources,
    totalUsers,
    totalSaves,
    totalApplied,
  ] = await Promise.all([
    prisma.opportunity.count(),
    prisma.opportunity.count({ where: { status: { in: ["OPEN", "CLOSING_SOON"] } } }),
    prisma.opportunity.count({
      where: { deadline: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) } },
    }),
    prisma.opportunity.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    prisma.source.count(),
    prisma.user.count(),
    prisma.trackedOpportunity.count(),
    prisma.trackedOpportunity.count({ where: { status: "APPLIED" } }),
  ]);
  return {
    totalOpportunities,
    activeOpportunities,
    expiringSoon,
    needsReview,
    totalSources,
    totalUsers,
    totalSaves,
    totalApplied,
  };
}

export default async function AdminOverviewPage() {
  const stats = await getAnalytics();

  const cards = [
    { label: "Total opportunities", value: stats.totalOpportunities },
    { label: "Active", value: stats.activeOpportunities },
    { label: "Expiring within 7 days", value: stats.expiringSoon },
    { label: "Needs review", value: stats.needsReview },
    { label: "Sources", value: stats.totalSources },
    { label: "Users", value: stats.totalUsers },
    { label: "Total saves", value: stats.totalSaves },
    { label: "Marked applied", value: stats.totalApplied },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-5">
          <p className="text-xs font-medium text-foreground-muted">{c.label}</p>
          <p className="mt-1 font-display text-3xl text-foreground">{c.value}</p>
        </Card>
      ))}
    </div>
  );
}
