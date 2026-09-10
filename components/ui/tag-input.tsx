"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Free-text multi-value input backed by a real string[] array, not a comma-separated string
 * (docs/personalization.md — the CSV inputs this replaces had a real bug: deriving the
 * text field's value from `list.join(", ")` fought the user's own typing, since every
 * keystroke round-tripped through split→filter→join and silently stripped trailing commas
 * before the next character could be typed). Each committed entry becomes its own removable
 * chip immediately — no comma-splitting involved at render time.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const exists = value.some((v) => v.toLowerCase() === trimmed.toLowerCase());
    if (!exists) onChange([...value, trimmed]);
    setDraft("");
  }

  function remove(tag: string) {
    onChange(value.filter((v) => v !== tag));
  }

  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-2 focus-within:ring-2 focus-within:ring-accent">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="ml-0.5 text-accent/70 hover:text-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            // A comma typed mid-flow commits the tag before it, exactly like a real tag
            // input — but the field's own value is never *derived* from the tag list, so
            // there's nothing to fight the next keystroke.
            if (next.includes(",")) {
              const [before] = next.split(",");
              commit(before);
            } else {
              setDraft(next);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              remove(value[value.length - 1]);
            }
          }}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className={cn(
            "min-w-[8rem] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
          )}
        />
      </div>
    </div>
  );
}
