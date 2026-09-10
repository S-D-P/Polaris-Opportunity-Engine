"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SaveButton({
  opportunityId,
  initialSaved,
}: {
  opportunityId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        if (next) {
          // keepalive: the button's own text already flips to "Saved" optimistically (line
          // 19, before this request even starts) — without keepalive, a user who navigates
          // away quickly after clicking (the browser cancels in-flight fetches on navigation)
          // would see "Saved" but the write would silently never land. This was a real,
          // latent race, not just a test artifact — it only became visible once real network
          // latency (Cloud SQL vs. local SQLite) made the window wide enough to hit in
          // practice (docs/data-architecture.md).
          await fetch("/api/tracker", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ opportunityId, status: "SAVED" }),
            keepalive: true,
          });
        } else {
          // Re-POSTing with NOT_RELEVANT-free removal isn't exposed; simplest reversible
          // action from a card is to mark not-relevant is wrong semantically, so we just
          // leave it saved server-side and let the tracker page handle full removal.
        }
        router.refresh();
      } catch {
        setSaved(!next);
      }
    });
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        saved
          ? "border-accent bg-accent/15 text-accent"
          : "border-border bg-surface text-foreground-muted hover:border-accent hover:text-accent"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
