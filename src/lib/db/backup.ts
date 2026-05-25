/**
 * Pure database dump — emits a self-contained SQL string that, when
 * loaded into a fresh Postgres database, reproduces the source state.
 *
 * Format:
 *   1. Header (timestamp, source URL, table count)
 *   2. Canonical schema.sql contents (idempotent CREATE TABLE / ALTER)
 *   3. Data: per-table INSERTs wrapped in a transaction with
 *      `session_replication_role = 'replica'` so FK ordering doesn't
 *      matter at load time. Sequence values are reset after data load
 *      so SERIAL columns continue from the right id.
 *
 * Restore: `psql "$DATABASE_URL" < backup-YYYY-MM-DD-prod.sql`
 *
 * The dump opens its own short-lived Pool against the passed connection
 * string — does NOT use the module-level singleton in client.ts — so it
 * can back up multiple databases (prod + demo) from one cron invocation.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

export type DumpResult = {
  sql: string;
  table_count: number;
  row_count: number;
  bytes: number;
};

const SCHEMA_PATH = join(process.cwd(), "src", "lib", "db", "schema.sql");

export async function dumpDatabase(connectionString: string): Promise<DumpResult> {
  const pool = new Pool({ connectionString, max: 2 });
  try {
    const schemaSQL = await readFile(SCHEMA_PATH, "utf-8");
    const tables = await listUserTables(pool);

    const parts: string[] = [];
    parts.push(header(tables.length));
    parts.push("-- ============================================");
    parts.push("-- SCHEMA (idempotent — safe on a fresh or existing DB)");
    parts.push("-- ============================================");
    parts.push(schemaSQL.trim());
    parts.push("");
    parts.push("-- ============================================");
    parts.push("-- DATA");
    parts.push("-- ============================================");
    parts.push("BEGIN;");
    parts.push("SET session_replication_role = 'replica';");
    parts.push("");

    let totalRows = 0;
    for (const table of tables) {
      const { sql, rowCount } = await dumpTable(pool, table);
      parts.push(sql);
      totalRows += rowCount;
    }

    parts.push("");
    parts.push("-- Reset SERIAL sequences so new inserts continue past restored ids");
    for (const table of tables) {
      const seqResetSQL = await resetSequenceSQL(pool, table);
      if (seqResetSQL) parts.push(seqResetSQL);
    }

    parts.push("");
    parts.push("SET session_replication_role = 'origin';");
    parts.push("COMMIT;");
    parts.push("");
    parts.push(`-- End of dump (${tables.length} tables, ${totalRows} rows)`);

    const sql = parts.join("\n");
    return {
      sql,
      table_count: tables.length,
      row_count: totalRows,
      bytes: Buffer.byteLength(sql, "utf-8"),
    };
  } finally {
    await pool.end();
  }
}

function header(tableCount: number): string {
  const now = new Date().toISOString();
  return [
    "-- ============================================",
    "-- Farley Creative Hub — Postgres dump",
    `-- Generated: ${now}`,
    `-- Tables: ${tableCount}`,
    "-- Restore: psql \"$DATABASE_URL\" < this-file.sql",
    "-- See operator-runbooks/db-restore.md for full procedure",
    "-- ============================================",
    "",
  ].join("\n");
}

async function listUserTables(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);
  return result.rows.map((r) => r.table_name);
}

async function dumpTable(
  pool: Pool,
  table: string,
): Promise<{ sql: string; rowCount: number }> {
  const colRes = await pool.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table],
  );
  const columns = colRes.rows.map((r) => r.column_name);
  if (columns.length === 0) {
    return { sql: `-- (no columns found for ${table}, skipping)\n`, rowCount: 0 };
  }
  const colTypes = new Map(colRes.rows.map((r) => [r.column_name, r.data_type]));

  const dataRes = await pool.query<Record<string, unknown>>(
    `SELECT ${columns.map(quoteIdent).join(", ")} FROM ${quoteIdent(table)}`,
  );

  if (dataRes.rows.length === 0) {
    return { sql: `-- ${table}: empty\n`, rowCount: 0 };
  }

  const lines: string[] = [];
  lines.push(`-- ${table}: ${dataRes.rows.length} rows`);
  const colList = columns.map(quoteIdent).join(", ");
  for (const row of dataRes.rows) {
    const values = columns.map((c) => formatValue(row[c], colTypes.get(c) ?? "text"));
    lines.push(`INSERT INTO ${quoteIdent(table)} (${colList}) VALUES (${values.join(", ")});`);
  }
  lines.push("");
  return { sql: lines.join("\n"), rowCount: dataRes.rows.length };
}

async function resetSequenceSQL(pool: Pool, table: string): Promise<string | null> {
  // Find any SERIAL/IDENTITY column on this table and reset its sequence
  // to max(id)+1 so subsequent inserts don't collide with restored rows.
  const res = await pool.query<{ column_name: string; sequence_name: string }>(
    `SELECT a.attname AS column_name,
            pg_get_serial_sequence($1, a.attname) AS sequence_name
       FROM pg_attribute a
      WHERE a.attrelid = $1::regclass
        AND a.attnum > 0
        AND NOT a.attisdropped
        AND pg_get_serial_sequence($1, a.attname) IS NOT NULL`,
    [table],
  );
  if (res.rows.length === 0) return null;
  const lines: string[] = [];
  for (const { column_name, sequence_name } of res.rows) {
    lines.push(
      `SELECT setval('${sequence_name}', COALESCE((SELECT MAX(${quoteIdent(column_name)}) FROM ${quoteIdent(table)}), 0) + 1, false);`,
    );
  }
  return lines.join("\n");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function formatValue(value: unknown, dataType: string): string {
  if (value === null || value === undefined) return "NULL";

  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return value.toString();
  }

  if (typeof value === "bigint") return value.toString();

  if (value instanceof Date) {
    return `'${value.toISOString()}'::timestamptz`;
  }

  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString("hex")}'::bytea`;
  }

  if (Array.isArray(value)) {
    // pg returns array columns as JS arrays; emit as ARRAY[...]::type[]
    const elemType = dataType.replace(/\[\]$/, "").replace(/^ARRAY$/i, "text");
    const items = value.map((v) => formatValue(v, elemType)).join(", ");
    return `ARRAY[${items}]::${elemType}[]`;
  }

  if (typeof value === "object") {
    // jsonb / json — pg returns parsed object; re-serialize and emit as ::jsonb
    return `${escapeStringLiteral(JSON.stringify(value))}::jsonb`;
  }

  // string fallback (covers text, varchar, uuid, timestamps-as-string, etc.)
  const str = String(value);
  const lit = escapeStringLiteral(str);
  // Cast specific types so the literal round-trips cleanly
  if (dataType === "uuid") return `${lit}::uuid`;
  if (dataType === "timestamp with time zone" || dataType === "timestamp without time zone") {
    return `${lit}::${dataType === "timestamp with time zone" ? "timestamptz" : "timestamp"}`;
  }
  if (dataType === "date") return `${lit}::date`;
  if (dataType === "jsonb") return `${lit}::jsonb`;
  if (dataType === "json") return `${lit}::json`;
  return lit;
}

function escapeStringLiteral(str: string): string {
  // Use dollar-quoting for strings containing single quotes or backslashes —
  // safer and more readable than escape sequences. Pick a tag unlikely to
  // appear in the content.
  if (!str.includes("'") && !str.includes("\\")) {
    return `'${str}'`;
  }
  let tag = "bk";
  while (str.includes(`$${tag}$`)) {
    tag += "_";
  }
  return `$${tag}$${str}$${tag}$`;
}
