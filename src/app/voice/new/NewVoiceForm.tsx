"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

type Mode = "samples" | "existing" | "blank";

type Extracted = {
  voice_notes: string;
  always_say: string[];
  never_say: string[];
  audience_persona: string;
  pattern_summary: string;
};

export default function NewVoiceForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("samples");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [samples, setSamples] = useState("");
  const [includeExisting, setIncludeExisting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profiles/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samples: mode === "samples" || mode === "existing" ? samples : undefined,
          fromExisting: mode === "existing" || includeExisting,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Generation failed");
        return;
      }
      setExtracted(data.extracted);
      setSourceCounts(data.source_counts ?? {});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/voice-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          voice_notes: extracted?.voice_notes ?? "",
          writing_samples: samples,
          always_say: extracted?.always_say ?? [],
          never_say: extracted?.never_say ?? [],
          audience_persona: extracted?.audience_persona ?? "",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? data.error ?? "Save failed");
        return;
      }
      router.push(`/voice/${data.profile.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <section className="p-4 border border-border rounded-lg bg-surface">
        <p className="text-xs uppercase tracking-widest text-muted mb-3">
          How to build it
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { mode: "samples" as Mode, label: "Paste samples", hint: "Real writing → AI extract" },
              { mode: "existing" as Mode, label: "From Hub", hint: "Pull existing content" },
              { mode: "blank" as Mode, label: "Blank", hint: "Fill in manually" },
            ]
          ).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => {
                setMode(opt.mode);
                setExtracted(null);
              }}
              className={`text-left p-3 rounded border transition ${
                mode === opt.mode
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:border-accent"
              }`}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p
                className={`text-xs mt-1 ${
                  mode === opt.mode ? "text-background/70" : "text-muted"
                }`}
              >
                {opt.hint}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Name + description */}
      <section className="p-4 border border-border rounded-lg bg-surface space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">
            Profile name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Studio voice, Sales voice, Etsy listing voice"
            className={inputClasses}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">
            What's it for? <span className="text-muted text-xs">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Cold outreach + warm pitches in the pipeline"
            className={inputClasses}
          />
        </div>
      </section>

      {/* Mode body */}
      {mode === "samples" && (
        <section className="p-4 border border-border rounded-lg bg-surface">
          <label className="text-sm font-medium block mb-1">
            Paste real writing samples
          </label>
          <p className="text-xs text-muted leading-relaxed mb-3">
            Past emails, Etsy listing descriptions, Instagram captions, even text
            messages. Separate samples with <code>---</code> on its own line.
            The more real writing, the sharper the extraction. ~5 samples works
            well; more is better.
          </p>
          <textarea
            value={samples}
            onChange={(e) => setSamples(e.target.value)}
            rows={14}
            className={`${inputClasses} font-mono text-sm`}
            placeholder={`Hey Sarah —\n\nLoved that you mentioned the spring collection. We just shipped a similar palette and I think it'd land for your bridesmaids…\n\n---\n\nHand-painted botanical save-the-date. Three color palettes. Fully editable in Canva — change names, dates, fonts in under 5 minutes…\n\n---\n\n[paste 3-10 samples]`}
          />
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={includeExisting}
                onChange={(e) => setIncludeExisting(e.target.checked)}
              />
              Also include existing Hub content (drafts, Etsy listings, pipeline notes)
            </label>
            <button
              type="button"
              onClick={generate}
              disabled={generating || (samples.length < 100 && !includeExisting)}
              className="ml-auto bg-accent text-white px-5 py-2 text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-40"
            >
              {generating ? "Analyzing…" : "Generate voice from samples →"}
            </button>
          </div>
        </section>
      )}

      {mode === "existing" && (
        <section className="p-4 border border-border rounded-lg bg-surface">
          <p className="text-sm font-medium mb-1">Pull from existing Hub content</p>
          <p className="text-xs text-muted leading-relaxed mb-4">
            Will analyze writing across your Hub drafts, synced Etsy listings,
            and pipeline activity notes. Best for the studio voice profile when
            you&apos;ve already built up content in the Hub.
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="bg-accent text-white px-5 py-2 text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-40"
          >
            {generating ? "Analyzing…" : "Analyze my existing content →"}
          </button>
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600 border-l-2 border-red-600 pl-3">
          {error}
        </p>
      )}

      {/* Extracted preview */}
      {extracted && (
        <section className="p-5 border-2 border-accent rounded-lg bg-accent/5 space-y-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent mb-2">
              Extracted voice
            </p>
            <p className="text-sm text-muted">
              Edit anything before saving. {Object.entries(sourceCounts)
                .filter(([, v]) => v > 0)
                .map(([k, v]) => `${v} ${k}`)
                .join(" · ")}
            </p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-muted block mb-1">
              Pattern summary
            </label>
            <p className="text-sm italic text-foreground/85 border-l-2 border-accent pl-3">
              {extracted.pattern_summary}
            </p>
          </div>

          <FieldText
            label="Voice notes"
            value={extracted.voice_notes}
            onChange={(v) =>
              setExtracted({ ...extracted, voice_notes: v })
            }
            rows={5}
          />

          <FieldText
            label="Audience persona"
            value={extracted.audience_persona}
            onChange={(v) =>
              setExtracted({ ...extracted, audience_persona: v })
            }
            rows={3}
          />

          <FieldCsv
            label="Always-say phrases"
            value={extracted.always_say}
            onChange={(v) => setExtracted({ ...extracted, always_say: v })}
          />

          <FieldCsv
            label="Never-say phrases"
            value={extracted.never_say}
            onChange={(v) => setExtracted({ ...extracted, never_say: v })}
          />

          <div className="flex items-center gap-3 pt-3 border-t border-accent/30">
            <button
              type="button"
              onClick={save}
              disabled={saving || !name.trim()}
              className="bg-foreground text-background px-6 py-2.5 text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save voice profile →"}
            </button>
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="text-sm text-muted hover:text-foreground underline disabled:opacity-40"
            >
              {generating ? "Regenerating…" : "Regenerate from samples"}
            </button>
          </div>
        </section>
      )}

      {/* Blank mode — save without extraction */}
      {mode === "blank" && (
        <section className="p-4 border border-border rounded-lg bg-surface">
          <p className="text-sm text-muted leading-relaxed mb-4">
            Blank mode just creates an empty profile you can fill in on the
            detail page. If you have any writing to analyze, &ldquo;Paste
            samples&rdquo; or &ldquo;From Hub&rdquo; will get you a much better
            starting point.
          </p>
          <button
            type="button"
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-accent text-white px-5 py-2 text-sm font-medium rounded hover:opacity-90 transition disabled:opacity-40"
          >
            {saving ? "Saving…" : "Create blank profile →"}
          </button>
        </section>
      )}
    </div>
  );
}

function FieldText({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted block mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={inputClasses}
      />
    </div>
  );
}

function FieldCsv({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-muted block mb-1">
        {label} <span className="text-muted">({value.length})</span>
      </label>
      <input
        type="text"
        value={value.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          )
        }
        className={inputClasses}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="text-xs bg-foreground/10 text-foreground px-2 py-0.5 rounded"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
