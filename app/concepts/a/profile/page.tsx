import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { GoalCard } from "@/components/concepts/a/goal-card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ConceptAProfile() {
  const session = await auth();

  return (
    <div>
      <ConceptSwitcher active="a" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/a" labels={{ home: "Compass", search: "Ask", profile: "You" }} />
        </div>
      </div>

      {!session?.user ? (
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <EmptyState title="Log in to see your compass" action={<ButtonLink href="/login" size="sm">Log in</ButtonLink>} />
        </div>
      ) : (
        <ProfileContent userId={session.user.id} />
      )}
    </div>
  );
}

async function ProfileContent({ userId }: { userId: string }) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const interests = fromJsonArray(profile.interests);
  const skills = fromJsonArray(profile.skills);
  const goalTags = fromJsonArray(profile.goalTags);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">You, as Polaris understands you</h1>

      <GoalCard
        name={profile.name}
        aspirationsSummary={profile.aspirationsSummary}
        aspirationsRaw={profile.aspirationsRaw}
        interests={interests}
      />

      {goalTags.length > 0 && (
        <div>
          <p className="text-sm font-medium text-foreground">Your goal, broken into directions</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {goalTags.map((t) => (
              <Badge key={t} tone="primary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-medium text-foreground">What you bring</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.length > 0 ? (
            skills.map((s) => <Badge key={s}>{s}</Badge>)
          ) : (
            <span className="text-sm text-foreground-muted">No skills listed yet.</span>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-surface-muted p-4 text-sm text-foreground-muted">
        {profile.stage ? `${profile.currentRole || "Currently"} · ${profile.stage.replace(/_/g, " ").toLowerCase()}` : "Stage not set."}
        {profile.country ? ` · based in ${profile.country}` : ""}
      </div>

      <ButtonLink href="/onboarding?edit=1" variant="outline" size="sm">
        Update your compass
      </ButtonLink>
    </div>
  );
}
