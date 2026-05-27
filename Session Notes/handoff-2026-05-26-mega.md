# Session handoff — 2026-05-26 (mega session — sales pipeline build)

**Fifth session, second mega day in a row.** Started as a standard Arnold (site review + Etsy MCP audit + DKIM/SPF) and turned into a ~10-hour build of the full sales pipeline: first-touch generator with company enrichment + multi-recipient roster, lead/pipeline tab UX, /clients account-management surface. 18 commits in the Hub repo (this session alone) + 1 in farley-creative-site. Pipeline is now operational end-to-end for outbound: **Leads → Pipeline → Clients**, each inbox-zero-capable.

## Arc of the session

1. **Arnold + farleycreative.com review** — Collie shipped two PRs overnight (home/about/work mockup pass + about-photo full-res). Caught + fixed a Reveal animation bug (IntersectionObserver missing elements on instant scroll); shipped self-healing observer with immediate-in-view check + 2s safety net fallback. Also dropped stale "Five projects" copy on /work (now six).
2. **Etsy MCP audit + 6 new tools** — Subagent did a full audit of Hub Etsy capabilities + Etsy API gaps + recommendations. Shipped: `get_etsy_shop_info`, `list_etsy_listings`, `update_etsy_listing` (new lib helper + endpoint), `create_etsy_draft_listing`, `search_etsy_taxonomy`, `list_etsy_shipping_profiles`. Total MCP tools: 45 → 46 (after later first-touch addition).
3. **DKIM + SPF email auth** — Generated 1024-bit DKIM in Workspace, added DNS records at Network Solutions (the registrar — `systemdns.com` NS, not Network Solutions itself), activated in Workspace. SPF added too (`v=spf1 include:_spf.google.com ~all`). DMARC already at `p=none` monitoring. Full email auth stack live for collie@farleycreative.com.
4. **Per-lead first-touch generator — 18-commit saga** — Built, iterated, partially reverted, rebuilt. End state in the architecture section below.
5. **Sage descriptor correction** — Mid-build, caught fundamental error: Sage Em is an emergency lighting **manufacturer** (white-label OEM of SignTex), not a rep agency. Propagated correction to Hub brand kit receipts, composition template receipt rules, farley-creative-site case study (commit bcb887a), workspace memory mirror. Sage moves out of agency-to-agency receipt slot → CrossRef + PALMFEST cover agencies; Sage covers B2B manufacturer/industrial.
6. **Leads tab UX + Pass button** — Replaced flat leads list with default-Active tab view (Dismissed/Converted/All accessible behind clicks). New "Pass on lead" button does soft dismiss (Sage best-practice: preserves history, prevents re-evaluation, enables pattern recognition). Delete reserved for spam/duplicates/parser errors only.
7. **Pipeline tab UX** — Same pattern carried to /pipeline. Default-Active = lead+contacted+discovery+proposal+negotiating. Tabs for Signed / Passed / Dormant / All. Empty Active shows "🎉 Active pipeline is clear."
8. **/clients account-management surface** — New top-nav link. Lists signed prospects + their linked brand kit (via brand_kits.from_prospect_id). Each row: color-dot from kit accent, kit name pill (or amber "No brand kit" warning), industry/size/location, services, last-touched relative time, next-action with overdue indicator. Detail clicks through to /pipeline/[id] (same data model for now).

## Sales pipeline architecture — current end state

### Lead detail page (`/pipeline/leads/[id]`)

Status bar with **Convert to prospect** / **Pass on lead** / **Delete** actions. Source posting prominent. Company website section (clickable + /contact-us /team /about quick-jump pills + override URL input). Then the outreach panel.

### Outreach panel — two ordered actions, no Gmail refresh needed

**Step 1: Populate roster** button
- Calls `POST /api/leads/[id]/populate-roster`
- Runs `enrichCompany`: Claude guesses website URL → fetches homepage → identifies team/about pages via Claude + crawls common paths (`/contact`, `/contact-us`, `/about`, `/team`, `/our-team`, `/leadership`, `/people`, `/who-we-are`, `/company`) → Claude extracts structured contacts (name, title, email if literally on page)
- Saves to `leads.website_url`, `leads.contacts` (JSONB), `leads.enrichment_notes`
- Does NOT touch Gmail, NOT draft, NOT promote
- Idempotent — re-running overwrites

