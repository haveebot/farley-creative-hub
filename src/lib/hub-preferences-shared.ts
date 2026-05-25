/**
 * Client-safe hub preferences types + constants. No DB imports.
 *
 * Server CRUD lives in src/lib/db/hub-preferences.ts and re-exports
 * these so server code has a single import path.
 */

export type HubTheme = "light" | "dark";

export const HUB_THEMES: HubTheme[] = ["light", "dark"];

export type HubPreferences = {
  id: number;
  hub_label: string;
  accent_color: string;
  theme: HubTheme;
  /** Custom favicon URL. When null, /icon falls back to the generated F mark. */
  favicon_url: string | null;
  updated_at: Date;
};
