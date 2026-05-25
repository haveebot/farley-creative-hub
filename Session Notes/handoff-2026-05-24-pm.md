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
| `3f58b61` | **feat: pivot cadence sends to Gmail API (Workspace) — Resend becomes fallback** |
| `ac16dd9` | docs: update truck — Gmail API pivot operational |
| `a0c119d` | **feat: draft-only cadence mode — Hub never auto-sends client emails** |
| `83d7732` | docs: update truck — draft-only failsafe locked |
| `ebd4a5a` | feat: surface cadence drafts on Hub home Awaiting You |
| `3345682` | feat: expose cadence + enrollment tools via MCP (12 tools, total 32) |
| `3dc7464` | feat: recent Gmail exchange on prospect detail (reply-context for drafts) |
| `fc3944b` | feat: lead capture from Gmail inbox via hourly poll |
| `3ebf96c` | **feat: dual-purpose Workspace OAuth — sending vs lead source** |
| `01af89e` | docs: truck update — full lead→cadence loop operational |
| `42d806f` | feat: lead-backfill admin endpoint — retroactively label past matching mail |
| `6d9fb5f` | feat: lead-backfill UI on /settings/workspace |
| `16105d3` | **feat: A — Daily Briefing on Hub home (Claude-generated morning read)** |
| `a0fbd72` | **feat: C — Pipeline funnel + week-in-review on Hub home** |
| `c69a075` | **feat: B — Cadence template gallery (3 starter cadences, one-click clone)** |
| `31b7fe3` | **feat: D — Etsy listing prep workflow (the prep-then-paste answer to Collie's #1 bottleneck without the API)** |
| `b765b8b` | **feat: E — Brand kit depth (writing samples + always/never-say + audience + positioning)** |
| `7353292` / `65435b4` / `f85bbb7` / `b38946c` | favicon — italic-serif F mark (v1 → v2 fixes → final) |
| `b07e580` | feat: custom favicon upload + MCP-settable (operator drops their own; Hub falls back to F) |
| `df0beac` | **feat: demo-mode infrastructure + seed script for fcdemohub.com** |
| `4e74909` | chore: add seed-demo npm script |
| `73b611b` | fix: reorder schema.sql so FKs resolve on a fresh DB (critical for new-tenant spin-up) |

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
| Resend domain `farleycreative.com` | ✓ Verified (fallback channel only) |
| Workspace secondary domain `farleycreative.com` | ✓ Verified |
| `collie@farleycreative.com` user | ✓ Created, end-to-end mail tested |
| Canva DNS records (5 added in zero-disruption pass + Google MX) | ✓ All propagated globally |
| Google Cloud project `farley-creative-hub` (under PFV org) | ✓ Created, Gmail API enabled |
| OAuth consent screen (Internal — PFV-org-only access) | ✓ Configured, gmail.modify scope |
| OAuth Client ID `Farley Creative Hub — production` | ✓ Created, redirect URI `/api/workspace/callback` |
| `GOOGLE_OAUTH_CLIENT_ID` + `_SECRET` in Vercel | ✓ Loaded |
| Workspace OAuth grant to `collie@farleycreative.com` | ✓ Connected, 4 scopes granted |
| `RESEND_API_KEY` + `_FROM_EMAIL` in Vercel | ✓ Loaded (fallback only) |
| `CRON_SECRET` in Vercel | ✓ Loaded (401 reject confirmed when called without it) |
| Cron firing hourly | ✓ Live |
| **Cadence email behavior** | **✓ Draft-only via Gmail API. Cron creates Gmail drafts in Collie's Drafts folder; she reviews + sends. Cron response confirms `mode: "draft_only"`, `has_workspace: true`, `workspace_email: collie@farleycreative.com`. Never auto-sends.** |
| **Workspace OAuth (sending — Farley identity)** | ✓ Connected as `collie@farleycreative.com` |
| **Workspace OAuth (reading_leads — PFV identity)** | ✓ Connected as `collie@palmfamilyventures.com` |
| **Lead capture from inbox** | ✓ Cron polls Hub/Leads label every 30 min on PFV inbox; Claude parses (digests fan out to multiple leads); imports to `/pipeline/leads`. Requires Gmail filter at PFV inbox to label matching senders. |
| **Recent Gmail exchange (prospect detail)** | ✓ Shows last ~10 messages with primary contact, with thread deeplinks |
| **Lead backfill** | ✓ Admin UI at /settings/workspace; retroactively labels past matching mail. Verified with 54 messages → 33 leads imported (Indeed/AngelList/LinkedIn) |
| **Daily Briefing (Hub home)** | ✓ Claude-generated, cached per-day, Refresh button. Pulls drafts + leads + prospects + activity into 1-2 paragraph chief-of-staff read |
| **Pipeline funnel + week-in-review** | ✓ Bottom of Hub home: funnel bars, 7d-vs-7d stats, hot prospects, stale alerts. Auto-hides when pipeline is empty |
| **Cadence template gallery** | ✓ 3 starter cadences on /cadences (3-touch intro, post-discovery follow-up, long-form 5-step nurture). One-click clone → fully editable real cadence |
| **Etsy listing prep workflow** | ✓ /listings surface: context-aware Claude drafting → structured title/description/tags/keywords with copy-buttons → status flow draft/approved/posted/archived. Solves the #1 bottleneck even without Etsy API |
| **Brand kit depth** | ✓ 5 new fields on brand kits (writing samples / always-say / never-say / audience persona / differentiators). Compounds across every Claude-touched surface |
| **Favicon** | ✓ Italic serif "F" placeholder on coral; operator can drop a custom one via /settings upload OR MCP update_hub_preferences |
| **Demo Hub (fcdemohub.com)** | ✓ **LIVE.** Separate Vercel project (`farley-creative-hub-demo`), separate Neon DB (`neon-almond-crystal`), same codebase as FC Hub. DEMO_MODE=true flips posture: auth bypassed, writes return 403, banner at top, cron no-ops. Seeded with 9 prospects + 8 leads + 2 cadences (1 with active enrollment + drafted email) + 3 listings + deep studio brand kit. Public, no auth. |

### Architectural pivots mid-session (two)

**Pivot 1 — Resend → Gmail API.** The cadence MVP was first shipped using Resend as the send channel. Winston correctly flagged that sends weren't appearing in Collie's actual inbox (Sent folder) and that we'd referenced Workspace integration multiple times during planning. The right architecture for low-volume operator-driven cadences is **Gmail API via Workspace OAuth** — sends land in the operator's Sent folder, replies thread natively, single inbox UX.

**Pivot 2 — Auto-send → Draft-only.** After Gmail API was wired, Winston articulated the failsafe principle: "when speaking to clients and dealing with real money, we always have that failsafe." The Hub now NEVER auto-sends cadence emails. Cron creates Gmail drafts in Collie's Drafts folder; she reviews + sends each one from Gmail. Mirrors Sage's manual-after-draft pattern but with automated drafting. Resend stays in the codebase for purely transactional uses but is no longer a cadence channel; the cron explicitly does NOT fall back to it on Workspace disconnect (queues instead).

**Pivot 3 — Single OAuth → Dual-purpose.** After lead capture shipped, Winston flagged that Collie's existing job alerts arrive at `collie@palmfamilyventures.com` (her PFV email she's been using), NOT at the new Farley identity. Forwarding all PFV mail to Farley was rejected — would clutter the studio identity inbox. Architecture pivot: Hub now supports TWO Workspace OAuth connections, tagged by purpose. `sending` = Farley (cadence drafts + sends originate here). `reading_leads` = PFV (lead-poll reads here, never sends). Schema: `workspace_connections.purpose` column with unique-index-per-purpose. UI: `/settings/workspace` shows two connection slots, each Connect/Disconnect independently. Mailboxes stay where they naturally are; no forwarding needed. Pivot shipped in commit `3f58b61`:

