import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { TrackerBoard } from "@/components/tracker/tracker-board";

export default async function TrackerPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/tracker");

  const items = await prisma.trackedOpportunity.findMany({
    where: { userId: session.user.id },
    include: { opportunity: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Your tracker</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        Everything you&apos;ve saved, in one place, organized by where you are in the process.
      </p>
      <div className="mt-8">
        <TrackerBoard initialItems={JSON.parse(JSON.stringify(items))} />
      </div>
    </div>
  );
}
