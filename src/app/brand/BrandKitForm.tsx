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
  const [writingSamples, setWritingSamples] = useState(initial.writing_samples ?? "");
  const [audiencePersona, setAudiencePersona] = useState(initial.audience_persona ?? "");
  const [differentiators, setDifferentiators] = useState(initial.differentiators ?? "");
  const [alwaysSayInput, setAlwaysSayInput] = useState(
    (initial.always_say ?? []).join(", "),
  );
  const [neverSayInput, setNeverSayInput] = useState(
    (initial.never_say ?? []).join(", "),
  );
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

    const splitCsv = (s: string) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.length > 0);

    setStatus("saving");
    try {
      const res = await fetch(`/api/brand-kits/${initial.id}`, {
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
          writing_samples: writingSamples,
          audience_persona: audiencePersona,
          differentiators: differentiators,
          always_say: splitCsv(alwaysSayInput),
          never_say: splitCsv(neverSayInput),
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
        <Field label="Voice notes" hint="How the studio sounds (described). Adjectives, phrases, energy. Quick.">
          <textarea
            value={voiceNotes}
            onChange={(e) => setVoiceNotes(e.target.value)}
            rows={4}
            placeholder="e.g. Warm, confident, lightly playful. Concrete over abstract. Never corporate or salesy."
            className={inputClasses}
          />
        </Field>
        <Field
          label="Writing samples"
          hint="Paste 3-5 actual examples of how the studio sounds — a past listing, customer reply, Instagram caption. Claude pattern-matches against these (much stronger signal than descriptive voice notes). Separate samples with --- on their own line."
        >
          <textarea
            value={writingSamples}
            onChange={(e) => setWritingSamples(e.target.value)}
            rows={10}
            placeholder={`Example 1 — Etsy listing description:
Made for the bride who wants every detail to feel intentional...

---

Example 2 — customer reply:
Hi Sarah — yes, totally doable. The color palette you mentioned would look gorgeous on this template; I can swap it before sending the final.

---

Example 3 — Instagram caption:
Three days, three trial runs of the same envelope flap. Worth it.`}
            className={inputClasses}
          />
        </Field>
        <Field
          label="Audience persona"
          hint="Who the studio is writing to. The clearer this is, the better Claude tunes its voice + references."
        >
          <textarea
            value={audiencePersona}
            onChange={(e) => setAudiencePersona(e.target.value)}
            rows={4}
            placeholder="e.g. Brides planning outdoor / garden weddings, 28-35, design-literate, value craft over speed, allergic to corporate or salesy. Often shop on Etsy after pinning for weeks."
            className={inputClasses}
          />
        </Field>
        <Field
          label="Differentiators / positioning"
          hint="What makes this studio different from a hundred others in the same category. What you lead with."
        >
          <textarea
            value={differentiators}
            onChange={(e) => setDifferentiators(e.target.value)}
            rows={4}
            placeholder="e.g. Hand-painted (not stock illustration) botanical templates fully editable in Canva. Studio prioritizes quiet craft over trend-chasing. Three color palettes per design, painted in-house."
            className={inputClasses}
          />
        </Field>
        <Field
          label="Always-say phrases"
          hint="Words/phrases Claude should prefer when they fit. Comma-separated."
        >
          <input
            type="text"
            value={alwaysSayInput}
            onChange={(e) => setAlwaysSayInput(e.target.value)}
            placeholder="hand-painted, made for, watercolor, fully editable"
            className={inputClasses}
          />
        </Field>
        <Field
          label="Never-say phrases"
          hint="Words/phrases Claude must never use. Comma-separated. The hard guardrails."
        >
          <input
            type="text"
            value={neverSayInput}
            onChange={(e) => setNeverSayInput(e.target.value)}
            placeholder="circle back, looking forward to hearing from you, exclusive offer, just checking in"
            className={inputClasses}
          />
        </Field>
        <Field
          label="Brand book notes"
          hint="Long-form brand-book content. Auto-extracted from PDF upload if you attach one (file upload coming separately). AI reads this in addition to the fields above."
        >
          <textarea
            value={brandBookNotes}
            onChange={(e) => setBrandBookNotes(e.target.value)}
            rows={6}
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
