"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  HUB_THEMES,
  type HubPreferences,
  type HubTheme,
} from "@/lib/hub-preferences-shared";

type Status = "idle" | "saving" | "saved" | "error";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const THEME_LABELS: Record<HubTheme, string> = {
  light: "Light",
  dark: "Dark",
};

export default function HubSettingsForm({ initial }: { initial: HubPreferences }) {
  const router = useRouter();
  const [hubLabel, setHubLabel] = useState(initial.hub_label);
  const [accentColor, setAccentColor] = useState(initial.accent_color);
  const [theme, setTheme] = useState<HubTheme>(initial.theme);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!HEX_COLOR.test(accentColor)) {
      setStatus("error");
      setErrorMessage("Accent color must be a hex value like #c97d5d.");
      return;
    }

    setStatus("saving");
    try {
      const res = await fetch("/api/hub-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hub_label: hubLabel,
          accent_color: accentColor,
          theme,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <Field label="Hub label" hint="What this dashboard calls itself in the header and browser tab.">
        <input
          type="text"
          value={hubLabel}
          onChange={(e) => setHubLabel(e.target.value)}
          className={inputClasses}
        />
      </Field>

      <Field label="Theme" hint="Light or dark — applies across every Hub surface.">
        <div className="flex items-center gap-2">
          {HUB_THEMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className={`px-4 py-2 rounded-md text-sm border transition ${
                theme === t
                  ? "border-accent bg-surface-strong"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              {THEME_LABELS[t]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Hub accent color" hint="The accent color used by buttons, links, and focus rings in the Hub. Separate from your studio's actual brand color — pick whatever you like to look at.">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={HEX_COLOR.test(accentColor) ? accentColor : "#c97d5d"}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-12 h-12 rounded-md border border-border cursor-pointer"
          />
          <input
            type="text"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className={`${inputClasses} font-mono text-sm`}
          />
        </div>
      </Field>

      <div className="flex items-center gap-4 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={status === "saving"}
          className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:opacity-90 transition disabled:opacity-50"
          style={{ background: HEX_COLOR.test(accentColor) ? accentColor : undefined }}
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

const inputClasses =
  "w-full px-4 py-3 bg-transparent border border-border rounded-md focus:outline-none focus:border-accent transition";

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
