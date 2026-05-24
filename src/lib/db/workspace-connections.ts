/**
 * Google Workspace OAuth connection CRUD — server-only.
 *
 * Multi-purpose: connections are tagged with a purpose:
 *   - 'sending'        — mailbox where Hub creates Gmail drafts + sends;
 *                        cadence-tick uses this (e.g., collie@farleycreative.com)
 *   - 'reading_leads'  — mailbox where job alerts arrive; lead-poll
 *                        uses this (e.g., collie@palmfamilyventures.com)
 *
 * Only one connection per purpose at a time (enforced by unique index).
 * A single mailbox can serve both roles (would be two rows with the
 * same email, different purposes).
 */

import { query, queryOne } from "./client";

export type ConnectionPurpose = "sending" | "reading_leads";

export const CONNECTION_PURPOSES: ConnectionPurpose[] = ["sending", "reading_leads"];

export const PURPOSE_LABELS: Record<ConnectionPurpose, string> = {
  sending: "Sending identity",
  reading_leads: "Lead source",
};

export type WorkspaceConnection = {
  id: number;
  email: string;
  refresh_token: string;
  access_token: string | null;
  access_expires_at: Date | null;
  scopes: string[];
  connected_by: string;
  connected_at: Date;
  updated_at: Date;
  purpose: ConnectionPurpose;
};

/**
 * Returns the connection for a specific purpose (or null).
 */
export async function getConnectionByPurpose(
  purpose: ConnectionPurpose,
): Promise<WorkspaceConnection | null> {
  return queryOne<WorkspaceConnection>(
    `SELECT * FROM workspace_connections WHERE purpose = $1 LIMIT 1`,
    [purpose],
  );
}

/**
 * Returns the 'sending' connection. Kept as the default `getActiveConnection`
 * for backwards-compat with existing callers that don't yet specify a purpose
 * (e.g., the prospect-detail Gmail exchange view, which is sending-side context).
 */
export async function getActiveConnection(): Promise<WorkspaceConnection | null> {
  return getConnectionByPurpose("sending");
}

export async function listConnections(): Promise<WorkspaceConnection[]> {
  return query<WorkspaceConnection>(
    `SELECT * FROM workspace_connections ORDER BY purpose ASC`,
  );
}

export async function getConnectionByEmail(email: string): Promise<WorkspaceConnection | null> {
  return queryOne<WorkspaceConnection>(
    `SELECT * FROM workspace_connections WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  );
}

export type UpsertInput = {
  email: string;
  refresh_token: string;
  access_token: string;
  expires_in: number; // seconds
  scopes: string[];
  connected_by: string;
  purpose: ConnectionPurpose;
};

export async function upsertConnection(input: UpsertInput): Promise<WorkspaceConnection> {
  const access_expires_at = new Date(Date.now() + input.expires_in * 1000);

  // Upsert by purpose — there's only one connection per purpose at a time.
  // Re-consenting for the same purpose replaces the prior connection (even if
  // it's a different email — operator might switch which mailbox plays the role).
  const existing = await getConnectionByPurpose(input.purpose);
  if (existing) {
    const row = await queryOne<WorkspaceConnection>(
      `UPDATE workspace_connections
          SET email = $2,
              refresh_token = $3,
              access_token = $4,
              access_expires_at = $5,
              scopes = $6,
              connected_by = $7,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        existing.id,
        input.email,
        input.refresh_token,
        input.access_token,
        access_expires_at,
        input.scopes,
        input.connected_by,
      ],
    );
    if (!row) throw new Error("Failed to update workspace connection");
    return row;
  }

  const row = await queryOne<WorkspaceConnection>(
    `INSERT INTO workspace_connections
       (email, refresh_token, access_token, access_expires_at, scopes, connected_by, purpose)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.email,
      input.refresh_token,
      input.access_token,
      access_expires_at,
      input.scopes,
      input.connected_by,
      input.purpose,
    ],
  );
  if (!row) throw new Error("Failed to create workspace connection");
  return row;
}

export async function updateAccessToken(
  id: number,
  access_token: string,
  expires_in: number,
): Promise<WorkspaceConnection> {
  const access_expires_at = new Date(Date.now() + expires_in * 1000);
  const row = await queryOne<WorkspaceConnection>(
    `UPDATE workspace_connections
        SET access_token = $2,
            access_expires_at = $3,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, access_token, access_expires_at],
  );
  if (!row) throw new Error("Failed to update access token");
  return row;
}

export async function deleteConnection(id: number): Promise<void> {
  await query(`DELETE FROM workspace_connections WHERE id = $1`, [id]);
}

export async function deleteConnectionByPurpose(purpose: ConnectionPurpose): Promise<void> {
  await query(`DELETE FROM workspace_connections WHERE purpose = $1`, [purpose]);
}
