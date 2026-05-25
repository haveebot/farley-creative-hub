// Decrypt a Farley Hub backup blob (.sql.gz.enc → .sql.gz).
//
// Usage:
//   node --env-file=.env.local --import tsx scripts/backup-decrypt.ts <input.sql.gz.enc> [<output.sql.gz>]
//
// If output is omitted, writes to stdout (pipe to `gunzip` or to a file).
//
// Requires BACKUP_ENCRYPTION_KEY in env — same value the cron used to
// encrypt. Store it somewhere safe (1Password, Vercel env) and never
// commit it.

import { readFileSync, writeFileSync } from "node:fs";
import { decryptBackup } from "../src/lib/db/backup-crypto";

function main() {
  const [, , input, output] = process.argv;
  if (!input) {
    console.error("usage: backup-decrypt <input.sql.gz.enc> [<output.sql.gz>]");
    process.exit(1);
  }
  const encrypted = readFileSync(input);
  const plaintext = decryptBackup(encrypted);
  if (output) {
    writeFileSync(output, plaintext);
    console.error(`wrote ${plaintext.length} bytes to ${output}`);
  } else {
    process.stdout.write(plaintext);
  }
}

main();
