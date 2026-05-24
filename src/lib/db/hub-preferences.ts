/**
 * Hub preferences — single-row table for operator-chrome settings.
 *
 * Separate from brand kits because the Hub's look-and-feel is a
 * different concern from the studio's brand identity. The studio
 * might use a #b8d0bb pistachio for its actual brand while Collie
 * prefers a #c97d5d terracotta for the Hub chrome — both legit.
 */

import { queryOne } from "./client";

export type HubTheme = "light" | "dark";

export const HUB_THEMES: HubTheme[] = ["light", "dark"];

export type HubPreferences = {
  id: number;
  hub_label: string;
  accent_color: string;
  theme: HubTheme;
  updated_at: Date;
};

export type HubPreferencesUpdate = Partial<Omit<HubPreferences, "id" | "updated_at">>;

const SELECT_SQL = `SELECT * FROM hub_preferences ORDER BY id LIMIT 1`;

/**
 * Load the hub preferences row. Creates it with defaults if missing.
 */
export async function getHubPreferences(): Promise<HubPreferences> {
  const existing = await queryOne<HubPreferences>(SELECT_SQL);
  if (existing) return existing;

  const created = await queryOne<HubPreferences>(
    `INSERT INTO hub_preferences DEFAULT VALUES RETURNING *`,
  );
  if (!created) throw new Error("Failed to create hub_preferences row");
  return created;
}

export async function updateHubPreferences(
  updates: HubPreferencesUpdate,
): Promise<HubPreferences> {
  const current = await getHubPreferences();

  const fields = Object.keys(updates) as Array<keyof HubPreferencesUpdate>;
  if (fields.length === 0) return current;

  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  setClauses.push(`updated_at = NOW()`);

  values.push(current.id);
  const sql = `
    UPDATE hub_preferences
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;

  const updated = await queryOne<HubPreferences>(sql, values);
  if (!updated) throw new Error("Failed to update hub_preferences");
  return updated;
}
