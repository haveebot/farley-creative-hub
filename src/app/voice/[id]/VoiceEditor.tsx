"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VoiceProfile } from "@/lib/voice-profiles-shared";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function VoiceEditor({ initial }: { initial: VoiceProfile }) {
  const router = useRouter();
  const [p, setP] = useState<VoiceProfile>(initial);
  const [alwaysSayInput, setAlwaysSayInput] = useState(initial.always_say.join(", "));
  const [neverSayInput, setNeverSayInput] = useState(initial.never_say.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  async function patch(updates: Partial<VoiceProfile>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/voice-profiles/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message ?? data.error ?? "Save failed");
    } else {
      setP(data.profile);
    }
    setSaving(false);
  }

  async function regenerateFromSamples() {
    if (!p.writing_samples.trim() || p.writing_samples.length < 100) {
      setError("Add at least ~100 chars of writing samples first");
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profiles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: p.writing_samples }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Regenerate failed");
        return;
      }
      const updated = await fetch(`/api/voice-profiles/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voice_notes: data.extracted.voice_notes,
          always_say: data.extracted.always_say,
          never_say: data.extracted.never_say,
          audience_persona: data.extracted.audience_persona,
        }),
      });
      const updatedData = await updated.json();
      if (updatedData.ok) {
        setP(updatedData.profile);
        setAlwaysSayInput(updatedData.profile.always_say.join(", "));
        setNeverSayInput(updatedData.profile.never_say.join(", "));
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete voice profile "${p.name}"?`)) return;
    const res = await fetch(`/api/voice-profiles/${p.id}`, { method: "DELETE" });
    if (res.ok) router.push("/voice");
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 border-l-2 border-red-600 pl-3">
          {error}
        </p>
      )}

      {/* Name + description + default toggle */}
      <section className="p-4 border border-border rounded-lg bg-surface space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            Name
          </label>
          <input
            type="text"
            value={p.name}
            onChange={(e) => setP({ ...p, name: e.target.value })}
            onBlur={() => patch({ name: p.name })}
            className={inputClasses}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            Description
          </label>
          <input
            type="text"
            value={p.description}
            onChange={(e) => setP({ ...p, description: e.target.value })}
            onBlur={() => patch({ description: p.description })}
            className={inputClasses}
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.is_default}
              onChange={(e) => patch({ is_default: e.target.checked })}
            />
            Default voice for new drafts
          </label>
        </div>
      </section>

      {/* Voice notes */}
      <section className="p-4 border border-border rounded-lg bg-surface">
        <label className="text-xs uppercase tracking-widest text-muted block mb-1">
          Voice notes
        </label>
        <p className="text-xs text-muted mb-2">
          How this voice sounds — specific moves, rhythm, characteristic
          phrases. Avoid abstract adjectives.
        </p>
        <textarea
          value={p.voice_notes}
          onChange={(e) => setP({ ...p, voice_notes: e.target.value })}
          onBlur={() => patch({ voice_notes: p.voice_notes })}
          rows={5}
          className={inputClasses}
        />
      </section>

      {/* Audience */}
      <section className="p-4 border border-border rounded-lg bg-surface">
        <label className="text-xs uppercase tracking-widest text-muted block mb-1">
          Audience persona
        </label>
        <textarea
          value={p.audience_persona}
          onChange={(e) => setP({ ...p, audience_persona: e.target.value })}
          onBlur={() => patch({ audience_persona: p.audience_persona })}
          rows={3}
          className={inputClasses}
        />
      </section>

      {/* Always / never */}
      <section className="p-4 border border-border rounded-lg bg-surface space-y-4">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            Always-say phrases <span className="text-muted">({p.always_say.length})</span>
          </label>
          <input
            type="text"
            value={alwaysSayInput}
            onChange={(e) => setAlwaysSayInput(e.target.value)}
            onBlur={() =>
              patch({
                always_say: alwaysSayInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              })
            }
            className={inputClasses}
            placeholder="comma, separated, phrases"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            Never-say phrases <span className="text-muted">({p.never_say.length})</span>
          </label>
          <input
            type="text"
            value={neverSayInput}
            onChange={(e) => setNeverSayInput(e.target.value)}
            onBlur={() =>
              patch({
                never_say: neverSayInput
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0),
              })
            }
            className={inputClasses}
            placeholder="synergy, leverage, world-class"
          />
        </div>
      </section>

      {/* Writing samples */}
      <section className="p-4 border border-border rounded-lg bg-surface">
        <div className="flex items-baseline justify-between mb-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted block">
              Writing samples
            </label>
            <p className="text-xs text-muted">
              Real past writing. Separate samples with <code>---</code>. The
              strongest signal for AI voice matching.
            </p>
          </div>
          <button
            type="button"
            onClick={regenerateFromSamples}
            disabled={regenerating}
            className="text-xs underline text-accent hover:text-foreground disabled:opacity-40"
          >
            {regenerating ? "Regenerating…" : "Re-extract voice from samples →"}
          </button>
        </div>
        <textarea
          value={p.writing_samples}
          onChange={(e) => setP({ ...p, writing_samples: e.target.value })}
          onBlur={() => patch({ writing_samples: p.writing_samples })}
          rows={12}
          className={`${inputClasses} font-mono text-sm`}
        />
      </section>

      <section className="flex items-center justify-between pt-3 border-t border-border">
        <p className="text-xs text-muted">
          {saving ? "Saving…" : "Auto-saved"}
        </p>
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm text-red-600 hover:underline"
        >
          Delete voice profile
        </button>
      </section>
    </div>
  );
}
