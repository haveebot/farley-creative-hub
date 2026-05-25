"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncFromEtsyButton() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/etsy/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setResult(
          data.message ?? data.error ?? `Sync failed (${res.status})`,
        );
        return;
      }
      setResult(
        `Synced — ${data.created} new, ${data.updated} updated (of ${data.total} on Etsy).`,
      );
      router.refresh();
    } catch (err) {
      setResult((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {result && (
        <span className="text-xs text-muted max-w-xs truncate" title={result}>
          {result}
        </span>
      )}
      <button
        type="button"
        onClick={sync}
        disabled={syncing}
        className="text-sm font-medium underline hover:text-accent transition disabled:opacity-50"
      >
        {syncing ? "Syncing…" : "↻ Sync from Etsy"}
      </button>
    </div>
  );
}
