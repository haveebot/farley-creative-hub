"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Two quick-start actions on the /voice empty state:
 *   1. Seed studio voice — pulls existing brand kit voice fields into a profile
 *   2. Generate from Hub content — analyzes drafts/Etsy listings/pipeline notes
 */
export default function EmptyStateActions() {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "seed" | "generate">(null);
  const [error, setError] = useState<string | null>(null);

  async function seed() {
    setBusy("seed");
    setError(null);
    try {
      const res = await fetch("/api/voice-profiles/seed-from-brand-kit", {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Seed failed");
        return;
      }
      router.push(`/voice/${data.profile.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 mt-6">
      <button
        type="button"
        onClick={seed}
        disabled={busy !== null}
        className="w-full md:w-auto bg-accent text-white px-5 py-2.5 text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-40"
      >
        {busy === "seed" ? "Seeding…" : "Seed Studio voice from brand kit →"}
      </button>
      <div className="text-xs text-muted">
        Or:{" "}
        <a href="/voice/new" className="underline hover:text-foreground">
          create from samples / Hub content / blank
        </a>
      </div>
      {error && (
        <p className="text-sm text-red-600 border-l-2 border-red-600 pl-3">
          {error}
        </p>
      )}
    </div>
  );
}
