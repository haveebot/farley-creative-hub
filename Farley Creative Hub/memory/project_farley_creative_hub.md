---
name: Farley Creative Hub — operator dashboard for Farley Girls Creative
description: HeyeLab tenant (Heye Lab built, Collie operated, no revenue share). Multi-vertical creative studio operating system — brand kits (studio + clients), asset library, AI drafting in any brand voice, sales pipeline (leads + prospects + activity + cadence stub), Etsy OAuth scaffold, agent access via MCP. Live at hub.farleycreative.com. ~33 commits across two sessions (2026-05-23 scaffold + 2026-05-24 substantive build).
type: project
originSessionId: 2026-05-22-farley-creative-hub-scaffold
---

**Authoritative project memory for Farley Creative Hub.** Workspace mirror at `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md` — synced during dumptruck.

## What this is

A Wheelhouse-style operator dashboard that runs Collie Farley's creative studio (Farley Girls Creative) end-to-end. One Hub, all the firm's verticals: brand identity (studio + clients), asset library, AI-drafted content, sales pipeline (sourced leads → active prospects → signed clients), Etsy operations (scaffold ready), agent integration.

Live at **`hub.farleycreative.com`**.

Repo at **`github.com/haveebot/farley-creative-hub`** (public per Vercel contributor onboarding rule).

## Two-frame discipline (locked)

Per [`feedback_beta_tenant_self_framing.md`](../../../../../.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/feedback_beta_tenant_self_framing.md):

