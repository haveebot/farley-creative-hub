"use client";

import { useState } from "react";

type Briefing = {
  content: string;
  generated_at: string | Date;
  generated_by: string;
};

export default function DailyBriefing({ initial }: { initial: Briefing | null }) {
  const [briefing, setBriefing] = useState<Briefing | null>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-briefing/regenerate", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Failed to refresh");
        setRefreshing(false);
        return;
      }
      setBriefing(data.briefing);
    } catch (err) {
      setError((err as Error).message);
    }
    setRefreshing(false);
  }

  if (!briefing) {
    return (
      <section className="p-6 border border-border rounded-lg bg-surface mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider">Today</h2>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
          >
            {refreshing ? "Writing…" : "Generate briefing"}
          </button>
        </div>
        <p className="text-sm text-muted">
          {refreshing
            ? "Pulling the latest from drafts, leads, prospects, and activity…"
            : "No briefing yet for today. Click Generate to write one."}
        </p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </section>
    );
  }

  return (
    <section className="p-6 border border-border rounded-lg bg-surface mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider">Today</h2>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="text-xs text-muted hover:text-foreground hover:underline disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <div className="text-base leading-relaxed whitespace-pre-wrap font-serif">
        {briefing.content}
      </div>
      <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
        Generated {formatRelative(briefing.generated_at)} ·{" "}
        {briefing.generated_by === "auto" ? "auto" : briefing.generated_by}
      </p>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </section>
  );
}

function formatRelative(at: string | Date): string {
  const d = new Date(at);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleString();
}
