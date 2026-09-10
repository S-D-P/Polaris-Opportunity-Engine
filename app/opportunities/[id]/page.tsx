import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { fromJsonArray } from "@/lib/db/json";
import { toMatchOpportunity, toMatchProfile } from "@/lib/matching/adapters";
import { scoreOpportunity } from "@/lib/matching/scoring";
import { formatDeadlineLabel } from "@/lib/deadline";
import { OPPORTUNITY_TYPE_LABELS, type OpportunityTypeValue } from "@/lib/taxonomy";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { TrackingActions } from "@/components/feed/tracking-actions";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await prisma.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  const session = await auth();
  let match = null;
  let trackedStatus: string | null = null;

  if (session?.user) {
    const [profile, tracked] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: session.user.id } }),
      prisma.trackedOpportunity.findUnique({
        where: { userId_opportunityId: { userId: session.user.id, opportunityId: id } },
      }),
    ]);
    if (profile) match = scoreOpportunity(toMatchProfile(profile), toMatchOpportunity(opportunity));
    trackedStatus = tracked && tracked.status !== "NOT_RELEVANT" ? tracked.status : null;
  }

  const benefits = fromJsonArray(opportunity.benefits);
  const educationReqs = fromJsonArray(opportunity.educationRequirements);
  const experienceReqs = fromJsonArray(opportunity.experienceRequirements);
  const citizenshipReqs = fromJsonArray(opportunity.citizenshipRequirements);
  const targetAudience = fromJsonArray(opportunity.targetAudience);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-4">
        <BackButton />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-muted">
        <span className="font-medium text-primary">
          {OPPORTUNITY_TYPE_LABELS[opportunity.opportunityType as OpportunityTypeValue]}
        </span>
        <span aria-hidden>·</span>
        <span>{opportunity.organization}</span>
        {opportunity.isSeedData && <Badge tone="neutral">Demo data</Badge>}
      </div>

      <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">{opportunity.title}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {opportunity.remote && <Badge tone="neutral">Remote</Badge>}
        {opportunity.hybrid && <Badge tone="neutral">Hybrid</Badge>}
        {opportunity.inPerson && <Badge tone="neutral">In-person</Badge>}
        {opportunity.location && <Badge tone="neutral">{opportunity.location}</Badge>}
        <Badge tone={opportunity.isFree ? "success" : "warning"}>
          {opportunity.isFree ? "Free" : opportunity.cost || "Paid"}
        </Badge>
        <Badge tone="neutral">{formatDeadlineLabel(opportunity.deadline, opportunity.deadlineType)}</Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer" size="lg">
          Apply on {opportunity.organization}&apos;s site ↗
        </ButtonLink>
      </div>

      {session?.user && (
        <div className="mt-4">
          <TrackingActions opportunityId={opportunity.id} initialStatus={trackedStatus} />
        </div>
      )}

      {match && (
        <Card className="mt-8 border-accent/40 bg-accent/5 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border border-accent/40 bg-surface">
              <span className="font-display text-lg leading-none text-accent">
                {match.eligible ? `${match.score}%` : "—"}
              </span>
            </div>
            <div>
              <h2 className="font-display text-lg text-foreground">Why Polaris recommends it</h2>
              {!match.eligible && (
                <p className="text-sm text-foreground-muted">
                  This one doesn&apos;t fit your stated eligibility. See below.
                </p>
              )}
            </div>
          </div>
          {match.eligible && match.reasons.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {match.reasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-foreground-muted">
                  <span className="text-accent">•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
          {!match.eligible && match.ineligibleReasons.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {match.ineligibleReasons.map((r) => (
                <li key={r} className="flex gap-2 text-sm text-foreground-muted">
                  <span className="text-danger">•</span>
                  {r}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl text-foreground">Overview</h2>
          <Badge tone="neutral">Official source content</Badge>
        </div>
        <p className="mt-3 whitespace-pre-line text-foreground-muted">{opportunity.description}</p>
      </section>

      {opportunity.aiSummary && (
        <section className="mt-10 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-foreground">Polaris AI summary</h2>
            <Badge tone="accent">AI generated</Badge>
          </div>
          <p className="mt-2 text-sm text-foreground-muted">
            Generated by Gemini from the official description above, not written by{" "}
            {opportunity.organization}.
          </p>
          <p className="mt-3 text-foreground-muted">{opportunity.aiSummary}</p>
        </section>
      )}

      {(opportunity.eligibilitySummary || educationReqs.length > 0 || experienceReqs.length > 0 || citizenshipReqs.length > 0 || opportunity.minimumAge || opportunity.maximumAge) && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-foreground">Eligibility</h2>
          {opportunity.eligibilitySummary && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <Badge tone="accent">AI interpreted eligibility</Badge>
              </div>
              <p className="mt-1.5 text-foreground-muted">{opportunity.eligibilitySummary}</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Interpreted by Gemini from the source page, grounded in what it actually
                states. Always confirm exact eligibility on the official application page.
              </p>
            </>
          )}
          <ul className="mt-3 space-y-1.5 text-sm text-foreground-muted">
            {opportunity.minimumAge && <li>• Minimum age: {opportunity.minimumAge}</li>}
            {opportunity.maximumAge && <li>• Maximum age: {opportunity.maximumAge}</li>}
            {educationReqs.map((r) => (
              <li key={r}>• Education: {r}</li>
            ))}
            {experienceReqs.map((r) => (
              <li key={r}>• Experience: {r}</li>
            ))}
            {citizenshipReqs.filter((c) => c.toLowerCase() !== "any").map((r) => (
              <li key={r}>• Citizenship: {r}</li>
            ))}
            {opportunity.genderRequirement && <li>• {opportunity.genderRequirement}</li>}
          </ul>
        </section>
      )}

      {(benefits.length > 0 || opportunity.funding) && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-foreground">What you get</h2>
          {opportunity.funding && <p className="mt-3 text-foreground-muted">{opportunity.funding}</p>}
          {benefits.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm text-foreground-muted">
              {benefits.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl text-foreground">Important dates</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground-muted">
          <li>• {formatDeadlineLabel(opportunity.deadline, opportunity.deadlineType)}</li>
          {opportunity.startDate && (
            <li>• Starts {new Date(opportunity.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</li>
          )}
          {opportunity.endDate && (
            <li>• Ends {new Date(opportunity.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl text-foreground">Application process</h2>
        <p className="mt-3 text-sm text-foreground-muted">
          Full application steps are provided on the organization&apos;s own site. Polaris
          surfaces and explains this opportunity, but applying happens directly with{" "}
          {opportunity.organization}.
        </p>
      </section>

      {targetAudience.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl text-foreground">Who this is for</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {targetAudience.map((a) => (
              <Badge key={a} tone="primary">
                {a}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-border bg-surface-muted/60 p-5">
        <h2 className="font-display text-lg text-foreground">Source</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          Polaris aggregates and structures opportunities from public sources. The
          organization&apos;s own page is always the authoritative source of truth.
        </p>
        <dl className="mt-3 grid gap-1 text-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-foreground-muted">Organization</dt>
            <dd className="text-foreground">{opportunity.sourceName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-foreground-muted">Original link</dt>
            <dd className="min-w-0">
              <Link
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary hover:underline"
              >
                {opportunity.sourceUrl}
              </Link>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-foreground-muted">Last checked</dt>
            <dd className="text-foreground">
              {new Date(opportunity.lastCheckedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="w-32 shrink-0 text-foreground-muted">Status</dt>
            <dd>
              <Badge
                tone={
                  opportunity.verificationStatus === "VERIFIED"
                    ? "success"
                    : opportunity.verificationStatus === "AI_EXTRACTED"
                      ? "accent"
                      : "warning"
                }
              >
                {opportunity.verificationStatus === "VERIFIED"
                  ? "Verified"
                  : opportunity.verificationStatus === "AI_EXTRACTED"
                    ? "AI-extracted"
                    : "Needs review"}
              </Badge>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