- New schema: `workspace_connections` table for OAuth tokens; `prospect_sends.send_via` column for per-send channel tracking
- New code: `src/lib/gmail/oauth.ts` (authorize/exchange/refresh/userinfo), `src/lib/gmail/send.ts` (sendViaGmail with auto-refresh), `src/lib/db/workspace-connections.ts` (connection CRUD)
- New routes: `/api/workspace/connect`, `/api/workspace/callback`, `/api/workspace/disconnect`
- New UI: `/settings/workspace` with operator setup instructions when GOOGLE_OAUTH_CLIENT_ID isn't set
- Cron rewrite: picks channel at top of tick — gmail (preferred) → resend (fallback) → queue
- Settings nav: Workspace added as a tab between Agent access and Etsy

Memory rule locked alongside the pivot: [[feedback_hear_what_winston_says_not_my_framework]] — when the same tool/preference appears twice in a session, STOP and re-architect or explicitly push back; don't paper over with a "both for different jobs" framework.

### Etsy — PENDING (external)
- `farley-girls-creative-hub` Pending Personal Approval. Watch the developer portal around 48h mark (~5-26 11AM CT).
- If approved: paste keystring + shared secret into Vercel as `ETSY_CLIENT_ID` + `ETSY_CLIENT_SECRET`, redeploy, test OAuth at `/settings/etsy`.
- If banned again: account is poisoned. The Hub still serves Collie's #1 bottleneck (listing drafting → manual paste into Etsy) without API access.

## Next session pickup — in priority order

### 0. Tier 1 backup — DAILY DB DUMPS (locked, first move)
~45 min. Cron endpoint `/api/cron/db-backup` runs once daily, dumps both schemas (real + demo) as compressed SQL to Vercel Blob under `backups/`, keeps 30 daily + 12 monthly with auto-prune. Plus a one-page restore runbook. Closes the "corruption not noticed for 2 weeks" gap that Neon's 7-day window misses.

### 1. Demo vs FC Hub explainer (READY — read before building)
Pre-written reference doc at [`Farley Creative Hub/operator-runbooks/demo-vs-fc-hub.md`](../Farley%20Creative%20Hub/operator-runbooks/demo-vs-fc-hub.md). Covers what's the same, what's different (the one DEMO_MODE flag flipping 4 behaviors), how the same data shape becomes a different experience, why we chose this architecture vs alternatives. No build — just clarity for grounding the rest of the queue.

