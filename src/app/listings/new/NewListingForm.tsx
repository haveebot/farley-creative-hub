"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Asset } from "@/lib/db/assets";
import type { BrandKit } from "@/lib/db/brand-kits";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function NewListingForm({
  assets,
  brandKits,
}: {
  assets: Asset[];
  brandKits: BrandKit[];
}) {
  const router = useRouter();
  const studio = brandKits.find((k) => k.is_studio_self);
  const [workingName, setWorkingName] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [assetId, setAssetId] = useState<number | "">("");
  const [brandKitId, setBrandKitId] = useState<number | "">(studio?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workingName.trim()) {
      setError("Working name is required.");
      return;
    }
    if (!contextNotes.trim()) {
      setError("Tell Claude what the listing is for.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          working_name: workingName.trim(),
          context_notes: contextNotes.trim(),
          asset_id: typeof assetId === "number" ? assetId : null,
          brand_kit_id: typeof brandKitId === "number" ? brandKitId : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message ?? data.error ?? "Failed to draft listing.");
        setSubmitting(false);
        return;
      }
      router.push(`/listings/${data.listing.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Working name" required>
        <input
          type="text"
          value={workingName}
          onChange={(e) => setWorkingName(e.target.value)}
          placeholder="e.g. Botanical wedding invite suite — watercolor"
          className={inputClasses}
          autoFocus
        />
        <p className="text-xs text-muted mt-1">
          Internal name to find this listing later — doesn&apos;t go to Etsy.
        </p>
      </Field>

      <Field label="What is this listing? (Claude needs this)" required>
        <textarea
          value={contextNotes}
          onChange={(e) => setContextNotes(e.target.value)}
          placeholder={`Design type, who it's for, what's in the package, customization options, file format and delivery.

Example: "Watercolor botanical wedding invitation suite for garden / outdoor weddings. Includes save the date, invite, RSVP card, details card. Fully editable Canva templates. Bride personalizes wording, fonts, and colors before downloading high-res PDFs. Three color palettes included: sage + cream, blush + terracotta, deep emerald."`}
          className={`${inputClasses} min-h-[180px] resize-y`}
        />
        <p className="text-xs text-muted mt-1">
          The richer this is, the better the draft. Claude can&apos;t invent
          details you don&apos;t provide.
        </p>
      </Field>

      <Field label="Linked design asset (optional)">
        <select
          value={assetId}
          onChange={(e) => setAssetId(e.target.value ? Number(e.target.value) : "")}
          className={inputClasses}
        >
          <option value="">— No linked asset —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.kind})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted mt-1">
          If the design file is in your assets library, link it here for record-keeping.
          Claude uses the filename + metadata as light context.
        </p>
      </Field>

      <Field label="Voice">
        <select
          value={brandKitId}
          onChange={(e) =>
            setBrandKitId(e.target.value ? Number(e.target.value) : "")
          }
          className={inputClasses}
        >
          {brandKits.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.is_studio_self ? " (studio)" : ""}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-accent text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {submitting ? "Drafting with Claude…" : "Draft listing →"}
        </button>
        <a href="/listings" className="text-sm text-muted hover:text-foreground transition">
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
