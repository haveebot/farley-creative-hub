/**
 * Voice profiles CRUD — server-only.
 */

import { query, queryOne } from "./client";
import type {
  VoiceProfile,
  VoiceProfileCreate,
  VoiceProfileUpdate,
} from "@/lib/voice-profiles-shared";

export type { VoiceProfile } from "@/lib/voice-profiles-shared";

const ALLOWED_FIELDS = new Set<string>([
  "name",
  "description",
  "voice_notes",
  "writing_samples",
  "always_say",
  "never_say",
  "audience_persona",
  "is_default",
]);

export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  return query<VoiceProfile>(
    `SELECT * FROM voice_profiles ORDER BY is_default DESC, updated_at DESC`,
  );
}

export async function getVoiceProfile(id: number): Promise<VoiceProfile | null> {
  return queryOne<VoiceProfile>(`SELECT * FROM voice_profiles WHERE id = $1`, [id]);
}

export async function getDefaultVoiceProfile(): Promise<VoiceProfile | null> {
  return queryOne<VoiceProfile>(
    `SELECT * FROM voice_profiles WHERE is_default = true LIMIT 1`,
  );
}

export async function createVoiceProfile(input: VoiceProfileCreate): Promise<VoiceProfile> {
  // If marking as default, first unset any existing default
  if (input.is_default) {
    await query(`UPDATE voice_profiles SET is_default = false WHERE is_default = true`);
  }

  const row = await queryOne<VoiceProfile>(
    `INSERT INTO voice_profiles
       (name, description, voice_notes, writing_samples, always_say, never_say, audience_persona, is_default)
     VALUES ($1, COALESCE($2, ''), COALESCE($3, ''), COALESCE($4, ''),
             COALESCE($5, '{}'::text[]), COALESCE($6, '{}'::text[]),
             COALESCE($7, ''), COALESCE($8, false))
     RETURNING *`,
    [
      input.name.trim(),
      input.description ?? null,
      input.voice_notes ?? null,
      input.writing_samples ?? null,
      input.always_say ?? null,
      input.never_say ?? null,
      input.audience_persona ?? null,
      input.is_default ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create voice profile");
  return row;
}

export async function updateVoiceProfile(
  id: number,
  updates: VoiceProfileUpdate,
): Promise<VoiceProfile> {
  const fields = (Object.keys(updates) as Array<keyof VoiceProfileUpdate>).filter((f) =>
    ALLOWED_FIELDS.has(f as string),
  );
  if (fields.length === 0) {
    const existing = await getVoiceProfile(id);
    if (!existing) throw new Error("Voice profile not found");
    return existing;
  }

  // If setting is_default true, unset others first
  if (updates.is_default === true) {
    await query(
      `UPDATE voice_profiles SET is_default = false WHERE is_default = true AND id != $1`,
      [id],
    );
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const sql = `
    UPDATE voice_profiles
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<VoiceProfile>(sql, values);
  if (!row) throw new Error("Failed to update voice profile");
  return row;
}

export async function deleteVoiceProfile(id: number): Promise<void> {
  await query(`DELETE FROM voice_profiles WHERE id = $1`, [id]);
}

/**
 * Pull existing writing samples Collie already has in the Hub:
 *   - Drafts in the `drafts` table
 *   - Listing descriptions + titles
 *   - Pipeline activity notes
 *
 * Returns concatenated text suitable for voice analysis. Capped at ~20k
 * chars so Claude can read it in one prompt without truncation.
 */
export async function gatherExistingWriting(
  options: { maxChars?: number; sources?: Array<"drafts" | "listings" | "pipeline"> } = {},
): Promise<{ samples: string; sources: Record<string, number> }> {
  const maxChars = options.maxChars ?? 20000;
  const sources = options.sources ?? ["drafts", "listings", "pipeline"];
  const parts: string[] = [];
  const counts: Record<string, number> = {};

  if (sources.includes("drafts")) {
    const drafts = await query<{ kind: string; title: string; content: string }>(
      `SELECT kind, title, content FROM drafts
       WHERE content IS NOT NULL AND LENGTH(content) > 50
       ORDER BY created_at DESC
       LIMIT 30`,
    );
    counts.drafts = drafts.length;
    for (const d of drafts) {
      parts.push(
        `--- DRAFT (${d.kind})${d.title ? ` — ${d.title}` : ""}\n${d.content.trim()}\n`,
      );
    }
  }

  if (sources.includes("listings")) {
    const listings = await query<{ title: string; description: string }>(
      `SELECT title, description FROM listings
       WHERE LENGTH(COALESCE(description, '')) > 50
       ORDER BY updated_at DESC
       LIMIT 20`,
    );
    counts.listings = listings.length;
    for (const l of listings) {
      parts.push(`--- ETSY LISTING — ${l.title}\n${l.description.trim()}\n`);
    }
  }

  if (sources.includes("pipeline")) {
    const activities = await query<{ kind: string; content: string }>(
      `SELECT kind, content FROM prospect_activity
       WHERE kind IN ('note', 'email_sent', 'email_drafted')
         AND LENGTH(COALESCE(content, '')) > 50
       ORDER BY created_at DESC
       LIMIT 20`,
    );
    counts.pipeline = activities.length;
    for (const a of activities) {
      parts.push(`--- PIPELINE (${a.kind})\n${a.content.trim()}\n`);
    }
  }

  // Concat and cap
  let full = parts.join("\n");
  if (full.length > maxChars) {
    full = full.slice(0, maxChars) + "\n[... truncated]";
  }
  return { samples: full, sources: counts };
}