**Step 2: Roster** — checkboxes + editable email per row
- Reads from `lead.contacts` (persisted JSONB) — survives refresh + works across machines
- Each row: name, title, AI-top-pick badge, **editable email input** (operator types in missing emails from their own research — no guessing, ever)
- Auto-check: typing an email into a previously-empty row checks it; clearing unchecks
- Local state mirrors lead.contacts; edits get persisted back to lead.contacts on Draft click

**Step 3: Draft first-touch (N)** button
- Disabled until ≥1 recipient with email selected
- Calls `POST /api/leads/[id]/draft-first-touch` with `recipients` array + `contacts` for persistence
- AI drafts email via Claude (composition template + brand kit + voice profile + JD content)
- Creates Gmail draft with **all selected recipients already on the To: line** — no back-fill step
- Deletes any previous Gmail draft for this lead (only one live per lead)
- Stamps `lead.first_touch_*` columns; persists operator's email edits to `lead.contacts`
- Returns analysis (role/constraint/lever) + subject + body + gmail link

**Step 4: Open Gmail Draft ↗** — recipients are THERE, no refresh.

### What does NOT happen

- Lead is **NOT auto-promoted** to prospect on draft (operator does that manually via Convert button after actually sending — drafting ≠ contacting)
- Contacts are NOT persisted to prospect_contacts (they live on the lead until promotion; when convert fires the carry-over is TBD — currently not wired)
- No email guessing/inference — only literal scrape + operator manual entry
- No Hunter.io / Apollo / paid email finders (Winston explicitly declined)

### Composition template (`composition-templates/job-board-first-touch.md`)

22 numbered principles, loaded from disk at runtime (edit the .md → next draft uses it, no redeploy). Versioned artifact. Covers: Read (analyze JD before composing) → Open (personal intro + acknowledge their language + methodology mention if named) → Frame (alternative not replacement, map gap to one lever, founder-operator empathy, ONE receipt by default / TWO max when complementary, prospect-type-aware receipt selection) → Ask (soft 1-call narrow window) → Skip (no price, no attachments, no agency-speak, no more than 4 short paragraphs).

Receipt rule: name the specific case study in the body + link to **farleycreative.com/work** (the index, not the case study page — diversifies the click, reads as confidence).

Receipt-to-prospect-type mapping (post-Sage correction):
- **Agency prospects** → CrossRef (multi-tenant platform for rep agencies) or PALMFEST (multi-channel campaign performance)
- **B2B manufacturer / industrial** → Sage Em (brand + sales infrastructure)
- **Hospitality/restaurant/venue** → Palm Social Club or Cinnamon Shore
- **Event/festival/experiential** → PALMFEST
- **Real estate/luxury hospitality** → Cinnamon Shore or RK Projects
- **Retail/lifestyle/product** → Palm Republic
- **Hyperlocal/community/platform** → Port A Local or CrossRef

### Brand kit `brand_book_notes` (~7,900 chars)

Studio voice (3,900) + differentiators (1,900) + brand book notes (now 7,871 with the receipts block). Receipts block has each case study with outcome numbers + "Use when..." guidance. CrossRef added as the multi-tenant platform receipt for agency-to-agency.

## Leads page — tab UX

Default view: **Active** (`new + reviewing + qualified` — the actionable queue). Tabs at top with counts:
```
[ Active (N) ]  [ Dismissed (N) ]  [ Converted (N) ]  [ All (N) ]
```
- **Pass on lead** button (next to Convert) sets status='dismissed' + routes back to leads. Soft, reversible from Dismissed tab.
- Delete button is far right, red, tooltip: "only for spam, duplicates, or parser errors. For 'no thanks' use Pass."
- Search bar cross-cuts current tab. Source + state filters within current tab.
- Empty Active: "🎉 Active queue is clear."

## Pipeline page — tab UX (matching leads)

Default view: **Active** (`lead + contacted + discovery + proposal + negotiating` — the live sales motion). Tabs: Active / Signed / Passed / Dormant / All with counts. Search bar + filters (state/industry/size/service).

## /clients — account-management surface

