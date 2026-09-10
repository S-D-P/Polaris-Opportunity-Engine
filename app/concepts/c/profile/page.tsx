import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { ConceptSwitcher } from "@/components/concepts/shared/switcher";
import { ConceptSubNav } from "@/components/concepts/shared/concept-nav";
import { CategoryTile } from "@/components/concepts/c/category-tile";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ConceptCProfile() {
  const session = await auth();

  return (
    <div>
      <ConceptSwitcher active="c" />
      <div className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <ConceptSubNav base="/concepts/c" labels={{ home: "Explore", search: "Browse", profile: "Your universe" }} />
        </div>
      </div>

      {!session?.user ? (
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <EmptyState title="Log in to see your universe" action={<ButtonLink href="/login" size="sm">Log in</ButtonLink>} />
        </div>
      ) : (
        <UniverseSettings userId={session.user.id} />
      )}
    </div>
  );
}

async function UniverseSettings({ userId }: { userId: string }) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const interests = fromJsonArray(profile.interests);
  const preferredTypes = fromJsonArray(profile.preferredTypes);
  const preferredCountries = fromJsonArray(profile.preferredCountries);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-foreground">Your universe settings</h1>
      <p className="mt-1 text-sm text-foreground-muted">
        These are the dials that shape what you see when exploring.
      </p>

      <div className="mt-8 space-y-8">
        <div>
          <p className="text-sm font-medium text-foreground">Interests shaping your universe</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {interests.length > 0 ? (
              interests.map((i) => <CategoryTile key={i} label={i} href={`/concepts/c/search?q=${encodeURIComponent(i)}`} />)
            ) : (
              <p className="text-sm text-foreground-muted">No interests set yet.</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">Opportunity types you favor</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {preferredTypes.length > 0 ? (
              preferredTypes.map((t) => (
                <CategoryTile key={t} label={t.replace(/_/g, " ")} href={`/concepts/c/search?type=${t}`} />
              ))
            ) : (
              <p className="text-sm text-foreground-muted">No preferred types set yet.</p>
            )}
          </div>
        </div>

        {preferredCountries.length > 0 && (
          <div>
            <p className="text-sm font-medium text-foreground">Geographies you favor</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {preferredCountries.map((c) => (
                <CategoryTile key={c} label={c} href={`/concepts/c/search?q=${encodeURIComponent(c)}`} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ButtonLink href="/onboarding?edit=1" variant="outline" size="sm" className="mt-8">
        Adjust your universe
      </ButtonLink>
    </div>
  );
}
