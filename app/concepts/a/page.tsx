import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { generateFeed } from "@/lib/matching/feed";
import { buildOpportunityPath } from "@/lib/concepts/path";
import { getDeadlineUrgency } from "@/lib/deadline";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { CompassCard } from "@/components/concepts/a/compass-card";
import { GoalCard } from "@/components/concepts/a/goal-card";
import { PathTimeline } from "@/components/concepts/a/path-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function ConceptAHome() {
  const session = await auth();

  return (
    <div>
      <ConceptSwitcher active="a" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/a" labels={{ home: "Compass", search: "Ask", profile: "You" }} />
        </div>
      </div>

      {!session?.user ? (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <EmptyState
            title="Your compass needs a profile to point anywhere"
            description="Log in with the demo account to see the Personal Compass concept with real matched data."
            action={
              <ButtonLink href="/login?callbackUrl=/concepts/a" size="sm">
                Log in
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <ConceptAContent userId={session.user.id} name={session.user.name ?? null} />
      )}
    </div>
  );
}

async function ConceptAContent({ userId, name }: { userId: string; name: string | null }) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.onboardingComplete) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <EmptyState
          title="Finish onboarding to unlock your compass"
          description="Concept A is built entirely around your real profile. Complete the wizard first."
          action={
            <ButtonLink href="/onboarding" size="sm">
              Continue onboarding
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const feedItems = await generateFeed(userId, 40);
  const bestMatches = feedItems.slice(0, 4);
  const closingSoon = feedItems
    .filter((i) => ["today", "soon", "this-week"].includes(getDeadlineUrgency(i.opportunity.deadline)))
    .sort((a, b) => (a.opportunity.deadline?.getTime() ?? 0) - (b.opportunity.deadline?.getTime() ?? 0))
    .slice(0, 3);

  const interests: string[] = JSON.parse(profile.interests || "[]");
  const interestGroups = interests.slice(0, 2).map((interest) => ({
    interest,
    items: feedItems
      .filter((i) => {
        const categories: string[] = JSON.parse(i.opportunity.categories || "[]");
        const fields: string[] = JSON.parse(i.opportunity.fields || "[]");
        return [...categories, ...fields].some((c) => c.toLowerCase() === interest.toLowerCase());
      })
      .slice(0, 3),
  }));

  const path = buildOpportunityPath(feedItems);

  const trackedCounts = await prisma.trackedOpportunity.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">
          {greeting()}{name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-1 text-foreground-muted">Here&apos;s where to focus your attention right now.</p>
      </div>

      <GoalCard
        name={name}
        aspirationsSummary={profile.aspirationsSummary}
        aspirationsRaw={profile.aspirationsRaw}
        interests={interests}
      />

      {bestMatches.length === 0 ? (
        <EmptyState
          title="Nothing matched yet"
          description="Widen your preferences or check back as more sources are added."
        />
      ) : (
        <section>
          <h2 className="font-display text-xl text-foreground">Best opportunities for you</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {bestMatches.map(({ opportunity, match }) => (
              <CompassCard key={opportunity.id} opportunity={opportunity} match={match} />
            ))}
          </div>
        </section>
      )}

      {closingSoon.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-foreground">Closing soon</h2>
          <p className="text-sm text-foreground-muted">Worth deciding on before you lose the option.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {closingSoon.map(({ opportunity, match }) => (
              <CompassCard key={opportunity.id} opportunity={opportunity} match={match} compact />
            ))}
          </div>
        </section>
      )}

      {path.length > 1 && <PathTimeline steps={path} />}

      {interestGroups.map(
        (group) =>
          group.items.length > 0 && (
            <section key={group.interest}>
              <h2 className="font-display text-xl text-foreground">
                Because you&apos;re interested in {group.interest}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {group.items.map(({ opportunity, match }) => (
                  <CompassCard key={opportunity.id} opportunity={opportunity} match={match} compact />
                ))}
              </div>
            </section>
          )
      )}

      <section className="rounded-2xl border border-border bg-surface-muted/50 p-5">
        <h2 className="font-display text-lg text-foreground">Your progress</h2>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          {trackedCounts.length === 0 ? (
            <span className="text-foreground-muted">Nothing tracked yet.</span>
          ) : (
            trackedCounts.map((t) => (
              <span key={t.status} className="text-foreground-muted">
                <span className="font-medium text-foreground">{t._count}</span> {t.status.toLowerCase()}
              </span>
            ))
          )}
        </div>
        <Link href="/tracker" className="mt-2 inline-block text-sm text-primary hover:underline">
          Open full tracker →
        </Link>
      </section>
    </div>
  );
}
