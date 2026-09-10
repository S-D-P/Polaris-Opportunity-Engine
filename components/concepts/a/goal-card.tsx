import { Badge } from "@/components/ui/badge";

export function GoalCard({
  name,
  aspirationsSummary,
  aspirationsRaw,
  interests,
}: {
  name: string | null;
  aspirationsSummary: string | null;
  aspirationsRaw: string | null;
  interests: string[];
}) {
  const goal = aspirationsSummary || aspirationsRaw;

  return (
    <div className="rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-transparent p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Your compass</p>
      {goal ? (
        <p className="mt-2 font-display text-xl text-foreground">&ldquo;{goal}&rdquo;</p>
      ) : (
        <p className="mt-2 text-foreground-muted">
          {name ? `${name}, you` : "You"} haven&apos;t told Polaris where you want to go yet.
        </p>
      )}
      {interests.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {interests.map((i) => (
            <Badge key={i} tone="accent">
              {i}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
