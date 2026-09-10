import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { STAGE_LABELS, type StageValue } from "@/lib/taxonomy";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/profile");

  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  if (!profile?.onboardingComplete) redirect("/onboarding");

  const interests = fromJsonArray(profile.interests);
  const skills = fromJsonArray(profile.skills);
  const preferredCountries = fromJsonArray(profile.preferredCountries);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-foreground">Your profile</h1>
        <ButtonLink href="/onboarding?edit=1" variant="outline" size="sm">
          Edit
        </ButtonLink>
      </div>

      <div className="mt-8 space-y-6">
        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Basics</h2>
          <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-foreground-muted">Name</dt>
            <dd>{profile.name || "—"}</dd>
            <dt className="text-foreground-muted">Country</dt>
            <dd>{profile.country || "—"}</dd>
            <dt className="text-foreground-muted">Stage</dt>
            <dd>{profile.stage ? STAGE_LABELS[profile.stage as StageValue] : "—"}</dd>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Education & professional</h2>
          <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-foreground-muted">School</dt>
            <dd>{profile.school || "—"}</dd>
            <dt className="text-foreground-muted">Field of study</dt>
            <dd>{profile.fieldOfStudy || "—"}</dd>
            <dt className="text-foreground-muted">Current role</dt>
            <dd>{profile.currentRole || "—"}</dd>
            <dt className="text-foreground-muted">Years of experience</dt>
            <dd>{profile.yearsExperience ?? "—"}</dd>
          </dl>
          {skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skills.map((s) => (
                <Badge key={s}>{s}</Badge>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Interests</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {interests.length > 0 ? (
              interests.map((i) => (
                <Badge key={i} tone="accent">
                  {i}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-foreground-muted">None set</span>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Aspirations</h2>
          <p className="mt-2 text-sm text-foreground-muted">{profile.aspirationsRaw || "Not set"}</p>
          {profile.aspirationsSummary && (
            <p className="mt-2 text-sm italic text-foreground-muted">
              Polaris understood this as: &quot;{profile.aspirationsSummary}&quot;
            </p>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-display text-lg text-foreground">Preferences</h2>
          <dl className="mt-3 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
            <dt className="text-foreground-muted">Work mode</dt>
            <dd>
              {[profile.remoteOk && "Remote", profile.hybridOk && "Hybrid", profile.inPersonOk && "In-person"]
                .filter(Boolean)
                .join(", ") || "—"}
            </dd>
            <dt className="text-foreground-muted">Countries</dt>
            <dd>{preferredCountries.length > 0 ? preferredCountries.join(", ") : "Anywhere"}</dd>
            <dt className="text-foreground-muted">Free only</dt>
            <dd>{profile.paidOnly ? "Yes" : "No"}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
