/**
 * Leads CRUD — server-only (imports pg).
 */

import { query, queryOne } from "./client";
import type {
  Lead,
  LeadSourceType,
  LeadStatus,
} from "@/lib/leads-shared";

export type { Lead, LeadSourceType, LeadStatus } from "@/lib/leads-shared";

export type LeadCreate = {
  source_type: LeadSourceType;
  source_url?: string | null;
  source_title?: string | null;
  business_name?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  size?: string | null;
  service_signal?: string[];
  raw_content?: string;
  notes?: string;
  status?: LeadStatus;
  /** Company website discovered via enrichment or manually set by operator. */
  website_url?: string | null;
  found_by: string;
};

export type LeadUpdate = Partial<Omit<LeadCreate, "found_by">>;

export type LeadListFilter = {
  status?: LeadStatus;
  source_type?: LeadSourceType;
  state?: string;
};

export async function listLeads(filter: LeadListFilter = {}): Promise<Lead[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  if (filter.source_type) {
    params.push(filter.source_type);
    where.push(`source_type = $${params.length}`);
  }
  if (filter.state) {
    params.push(filter.state);
    where.push(`state = $${params.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT *
      FROM leads
      ${whereSql}
      ORDER BY
        CASE status
          WHEN 'new' THEN 0
          WHEN 'reviewing' THEN 1
          WHEN 'qualified' THEN 2
          WHEN 'converted' THEN 3
          WHEN 'dismissed' THEN 4
          ELSE 5
        END,
        created_at DESC
  `;
  return query<Lead>(sql, params);
}

export async function getLead(id: number): Promise<Lead | null> {
  return queryOne<Lead>(`SELECT * FROM leads WHERE id = $1`, [id]);
}

export async function createLead(input: LeadCreate): Promise<Lead> {
  const row = await queryOne<Lead>(
    `INSERT INTO leads
       (source_type, source_url, source_title, business_name, city, state,
        industry, size, service_signal, raw_content, notes, status, found_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, '{}'::text[]),
             COALESCE($10, ''), COALESCE($11, ''), COALESCE($12, 'new'), $13)
     RETURNING *`,
    [
      input.source_type,
      input.source_url ?? null,
      input.source_title ?? null,
      input.business_name ?? null,
      input.city ?? null,
      input.state ?? null,
      input.industry ?? null,
      input.size ?? null,
      input.service_signal ?? null,
      input.raw_content ?? null,
      input.notes ?? null,
      input.status ?? null,
      input.found_by,
    ],
  );
  if (!row) throw new Error("Failed to create lead");
  return row;
}

export async function updateLead(id: number, updates: LeadUpdate): Promise<Lead> {
  const fields = Object.keys(updates) as Array<keyof LeadUpdate>;
  if (fields.length === 0) {
    const existing = await getLead(id);
    if (!existing) throw new Error("Lead not found");
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
    UPDATE leads
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<Lead>(sql, values);
  if (!row) throw new Error("Failed to update lead");
  return row;
}

export async function deleteLead(id: number): Promise<void> {
  await query(`DELETE FROM leads WHERE id = $1`, [id]);
}

export async function markLeadConverted(
  id: number,
  prospectId: number,
): Promise<Lead> {
  return updateLead(id, {
    status: "converted",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(({ converted_to_prospect_id: prospectId } as unknown) as any),
  });
}
