/**
 * Sales pipeline CRUD — prospects, contacts, activity.
 *
 * Server-only (imports pg). Client should import types from
 * @/lib/pipeline-shared.
 */

import { query, queryOne } from "./client";
import type {
  ActivityKind,
  ContactRole,
  Prospect,
  ProspectActivityRow,
  ProspectContact,
  ProspectIndustry,
  ProspectSize,
  ProspectSource,
  ProspectStatus,
  ServiceInterest,
} from "@/lib/pipeline-shared";

export type {
  Prospect,
  ProspectContact,
  ProspectActivityRow,
  ProspectStatus,
  ProspectSize,
  ProspectIndustry,
  ServiceInterest,
  ProspectSource,
  ActivityKind,
  ContactRole,
} from "@/lib/pipeline-shared";

// ============ Prospects ============

export type ProspectCreate = {
  business_name: string;
  industry?: ProspectIndustry | null;
  size?: ProspectSize | null;
  city?: string | null;
  state?: string | null;
  website_url?: string | null;
  status?: ProspectStatus;
  service_interest?: ServiceInterest[];
  notes?: string;
  next_action?: string | null;
  next_action_date?: string | null;
  source?: ProspectSource | null;
};

export type ProspectUpdate = Partial<Omit<ProspectCreate, "business_name">> & {
  business_name?: string;
};

export type ProspectListFilter = {
  status?: ProspectStatus;
  state?: string;
  industry?: ProspectIndustry;
  size?: ProspectSize;
  service?: ServiceInterest;
};

export async function listProspects(filter: ProspectListFilter = {}): Promise<Prospect[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.status) {
    params.push(filter.status);
    where.push(`status = $${params.length}`);
  }
  if (filter.state) {
    params.push(filter.state);
    where.push(`state = $${params.length}`);
  }
  if (filter.industry) {
    params.push(filter.industry);
    where.push(`industry = $${params.length}`);
  }
  if (filter.size) {
    params.push(filter.size);
    where.push(`size = $${params.length}`);
  }
  if (filter.service) {
    params.push(filter.service);
    where.push(`$${params.length} = ANY(service_interest)`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT *
      FROM prospects
      ${whereSql}
      ORDER BY
        CASE WHEN next_action_date IS NULL THEN 1 ELSE 0 END,
        next_action_date ASC,
        updated_at DESC
  `;
  return query<Prospect>(sql, params);
}

export async function getProspect(id: number): Promise<Prospect | null> {
  return queryOne<Prospect>(`SELECT * FROM prospects WHERE id = $1`, [id]);
}

export async function createProspect(input: ProspectCreate): Promise<Prospect> {
  const row = await queryOne<Prospect>(
    `INSERT INTO prospects
       (business_name, industry, size, city, state, website_url, status,
        service_interest, notes, next_action, next_action_date, source)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'lead'),
             COALESCE($8, '{}'), COALESCE($9, ''), $10, $11, $12)
     RETURNING *`,
    [
      input.business_name,
      input.industry ?? null,
      input.size ?? null,
      input.city ?? null,
      input.state ?? null,
      input.website_url ?? null,
      input.status ?? null,
      input.service_interest ?? null,
      input.notes ?? null,
      input.next_action ?? null,
      input.next_action_date ?? null,
      input.source ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create prospect");
  return row;
}

export async function updateProspect(id: number, updates: ProspectUpdate): Promise<Prospect> {
  const fields = Object.keys(updates) as Array<keyof ProspectUpdate>;
  if (fields.length === 0) {
    const existing = await getProspect(id);
    if (!existing) throw new Error("Prospect not found");
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
    UPDATE prospects
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<Prospect>(sql, values);
  if (!row) throw new Error("Failed to update prospect");
  return row;
}

export async function deleteProspect(id: number): Promise<void> {
  await query(`DELETE FROM prospects WHERE id = $1`, [id]);
}

// ============ Contacts ============

export type ContactCreate = {
  prospect_id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  role?: ContactRole | null;
  is_primary?: boolean;
  notes?: string;
};

export type ContactUpdate = Partial<Omit<ContactCreate, "prospect_id">>;

export async function listContacts(prospectId: number): Promise<ProspectContact[]> {
  return query<ProspectContact>(
    `SELECT * FROM prospect_contacts
       WHERE prospect_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
    [prospectId],
  );
}

export async function createContact(input: ContactCreate): Promise<ProspectContact> {
  // If this is being set as primary, demote any existing primary first.
  if (input.is_primary) {
    await query(
      `UPDATE prospect_contacts SET is_primary = FALSE WHERE prospect_id = $1 AND is_primary = TRUE`,
      [input.prospect_id],
    );
  }
  const row = await queryOne<ProspectContact>(
    `INSERT INTO prospect_contacts
       (prospect_id, name, email, phone, role, is_primary, notes)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), COALESCE($7, ''))
     RETURNING *`,
    [
      input.prospect_id,
      input.name,
      input.email ?? null,
      input.phone ?? null,
      input.role ?? null,
      input.is_primary ?? null,
      input.notes ?? null,
    ],
  );
  if (!row) throw new Error("Failed to create contact");
  return row;
}

export async function updateContact(id: number, updates: ContactUpdate): Promise<ProspectContact> {
  if (updates.is_primary) {
    // Find this contact's prospect first, then demote others.
    const cur = await queryOne<{ prospect_id: number }>(
      `SELECT prospect_id FROM prospect_contacts WHERE id = $1`,
      [id],
    );
    if (cur) {
      await query(
        `UPDATE prospect_contacts SET is_primary = FALSE WHERE prospect_id = $1 AND id != $2 AND is_primary = TRUE`,
        [cur.prospect_id, id],
      );
    }
  }

  const fields = Object.keys(updates) as Array<keyof ContactUpdate>;
  if (fields.length === 0) {
    const existing = await queryOne<ProspectContact>(
      `SELECT * FROM prospect_contacts WHERE id = $1`,
      [id],
    );
    if (!existing) throw new Error("Contact not found");
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
    UPDATE prospect_contacts
       SET ${setClauses.join(", ")}
     WHERE id = $${values.length}
     RETURNING *
  `;
  const row = await queryOne<ProspectContact>(sql, values);
  if (!row) throw new Error("Failed to update contact");
  return row;
}

export async function deleteContact(id: number): Promise<void> {
  await query(`DELETE FROM prospect_contacts WHERE id = $1`, [id]);
}

// ============ Activity ============

export type ActivityCreate = {
  prospect_id: number;
  kind: ActivityKind;
  content?: string;
  draft_id?: number | null;
  created_by: string;
};

export async function listActivity(prospectId: number): Promise<ProspectActivityRow[]> {
  return query<ProspectActivityRow>(
    `SELECT * FROM prospect_activity
       WHERE prospect_id = $1
       ORDER BY created_at DESC`,
    [prospectId],
  );
}

export async function logActivity(input: ActivityCreate): Promise<ProspectActivityRow> {
  const row = await queryOne<ProspectActivityRow>(
    `INSERT INTO prospect_activity
       (prospect_id, kind, content, draft_id, created_by)
     VALUES ($1, $2, COALESCE($3, ''), $4, $5)
     RETURNING *`,
    [
      input.prospect_id,
      input.kind,
      input.content ?? null,
      input.draft_id ?? null,
      input.created_by,
    ],
  );
  if (!row) throw new Error("Failed to log activity");
  return row;
}
