# Session handoff — 2026-05-24 PM

**Third session.** A recovery + build day. Started with the Etsy app discovered banned, ended with a full email cascade infrastructure (Resend + Workspace + cron) shipping production-ready sends.

## Arc of the day

1. **Arnold + scaffold check** — clean trucked state from 5-24 morning handoff.
2. **Etsy ban diagnosis** — original `farley-creativ-hub` app discovered permanently banned. Root-caused to third-party-tool framing in the prior dictated-at-portal submission. Three cross-project memory rules locked: [[feedback_dont_default_to_emailing_collie]], [[feedback_vendor_submission_is_work]], [[feedback_never_suggest_taking_a_break]].
3. **Etsy resubmission** — corrected single-shop / sole-operator submission artifact at [`Farley Creative Hub/vendor-submissions/etsy-developer-app.md`](../Farley%20Creative%20Hub/vendor-submissions/etsy-developer-app.md). Resubmitted as `farley-girls-creative-hub` at 11:09 AM CT. Currently **Pending Personal Approval** (24-48h documented window). Etsy does NOT notify on rejection — check developer portal manually around the 48h mark.
4. **Hub build — cadence MVP** — full email cascade infrastructure shipped end-to-end (see Commit chain below).
5. **Email config — operator-side** — Resend + Workspace + Vercel env vars all wired. Cron is now firing hourly automatically.

## Commit chain (this session)

| Commit | What |
|---|---|
| `f656005` | feat: public `/privacy` page + Etsy submission artifact |
| `d52aa5a` | docs: log Etsy resubmission state |
| `358be41` | fix: backfill 5 missing tables in `schema.sql` + apply to prod (cadence + etsy_connections were claimed-present but actually missing) |
| `37ce6fb` | feat: cadences + enrollments DB modules |
| `9b52e6d` | feat: cadences + enrollments API routes |
| `5517425` | feat: cadence builder UI (list / new / detail with inline step editor) |
| `3737890` | feat: enrollment surface on prospect detail page |
| `a3b7bfb` | feat: cron tick endpoint + `vercel.json` hourly schedule |
| `e2e8400` | docs: log cadence MVP shipping + operator-side prereqs |
| `01405de` | fix: cast `'{}'` literal to `text[]` in array-column inserts (lead capture bug) |
| `4fd78b2` | docs: split MCP setup instructions for Claude Code vs Claude desktop |

## Where things stand

### Cadence MVP — DONE, code + ops side
- DB modules: [`src/lib/cadences-shared.ts`](../src/lib/cadences-shared.ts), [`src/lib/db/cadences.ts`](../src/lib/db/cadences.ts), [`src/lib/db/enrollments.ts`](../src/lib/db/enrollments.ts)
- API routes: `/api/cadences/*`, `/api/enrollments/[id]`, `/api/prospects/[id]/enroll`, `/api/cron/cadence-tick`
- UI: `/cadences`, `/cadences/new`, `/cadences/[id]`, enrollment section on `/pipeline/[id]`
- Sub-nav: Pipeline tabs now Active prospects | Leads | Cadences
- Cron: `vercel.json` schedules `/api/cron/cadence-tick` hourly (`0 * * * *`)

### Email infrastructure — DONE, fully verified
| | Status |
|---|---|
| Resend domain `farleycreative.com` | ✓ Verified |
| Workspace secondary domain `farleycreative.com` | ✓ Verified |
| `collie@farleycreative.com` user | ✓ Created, end-to-end mail tested |
| Canva DNS records (5 added in zero-disruption pass + Google MX) | ✓ All propagated globally |
| `RESEND_API_KEY` in Vercel | ✓ Loaded (`has_resend: true` confirmed via cron tick) |
| `RESEND_FROM_EMAIL` = `Farley Girls Creative <collie@farleycreative.com>` | ✓ Loaded |
| `CRON_SECRET` in Vercel | ✓ Loaded (401 reject confirmed when called without it) |
| Cron firing hourly | ✓ Live |

### Etsy — PENDING (external)
- `farley-girls-creative-hub` Pending Personal Approval. Watch the developer portal around 48h mark (~5-26 11AM CT).
- If approved: paste keystring + shared secret into Vercel as `ETSY_CLIENT_ID` + `ETSY_CLIENT_SECRET`, redeploy, test OAuth at `/settings/etsy`.
- If banned again: account is poisoned. The Hub still serves Collie's #1 bottleneck (listing drafting → manual paste into Etsy) without API access.

## Next session pickup — in priority order

### 1. Real-prospect first-send
The earliest organic end-to-end validation: enroll a real prospect (not a test) in a real cadence. Cron fires at the top of the next hour. First real email actually goes out. Validates the full chain in a production-meaningful way.

### 2. Email-forward lead capture (deferred from 5-24 AM handoff)
`leads@farleycreative.com` Google Workspace alias → Resend inbound webhook → Hub auto-parses Indeed digests into individual leads.
- Workspace alias setup: ~5 min in admin console
- Resend inbound webhook: ~15 min Hub-side endpoint to receive + parse
- Gmail filter / forwarding rule from Collie's existing job-board digests

### 3. Reply detection for cascades (V2 per 5-24 AM handoff)
Gmail API watch on `collie@farleycreative.com` → Hub detects replies → auto-pauses matching enrollment so we don't keep cadencing someone who replied. Requires Workspace OAuth setup; ~1 session of work.

### 4. MCP tools for cadences
The MCP server (`/api/mcp`) currently exposes ~19 tools but none of the cadence/enrollment surface. Adding `list_cadences`, `create_cadence`, `create_cadence_step`, `enroll_prospect`, `list_enrollments`, etc. would let agent integrations drive cadences too. Mechanical; ~30 min.

### 5. Workspace-side DKIM for Collie's manual Gmail sends
If Collie's manual sends from her Gmail start landing in spam folders, add Google's DKIM record at `google._domainkey.farleycreative.com`. 5-min fix. Not a problem until it is.

### 6. Legacy `brand_identity` table cleanup
Prod has this table from scaffold day; superseded by `brand_kits`. DROP TABLE when confirmed unused.

## Memory rules locked this session

- [[feedback_dont_default_to_emailing_collie]] — operator-side mistakes get diagnosed on our side first; only loop tenants in when they hold information we can't derive.
- [[feedback_vendor_submission_is_work]] — Claude drafts + reviews vendor submission content BEFORE dictating form values. Never field-dictate at portal time.
- [[feedback_never_suggest_taking_a_break]] — do not ever suggest Winston take a break.

## How to resume

1. Open `farley-creative-hub` in Claude Code.
2. Read this handoff + `Farley Creative Hub/memory/project_farley_creative_hub.md`.
3. Check Etsy developer portal for app approval status (~48h since submission).
4. Check Resend dashboard → Emails for any cadence sends that fired.
5. Real-prospect first-send is the natural pickup unless something more urgent surfaced.

## Pointers

- **Project memory authoritative:** [`Farley Creative Hub/memory/project_farley_creative_hub.md`](../Farley%20Creative%20Hub/memory/project_farley_creative_hub.md)
- **Workspace memory mirror:** `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md`
- **Vendor submissions:** `Farley Creative Hub/vendor-submissions/`
- **Etsy submission artifact:** [`etsy-developer-app.md`](../Farley%20Creative%20Hub/vendor-submissions/etsy-developer-app.md)
- **Etsy submission screenshot (2026-05-24 11:09 CT):** [`etsy-submission-2026-05-24-confirmation.png`](../Farley%20Creative%20Hub/vendor-submissions/etsy-submission-2026-05-24-confirmation.png)
