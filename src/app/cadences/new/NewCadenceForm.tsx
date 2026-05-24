"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrandKit } from "@/lib/db/brand-kits";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function NewCadenceForm({ brandKits }: { brandKits: BrandKit[] }) {
  const router = useRouter();
  const studio = brandKits.find((k) => k.is_studio_self);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [brandKitId, setBrandKitId] = useState<number | null>(studio?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/cadences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          brand_kit_id: brandKitId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to create cadence.");
        setSubmitting(false);
        return;
      }
      router.push(`/cadences/${data.cadence.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Name" required>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. New-prospect 3-touch outreach"
          className={inputClasses}
          autoFocus
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When to use this cadence, who it's for, any quirks."
          className={`${inputClasses} min-h-[80px] resize-y`}
        />
      </Field>

      <Field label="Voice">
        <select
          value={brandKitId ?? ""}
          onChange={(e) => setBrandKitId(e.target.value ? Number(e.target.value) : null)}
          className={inputClasses}
        >
          <option value="">— No brand kit (generic voice) —</option>
          {brandKits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.is_studio_self ? " (studio)" : ""}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">
          Claude drafts each step in this brand's voice.
        </p>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create cadence"}
        </button>
        <a href="/cadences" className="text-sm text-muted hover:text-foreground transition">
          Cancel
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
