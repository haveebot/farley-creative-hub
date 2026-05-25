/**
 * Daily DB backup cron.
 *
 *   GET /api/cron/db-backup
 *
 * Schedule: once daily at 04:00 UTC (see vercel.json).
 * Auth: CRON_SECRET header (Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`).
 *
 * What it does:
 *   1. Dumps prod DB (DATABASE_URL) as gzipped SQL.
 *   2. Dumps demo DB (DEMO_DATABASE_URL) if env var is set. Demo dump is
 *      best-effort — failure is logged but does NOT fail the cron.
 *   3. Uploads each to Vercel Blob at backups/{schema}/YYYY-MM-DD.sql.gz.
 *   4. Prunes old backups per the retention policy in backup-prune.ts
 *      (keep all from last 30 days + earliest of each month for last 12 months).
 *
 * Failure mode: any error dumping prod aborts the run with 500 so the
 * Vercel Cron failure surfaces in the dashboard. Demo failure does not.
 *
 * Restore: see operator-runbooks/db-restore.md.
 */

import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { del, list, put } from "@vercel/blob";
import { dumpDatabase, type DumpResult } from "@/lib/db/backup";
import { decidePrune, extractDateKey } from "@/lib/db/backup-prune";
import { encryptBackup } from "@/lib/db/backup-crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SchemaTarget = {
  name: "prod" | "demo";
  connectionString: string;
};

type SchemaResult = {
  schema: "prod" | "demo";
  ok: boolean;
  uploaded?: { url: string; bytes_raw: number; bytes_gz: number; tables: number; rows: number };
  pruned?: { kept: number; deleted: number };
  error?: string;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { ok: false, error: "BLOB_READ_WRITE_TOKEN not set" },
      { status: 500 },
    );
  }
  if (!process.env.BACKUP_ENCRYPTION_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "BACKUP_ENCRYPTION_KEY not set. Generate with `openssl rand -hex 32` and add to Vercel env. Backups contain OAuth tokens — refusing to write plaintext.",
      },
      { status: 500 },
    );
  }

  const targets: SchemaTarget[] = [];
  if (process.env.DATABASE_URL) {
    targets.push({ name: "prod", connectionString: process.env.DATABASE_URL });
  }
  if (process.env.DEMO_DATABASE_URL) {
    targets.push({ name: "demo", connectionString: process.env.DEMO_DATABASE_URL });
  }

  if (targets.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no databases configured (DATABASE_URL / DEMO_DATABASE_URL)" },
      { status: 500 },
    );
  }

  const today = new Date();
  const dateKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

  const results: SchemaResult[] = [];
  let prodFailed = false;

  for (const target of targets) {
    try {
      const dump = await dumpDatabase(target.connectionString);
      const uploaded = await uploadBackup(target.name, dateKey, dump);
      const pruned = await pruneSchema(target.name, today);
      results.push({
        schema: target.name,
        ok: true,
        uploaded: {
          url: uploaded.url,
          bytes_raw: dump.bytes,
          bytes_gz: uploaded.bytes_gz,
          tables: dump.table_count,
          rows: dump.row_count,
        },
        pruned,
      });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[db-backup] ${target.name} failed:`, err);
      results.push({ schema: target.name, ok: false, error: message });
      if (target.name === "prod") prodFailed = true;
    }
  }

  const body = {
    ok: !prodFailed,
    date: dateKey,
    results,
  };

  return NextResponse.json(body, { status: prodFailed ? 500 : 200 });
}

async function uploadBackup(
  schema: "prod" | "demo",
  dateKey: string,
  dump: DumpResult,
): Promise<{ url: string; bytes_gz: number }> {
  const gz = gzipSync(Buffer.from(dump.sql, "utf-8"), { level: 9 });
  const encrypted = encryptBackup(gz);
  const pathname = `backups/${schema}/${dateKey}.sql.gz.enc`;

  // Same-day retry: remove any prior blob at this pathname before put.
  // Vercel Blob's put() with addRandomSuffix:false will fail on collision
  // in some sdk versions; deleting first makes the behavior deterministic.
  await deleteIfExists(pathname);

  const result = await put(pathname, encrypted, {
    access: "public",
    contentType: "application/octet-stream",
    addRandomSuffix: false,
  });

  return { url: result.url, bytes_gz: encrypted.length };
}

async function deleteIfExists(pathname: string): Promise<void> {
  // list() is prefix-based; using the full pathname as prefix returns
  // 0 or 1 results.
  const listing = await list({ prefix: pathname });
  for (const blob of listing.blobs) {
    if (blob.pathname === pathname) {
      await del(blob.url);
    }
  }
}

async function pruneSchema(
  schema: "prod" | "demo",
  today: Date,
): Promise<{ kept: number; deleted: number }> {
  const prefix = `backups/${schema}/`;
  const blobs: { pathname: string; url: string }[] = [];

  // list() returns up to 1000 by default. Cursor through if there are more.
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    for (const b of page.blobs) {
      blobs.push({ pathname: b.pathname, url: b.url });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  // Map dateKey -> blob(s). A given dateKey should have exactly one blob,
  // but if somehow there are duplicates we'll delete all of them when the
  // dateKey is pruned (and keep all when retained — caller can clean up).
  const blobsByDateKey = new Map<string, { pathname: string; url: string }[]>();
  for (const blob of blobs) {
    const dateKey = extractDateKey(blob.pathname);
    if (!dateKey) continue;
    const existing = blobsByDateKey.get(dateKey) ?? [];
    existing.push(blob);
    blobsByDateKey.set(dateKey, existing);
  }

  const decision = decidePrune(Array.from(blobsByDateKey.keys()), today);

  let deleted = 0;
  for (const dateKey of decision.delete) {
    for (const blob of blobsByDateKey.get(dateKey) ?? []) {
      try {
        await del(blob.url);
        deleted++;
      } catch (err) {
        console.error(`[db-backup] failed to delete ${blob.pathname}`, err);
      }
    }
  }

  return { kept: decision.keep.length, deleted };
}
