/**
 * Postgres client — single shared pg.Pool, lazy-initialized.
 *
 * Vercel's Neon integration auto-wires DATABASE_URL. The Pool is
 * cached as a module-level singleton so warm serverless invocations
 * reuse connections.
 *
 * For middleware (edge runtime), DO NOT import this module — edge
 * doesn't support node-postgres. Middleware checks HMAC session
 * cookies only, no DB calls.
 */

import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL not set. Vercel's Neon integration should auto-wire this; check Storage tab.",
      );
    }
    pool = new Pool({
      connectionString,
      // Neon requires SSL but the connection string includes ?sslmode=require.
      // Pool will respect it automatically.
    });
  }
  return pool;
}

/**
 * Run a parameterized query. Caller specifies the row shape.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

/**
 * Run a query that returns a single row (or null).
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