New route, new top-nav link. Lists signed prospects (status='signed') with their linked brand kit (LEFT JOIN brand_kits via `from_prospect_id`).

Per-row: business name + brand-kit accent-color dot + kit name pill (or amber "No brand kit" warning) + industry/size/location + service-interest pills + last-touched relative time + next-action with overdue indicator.

Stats header: "N signed clients · N with brand kit · N need kit setup" (amber if any unkitted).

Detail clicks through to `/pipeline/[id]` for now. When client-specific workflows grow (retainer status, deliverables, SOWs), `/clients/[id]` becomes a dedicated detail surface.

## Hub commit chain (18 commits this session)

| Commit | What |
|---|---|
| `d15c26d` | fix(reveal): self-healing scroll-in observer + drop stale "five projects" copy [site repo] |
| `8105904` | feat(mcp): expose 6 etsy tools |
| `5f869d7` | feat(leads): per-lead first-touch generator (initial) |
| `30eb835` | feat(leads): search bar on leads index |
| `0c1001b` | fix(first-touch): strip stray Claude code-fence artifacts |
| `5c975c9` | feat(first-touch): sage-style intro + agency-aware receipts + auto-promote |
| `5297577` | fix(sage): correct receipt descriptor (manufacturer not rep agency) + shared promote helper |
| `aa9d72b` | feat(first-touch): company enrichment + multi-recipient + roster curator |
| `d21d6cd` | refactor(first-touch): 2-step prepare/commit + sage multi-TO (no CC) |
| `7084cac` | fix(leads): keep "Draft first-touch" button visible after auto-promotion |
| `da7191c` | revert(first-touch): strip back to simple draft-only — no auto-promote, no roster |
| `5bebeb1` | feat(first-touch): roster back-fill into existing Gmail draft (no auto-promote) |
| `d9a7946` | fix(first-touch): persist enrichment + editable email per row + crawl contact pages |
| `a8838ca` | feat(leads): surface company website link + quick-jump |
| `9e71404` | copy(first-touch): receipt link goes to /work index |
| `9012498` | feat(first-touch): split into populate-roster (step 1) + draft (step 2) |
| `978a063` | feat(leads): Pass button + tab-based view |
| `e9b2e89` | feat(pipeline): tab UX on /pipeline + new /clients surface |

Plus `bcb887a` in `farley-creative-site` for the Sage manufacturer descriptor fix in the case study.

## Schema changes (idempotent, applied to prod Neon)

```sql
-- First-touch outreach tracking (early session)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_drafted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_gmail_draft_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_subject TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_jd_source TEXT;

-- Company enrichment persistence (later session — roster lives on lead)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enrichment_notes TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_body TEXT;
```

## New files

- `composition-templates/job-board-first-touch.md` — 22 principles + structural template, loaded from disk at runtime
- `src/lib/ai/first-touch.ts` — generator function, hybrid URL fetch
- `src/lib/ai/enrich-company.ts` — Claude URL guess → page crawl (including common contact paths) → contact extraction
- `src/lib/leads/promote.ts` — shared ensureProspectForLead helper (currently unused after revert, kept for future Convert use)
- `src/app/api/leads/[id]/populate-roster/route.ts` — Step 1 endpoint
- `src/app/api/leads/[id]/draft-first-touch/route.ts` — Step 2 endpoint (rewritten multiple times)
- `src/app/clients/page.tsx` + `src/app/clients/ClientsPanel.tsx` — account management surface

## Memory rules locked / reinforced

- **Don't fabricate options.** [feedback_hear_what_winston_says_not_my_framework] — violated multiple times in this session (Option B individual-drafts fabrication when Sage playbook said multi-TO; auto-promote that wasn't asked for; over-architecting). Each time corrected by going back to the source (Sage playbook, what Winston actually said).
- **Surgical fixes over re-architecture.** When user flags a specific issue, fix THAT issue. Don't rebuild the whole flow.
- **Persist UI state.** Roster needed to live on `lead.contacts` (JSONB) — the in-memory-only approach failed when operator switched machines. General rule: any data the operator interacts with should persist.
- **Sage descriptor: lighting MANUFACTURER**, white-label OEM of SignTex. Not a rep agency. Memory mirror updated; canonical fix in sage-em vault pending.
- **No email guessing.** No pattern inference (`firstname.lastname@domain`). No paid email finders (Winston declined Hunter.io). Only literal scrape from public pages + operator manual entry.
- **Drafting ≠ contacting.** Auto-promoting on draft is wrong. Operator promotes via the existing Convert action after actually sending.

