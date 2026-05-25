"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Asset } from "@/lib/db/assets";
import type { Listing, ListingImage, ListingStatus } from "@/lib/listings-shared";
import { LISTING_STATUS_LABELS } from "@/lib/listings-shared";
import EtsyPublishPanel from "./EtsyPublishPanel";
import ImageAttachmentsPanel from "./ImageAttachmentsPanel";

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

export default function ListingEditor({
  initialListing,
  asset,
  initialImages,
  imageAssets,
}: {
  initialListing: Listing;
  asset: Asset | null;
  initialImages: (ListingImage & { asset?: Asset })[];
  imageAssets: Asset[];
}) {
  const router = useRouter();
  const [listing, setListing] = useState<Listing>(initialListing);
  const [images, setImages] = useState<(ListingImage & { asset?: Asset })[]>(
    initialImages,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function patch(updates: Partial<Listing>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/listings/${listing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.message ?? data.error ?? "Save failed.");
      setSaving(false);
      return false;
    }
    setListing(data.listing);
    setSaving(false);
    return true;
  }

  async function handleDelete() {
    if (!confirm(`Delete listing "${listing.working_name}"?`)) return;
    const res = await fetch(`/api/listings/${listing.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Failed to delete listing.");
      return;
    }
    router.push("/listings");
  }

  async function copyToClipboard(text: string, fieldKey: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  }

  const titleLen = listing.title.length;
  const titleOverLimit = titleLen > 140;

  return (
    <div className="space-y-6">
      {/* Status + actions */}
      <section className="p-4 border border-border rounded-lg bg-surface flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-1">Status</p>
          <p className="text-sm font-medium">
            {LISTING_STATUS_LABELS[listing.status]}
            {listing.posted_at && (
              <span className="text-xs text-muted ml-2">
                · posted {new Date(listing.posted_at).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {(["draft", "approved", "posted", "archived"] as ListingStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => patch({ status: s })}
              disabled={saving || listing.status === s}
              className={`text-xs px-2 py-1 rounded border transition ${
                listing.status === s
                  ? "bg-foreground text-background border-foreground"
                  : "border-border hover:border-accent"
              } disabled:opacity-50`}
            >
              {LISTING_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </section>

      {asset && (
        <section className="p-4 border border-border rounded-lg bg-surface flex items-center gap-4">
          {asset.mime_type.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.name}
              className="w-20 h-20 object-cover rounded border border-border"
            />
          ) : (
            <div className="w-20 h-20 rounded border border-border flex items-center justify-center text-2xl text-muted">
              {asset.mime_type === "application/pdf" ? "📄" : "📦"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-widest text-muted">Linked asset</p>
            <p className="font-medium truncate">{asset.name}</p>
            <a
              href={asset.url}
              target="_blank"
              rel="noopener"
              className="text-xs underline text-muted hover:text-foreground"
            >
              open file →
            </a>
          </div>
        </section>
      )}

      {/* Context notes */}
      <section className="p-4 border border-border rounded-lg bg-surface">
        <details>
          <summary className="text-xs uppercase tracking-widest text-muted cursor-pointer">
            Context notes (what you told Claude)
          </summary>
          <p className="text-sm text-muted mt-3 whitespace-pre-wrap">
            {listing.context_notes}
          </p>
        </details>
      </section>

      {/* Title */}
      <FieldBlock
        label="Title"
        helper={
          <span className={titleOverLimit ? "text-red-600" : "text-muted"}>
            {titleLen}/140 chars
          </span>
        }
        onCopy={() => copyToClipboard(listing.title, "title")}
        copied={copiedField === "title"}
      >
        <input
          type="text"
          value={listing.title}
          onChange={(e) => setListing({ ...listing, title: e.target.value })}
          onBlur={() => patch({ title: listing.title })}
          className={inputClasses}
        />
      </FieldBlock>

      {/* Description */}
      <FieldBlock
        label="Description"
        onCopy={() => copyToClipboard(listing.description, "description")}
        copied={copiedField === "description"}
      >
        <textarea
          value={listing.description}
          onChange={(e) => setListing({ ...listing, description: e.target.value })}
          onBlur={() => patch({ description: listing.description })}
          className={`${inputClasses} min-h-[280px] resize-y font-serif`}
        />
      </FieldBlock>

      {/* Tags */}
      <FieldBlock
        label="Tags"
        helper={
          <span
            className={
              listing.tags.length === 13 ? "text-muted" : "text-red-600"
            }
          >
            {listing.tags.length}/13
          </span>
        }
        onCopy={() => copyToClipboard(listing.tags.join(", "), "tags")}
        copied={copiedField === "tags"}
      >
        <input
          type="text"
          value={listing.tags.join(", ")}
          onChange={(e) =>
            setListing({
              ...listing,
              tags: e.target.value
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0),
            })
          }
          onBlur={() => patch({ tags: listing.tags })}
          className={inputClasses}
          placeholder="comma, separated, etsy, tags"
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {listing.tags.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="text-xs bg-foreground/10 text-foreground px-2 py-0.5 rounded"
            >
              {t}
            </span>
          ))}
        </div>
      </FieldBlock>

      {/* Keywords */}
      <FieldBlock
        label="Suggested keywords (weave into description)"
        helper={<span className="text-muted">{listing.keywords.length}</span>}
        onCopy={() =>
          copyToClipboard(listing.keywords.join(", "), "keywords")
        }
        copied={copiedField === "keywords"}
      >
        <input
          type="text"
          value={listing.keywords.join(", ")}
          onChange={(e) =>
            setListing({
              ...listing,
              keywords: e.target.value
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0),
            })
          }
          onBlur={() => patch({ keywords: listing.keywords })}
          className={inputClasses}
        />
      </FieldBlock>

      {error && (
        <p className="text-sm text-red-600 -mt-3">{error}</p>
      )}

      {/* Images for Etsy push */}
      <ImageAttachmentsPanel
        listingId={listing.id}
        initialImages={images}
        imageAssets={imageAssets}
        onChange={setImages}
      />

      {/* Etsy publishing fields + push */}
      <EtsyPublishPanel
        listing={listing}
        images={images}
        onListingUpdate={setListing}
      />

      <section className="flex items-center justify-between pt-3 border-t border-border">
        <p className="text-xs text-muted">
          Drafted via {listing.ai_model_used ?? "(unknown model)"} · saved {saving ? "…" : "auto"}
        </p>
        <button
          type="button"
          onClick={handleDelete}
          className="text-sm text-red-600 hover:underline"
        >
          Delete listing
        </button>
      </section>
    </div>
  );
}

function FieldBlock({
  label,
  helper,
  onCopy,
  copied,
  children,
}: {
  label: string;
  helper?: React.ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="p-4 border border-border rounded-lg bg-surface">
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium">
          {label}
          {helper && <span className="ml-3 text-xs">{helper}</span>}
        </label>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="text-xs underline text-muted hover:text-foreground"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
