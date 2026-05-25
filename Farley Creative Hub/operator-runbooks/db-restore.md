# DB Restore Runbook — Farley Creative Hub

**Last verified:** 2026-05-25
**Audience:** Winston (operator). Not Collie's surface.

## What backups exist

The `db-backup` cron in `vercel.json` runs daily at **04:00 UTC** (11:00 PM CT the previous day). Each run:

1. Dumps the prod DB (`DATABASE_URL`) and the demo DB (`DEMO_DATABASE_URL`) to SQL.
2. Gzips, then **encrypts with AES-256-GCM** using `BACKUP_ENCRYPTION_KEY`.
3. Uploads to Vercel Blob at `backups/{schema}/YYYY-MM-DD.sql.gz.enc`.
4. Prunes per retention policy: **keep all from last 30 days + earliest of each month for last 12 months**. Anything older is deleted.

Worst-case data loss window: **24 hours** (last successful daily backup). Closes the "corruption noticed weeks later" gap that Neon's 7-day PITR window doesn't cover.

### Why encrypted

The dump contains Workspace OAuth refresh tokens (`workspace_connections.refresh_token`). An attacker who reads a backup can keep issuing access tokens until Collie revokes Workspace access at `myaccount.google.com`. Vercel Blob's only access mode on the current SDK is "public" with obscure URLs — fine for assets, not fine for OAuth secrets. So backups are encrypted at rest with a key stored separately from the blob.

### Required env vars (Vercel — fc-hub project)

| Var | Purpose | How to generate |
|---|---|---|
| `CRON_SECRET` | Authenticates the daily cron call | `openssl rand -hex 32` |
| `BACKUP_ENCRYPTION_KEY` | AES-256 key (64 hex chars) | `openssl rand -hex 32` |
| `DATABASE_URL` | Prod DB connection (already wired by Neon integration) | — |
| `DEMO_DATABASE_URL` | (Optional) Demo DB connection. Add if you want demo backed up too. | Copy from `farley-creative-hub-demo` project's Storage tab |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (already wired) | — |

**Store `BACKUP_ENCRYPTION_KEY` in 1Password before pasting into Vercel.** If it's lost, every backup is unrecoverable. Vercel env vars are not a backup — they live in one place.

## Verify a backup ran

**Option A — list from CLI** (any machine with `BLOB_READ_WRITE_TOKEN`):

```bash
cd ~/Projects/workspace/farley-creative-hub
node --env-file=.env.local -e "
  const { list } = require('@vercel/blob');
  list({ prefix: 'backups/' }).then(r =>
    r.blobs
      .sort((a, b) => a.pathname.localeCompare(b.pathname))
      .forEach(b => console.log(b.pathname, '·', (b.size/1024).toFixed(1)+'KB'))
  );
"
```

Expected output: at minimum, today's `backups/prod/YYYY-MM-DD.sql.gz` (and `backups/demo/...` if `DEMO_DATABASE_URL` is configured).

**Option B — trigger manually:**

```bash
curl -sS https://hub.farleycreative.com/api/cron/db-backup \
  -H "Authorization: Bearer $CRON_SECRET" | jq
```

Response includes `uploaded.url`, `uploaded.bytes_gz`, `tables`, `rows`, and the prune summary.

## Restore — fresh database (clean copy)

Use case: spin up a side-by-side copy for inspection without touching prod, or seed a new tenant from a known good state.

```bash
cd ~/Projects/workspace/farley-creative-hub

# 1. Pull the encrypted backup
curl -L 'https://<blob-url-from-listing>' -o restore.sql.gz.enc

# 2. Decrypt (BACKUP_ENCRYPTION_KEY must be in .env.local with the
#    same value the cron used to encrypt). Output is the gzipped SQL.
node --env-file=.env.local --import tsx scripts/backup-decrypt.ts \
  restore.sql.gz.enc restore.sql.gz

# 3. Gunzip to plain SQL
gunzip restore.sql.gz

# 4. Create the target DB (Neon dashboard, or wherever)
#    Note the new connection string as TARGET_DATABASE_URL.

# 5. Load
psql "$TARGET_DATABASE_URL" < restore.sql
```