- **Tenant frame (Collie's):** "I'm building my perfect platform for my creative studio."
- **Operator frame (Heye Lab's, private):** "Canonical beta for the FirmDeploy productization."

Never crossed. No FirmDeploy / product-pitch language in the Farley repo, in briefs to her, or in tenant-facing surfaces.

## Architecture

### Stack
- **Frontend:** Next.js 16.2.1, React 19.2.4, Tailwind 4.2.2, TypeScript 6
- **Hosting:** Vercel (haveebots-projects scope), auto-deploy on push to main
- **DB:** Neon Postgres via Vercel Storage integration
- **Files:** Vercel Blob (public access)
- **AI:** Anthropic Claude Sonnet 4.5 (system-prompt caching for brand blocks)
- **Email:** Resend (configured, not yet used for live sends)
- **Auth:** Email + password (bcryptjs), HMAC-signed session cookies (Web Crypto for edge safety)

### Client-safety pattern (important)
Several DB modules transitively pull in `pg` (Node-only). Client components can't import them. Pattern: split into `src/lib/<feature>-shared.ts` (types + constants, no DB) and `src/lib/db/<feature>.ts` (CRUD, imports pg, re-exports shared types). Applied to: `assets-shared`, `drafts-shared`, `hub-preferences-shared`, `pipeline-shared`, `leads-shared`.

### Schema state
All tables in `src/lib/db/schema.sql` (idempotent — CREATE TABLE IF NOT EXISTS / ALTER TABLE ADD COLUMN IF NOT EXISTS). Applied via `node --env-file=.env.local -e "..."` using pg directly. Tables:
- `users` — operator accounts
- `hub_preferences` — Hub label, accent color, theme
- `brand_kits` — studio + client brand kits (with `from_prospect_id` linking promoted clients)
- `agent_tokens` — bearer tokens (hashed at rest, SHA-256)
- `assets` — Vercel Blob URLs + metadata
- `drafts` — AI-drafted content (with `prospect_id` linking outreach drafts)
- `prospects` + `prospect_contacts` + `prospect_activity` — active sales pipeline
- `leads` + lead status flow + `converted_to_prospect_id` link
- `etsy_connections` — OAuth tokens per shop
- `cadences` + `cadence_steps` + `prospect_enrollments` + `prospect_sends` — schema stub for next-session cadence build

## Surfaces

```
/                       Hub home (greeting, 3 cards, activity feed, recent assets)
/brand                  Brand kits list (studio + clients)
/brand/[id]             Per-kit edit + brand book PDF upload/extract
/assets                 File library
/drafts                 AI drafting with voice picker
/pipeline               Active prospects list
/pipeline/[id]          Prospect detail (details, contacts, activity, drafts-for, promote)
/pipeline/new           New prospect
/pipeline/leads         Lead queue
/pipeline/leads/[id]    Lead detail (inline-edit, convert button)
/pipeline/leads/new     New lead (with AI parser panel)
/settings               Hub look & feel (label, theme, accent)
/settings/agent-access  Bearer token management
/settings/etsy          Etsy OAuth (scaffold; activates on approval)
/login                  Email + password
/signup                 First-time signup (gated by SIGNUP_KEY)
```

## MCP server (`/api/mcp`)

JSON-RPC over HTTP. Bearer auth via the same `agent_tokens` table. Tools exposed (~19 as of 2026-05-24):

**Hub config:** `get_hub_preferences`, `update_hub_preferences`
**Brand kits:** `get_studio_brand_kit`, `update_studio_brand_kit`, `list_brand_kits`, `get_brand_kit`, `create_client_brand_kit`
**Assets:** `list_assets`
**Drafts:** `list_drafts`, `create_draft` (with optional `prospect_id` for outreach context)
**Pipeline:** `list_prospects`, `get_prospect` (returns prospect + contacts + activity), `create_prospect`, `update_prospect`, `add_prospect_contact`, `log_prospect_activity`
**Leads:** `list_leads`, `create_lead`, `parse_lead_source` (text or URL → structured fields), `convert_lead_to_prospect`

## Cross-feature integrations (the magic)

- **Drafts ↔ Pipeline** — `create_draft({ prospect_id })` makes Claude receive a prospect context block (not cached — per-call) alongside the cached brand block. Auto-logs a `note` activity with `draft_id` linked.
- **Lead → Prospect** — Convert button (or `convert_lead_to_prospect` MCP) creates a prospect with lead fields pre-filled, status='lead', source attribution preserved in notes, activity logged on the new prospect.
- **Prospect → Client kit** — Promote button (or future MCP tool) creates a `brand_kits` row with `from_prospect_id` linking back, flips prospect status to 'signed', logs `status_change` activity. Future drafts can use this client's voice.
- **AI parser → Lead form** — `/api/leads/parse` accepts text or URL, Claude returns structured ParsedLead, form auto-populates empty fields. Manual edits never overwritten.
- **Brand kit → CSS variable** — Hub preferences `accent_color` injected as `:root { --accent: ... }` in layout; Tailwind classes (`bg-accent`, etc.) instantly reflect the brand.

## Operator-side prereqs status

| Item | Status |
|---|---|
| Vercel project + autodeploy | ✅ |
| Neon Postgres | ✅ |
| Vercel Blob (public) | ✅ |
| `AUTH_HMAC_SECRET` | ✅ |
| `SIGNUP_KEY` | ✅ `96ba3ce8bdbd7cad26e018ee97a3cd37` |
| `ANTHROPIC_API_KEY` | ✅ |
| `BLOB_READ_WRITE_TOKEN` | ✅ auto |
| `DATABASE_URL` | ✅ auto |
| Custom domain `hub.farleycreative.com` | ✅ Canva DNS CNAME |
| Collie GitHub access (`colliebreah`) | ✅ invited |
| Etsy Developer app — `farley-creativ-hub` (original) | ❌ **PERMANENTLY BANNED** 2026-05-24 — third-party-tool framing in original submission (dictated field-by-field, no draft, no policy review). Visible in Collie's developer portal under "Banned Apps". |
| Etsy Developer app — `farley-girls-creative-hub` (resubmission) | ✅ **APPROVED** 2026-05-24 PM (less than 12h after submission — the corrected single-shop / sole-operator framing landed clean). Key is now active. |
| `ETSY_CLIENT_ID` + `_SECRET` | ⏳ next session — copy keystring + shared secret from Etsy developer portal into Vercel FC Hub project env vars, redeploy, run Collie through OAuth at `/settings/etsy` |
| Resend domain verify for `farleycreative.com` | ⏳ pending — blocks cadence-tick send step |
| `RESEND_API_KEY` + `RESEND_FROM_EMAIL` | ⏳ pending — set after domain verify |
| `CRON_SECRET` (Vercel env, used by /api/cron/cadence-tick) | ⏳ pending — generate a random string, set in Vercel; Vercel Cron sends it in `Authorization: Bearer ${CRON_SECRET}` header |
| Send identity locked: `collie@farleycreative.com` via Google Workspace | ✅ decided |

## Collie's setup status

- ✅ Onboarding email sent (`Your Hub is live — login + first steps`) to `collie.breah@gmail.com`
- ✅ GitHub collaborator invite sent (`colliebreah`)
- ⏳ Pending: she signs up, configures studio brand kit beyond defaults, optionally creates an agent token for Claude integration

## Cross-references

- **Wheelhouse pattern canonical:** `~/Projects/workspace/port-a-local/`
- **Repo-structure precedent:** `~/Projects/workspace/brons-beach/`
- **Sage HQ client-management precedent:** `~/Projects/workspace/sage-em-dashboard/`
- **Heyedeploy framework:** `~/Projects/workspace/heyedeploy/`
- **Workspace memory:** `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/`
- **Session notes (this repo):** `Session Notes/handoff-YYYY-MM-DD.md`

## Open items / decisions held

- **Email cascade MVP** — schema in place, UI + cron next session. Depends on Resend domain verify.
- **Email-forward lead capture** — queued; needs send-identity setup + Gmail filter rules.
- **Reply detection for cascades** — V2; Gmail API watch (Google Workspace makes this clean).
- **FirmDeploy framework name** — private working title; revisit at productization time.
- **Brand book RAG** — current implementation dumps full brand_book_notes into every Claude call. At scale we'd semantic-search relevant passages. Cost optimization, not immediate need.
- **Asset → Draft linking** — attach images to drafts so Claude can describe them. Phase 2 (would need Claude vision API).

## Session log

- **2026-05-23** — Scaffold session. Repo created, Next.js skeleton, contributor-context, project memory, Vercel deploy.
- **2026-05-24** — Substantive build day. Auth, brand kits, drafts, assets, pipeline (active + leads), Etsy scaffold, MCP server, activity feed, cadence schema stub. ~33 commits total across both sessions.
- **2026-05-24 (PM)** — Etsy recovery session. Original `farley-creativ-hub` app discovered permanently banned by Etsy (third-party-tool framing, dictated field-by-field with no draft). Two new cross-project memory rules locked: [[feedback_dont_default_to_emailing_collie]], [[feedback_vendor_submission_is_work]], [[feedback_never_suggest_taking_a_break]]. Drafted corrected single-shop / sole-operator submission artifact at `vendor-submissions/etsy-developer-app.md`. Added public `/privacy` page (commit `f656005`) to satisfy potential privacy-URL requirement. Resubmitted as `farley-girls-creative-hub` at 11:09 AM CT — currently Pending Personal Approval, 24-48h documented review window.
- **2026-05-24 (PM, cont'd)** — Cadence MVP shipped. Discovered the 5-24 handoff was wrong about schema state (cadence + etsy_connections tables claimed-present, actually missing from both schema.sql AND prod Neon). Backfilled (commit `358be41`). Then built end-to-end email cascade MVP: DB modules (commit `37ce6fb`), API routes (commit `9b52e6d`), `/cadences` list + new + detail with inline step editor (commit `5517425`), enrollment surface on prospect detail with pause/resume/cancel (commit `3737890`), `/api/cron/cadence-tick` + `vercel.json` hourly schedule (commit `a3b7bfb`). Pipeline sub-nav now has three tabs: Active prospects · Leads · Cadences. Cron tick: drafts via Claude with brand voice + prospect context, sends via Resend if configured, leaves pending if not (operator can fully exercise UI without Resend live).
- **2026-05-25 (mega session)** — All-day session, ran into 2026-05-26 early AM. 14 Hub commits + 13 commits in NEW repo `farley-creative-site`. Highlights: (1) Daily encrypted DB backups operational (`9bb78c4`). (2) Etsy fully connected — keystring/secret in Vercel, OAuth callback verified, **x-api-key bug** discovered + fixed (Etsy v3 needs `keystring:shared_secret` not just keystring, commit `eb611d6`), shop metadata backfilled via admin endpoint (`782f355`+`06d1d2e`). (3) Etsy push + image upload + sync built (`a190f1a`, 21 files / 1814 LOC). (4) **farleycreative.com cutover** — built site from scratch, integrated Collie's IA notes + About copy + packages + 5 case studies (Port A Local + Sage Em real, 3 PFV translated from current Canva site), real photography via Chrome MCP scrape of 153 images (picked 13), DNS cutover Canva→Vercel mid-session. Site lives at `https://farleycreative.com`. (5) Web traffic dashboard on Hub home (`34e6ddd`). (6) **Voice profiles as first-class entity** — separate `voice_profiles` table, AI extractor from real samples, 7 MCP tools, wired through draftWithClaude + cadence-tick, seed-from-brand-kit one-click migration, VoiceCard on Hub home (`184a0e0`+`97b6fb9`+`63d5be8`). (7) Nav rename: Listings → **Etsy**. (8) **Lead parser bug fix** — parser was never extracting `source_url` for digest items (every cron-captured lead had NULL url), fixed + ran one-shot regex backfill for 33 of 75 existing leads (`20b07f7`+`ecc12b8`). Memory rules locked alongside: nothing fundamentally new — referenced existing cross-project rules.
