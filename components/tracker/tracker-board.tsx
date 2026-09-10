"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TRACK_STATUSES, TRACK_STATUS_LABELS } from "@/lib/taxonomy";
import { formatDeadlineLabel } from "@/lib/deadline";

interface TrackedItem {
  id: string;
  status: string;
  notes: string | null;
  opportunity: {
    id: string;
    title: string;
    organization: string;
    opportunityType: string;
    deadline: string | null;
  };
}

const BOARD_STATUSES = TRACK_STATUSES.filter((s) => s !== "NOT_RELEVANT");

export function TrackerBoard({ initialItems }: { initialItems: TrackedItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [savingId, setSavingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, TrackedItem[]> = {};
    for (const status of TRACK_STATUSES) map[status] = [];
    for (const item of items) map[item.status]?.push(item);
    return map;
  }, [items]);

  async function updateItem(id: string, patch: { status?: string; notes?: string }) {
    setSavingId(id);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await fetch(`/api/tracker/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } finally {
      setSavingId(null);
    }
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/tracker/${id}`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing tracked yet"
        description="Save opportunities from your feed or search results and they'll show up here."
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {BOARD_STATUSES.map((status) => (
        <div key={status}>
          <h2 className="mb-3 text-sm font-semibold text-foreground-muted">
            {TRACK_STATUS_LABELS[status]}{" "}
            <span className="text-foreground-muted/70">({grouped[status].length})</span>
          </h2>
          <div className="space-y-3">
            {grouped[status].map((item) => (
              <Card key={item.id} className="p-4">
                <Link
                  href={`/opportunities/${item.opportunity.id}`}
                  className="text-sm font-medium text-foreground hover:text-primary"
                >
                  {item.opportunity.title}
                </Link>
                <p className="mt-0.5 text-xs text-foreground-muted">{item.opportunity.organization}</p>
                <Badge tone="neutral" className="mt-2">
                  {formatDeadlineLabel(item.opportunity.deadline)}
                </Badge>

                <Select
                  value={item.status}
                  disabled={savingId === item.id}
                  onChange={(e) => updateItem(item.id, { status: e.target.value })}
                  className="mt-3 text-xs"
                >
                  {TRACK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {TRACK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>

                <Textarea
                  defaultValue={item.notes ?? ""}
                  placeholder="Add a note…"
                  className="mt-2 min-h-16 text-xs"
                  onBlur={(e) => {
                    if (e.target.value !== (item.notes ?? "")) {
                      updateItem(item.id, { notes: e.target.value });
                    }
                  }}
                />

                <button
                  onClick={() => removeItem(item.id)}
                  className="mt-2 text-xs text-foreground-muted hover:text-danger"
                >
                  Remove
                </button>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