### 2. Mobile UX — snap + nav drawer
~1-2 hours. Both deployments share the codebase so fixing once fixes both. Audit:
- Top nav on mobile (needs a hamburger drawer instead of horizontal scroll)
- Pipeline filters (currently scroll off-screen)
- Asset grid + listing cards (left/right snap)
- Cadence step editor (likely overflow issues)
- Hub home cards (already grid-1-on-mobile, should be fine — verify)

### 3. Workflow indicator on pipeline
Medium build, ~2-3 hours. In-context "what can I do here?" surface on `/pipeline/[id]` that suggests next moves based on prospect status. E.g., status='discovery' → suggests "send proposal," "log call," "enroll in post-discovery cadence." Helps Collie discover the full capability of the pipeline.

### 4. Website (farleycreative.com) review + Vercel migration prep
Separate front-end track. Phase 0 = audit only (no build): what's currently on the Canva site, what should it become (real firm-enterprise web presence), what's the IA + page list. Likely produces its own repo + multi-session arc. Don't conflate with the Hub — that's the operations product. The website is the public marketing presence.

### 5. Web traffic dashboard on Hub home
Depends on #4 landing first. Once farleycreative.com is on Vercel, pull Vercel Analytics into Hub home — "your website got X visits this week, top pages, top referrers." Small add when its dependency is in place.

### 6. Social media tools — FIRM-FACING only
Big scope. Account linking (Instagram, Pinterest, etc.), scheduled posting, content drafting via Claude (already partially possible via `/drafts` kind='social_post'). **Important scope:** for HER firm's own social media marketing, NOT a service-to-clients social tool. Multi-session.

### 2. Email-forward lead capture (deferred from 5-24 AM handoff)
`leads@farleycreative.com` Google Workspace alias → Resend inbound webhook → Hub auto-parses Indeed digests into individual leads.
- Workspace alias setup: ~5 min in admin console
- Resend inbound webhook: ~15 min Hub-side endpoint to receive + parse
- Gmail filter / forwarding rule from Collie's existing job-board digests

### 3. Reply detection for cascades (V2 per 5-24 AM handoff)
Gmail API watch on `collie@farleycreative.com` → Hub detects replies → auto-pauses matching enrollment so we don't keep cadencing someone who replied. Requires Workspace OAuth setup; ~1 session of work.

### 4. MCP tools for cadences
~~The MCP server (`/api/mcp`) currently exposes ~19 tools but none of the cadence/enrollment surface.~~ **DONE — commit `3345682`.** 12 cadence + enrollment MCP tools shipped: `list_cadences`, `get_cadence`, `create_cadence`, `add_cadence_step`, `list_enrollments`, `get_enrollment`, `list_enrollments_for_prospect`, `enroll_prospect`, `pause_enrollment`, `resume_enrollment`, `cancel_enrollment`, `list_drafted_sends`. Total MCP surface now 32 tools.

### 4b. OAuth 2.1 + Dynamic Client Registration for MCP (queued from Collie)
Per Collie's technical proposal 2026-05-24 PM (haveebot uid 453): the polished MCP setup is OAuth 2.1 + RFC 7591 DCR so claude.ai's "Add custom connector" UI auto-discovers Hub auth metadata and runs an interactive consent flow — no manual token paste. Currently `/.well-known/oauth-authorization-server` returns 404; the bearer-token-in-config path works fine for 1-2 user systems but is non-canonical. Right time to build it: when a second tenant comes online OR claude.ai's UI flow becomes primary. Estimated 2-4 hour build:
- `/.well-known/oauth-authorization-server` metadata endpoint
- RFC 7591 Dynamic Client Registration endpoint
- OAuth 2.1 authorize endpoint + consent UI
- Token endpoint
- `oauth_clients` table
- MCP route accepts either bearer (existing) or OAuth 2.1 tokens (new)

### 5. Workspace-side DKIM for Collie's manual Gmail sends
If Collie's manual sends from her Gmail start landing in spam folders, add Google's DKIM record at `google._domainkey.farleycreative.com`. 5-min fix. Not a problem until it is.

### 6. Legacy `brand_identity` table cleanup
Prod has this table from scaffold day; superseded by `brand_kits`. DROP TABLE when confirmed unused.

## Memory rules locked this session

- [[feedback_dont_default_to_emailing_collie]] — operator-side mistakes get diagnosed on our side first; only loop tenants in when they hold information we can't derive.
- [[feedback_vendor_submission_is_work]] — Claude drafts + reviews vendor submission content BEFORE dictating form values. Never field-dictate at portal time.
- [[feedback_never_suggest_taking_a_break]] — do not ever suggest Winston take a break.
- [[feedback_hear_what_winston_says_not_my_framework]] — when Winston references a tool/preference more than once in a session, treat the second mention as a STOP signal: re-architect or push back explicitly, don't paper over with a "both for different jobs" framework.

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
