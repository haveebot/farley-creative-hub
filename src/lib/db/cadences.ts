/**
 * Cadences + Cadence Steps CRUD — server-only (imports pg).
 *
 * Client should import types from @/lib/cadences-shared.
 */

import { query, queryOne } from "./client";
import type {
  Cadence,
  CadenceStep,
  CadenceWithSteps,
} from "@/lib/cadences-shared";

export type {
  Cadence,
  CadenceStep,
  CadenceWithSteps,
} from "@/lib/cadences-shared";

// ============ Cadences ============

export type CadenceCreate = {
  name: string;
  description?: string;
  brand_kit_id?: number | null;
  is_active?: boolean;
  created_by: string;
};

export type CadenceUpdate = Partial<Omit<CadenceCreate, "created_by">>;

export async function listCadences(includeInactive = false): Promise<Cadence[]> {
  const where = includeInactive ? "" : "WHERE is_active = TRUE";
  return query<Cadence>(`SELECT * FROM cadences ${where} ORDER BY updated_at DESC`);
}

export async function getCadence(id: number): Promise<Cadence | null> {
  return queryOne<Cadence>(`SELECT * FROM cadences WHERE id = $1`, [id]);
}

export async function getCadenceWithSteps(id: number): Promise<CadenceWithSteps | null> {
  const cadence = await getCadence(id);
  if (!cadence) return null;
  const steps = await listSteps(id);
  return { ...cadence, steps };
}

export async function createCadence(input: CadenceCreate): Promise<Cadence> {
  const row = await queryOne<Cadence>(
    `INSERT INTO cadences (name, description, brand_kit_id, is_active, created_by)
     VALUES ($1, COALESCE($2, ''), $3, COALESCE($4, TRUE), $5)
     RETURNING *`,
    [
      input.name,
      input.description ?? null,
      input.brand_kit_id ?? null,
      input.is_active ?? null,
      input.created_by,
    ],
  );
  if (!row) throw new Error("Failed to create cadence");
  return row;
}

export async function updateCadence(id: number, updates: CadenceUpdate): Promise<Cadence> {
  const fields = Object.keys(updates) as Array<keyof CadenceUpdate>;
  if (fields.length === 0) {
    const existing = await getCadence(id);
    if (!existing) throw new Error("Cadence not found");
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
    UPDATE cadences
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<Cadence>(sql, values);
  if (!row) throw new Error("Failed to update cadence");
  return row;
}

export async function deleteCadence(id: number): Promise<void> {
  await query(`DELETE FROM cadences WHERE id = $1`, [id]);
}

// ============ Cadence Steps ============

export type CadenceStepCreate = {
  cadence_id: number;
  step_number: number;
  delay_days?: number;
  delay_hours?: number;
  draft_prompt: string;
  subject_template?: string | null;
};

export type CadenceStepUpdate = Partial<Omit<CadenceStepCreate, "cadence_id" | "step_number">>;

export async function listSteps(cadenceId: number): Promise<CadenceStep[]> {
  return query<CadenceStep>(
    `SELECT * FROM cadence_steps WHERE cadence_id = $1 ORDER BY step_number ASC`,
    [cadenceId],
  );
}

export async function getStep(id: number): Promise<CadenceStep | null> {
  return queryOne<CadenceStep>(`SELECT * FROM cadence_steps WHERE id = $1`, [id]);
}

export async function createStep(input: CadenceStepCreate): Promise<CadenceStep> {
  const row = await queryOne<CadenceStep>(
    `INSERT INTO cadence_steps
       (cadence_id, step_number, delay_days, delay_hours, draft_prompt, subject_template)
     VALUES ($1, $2, COALESCE($3, 0), COALESCE($4, 0), $5, $6)
     RETURNING *`,
    [
      input.cadence_id,
      input.step_number,
      input.delay_days ?? null,
      input.delay_hours ?? null,
      input.draft_prompt,
      input.subject_template ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create cadence step");
  return row;
}

export async function updateStep(id: number, updates: CadenceStepUpdate): Promise<CadenceStep> {
  const fields = Object.keys(updates) as Array<keyof CadenceStepUpdate>;
  if (fields.length === 0) {
    const existing = await getStep(id);
    if (!existing) throw new Error("Step not found");
    return existing;
  }
  const setClauses: string[] = [];
  const values: unknown[] = [];
  fields.forEach((f, i) => {
    setClauses.push(`${f} = $${i + 1}`);
    values.push(updates[f]);
  });
  values.push(id);
  const sql = `
    UPDATE cadence_steps
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<CadenceStep>(sql, values);
  if (!row) throw new Error("Failed to update step");
  return row;
}

export async function deleteStep(id: number): Promise<void> {
  await query(`DELETE FROM cadence_steps WHERE id = $1`, [id]);
}

/** Renumber steps to be contiguous 1..N (call after deletes). */
export async function renumberSteps(cadenceId: number): Promise<void> {
  await query(
    `WITH ordered AS (
       SELECT id, ROW_NUMBER() OVER (ORDER BY step_number ASC, id ASC) AS new_number
         FROM cadence_steps
        WHERE cadence_id = $1
     )
     UPDATE cadence_steps cs
        SET step_number = ordered.new_number
       FROM ordered
      WHERE cs.id = ordered.id`,
    [cadenceId],
  );
}
