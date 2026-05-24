/**
 * Agent token CRUD.
 *
 * Tokens are hashed at rest (SHA-256). The plaintext is shown once
 * at creation time and never recoverable after. `token_prefix` is the
 * first 12 chars of the plaintext, stored separately for UI display.
 */

import { query, queryOne } from "./client";
import { generateAgentToken, sha256Hex, tokenPrefix } from "@/lib/auth/hash";

export type AgentToken = {
  id: number;
  name: string;
  token_hash: string;
  token_prefix: string;
  last_used_at: Date | null;
  created_at: Date;
  revoked_at: Date | null;
};

export type AgentTokenSummary = Omit<AgentToken, "token_hash">;

const SAFE_COLUMNS =
  "id, name, token_prefix, last_used_at, created_at, revoked_at";

/**
 * Create a new token. Returns the plaintext token (only chance to see it)
 * plus the stored record summary.
 */
export async function createAgentToken(
  name: string,
): Promise<{ plaintext: string; record: AgentTokenSummary }> {
  const plaintext = generateAgentToken();
  const hash = await sha256Hex(plaintext);
  const prefix = tokenPrefix(plaintext);
  const record = await queryOne<AgentTokenSummary>(
    `INSERT INTO agent_tokens (name, token_hash, token_prefix)
       VALUES ($1, $2, $3)
       RETURNING ${SAFE_COLUMNS}`,
    [name.trim(), hash, prefix],
  );
  if (!record) throw new Error("Failed to create agent token");
  return { plaintext, record };
}

/**
 * Verify an incoming bearer token. Returns the active token record
 * (or null) and updates last_used_at on a match.
 */
export async function verifyAgentToken(
  plaintext: string,
): Promise<AgentTokenSummary | null> {
  const hash = await sha256Hex(plaintext);
  const record = await queryOne<AgentTokenSummary>(
    `SELECT ${SAFE_COLUMNS}
       FROM agent_tokens
      WHERE token_hash = $1
        AND revoked_at IS NULL
      LIMIT 1`,
    [hash],
  );
  if (!record) return null;

  // Best-effort touch of last_used_at; failure to update shouldn't
  // block the auth check.
  await query(
    `UPDATE agent_tokens SET last_used_at = NOW() WHERE id = $1`,
    [record.id],
  ).catch((err) =>
    console.warn("[agent-tokens] failed to touch last_used_at", err),
  );

  return { ...record, last_used_at: new Date() };
}

export async function listAgentTokens(): Promise<AgentTokenSummary[]> {
  return query<AgentTokenSummary>(
    `SELECT ${SAFE_COLUMNS}
       FROM agent_tokens
      ORDER BY revoked_at NULLS FIRST, created_at DESC`,
  );
}

export async function revokeAgentToken(id: number): Promise<void> {
  await query(
    `UPDATE agent_tokens
        SET revoked_at = NOW()
      WHERE id = $1
        AND revoked_at IS NULL`,
    [id],
  );
}