## Operator-side state at session end

| Item | Status |
|---|---|
| DKIM 1024-bit | ✅ DNS propagated, activated in Workspace |
| SPF (Google) | ✅ DNS propagated |
| DMARC | ✅ Existing (`p=none` monitoring; tighten to `p=quarantine` after ~1 week clean traffic) |
| Workspace `sending` connection | ✅ `collie@farleycreative.com` |
| Workspace `reading_leads` connection | ✅ `collie@palmfamilyventures.com` |
| Etsy `farley-girls-creative-hub` app | ✅ Approved, connected, full push/sync working |
| Brand kit `brand_book_notes` | ✅ 7,871 chars with case study receipts (PALMFEST, Cinnamon Shore, Palm Social Club, Palm Republic, Sage Em as MANUFACTURER, Port A Local, CrossRef, RK Projects) |
| Composition template | ✅ Versioned, 22 principles |
| Daily DB backups | ✅ Cron firing 04:00 UTC |

## Next session pickup — priority order

### Outbound sales loop completion (Winston: "B comes after we send a few emails using the tool — probably next session")

**B: Follow-up cadence wiring** (~1-2 hr)
- On prospect detail page: "Enroll in follow-up cadence" action
- Default 2-3 step cadence baked in: D+5 nudge, D+12 second nudge, D+25 final
- Tie into existing cadence-tick cron (already drafts to Gmail Drafts)
- Track per-prospect: send-detection somehow (Gmail watch API OR manual mark-sent)

### Winston-actionable today / tomorrow

- **Send real first-touches** through the new pipeline on actual leads (Mediassociates, Smartsheet, Nexstar Broadcasting). Validate end-to-end: populate roster → pick recipients → draft → send from Gmail. Iterate composition template based on output.
- **Etsy walk with Collie** — use the 6 new Etsy MCP tools for tag-audit work on her 32 listings.
- **DMARC tightening** — after a week of clean DKIM+SPF traffic, change `p=none → p=quarantine`.

### Hub polish / queued

- **Voice picker on cadence step config** (~1 hr) — for when there are multiple voice profiles to choose between (currently 0; Collie's in progress)
- **Convert button carries lead.contacts → prospect_contacts** (~30 min) — currently the roster lives on lead and doesn't transfer on Convert. Operator has to re-enrich after promoting. Should be one-line addition to convert route.
- **Lead detail: prospect_contacts view on converted leads** — once Convert wires the roster carry-over, show the prospect's contact roster on the lead detail too (read-only since lead is converted).

### Lower priority but flagged

- **Hunter.io / email-finder integration** — Winston declined; do not revisit unless he asks
- **Lead-poll cron expansion** — more sources, better filtering of "would never be a fit" leads to reduce triage volume
- **`/clients/[id]` dedicated detail surface** — for when post-sale workflow needs framing distinct from sales pipeline

## How to resume

1. Open `farley-creative-hub` in Claude Code
2. Read this handoff + `Farley Creative Hub/memory/project_farley_creative_hub.md`
3. Outbound is ready to fire — try [`hub.farleycreative.com/pipeline/leads`](https://hub.farleycreative.com/pipeline/leads), pick a fresh lead, run the populate → draft → send flow end-to-end
4. After the first real first-touch is sent, tackle the follow-up cadence wiring (item B)

## Pointers

- **Project memory authoritative:** [`Farley Creative Hub/memory/project_farley_creative_hub.md`](../Farley%20Creative%20Hub/memory/project_farley_creative_hub.md)
- **Workspace memory mirror:** `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md`
- **Composition template:** `composition-templates/job-board-first-touch.md`
- **Site repo:** `~/Projects/workspace/farley-creative-site/`
- **Sage canonical playbook (referenced):** `~/Projects/workspace/sage-em/sage/Sage Em/Strategy/Agency Intro Email Playbook.md`
