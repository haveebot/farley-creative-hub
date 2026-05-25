// One-shot dry-run: dumps prod DB to stdout (or counts), no upload.
// Run: node --env-file=.env.local --import tsx scripts/dump-dryrun.ts
//      node --env-file=.env.local --import tsx scripts/dump-dryrun.ts --full
//
// Without --full, prints first 30 lines + last 30 + stats.
// With --full, prints the entire SQL (pipe to a file for inspection).

import { dumpDatabase } from "../src/lib/db/backup";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const t0 = Date.now();
  const result = await dumpDatabase(url);
  const ms = Date.now() - t0;

  const lines = result.sql.split("\n");

  if (process.argv.includes("--full")) {
    process.stdout.write(result.sql);
    return;
  }

  console.log("=== HEAD (first 30 lines) ===");
  console.log(lines.slice(0, 30).join("\n"));
  console.log("\n=== TAIL (last 30 lines) ===");
  console.log(lines.slice(-30).join("\n"));
  console.log("\n=== STATS ===");
  console.log(`tables       : ${result.table_count}`);
  console.log(`rows         : ${result.row_count}`);
  console.log(`bytes (raw)  : ${result.bytes.toLocaleString()}`);
  console.log(`lines        : ${lines.length.toLocaleString()}`);
  console.log(`elapsed      : ${ms}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
