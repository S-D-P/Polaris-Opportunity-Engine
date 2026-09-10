import { ButtonLink } from "@/components/ui/button";
import { OpportunityCard, type OpportunityCardData } from "@/components/feed/opportunity-card";

const EXAMPLES: (OpportunityCardData & { matchScore: number; matchReasons: string[] })[] = [
  {
    id: "example-1",
    title: "AI & Machine Learning Scholarship",
    organization: "CloudWorks & OpenLearn",
    opportunityType: "SCHOLARSHIP",
    location: "Online",
    remote: true,
    hybrid: false,
    inPerson: false,
    deadline: new Date(Date.now() + 15 * 86400000).toISOString(),
    isFree: true,
    shortDescription:
      "A funded 4-month machine learning course for students and early-career technologists.",
    aiSummary:
      "A scholarship covering a 4-month applied machine learning course, aimed at students and early-career technologists worldwide.",
    isSeedData: true,
    matchScore: 94,
    matchReasons: [
      "You've shown interest in AI/ML",
      "You're an early-career technology professional",
      "The program accepts applicants worldwide",
      "Applications are currently open",
    ],
  },
  {
    id: "example-2",
    title: "Global Voyager Fellowship",
    organization: "Horizon Foundation",
    opportunityType: "FELLOWSHIP",
    location: "Washington, D.C. + remote",
    remote: true,
    hybrid: true,
    inPerson: false,
    deadline: new Date(Date.now() + 46 * 86400000).toISOString(),
    isFree: true,
    shortDescription:
      "A fellowship for early-career professionals combining technology and public policy work.",
    aiSummary:
      "Supports early-career leaders working at the intersection of technology and public policy with a stipend and mentorship.",
    isSeedData: true,
    matchScore: 88,
    matchReasons: [
      "Matches your goal of combining AI and public policy",
      "Accepts early-career professionals",
    ],
  },
  {
    id: "example-3",
    title: "Women in AI Mentorship Circle",
    organization: "Women in AI Global Network",
    opportunityType: "MENTORSHIP",
    location: "Online",
    remote: true,
    hybrid: false,
    inPerson: false,
    deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
    isFree: true,
    shortDescription: "A 6-month mentorship program for women and gender minorities in AI/ML.",
    aiSummary:
      "Pairs women and gender-minority professionals in AI/ML with senior industry mentors over 6 months.",
    isSeedData: true,
    matchScore: 81,
    matchReasons: ["You've shown interest in AI/ML", "Available remotely"],
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <div className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold tracking-wide text-accent uppercase">
            Opportunity discovery, personalized
          </p>
          <h1 className="font-display text-4xl leading-[1.1] text-foreground sm:text-5xl">
            The opportunities you&apos;re looking for are already out there.
          </h1>
          <p className="mt-3 font-display text-4xl leading-[1.1] text-foreground-muted sm:text-5xl">
            Polaris helps you find them.
          </p>
          <p className="mt-6 max-w-xl text-lg text-foreground-muted">
            Scholarships, fellowships, internships, jobs, hackathons, research programs.
            They&apos;re scattered across hundreds of websites and newsletters. Tell Polaris who
            you are and where you want to go, and it brings the relevant ones to you, explained.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink href="/signup" size="lg">
              Find my opportunities
            </ButtonLink>
            <ButtonLink href="/search" variant="outline" size="lg">
              Browse without an account
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-surface-muted/50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl text-foreground">How Polaris works</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create your profile",
                body: "Tell Polaris about your education, skills, and interests in a few short steps, not a giant form.",
              },
              {
                step: "2",
                title: "Tell Polaris where you want to go",
                body: "Describe your goals in your own words. Polaris turns that into a structured picture of what to look for.",
              },
              {
                step: "3",
                title: "Discover opportunities matched to you",
                body: "Get a curated feed with a match score and a clear explanation for every recommendation.",
              },
            ].map((s) => (
              <div key={s.step}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground">
                  {s.step}
                </div>
                <h3 className="mt-3 font-medium text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-foreground-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl text-foreground">
              Example of what your feed could look like
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Illustrative examples. Sign up to get a feed matched to your actual profile.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => (
            <OpportunityCard key={ex.id} opportunity={ex} matchScore={ex.matchScore} matchReasons={ex.matchReasons} />
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-primary py-16 text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="font-display text-3xl">Stop missing opportunities you never saw.</h2>
          <div className="mt-6">
            <ButtonLink href="/signup" variant="secondary" size="lg">
              Find my opportunities
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
