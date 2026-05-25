# Demo Hub setup — operator runbook

Stands up `fcdemohub.com` as a public, read-only demo of the Farley Creative Hub. Shares the FC Hub's codebase + auto-redeploys on every push.

## Architecture summary

- Same GitHub repo (`haveebot/farley-creative-hub`)
- Separate Vercel project (`farley-creative-hub-demo`)
- Separate Neon DB (a new branch off the production DB)
- One env-flag difference: `DEMO_MODE=true`
- Domain: `fcdemohub.com`

When `DEMO_MODE=true`:
- Middleware bypasses session auth — anyone can view every page
- All mutating API calls (POST/PATCH/PUT/DELETE) return 403 with a "demo is read-only" message
- The Hub renders a banner at the top of every page explaining the demo posture
- Cron endpoints no-op (don't draft, don't poll, don't send)
- No external services touched (no Gmail API calls, no Resend, no Etsy)

## Setup — once, ~15 minutes

### 1. Create a Neon branch for the demo

Neon Console → your project → Branches → Create branch:
- Name: `demo`
- Parent: `main`
- This forks the schema (and any existing data — we'll wipe + reseed)

Copy the new branch's connection string. Looks like:
```
postgresql://...neon.tech/neondb?branch=demo&sslmode=require
```

### 2. Create the new Vercel project

Vercel dashboard → Add New → Project → Import from GitHub:
- Repo: `haveebot/farley-creative-hub`
- Project name: `farley-creative-hub-demo`
- Framework: Next.js (auto-detected)
- Don't deploy yet — set env vars first

### 3. Set env vars on the demo project

Vercel → `farley-creative-hub-demo` → Settings → Environment Variables. Production environment. Add:

| Variable | Value | Sensitive |
|---|---|---|
| `DEMO_MODE` | `true` | No |
| `DATABASE_URL` | the demo Neon branch connection string from step 1 | Yes |
| `ANTHROPIC_API_KEY` | same key as production FC Hub | Yes |
| `BLOB_READ_WRITE_TOKEN` | (skip — demo doesn't need uploads) | — |
| `AUTH_HMAC_SECRET` | any random 32-char string (unused but expected) | Yes |
| `SIGNUP_KEY` | any random string (unused) | Yes |

Do NOT copy over: `CRON_SECRET`, `RESEND_*`, `GOOGLE_OAUTH_*`, `ETSY_*`. Demo doesn't need them and they'd be misleading.

### 4. First deploy

Vercel → `farley-creative-hub-demo` → Deployments → Redeploy (or push any commit to main; the demo project auto-deploys on push).

Wait for it to land `● Ready`. The deployment URL (`farley-creative-hub-demo-xxx.vercel.app`) will work but show the schema only — no seed data yet.

### 5. Apply schema to the demo branch + seed it

From your local machine, in the repo root:

1. Create a `.env.demo` file (NOT committed — it's in `.gitignore` via `.env*`):
   ```bash
   DATABASE_URL=<paste the demo Neon branch connection string>
   DEMO_MODE=true
   ```

2. Apply the schema to the demo branch:
   ```bash
   node --env-file=.env.demo --import tsx scripts/migrate.ts
   ```
   (Or whatever pattern matches the existing migrate script — adapt to current convention.)

3. Run the seed script:
   ```bash
   node --env-file=.env.demo --import tsx scripts/seed-demo.ts
   ```

   The seed script refuses to run unless `DEMO_MODE=true` (safety guard against accidentally seeding the prod DB).

   You should see:
   ```
   Connected to demo DB. Clearing existing seeded data…
   Seeding studio brand kit…
   Seeding hub preferences…
   Seeding leads…
   Seeding prospects + contacts + activity…
   Seeding cadences + enrollments + drafts…
   Seeding listings…
   Done. Demo DB ready.
   ```

### 6. Point `fcdemohub.com` at the new Vercel project

Vercel → `farley-creative-hub-demo` → Settings → Domains → Add Domain → `fcdemohub.com`.

Vercel shows DNS records to add. Where the domain's DNS is currently managed (Canva? other?):
- Add an `A` record `@` → Vercel's IP
- OR a `CNAME` `www` → `cname.vercel-dns.com`

Wait ~5 min for DNS propagation. Visit `https://fcdemohub.com` — should load the demo Hub home with the "Demo Hub" banner at top.

### 7. Verify

- ✓ Banner shows at top of every page
- ✓ Daily Briefing renders against demo data
- ✓ `/pipeline/leads` shows 8 seeded leads
- ✓ `/pipeline` shows 9 seeded prospects in various stages
- ✓ `/cadences` shows 2 cadences with the intro one having an active enrollment
- ✓ `/listings` shows 3 sample Etsy listings
- ✓ Trying to enroll a prospect or create a cadence returns the "demo-read-only" error (or the UI button just doesn't work)
- ✓ Can't log out (no auth in demo mode) — that's intentional

## Resetting the demo to fresh state

Re-run the seed script anytime to wipe demo data and re-seed:

```bash
node --env-file=.env.demo --import tsx scripts/seed-demo.ts
```

The script is idempotent — `DELETE` then `INSERT` for all seeded tables. Operator-side state (the studio brand kit, hub_preferences) is updated in place.

## Future enhancements (phase 2)

- Per-prospect personalization slugs at `fcdemohub.com/p/[slug]` with tailored content (industry-specific brand voice, sample prospects matching the visitor's vertical, etc.)
- `/settings/demo` control surface on the production FC Hub for one-click "create a personalized demo for [Prospect Name]"
- Engagement signal back to FC Hub: page views, time on page, conversion taps
- Email gate as an OPTIONAL toggle for marketing-funnel use (currently no gate at all)
