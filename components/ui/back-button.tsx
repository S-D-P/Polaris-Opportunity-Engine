"use client";

import { useRouter } from "next/navigation";

/**
 * Returns the user to wherever they came from (feed, search, tracker, admin — anywhere that
 * linked into this page), preserving that page's own state (filters, scroll position, search
 * query) since `router.back()` is real browser history navigation, not a fixed redirect to a
 * hardcoded route. Falls back to the feed only when there's no in-app history to go back to
 * (e.g. someone opened the opportunity link directly) — never loops, since a fallback
 * navigation is a forward push, not another "back."
 */
export function BackButton({ fallbackHref = "/feed" }: { fallbackHref?: string }) {
  const router = useRouter();

  function handleBack() {
    // document.referrer is empty (or points off-site) when there's nothing in this tab's own
    // history to return to — e.g. a direct link or a new tab — so router.back() would either
    // no-op or leave the app entirely.
    const cameFromWithinApp =
      typeof document !== "undefined" &&
      document.referrer &&
      new URL(document.referrer).origin === window.location.origin;
    if (cameFromWithinApp && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}
