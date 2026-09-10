import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-muted/50 px-6 py-16 text-center">
      {icon && <div className="text-foreground-muted">{icon}</div>}
      <h3 className="font-display text-xl text-foreground">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
      )}
      {action}
    </div>
  );
}
