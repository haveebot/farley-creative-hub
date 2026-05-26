/**
 * Drafts CRUD — server-only (imports pg).
 *
 * Client code should import types/constants from @/lib/drafts-shared.
 */

import { query, queryOne } from "./client";
import type { Draft, DraftKind, DraftStatus } from "@/lib/drafts-shared";

export type {
  Draft,
  DraftKind,
  DraftStatus,
} from "@/lib/drafts-shared";
export {
  DRAFT_KINDS,
  DRAFT_STATUSES,
  KIND_LABELS,
  STATUS_LABELS,
} from "@/lib/drafts-shared";

export type DraftCreate = {
  title: string;
  kind: DraftKind;
  prompt: string;
  content: string;
  brand_kit_id?: number | null;
  prospect_id?: number | null;
  voice_profile_id?: number | null;
  model_used?: string | null;
  created_by: string;
};

export type DraftUpdate = Partial<{
  title: string;
  kind: DraftKind;
  status: DraftStatus;
  content: string;
}>;

export type DraftListFilter = {
  status?: DraftStatus;
  kind?: DraftKind;
  prospect_id?: number;
};

export async function listDrafts(filter: DraftListFilter = {}): Promise<Draft[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  if (filter.kind) {
    params.push(filter.kind);
    where.push(`kind = $${params.length}`);
  }
  if (typeof filter.prospect_id === "number") {
    params.push(filter.prospect_id);
    where.push(`prospect_id = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `SELECT * FROM drafts ${whereSql} ORDER BY created_at DESC`;
  return query<Draft>(sql, params);
}

export async function getDraft(id: number): Promise<Draft | null> {
  return queryOne<Draft>(`SELECT * FROM drafts WHERE id = $1`, [id]);
}

export async function createDraft(input: DraftCreate): Promise<Draft> {
  const row = await queryOne<Draft>(
    `INSERT INTO drafts
      (title, kind, prompt, content, brand_kit_id, prospect_id, voice_profile_id, model_used, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      input.title,
      input.kind,
      input.prompt,
      input.content,
      input.brand_kit_id ?? null,
      input.prospect_id ?? null,
      input.voice_profile_id ?? null,
      input.model_used ?? null,
      input.created_by,
    ],
  );
  if (!row) throw new Error("Failed to create draft");
  return row;
}

export async function updateDraft(id: number, updates: DraftUpdate): Promise<Draft> {
  const fields = Object.keys(updates) as Array<keyof DraftUpdate>;
  if (fields.length === 0) {
    const existing = await getDraft(id);
    if (!existing) throw new Error("Draft not found");
    return existing;
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
    UPDATE drafts
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<Draft>(sql, values);
  if (!row) throw new Error("Failed to update draft");
  return row;
}

export async function deleteDraft(id: number): Promise<void> {
  await query(`DELETE FROM drafts WHERE id = $1`, [id]);
}
