"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";

interface AdminOpportunity {
  id: string;
  title: string;
  organization: string;
  opportunityType: string;
  shortDescription: string;
  eligibilitySummary: string | null;
  verificationStatus: string;
  sourceName: string;
  dateDiscovered: string;
}

const TABS = [
  { value: "", label: "All" },
  { value: "NEEDS_REVIEW", label: "Needs review" },
  { value: "AI_EXTRACTED", label: "AI-extracted" },
  { value: "VERIFIED", label: "Verified" },
];

export default function AdminOpportunitiesPage() {
  const [tab, setTab] = useState("");
  const [items, setItems] = useState<AdminOpportunity[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AdminOpportunity>>({});

  async function load() {
    const params = tab ? `?verificationStatus=${tab}` : "";
    const res = await fetch(`/api/admin/opportunities${params}`);
    const json = await res.json();
    setItems(json.data?.opportunities ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client fetch on tab change, not a state sync
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function startEdit(item: AdminOpportunity) {
    setEditingId(item.id);
    setDraft(item);
  }

  async function saveEdit() {
    if (!editingId) return;
    await fetch(`/api/admin/opportunities/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setEditingId(null);
    load();
  }

  async function approve(id: string) {
    await fetch(`/api/admin/opportunities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus: "VERIFIED" }),
    });
    load();
  }

  return (
    <div>
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              tab === t.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-foreground-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-foreground-muted">
                  {item.organization} · {item.opportunityType} · via {item.sourceName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    item.verificationStatus === "VERIFIED"
                      ? "success"
                      : item.verificationStatus === "AI_EXTRACTED"
                        ? "accent"
                        : "warning"
                  }
                >
                  {item.verificationStatus}
                </Badge>
                {item.verificationStatus !== "VERIFIED" && (
                  <Button size="sm" variant="outline" onClick={() => approve(item.id)}>
                    Approve
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => startEdit(item)}>
                  Edit
                </Button>
              </div>
            </div>

            {editingId === item.id && (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                <Input
                  value={draft.title ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="Title"
                />
                <Textarea
                  value={draft.shortDescription ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, shortDescription: e.target.value }))}
                  placeholder="Short description"
                />
                <Textarea
                  value={draft.eligibilitySummary ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, eligibilitySummary: e.target.value }))}
                  placeholder="Eligibility summary"
                />
                <Select
                  value={draft.verificationStatus ?? item.verificationStatus}
                  onChange={(e) => setDraft((d) => ({ ...d, verificationStatus: e.target.value }))}
                >
                  <option value="NEEDS_REVIEW">Needs review</option>
                  <option value="AI_EXTRACTED">AI-extracted</option>
                  <option value="VERIFIED">Verified</option>
                </Select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-foreground-muted">No opportunities in this view.</p>}
      </div>
    </div>
  );
}
