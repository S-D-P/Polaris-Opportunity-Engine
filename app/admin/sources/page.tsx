"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Source {
  id: string;
  name: string;
  sourceType: string;
  url: string;
  isActive: boolean;
  _count: { opportunities: number; jobs: number };
}

interface Job {
  id: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  itemsFound: number;
  itemsStored: number;
  itemsDuplicate: number;
  itemsFailed: number;
  source: { name: string; sourceType: string };
}

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("RSS");
  const [url, setUrl] = useState("");

  async function load() {
    const [sourcesRes, jobsRes] = await Promise.all([
      fetch("/api/admin/sources"),
      fetch("/api/admin/jobs"),
    ]);
    const sourcesJson = await sourcesRes.json();
    const jobsJson = await jobsRes.json();
    setSources(sourcesJson.data?.sources ?? []);
    setJobs(jobsJson.data?.jobs ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial client fetch, not a state sync
    load();
  }, []);

  async function createSource(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sourceType, url }),
    });
    setName("");
    setUrl("");
    setShowForm(false);
    load();
  }

  async function runSource(id: string) {
    setRunningId(id);
    try {
      await fetch(`/api/admin/sources/${id}/run`, { method: "POST" });
      await load();
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl text-foreground">Sources</h2>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add source"}
        </Button>
      </div>

      {showForm && (
        <Card className="mt-4 p-5">
          <form onSubmit={createSource} className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="sourceType">Type</Label>
              <Select id="sourceType" value={sourceType} onChange={(e) => setSourceType(e.target.value)}>
                <option value="RSS">RSS feed</option>
                <option value="MANUAL">Manual / curated</option>
                <option value="JSON_API">JSON API (adapter not yet implemented)</option>
                <option value="STATIC_PAGE">Static page (adapter not yet implemented)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="url">URL</Label>
              <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} required type="url" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit">Create source</Button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-4 space-y-3">
        {sources.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-foreground">{s.name}</p>
              <p className="text-xs text-foreground-muted">
                {s.sourceType} · {s.url} · {s._count.opportunities} opportunities
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={runningId === s.id} onClick={() => runSource(s.id)}>
              {runningId === s.id ? "Running…" : "Run ingestion"}
            </Button>
          </Card>
        ))}
        {sources.length === 0 && <p className="text-sm text-foreground-muted">No sources yet.</p>}
      </div>

      <h2 className="mt-10 font-display text-xl text-foreground">Recent ingestion jobs</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-foreground-muted">
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Found</th>
              <th className="py-2 pr-4">Stored</th>
              <th className="py-2 pr-4">Duplicate</th>
              <th className="py-2 pr-4">Failed</th>
              <th className="py-2 pr-4">Started</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-b border-border/60">
                <td className="py-2 pr-4">{j.source.name}</td>
                <td className="py-2 pr-4">
                  <Badge
                    tone={j.status === "SUCCEEDED" ? "success" : j.status === "FAILED" ? "danger" : "neutral"}
                  >
                    {j.status}
                  </Badge>
                </td>
                <td className="py-2 pr-4">{j.itemsFound}</td>
                <td className="py-2 pr-4">{j.itemsStored}</td>
                <td className="py-2 pr-4">{j.itemsDuplicate}</td>
                <td className="py-2 pr-4">{j.itemsFailed}</td>
                <td className="py-2 pr-4">{new Date(j.startedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="mt-2 text-sm text-foreground-muted">No ingestion jobs yet.</p>}
      </div>
    </div>
  );
}
