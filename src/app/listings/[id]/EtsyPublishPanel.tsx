"use client";

import { useEffect, useState } from "react";
import {
  ETSY_WHEN_MADE,
  ETSY_WHO_MADE,
  validateForEtsyPush,
  type EtsyWhenMade,
  type EtsyWhoMade,
  type Listing,
  type ListingImage,
} from "@/lib/listings-shared";
import TaxonomyPicker from "./TaxonomyPicker";

type ShippingProfile = {
  shipping_profile_id: number;
  title: string;
};

const inputClasses =
  "w-full border border-border rounded px-3 py-2 bg-surface text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-accent";

const WHO_LABELS: Record<EtsyWhoMade, string> = {
  i_did: "I did",
  someone_else: "Someone else",
  collective: "A collective",
};

const WHEN_LABELS: Record<EtsyWhenMade, string> = {
  made_to_order: "Made to order",
  "2020_2025": "2020–2025",
  "2010_2019": "2010–2019",
  "2006_2009": "2006–2009",
  before_2006: "Before 2006",
  "2000_2005": "2000–2005",
  "1990s": "1990s",
  "1980s": "1980s",
  "1970s": "1970s",
  "1960s": "1960s",
  "1950s": "1950s",
  "1940s": "1940s",
  "1930s": "1930s",
  "1920s": "1920s",
  "1910s": "1910s",
  "1900s": "1900s",
  "1800s": "1800s",
  "1700s": "1700s",
  before_1700: "Before 1700",
};

export default function EtsyPublishPanel({
  listing,
  images,
  onListingUpdate,
}: {
  listing: Listing;
  images: ListingImage[];
  onListingUpdate: (l: Listing) => void;
}) {
  const [profiles, setProfiles] = useState<ShippingProfile[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [taxonomyLabel, setTaxonomyLabel] = useState<string | undefined>();
  const [priceDollars, setPriceDollars] = useState<string>(
    listing.price_cents != null ? (listing.price_cents / 100).toFixed(2) : "",
  );
  const [quantity, setQuantity] = useState<string>(String(listing.quantity));
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/etsy/shipping-profiles")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setProfilesLoaded(true);
        if (data.ok) {
          setProfiles(data.profiles ?? []);
        } else {
          setProfilesError(data.message ?? "Couldn't load shipping profiles");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setProfilesLoaded(true);
        setProfilesError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!listing.etsy_taxonomy_id) {
      setTaxonomyLabel(undefined);
      return;
    }
    let cancelled = false;
    fetch(`/api/etsy/taxonomy?q=`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.ok) return;
        const match = (data.nodes ?? []).find(
          (n: { id: number; path: string }) => n.id === listing.etsy_taxonomy_id,
        );
        if (match) setTaxonomyLabel(match.path);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listing.etsy_taxonomy_id]);

  async function patch(updates: Partial<Listing>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.ok && data.listing) {
        onListingUpdate(data.listing);
      }
    } finally {
      setSaving(false);
    }
  }

  async function push() {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch(`/api/listings/${listing.id}/push`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const detail =
          data.problems?.join("; ") ?? data.message ?? data.error ?? "Push failed";
        setPushResult({ ok: false, message: detail });
        return;
      }
      onListingUpdate(data.listing);
      setPushResult({
        ok: true,
        message: `Pushed as draft on Etsy. ${data.images_uploaded}/${data.images_uploaded + data.images_failed} images uploaded.`,
      });
    } catch (err) {
      setPushResult({ ok: false, message: (err as Error).message });
    } finally {
      setPushing(false);
    }
  }

  const problems = validateForEtsyPush(listing, images.length);
  const ready = problems.length === 0;
  const alreadyOnEtsy = !!listing.etsy_listing_id;

  return (
    <section className="p-4 border border-border rounded-lg bg-surface space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted mb-1">Etsy</p>
          <p className="text-sm font-medium">
            {alreadyOnEtsy
              ? `On Etsy — state: ${listing.etsy_state ?? "unknown"}`
              : "Not yet on Etsy"}
          </p>
          {listing.etsy_pushed_at && (
            <p className="text-xs text-muted">
              Pushed {new Date(listing.etsy_pushed_at).toLocaleString()}
            </p>
          )}
        </div>
        {listing.etsy_url && (
          <a
            href={listing.etsy_url}
            target="_blank"
            rel="noopener"
            className="text-sm underline text-muted hover:text-foreground"
          >
            Open on Etsy →
          </a>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">Price (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            onBlur={() => {
              const cents =
                priceDollars === ""
                  ? null
                  : Math.round(parseFloat(priceDollars) * 100);
              if (cents !== listing.price_cents) {
                patch({ price_cents: cents });
              }
            }}
            className={inputClasses}
            placeholder="24.99"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted">Quantity</label>
          <input
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => {
              const q = parseInt(quantity, 10);
              if (!isNaN(q) && q !== listing.quantity) {
                patch({ quantity: q });
              }
            }}
            className={inputClasses}
          />
        </div>
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted block mb-1">
          Etsy category
        </label>
        <TaxonomyPicker
          value={listing.etsy_taxonomy_id}
          valueLabel={taxonomyLabel}
          onChange={(id, label) => {
            setTaxonomyLabel(label);
            patch({ etsy_taxonomy_id: id });
          }}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-muted block mb-1">
          Shipping profile
        </label>
        {!profilesLoaded ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : profilesError ? (
          <p className="text-sm text-red-600">{profilesError}</p>
        ) : profiles.length === 0 ? (
          <p className="text-sm text-muted">
            No shipping profiles on this shop. Create one in your Etsy seller dashboard, then refresh.
          </p>
        ) : (
          <select
            value={listing.etsy_shipping_profile_id ?? ""}
            onChange={(e) =>
              patch({
                etsy_shipping_profile_id:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={inputClasses}
          >
            <option value="">— pick a shipping profile —</option>
            {profiles.map((p) => (
              <option key={p.shipping_profile_id} value={p.shipping_profile_id}>
                {p.title}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            Who made it
          </label>
          <select
            value={listing.etsy_who_made}
            onChange={(e) => patch({ etsy_who_made: e.target.value as EtsyWhoMade })}
            className={inputClasses}
          >
            {ETSY_WHO_MADE.map((v) => (
              <option key={v} value={v}>
                {WHO_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-muted block mb-1">
            When made
          </label>
          <select
            value={listing.etsy_when_made}
            onChange={(e) => patch({ etsy_when_made: e.target.value as EtsyWhenMade })}
            className={inputClasses}
          >
            {ETSY_WHEN_MADE.map((v) => (
              <option key={v} value={v}>
                {WHEN_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-4 border-t border-border space-y-3">
        {problems.length > 0 && (
          <div className="text-sm">
            <p className="text-muted mb-1">Before push:</p>
            <ul className="list-disc list-inside text-red-600 space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          onClick={push}
          disabled={!ready || pushing || saving}
          className="w-full bg-accent text-white px-4 py-3 rounded font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pushing
            ? "Pushing to Etsy…"
            : alreadyOnEtsy
              ? "Re-upload any pending images"
              : "Push as draft to Etsy →"}
        </button>
        {pushResult && (
          <p
            className={`text-sm ${pushResult.ok ? "text-accent" : "text-red-600"}`}
          >
            {pushResult.message}
          </p>
        )}
        {alreadyOnEtsy && (
          <p className="text-xs text-muted">
            Listing is on Etsy as a draft. Review images + final details on Etsy, then publish from your seller dashboard.
          </p>
        )}
      </div>
    </section>
  );
}
