"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CadenceTemplate } from "@/lib/cadence-templates";
import { formatStepDelay } from "@/lib/cadences-shared";

export default function TemplateGallery({
  templates,
}: {
  templates: CadenceTemplate[];
}) {
  const router = useRouter();
  const [cloning, setCloning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function clone(templateId: string) {
    setCloning(templateId);
    setError(null);
    try {
      const res = await fetch("/api/cadences/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Failed to clone template");
        setCloning(null);
        return;
      }
      router.push(`/cadences/${data.cadence.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCloning(null);
    }
  }

  return (
    <div className="mb-6">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">
        Start from a template
      </p>
      <p className="text-sm text-muted mb-4">
        Clone any of these into your cadences. The steps + prompts are starting
        points — edit anything after cloning. Voice defaults to your studio
        brand kit.
      </p>
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((t) => (
          <li key={t.id} className="border border-border rounded-lg bg-surface p-4 flex flex-col">
            <p className="font-medium text-sm mb-1">{t.name}</p>
            <p className="text-xs text-muted mb-3">{t.description}</p>
            <ol className="text-xs text-muted space-y-1 mb-4 flex-1">
              {t.steps.map((s, i) => (
                <li key={i}>
                  <span className="text-foreground">Step {i + 1}</span> ·{" "}
                  {formatStepDelay({
                    delay_days: s.delay_days,
                    delay_hours: s.delay_hours,
                  })}
                  {i === 0 ? " (at enrollment)" : " after previous"}
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() => clone(t.id)}
              disabled={cloning !== null}
              className="text-sm bg-accent text-white px-3 py-1.5 rounded font-medium hover:opacity-90 transition disabled:opacity-50"
            >
              {cloning === t.id ? "Cloning…" : "Clone →"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
    </div>
  );
}