The dump is self-contained: it includes both the schema (idempotent `CREATE TABLE IF NOT EXISTS`) and the data, wrapped in a single transaction with `session_replication_role = 'replica'` so FK ordering doesn't matter. Sequences are reset to `MAX(id) + 1` at the end so new inserts pick up where the snapshot left off.

## Restore — overwrite prod (rollback)

**Confirm with Winston before doing this.** Destructive. Wipes current prod state.

```bash
# 1. Pull the encrypted backup, decrypt, and gunzip
curl -L 'https://<blob-url>' -o restore.sql.gz.enc
node --env-file=.env.local --import tsx scripts/backup-decrypt.ts \
  restore.sql.gz.enc restore.sql.gz
gunzip restore.sql.gz

# 2. Wipe prod tables (data only — keep schema in place)
psql "$DATABASE_URL" <<'EOF'
BEGIN;
SET session_replication_role = 'replica';
TRUNCATE prospect_sends, prospect_enrollments, prospect_activity,
         prospect_contacts, prospects, leads, drafts, assets,
         brand_kits, agent_tokens, hub_preferences, etsy_connections,
         cadence_steps, cadences, workspace_connections,
         daily_briefings, listings, users
  RESTART IDENTITY CASCADE;
SET session_replication_role = 'origin';
COMMIT;
EOF

# 3. Load the backup
psql "$DATABASE_URL" < restore.sql
```

The `TRUNCATE ... RESTART IDENTITY CASCADE` resets serials so the restored snapshot's ids are preserved exactly. If you add new tables to `schema.sql`, append them to the truncate list here.

## When to use this vs Neon PITR

| Scenario | Tool | Why |
|---|---|---|
| "I deleted the wrong prospect 10 minutes ago" | Neon PITR (web UI) | Sub-second precision |
| "I deleted the wrong prospect 3 days ago" | Neon PITR | Within 7-day window |
| "Database got corrupted some time in the last month" | This runbook | Beyond PITR window |
| "We need a side-by-side copy from 6 weeks ago" | This runbook | PITR is point-in-time on the *same* DB |
| "Spin up a new tenant with FC Hub's current schema + seed data" | This runbook | Self-contained dump portable to any Neon project |

## Restoring just the demo DB

Identical procedure; swap `backups/prod/` → `backups/demo/` and `DATABASE_URL` → `DEMO_DATABASE_URL`. The dump format is identical.

## Failure modes — what to check

**Cron not firing:**
- Vercel dashboard → fc-hub project → Crons tab. Last run timestamp + status.
- If 401: `CRON_SECRET` env var got rotated; reset it and update Vercel.

**Cron firing but no blob appearing:**
- Cron response JSON `results[].error` will name the cause.
- Most likely: `DEMO_DATABASE_URL` set but pointing at a dead branch, or `BLOB_READ_WRITE_TOKEN` rotated, or `BACKUP_ENCRYPTION_KEY` missing.

**`BACKUP_ENCRYPTION_KEY` lost or different from what the backup was encrypted with:**
- The backup is unrecoverable. Encryption is by design un-bruteable. This is why the key needs to live in 1Password independent of Vercel — Vercel env loss = backup loss if you only had it there.
- For ongoing operations: rotate to a new key. New backups encrypt with the new key. Old backups are permanently lost. Operator should re-OAuth Workspace + agent tokens, but the user-facing pipeline state survives via Neon PITR for the 7-day window.

**Backup file too small (kB instead of expected MB):**
- A schema with 0 rows still dumps the CREATE statements (~5kB minimum). Check `tables` and `rows` in the cron response — should match what `/api/admin/db-stats` reports (or run `SELECT relname, n_live_tup FROM pg_stat_user_tables` directly).

**Restore fails with "permission denied for session_replication_role":**
- The DB user must be the DB owner. Neon's default `DATABASE_URL` user is the owner; only a problem if you point at a non-owner role.

## Adding a new tenant DB

To back up an additional DB (e.g., a future tenant on the same codebase):

1. Add the connection string as `<TENANT>_DATABASE_URL` to Vercel env.
2. In `src/app/api/cron/db-backup/route.ts`, append to the `targets` array in `GET`.
3. Redeploy.

The prune logic is per-schema and self-isolating: a new schema name gets its own retention window.
