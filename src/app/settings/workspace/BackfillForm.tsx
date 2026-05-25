"use client";

import { useState } from "react";

type BackfillResult = {
  ok: boolean;
  dry_run?: boolean;
  matched?: number;
  labeled?: number;
  query?: string;
  workspace_email?: string;
  detail?: string;
  next_step?: string;
  error?: string;
};

export default function BackfillForm({ workspaceEmail }: { workspaceEmail: string }) {
  const [query, setQuery] = useState(
    "from:(noreply@indeed.com OR alerts@angellist.com OR jobs-noreply@linkedin.com)",
  );
  const [limit, setLimit] = useState(100);
  const [busy, setBusy] = useState<null | "preview" | "apply">(null);
  const [result, setResult] = useState<BackfillResult | null>(null);

  async function run(dry_run: boolean) {
    setBusy(dry_run ? "preview" : "apply");
    setResult(null);
    try {
      const res = await fetch("/api/admin/leads-backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, limit, dry_run }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    }
    setBusy(null);
  }

  return (
    <div className="p-5 border border-border rounded-lg bg-surface">
      <p className="text-xs uppercase tracking-widest text-muted mb-2">
        One-time lead backfill
      </p>
      <p className="text-xs text-muted mb-4">
        Gmail filters only label INCOMING mail. Past alerts already in{" "}
        <strong>{workspaceEmail}</strong>'s inbox don't get the{" "}
        <code>Hub/Leads</code> label automatically. This form retroactively
        labels matching past mail so the cron picks it up on its next tick.
      </p>

      <label className="block text-sm font-medium mb-1">Gmail search query</label>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm font-mono min-h-[80px] resize-y focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="from:(sender1@example.com OR sender2@example.com)"
      />
      <p className="text-xs text-muted mt-1">
        Any valid Gmail search syntax. Common adds: <code>newer_than:90d</code> to scope by recency,{" "}
        <code>subject:</code> to match by subject keywords.
      </p>

      <div className="flex items-center gap-4 mt-4">
        <label className="text-sm">
          Max matches:{" "}
          <input
            type="number"
            min={1}
            max={200}
            value={limit}
            onChange={(e) => setLimit(Math.min(200, Math.max(1, Number(e.target.value))))}
            className="w-20 border border-border rounded px-2 py-1 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent ml-1"
          />
        </label>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={busy !== null || !query.trim()}
          className="text-sm bg-foreground/10 text-foreground px-3 py-1.5 rounded font-medium hover:bg-foreground/20 transition disabled:opacity-50"
        >
          {busy === "preview" ? "Searching…" : "Preview matches"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                `Apply the "Hub/Leads" label to up to ${limit} matching past messages? They'll be parsed into lead rows on the next cron tick.`,
              )
            ) {
              run(false);
            }
          }}
          disabled={busy !== null || !query.trim()}
          className="text-sm bg-accent text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {busy === "apply" ? "Labeling…" : "Apply label →"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 p-3 rounded border text-sm ${
            result.ok ? "border-accent bg-accent/5" : "border-red-300 bg-red-50"
          }`}
        >
          {result.ok ? (
            result.dry_run ? (
              <>
                <p className="font-medium">
                  Preview: {result.matched ?? 0} matching messages found.
                </p>
                {result.matched && result.matched > 0 ? (
                  <p className="text-xs text-muted mt-1">
                    Click <strong>Apply label →</strong> to label all of them
                    (cron processes them on the next tick at :30).
                  </p>
                ) : (
                  <p className="text-xs text-muted mt-1">
                    No matches. Check the query syntax or try different
                    senders.
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">
                  Labeled {result.labeled} of {result.matched} matching
                  messages.
                </p>
                {result.next_step && (
                  <p className="text-xs text-muted mt-1">{result.next_step}</p>
                )}
              </>
            )
          ) : (
            <p className="text-red-600">
              Error: {result.error ?? "unknown"} {result.detail && `— ${result.detail}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
