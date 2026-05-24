/**
 * Google Workspace OAuth connection CRUD — server-only.
 *
 * Single-user pattern for now (one active connection, typically
 * collie@farleycreative.com). Token refresh is handled by
 * `refreshAccessTokenIfNeeded()` — call before any Gmail API request.
 */

import { query, queryOne } from "./client";

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
};

export async function getActiveConnection(): Promise<WorkspaceConnection | null> {
  return queryOne<WorkspaceConnection>(
    `SELECT * FROM workspace_connections ORDER BY updated_at DESC LIMIT 1`,
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
};

export async function upsertConnection(input: UpsertInput): Promise<WorkspaceConnection> {
  const access_expires_at = new Date(Date.now() + input.expires_in * 1000);

  // Upsert by email (LOWER) so re-consent updates the row in place.
  const existing = await getConnectionByEmail(input.email);
  if (existing) {
    const row = await queryOne<WorkspaceConnection>(
      `UPDATE workspace_connections
          SET refresh_token = $2,
              access_token = $3,
              access_expires_at = $4,
              scopes = $5,
              connected_by = $6,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [
        existing.id,
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
       (email, refresh_token, access_token, access_expires_at, scopes, connected_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.email,
      input.refresh_token,
      input.access_token,
      access_expires_at,
      input.scopes,
      input.connected_by,
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
