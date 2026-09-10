import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { OnboardingWizard } from "@/components/onboarding/wizard";
import { fromJsonArray } from "@/lib/db/json";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/onboarding");

  const { edit } = await searchParams;

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  if (profile.onboardingComplete && !edit) redirect("/feed");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <OnboardingWizard
        initialStep={edit ? 0 : profile.onboardingStep}
        completeRedirect={profile.onboardingComplete ? "/profile" : "/feed"}
        initialData={{
          name: profile.name ?? "",
          country: profile.country ?? "",
          ageRange: profile.ageRange ?? "",
          stage: profile.stage ?? "",
          gender: profile.gender ?? "",
          school: profile.school ?? "",
          degree: profile.degree ?? "",
          fieldOfStudy: profile.fieldOfStudy ?? "",
          graduationYear: profile.graduationYear ?? undefined,
          academicInterests: fromJsonArray(profile.academicInterests),
          currentRole: profile.currentRole ?? "",
          industry: profile.industry ?? "",
          yearsExperience: profile.yearsExperience ?? undefined,
          skills: fromJsonArray(profile.skills),
          technologies: fromJsonArray(profile.technologies),
          interests: fromJsonArray(profile.interests),
          aspirationsRaw: profile.aspirationsRaw ?? "",
          remoteOk: profile.remoteOk,
          hybridOk: profile.hybridOk,
          inPersonOk: profile.inPersonOk,
          preferredCountries: fromJsonArray(profile.preferredCountries),
          paidOnly: profile.paidOnly,
          timeCommitment: profile.timeCommitment ?? "",
          preferredTypes: fromJsonArray(profile.preferredTypes),
          citizenship: profile.citizenship ?? "",
        }}
      />
    </div>
  );
}
