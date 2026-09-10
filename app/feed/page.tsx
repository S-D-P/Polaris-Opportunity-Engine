import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { generateFeed } from "@/lib/matching/feed";
import { OpportunityCard } from "@/components/feed/opportunity-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

export default async function FeedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/feed");

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile?.onboardingComplete) redirect("/onboarding");

  const [items, tracked] = await Promise.all([
    generateFeed(session.user.id, 30),
    prisma.trackedOpportunity.findMany({
      where: { userId: session.user.id },
      select: { opportunityId: true },
    }),
  ]);

  const trackedIds = new Set(tracked.map((t) => t.opportunityId));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-foreground">Your feed</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Given who you are and where you want to go, here&apos;s what to look at right now.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing matched yet"
          description="Polaris doesn't have an eligible, well-matched opportunity for your profile right now. Try widening your preferences, or check back as more sources are added."
          action={
            <ButtonLink href="/profile" variant="outline">
              Update your profile
            </ButtonLink>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {items.map(({ opportunity, match }) => (
            <OpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              matchScore={match.score}
              matchReasons={match.reasons}
              showSave
              savedInitially={trackedIds.has(opportunity.id)}
            />
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-sm text-foreground-muted">
        Looking for something specific?{" "}
        <Link href="/search" className="font-medium text-primary hover:underline">
          Try a search
        </Link>
      </p>
    </div>
  );
}
