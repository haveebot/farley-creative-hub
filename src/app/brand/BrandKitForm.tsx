"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BrandKit } from "@/lib/db/brand-kits";

type Status = "idle" | "saving" | "saved" | "error";

const HEX_COLOR_OR_EMPTY = /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/;

export default function BrandKitForm({ initial }: { initial: BrandKit }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(initial.secondary_color);
  const [accentColor, setAccentColor] = useState(initial.accent_color);
  const [voiceNotes, setVoiceNotes] = useState(initial.voice_notes);
  const [brandBookNotes, setBrandBookNotes] = useState(initial.brand_book_notes);
  const [etsyShopUrl, setEtsyShopUrl] = useState(initial.etsy_shop_url);
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url);
  const [instagramUrl, setInstagramUrl] = useState(initial.instagram_url);
  const [pinterestUrl, setPinterestUrl] = useState(initial.pinterest_url);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    for (const [label, val] of [
      ["Primary", primaryColor],
      ["Secondary", secondaryColor],
      ["Accent", accentColor],
    ] as const) {
      if (!HEX_COLOR_OR_EMPTY.test(val)) {
        setStatus("error");
        setErrorMessage(`${label} color must be a hex value like #c97d5d, or empty.`);
        return;
      }
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/brand-kits/studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          voice_notes: voiceNotes,
          brand_book_notes: brandBookNotes,
          etsy_shop_url: etsyShopUrl,
          website_url: websiteUrl,
          instagram_url: instagramUrl,
          pinterest_url: pinterestUrl,
        }),
      });

      if (res.ok) {
        setStatus("saved");
        router.refresh();
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }

      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.message ?? "Couldn't save changes.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section title="Identity">
        <Field label="Studio name" hint="How your studio is referred to publicly.">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClasses} />
        </Field>
        <Field label="Short bio" hint="A sentence or two about the studio. Used by AI when drafting copy.">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={inputClasses} />
        </Field>
      </Section>

      <Section title="Palette">
        <p className="text-xs text-muted mb-3">
          Leave any slot empty if you don't want to use it. Used downstream when generating brand-matched visuals + copy.
        </p>
        <ColorField label="Primary" hint="The dominant brand color." value={primaryColor} onChange={setPrimaryColor} />
        <ColorField label="Secondary" hint="Supporting tone — used for backgrounds, accents away from CTAs." value={secondaryColor} onChange={setSecondaryColor} />
        <ColorField label="Accent" hint="Highlights and call-outs. Pops against primary." value={accentColor} onChange={setAccentColor} />
      </Section>

      <Section title="Voice">
        <Field label="Voice notes" hint="How the studio sounds. Adjectives, phrases, things you'd never say.">
          <textarea
            value={voiceNotes}
            onChange={(e) => setVoiceNotes(e.target.value)}
            rows={5}
            placeholder="e.g. Warm, confident, lightly playful. Concrete over abstract. Never corporate or salesy."
            className={inputClasses}
          />
        </Field>
        <Field label="Brand book notes" hint="Paste any brand-book content here — guidelines, do's and don'ts, positioning, audience notes. AI reads this when generating anything in the studio voice. (File upload coming next session.)">
          <textarea
            value={brandBookNotes}
            onChange={(e) => setBrandBookNotes(e.target.value)}
            rows={8}
            placeholder="Paste content from your brand book or guidelines doc. Anything that helps AI draft on-brand."
            className={inputClasses}
          />
        </Field>
      </Section>

      <Section title="Links">
        <Field label="Etsy shop URL">
          <input type="url" value={etsyShopUrl} onChange={(e) => setEtsyShopUrl(e.target.value)} placeholder="https://farleygirlscreative.etsy.com" className={inputClasses} />
        </Field>
        <Field label="Website URL">
          <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://farleycreative.com" className={inputClasses} />
        </Field>
        <Field label="Instagram">
          <input type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/…" className={inputClasses} />
        </Field>
        <Field label="Pinterest">
          <input type="url" value={pinterestUrl} onChange={(e) => setPinterestUrl(e.target.value)} placeholder="https://pinterest.com/…" className={inputClasses} />
        </Field>
      </Section>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && <span className="text-sm text-muted">Saved.</span>}
        {status === "error" && errorMessage && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = HEX_COLOR_OR_EMPTY.test(value);
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-md border border-border"
          style={{ background: valid && value ? value : "transparent" }}
          aria-hidden
        />
        <input
          type="color"
          value={valid && value ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-md border border-border cursor-pointer"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="leave empty to skip"
          className={`${inputClasses} font-mono text-sm`}
        />
      </div>
    </Field>
  );
}

const inputClasses =
  "w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {hint && <span className="block text-xs text-muted mb-2">{hint}</span>}
      {children}
    </label>
  );
}
