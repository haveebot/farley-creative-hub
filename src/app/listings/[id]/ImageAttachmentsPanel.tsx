"use client";

import { useEffect, useState } from "react";
import type { Asset } from "@/lib/db/assets";
import type { ListingImage } from "@/lib/listings-shared";

type ImageWithAsset = ListingImage & { asset?: Asset };

export default function ImageAttachmentsPanel({
  listingId,
  initialImages,
  imageAssets,
  onChange,
}: {
  listingId: number;
  initialImages: ImageWithAsset[];
  imageAssets: Asset[];
  onChange?: (images: ImageWithAsset[]) => void;
}) {
  const [images, setImages] = useState<ImageWithAsset[]>(initialImages);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function notify(next: ImageWithAsset[]) {
    setImages(next);
    onChange?.(next);
  }

  async function refresh() {
    const res = await fetch(`/api/listings/${listingId}/images`);
    const data = await res.json();
    if (data.ok) {
      const merged = (data.images as ListingImage[]).map((img) => ({
        ...img,
        asset: imageAssets.find((a) => a.id === img.asset_id),
      }));
      notify(merged);
    }
  }

  async function attach(assetId: number) {
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId }),
    });
    const data = await res.json();
    if (!data.ok) {
      setError(data.message ?? data.error ?? "Failed to attach image");
      return;
    }
    setPicking(false);
    await refresh();
  }

  async function detach(imageId: number) {
    setError(null);
    const res = await fetch(`/api/listings/${listingId}/images/${imageId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Failed to remove image");
      return;
    }
    await refresh();
  }

  useEffect(() => {
    // Hydrate initial images with their asset metadata if not already present
    if (initialImages.some((img) => !img.asset)) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachedAssetIds = new Set(images.map((i) => i.asset_id));
  const availableAssets = imageAssets.filter((a) => !attachedAssetIds.has(a.id));

  return (
    <section className="p-4 border border-border rounded-lg bg-surface">
      <div className="flex items-baseline justify-between mb-3">
        <label className="text-sm font-medium">
          Images
          <span className="ml-3 text-xs text-muted">
            {images.length}/10 · first image is Etsy's primary
          </span>
        </label>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          disabled={images.length >= 10 || availableAssets.length === 0}
          className="text-xs underline text-muted hover:text-foreground disabled:opacity-30"
        >
          + Attach image
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {picking && (
        <div className="mb-4 border border-border rounded p-3 bg-surface-strong">
          <p className="text-xs text-muted mb-2">
            Pick from your asset library ({availableAssets.length} image
            {availableAssets.length === 1 ? "" : "s"} available)
          </p>
          {availableAssets.length === 0 ? (
            <p className="text-sm text-muted">
              No image assets to attach. Upload from{" "}
              <a href="/assets" className="underline">
                Assets
              </a>
              .
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
              {availableAssets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => attach(a.id)}
                  className="border border-border rounded p-1 hover:border-accent text-left"
                  title={a.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.name}
                    className="w-full aspect-square object-cover rounded"
                  />
                  <p className="text-xs truncate mt-1">{a.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {images.length === 0 ? (
        <p className="text-sm text-muted">
          No images yet. At least one is required to push to Etsy.
        </p>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative border border-border rounded overflow-hidden group"
            >
              {img.asset?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.asset.url}
                  alt={img.asset.name}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-surface-strong flex items-center justify-center text-muted text-xs">
                  loading…
                </div>
              )}
              <div className="absolute top-1 left-1 bg-foreground/70 text-background text-xs px-1.5 rounded">
                {i + 1}
              </div>
              {img.etsy_image_id && (
                <div
                  className="absolute top-1 right-1 bg-accent text-white text-xs px-1.5 rounded"
                  title="Uploaded to Etsy"
                >
                  ✓
                </div>
              )}
              <button
                type="button"
                onClick={() => detach(img.id)}
                className="absolute bottom-1 right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
