"use client";

import { useState } from "react";
import type { BrandIdentity } from "@/lib/db/brand";

type Status = "idle" | "saving" | "saved" | "error";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export default function BrandForm({ initial }: { initial: BrandIdentity }) {
  const [studioName, setStudioName] = useState(initial.studio_name);
  const [hubLabel, setHubLabel] = useState(initial.hub_label);
  const [bio, setBio] = useState(initial.bio);
  const [primaryColor, setPrimaryColor] = useState(initial.primary_color);
  const [voiceNotes, setVoiceNotes] = useState(initial.voice_notes);
  const [etsyShopUrl, setEtsyShopUrl] = useState(initial.etsy_shop_url);
  const [websiteUrl, setWebsiteUrl] = useState(initial.website_url);
  const [instagramUrl, setInstagramUrl] = useState(initial.instagram_url);
  const [pinterestUrl, setPinterestUrl] = useState(initial.pinterest_url);

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!HEX_COLOR.test(primaryColor)) {
      setStatus("error");
      setErrorMessage("Primary color must be a hex value like #c97d5d.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studio_name: studioName,
          hub_label: hubLabel,
          bio,
          primary_color: primaryColor,
          voice_notes: voiceNotes,
          etsy_shop_url: etsyShopUrl,
          website_url: websiteUrl,
          instagram_url: instagramUrl,
          pinterest_url: pinterestUrl,
        }),
      });

      if (res.ok) {
        setStatus("saved");
        // Reset to idle after a moment.
        setTimeout(() => setStatus("idle"), 2000);
        return;
      }

      const body = await res.json().catch(() => null);
      setStatus("error");
      setErrorMessage(body?.message ?? "Couldn't save changes. Try again.");
    } catch {
      setStatus("error");
      setErrorMessage("Something went wrong. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section title="Identity">
        <Field label="Studio name" hint="How your business is referred to publicly. Used in listings, customer comms, marketing.">
          <input
            type="text"
            value={studioName}
            onChange={(e) => setStudioName(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Hub label" hint="What this dashboard calls itself in the header and browser tab. Just for you — not customer-facing.">
          <input
            type="text"
            value={hubLabel}
            onChange={(e) => setHubLabel(e.target.value)}
            className={inputClasses}
          />
        </Field>
        <Field label="Short bio" hint="A sentence or two about the studio. Drawn on by AI when drafting listing copy.">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className={inputClasses}
          />
        </Field>
      </Section>

      <Section title="Visual">
        <Field label="Primary color" hint="Hex value (e.g. #c97d5d). Used as the accent on buttons and highlights.">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={HEX_COLOR.test(primaryColor) ? primaryColor : "#c97d5d"}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-md border border-border cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className={`${inputClasses} font-mono text-sm`}
            />
          </div>
        </Field>
      </Section>

      <Section title="Voice">
        <Field label="Voice notes" hint="How the studio sounds. Adjectives, phrases you use, things you'd never say. AI uses this to draft copy in your voice.">
          <textarea
            value={voiceNotes}
            onChange={(e) => setVoiceNotes(e.target.value)}
            rows={5}
            placeholder="e.g. Warm, confident, lightly playful. Concrete over abstract. Never corporate or salesy. Comfortable with em dashes."
            className={inputClasses}
          />
        </Field>
      </Section>

      <Section title="Links">
        <Field label="Etsy shop URL">
          <input
            type="url"
            value={etsyShopUrl}
            onChange={(e) => setEtsyShopUrl(e.target.value)}
            placeholder="https://farleygirlscreative.etsy.com"
            className={inputClasses}
          />
        </Field>
        <Field label="Website URL">
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://farleycreative.com"
            className={inputClasses}
          />
        </Field>
        <Field label="Instagram">
          <input
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/…"
            className={inputClasses}
          />
        </Field>
        <Field label="Pinterest">
          <input
            type="url"
            value={pinterestUrl}
            onChange={(e) => setPinterestUrl(e.target.value)}
            placeholder="https://pinterest.com/…"
            className={inputClasses}
          />
        </Field>
      </Section>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ background: HEX_COLOR.test(primaryColor) ? primaryColor : undefined }}
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span className="text-sm text-muted">Saved.</span>
        )}
        {status === "error" && errorMessage && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>
    </form>
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
