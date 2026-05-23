/**
 * Migration runner — applies src/lib/db/schema.sql idempotently.
 *
 * Run locally:    npm run migrate
 * Run in CI/Vercel: invoke `npm run migrate` from a build hook.
 *
 * The schema is idempotent (CREATE TABLE IF NOT EXISTS), so re-runs
 * are safe. Phase 2+ adds new statements to the same file.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(1);
  }

  const sqlPath = resolve(process.cwd(), "src/lib/db/schema.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const pool = new Pool({ connectionString: url });
  try {
    console.log(`Applying schema from ${sqlPath}…`);
    await pool.query(sql);
    console.log("Schema applied. ✓");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
