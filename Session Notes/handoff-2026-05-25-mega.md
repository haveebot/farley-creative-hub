# Session handoff — 2026-05-25 (mega session, ran through 2026-05-26 early AM)

**Fourth session, and the biggest yet.** Started as a standard orient (DB backups + Etsy keystring activation) and grew into: full agency website build from scratch, DNS cutover to farleycreative.com, voice profiles as a first-class entity, lead parser bug fix + backfill, and 14 Hub commits + 13 site repo commits across the day.

## Arc of the session

1. **Arnold + DB backups** — daily encrypted Postgres dumps to Vercel Blob with AES-256-GCM, 30d-daily + 12mo-monthly retention, operator runbook. Closes the 7d+ Neon PITR window.
2. **Etsy activation** — keys to Vercel, OAuth callback URL registered, Collie connected. Discovered Etsy v3 needs `keystring:shared_secret` in `x-api-key` (not just keystring); shipped fix + admin backfill of shop_id.
3. **Etsy push/upload/sync** — full A+B+C build per audit doc. Listings push → Etsy draft + image upload, sync existing Etsy → Hub. 21 files / 1,814 LOC in one commit.
4. **Farley Creative Hub web traffic dashboard** — Vercel Analytics tracker on site + Hub API fetcher + `WebTrafficCard` on home alongside `VoiceCard`.
5. **farleycreative.com Phase 0 audit + Phase 1 site build** — separate repo `farley-creative-site` (Next.js 16 + Tailwind 4 + Vercel). Brand-kit-driven scaffold → real photography integration → 5 case studies → packages page → contact form wired to Hub leads. Cutover DNS Canva → Vercel mid-session.
6. **Voice profiles as first-class entity** — separate from brand kits. AI extraction from real writing samples. 7 MCP tools. Wired through draftWithClaude + cadence-tick.
7. **Listings → Etsy nav rename** — surface-only, no URL change.
8. **Lead parser bug fix** — parser never extracted `source_url`; every lead missing the link to its posting. Fixed + backfilled 33 of 75 existing leads via regex extraction from `raw_content`.

## Hub commit chain (14 commits)

| Commit | What |
|---|---|
| `9bb78c4` | feat: daily DB backups — encrypted dumps to Vercel Blob |
| `a190f1a` | feat: Etsy push + image upload + sync — listings become a real tool |
| `e6adaaa` | docs: farleycreative.com Phase 0 audit |
| `782f355` | feat: admin endpoint to backfill etsy shop metadata |
| `06d1d2e` | fix: admin refresh-shop also accepts agent_token bearer auth |
| `eb611d6` | **fix: x-api-key header uses keystring:shared_secret format** (Etsy v3 requirement) |
| `34e6ddd` | feat: web traffic dashboard card on Hub home |
| `184a0e0` | feat: first-class voice profiles + AI extraction from existing writing |
| `97b6fb9` | feat: wire voice profiles into draft generation + cadence-tick + seed action |
| `63d5be8` | feat: voice MCP tools + Hub home voice readiness card |
| `ecc12b8` | feat: prominent source posting + paste-to-enrich on lead detail |
| `20b07f7` | **fix: lead parser extracts source_url for digest + single-source items** |
| (+ Listings → Etsy nav rename inside `184a0e0`) | |

## farley-creative-site commit chain (13 commits — NEW REPO this session)

| Commit | What |
|---|---|
| `8d32a4f` | feat: phase 1 scaffold — Next.js 16 + Tailwind 4 + brand tokens |
| `d7a40c0` | feat: restructure home per Collie's IA notes (2026-05-25) |
| `03ed432` | feat: 5 case studies + contact form wired to Hub leads + process page |
| `15766c0` | polish: real logo in nav + footer, mobile drawer, scroll-reveal motion, SEO |
| `e3482ce` | fix: hero uses CSS-only fade-in (not IntersectionObserver-blocked Reveal) |
| `dc3eadf` | feat: integrate Collie's About copy + full /packages page with tiered pricing |
| `aa41b68` | feat: 3 PFV case studies translated from founder voice → agency voice |
| `616c2d4` | feat: visit-live-site link on case studies with deployed brands |
| `258c55f` | feat: /experience page — RK + Cinnamon Shore + product design + brand engagements |
| `b783d35` | polish: live-site indicators on /work index + home Selected Work cards |
| `20e19c3` | feat: real photography on case studies + experience — scraped from current site |
| `79d6a6f` | docs: persistent next-actions log (DKIM + Vercel access + content gaps) |
| `b1902ef` | feat: vercel analytics + speed insights tracking |

## Hub state — what's now live

### Etsy integration — complete end-to-end
- ✅ Collie's account OAuth-connected (`shop_id=64827767, shop_name=FarleyGirlsCreative`)
- ✅ x-api-key bug fixed (was using just keystring; Etsy v3 needs `keystring:shared_secret`)
- ✅ Shop metadata backfilled via `/api/etsy/admin/refresh-shop`
- ✅ Listings: push to Etsy as draft + image upload + sync existing
- ✅ Per-listing fields: price, qty, taxonomy (type-ahead search), shipping profile, who/when made
- ✅ Schema: `listings.etsy_*` columns + `listing_images` + `etsy_taxonomy_cache`

### Voice profiles — first-class feature
- ✅ `voice_profiles` table separate from brand kits — name + description + voice_notes + writing_samples + always_say + never_say + audience_persona + is_default
- ✅ `drafts.voice_profile_id` FK (overrides brand kit voice when set)
- ✅ `/voice` index + `/voice/new` (3 modes: paste samples / from Hub / blank) + `/voice/[id]` edit
- ✅ AI extractor analyzes samples → returns voice_notes, always_say, never_say, audience_persona, pattern_summary
- ✅ `gatherExistingWriting()` pulls real Hub content (drafts + Etsy listings + pipeline notes) for analysis
- ✅ `/api/voice-profiles/seed-from-brand-kit` — 1-click migration from existing studio kit voice
- ✅ Wired through `draftWithClaude` (voice overrides brand kit voice fields when set; falls back to default voice profile)
- ✅ Cadence cron uses default voice profile automatically
- ✅ 7 MCP tools: list / get / get_default / create / update / delete / generate
- ✅ Hub home `VoiceCard` showing default voice + sample strength indicator

### Lead parser — bug fix + backfill
- ✅ Parser now extracts `source_url` for both single-lead and digest items
- ✅ Lead-poll cron passes URL through (was hardcoded `null`)
- ✅ Backfilled 33 of 75 existing leads via regex extraction from `raw_content`
- ✅ Lead detail page: prominent "Open full posting ↗" button at the top
- ✅ Paste-to-enrich flow on leads with thin content (< 600 chars)
- ✅ `/api/leads/[id]/enrich` re-parses pasted body + backfills only-empty structured fields (preserves operator edits)

### Hub nav (after rename)
`Hub · Brand · Voice · Assets · Drafts · Etsy · Pipeline · Settings · Sign out` — 9 items, getting crowded. Dropdown restructure flagged as next-session candidate.

### Hub home (after additions)
Greeting → Daily Briefing → 3 cards (drafts/leads/prospects) → Activity feed → **VoiceCard + WebTrafficCard** (2-col grid, new this session) → Pipeline Funnel → Recent Assets

### Daily DB backups — operational
- Cron: `0 4 * * *` (daily 04:00 UTC = 11pm CT)
- Encrypted with `BACKUP_ENCRYPTION_KEY` (AES-256-GCM)
- Uploaded to Vercel Blob at `backups/{schema}/YYYY-MM-DD.sql.gz.enc`
- Retention: keep all from last 30d + earliest-of-month last 12mo
- Restore runbook: [`Farley Creative Hub/operator-runbooks/db-restore.md`](../Farley%20Creative%20Hub/operator-runbooks/db-restore.md)

### Web traffic dashboard
- Vercel Analytics tracker installed on farley-creative-site
- Hub `WebTrafficCard` queries Vercel API for views/visitors/top-paths/top-referrers
- 3 new Vercel env vars on Hub project: `VERCEL_API_TOKEN` (sensitive), `FARLEY_SITE_PROJECT_ID`, `VERCEL_TEAM_ID`
- Period switcher (24h / 7d / 30d), "Open full Vercel Analytics →" link

## farley-creative-site state — what's now live at farleycreative.com

### Pages live
- `/` — Hero · Meet Collie · Selected work (5 cards) · Logo strip · Packages summary · Pull quote · Contact CTA
- `/about` — full About copy from Collie's "About Us" asset
- `/work` — 5 case study cards with live indicators
- `/work/[slug]` — Port A Local · Palm Social Club · The Palm Republic · PALMFEST · Sage Em (all with real content + hero images + galleries)
- `/packages` — Brand & Marketing (4 tiers) + Social Media (4 tiers) with full deliverables and prices
- `/experience` — RK Projects PA · Cinnamon Shore · Wrangler/JD/Stetson · Gully's Landing/Downtown Grub/Texas Culture Co
- `/how-we-execute` — 6 operating principles + In-house vs Partnership card
- `/contact` — form with name/email/company/interest picker/message → POSTs to Hub `/api/contact` → creates lead in Hub
- `/privacy` already existed
- `/not-found` — brand-system 404

### Real photography integrated
- 13 hero/gallery images live in `public/work/` and `public/experience/` (16 MB)
- 153 source images downloaded to `portfolio-source/` (gitignored, 67 MB raw)
- Port A Local: coastal sunset aerial · Palm Social: brand pack + cocktails + interiors · Palm Republic: laptop e-commerce + mobile site + branded t-shirt + retail interior · PALMFEST: stage at sunset + aerial PALMFEST letters · RK: kitchen mockup · Cinnamon Shore: community aerial

### DNS cutover — complete
- Apex `farleycreative.com` → Vercel `76.76.21.21`
- www subdomain → Vercel `76.76.21.21`
- MX records untouched (Workspace email continuous)
- SSL provisioned (Let's Encrypt via Vercel)
- Old Canva site no longer reachable at the apex
- DKIM record at `google._domainkey` flagged as next action

### Vercel Analytics
- `@vercel/analytics` + `@vercel/speed-insights` installed in layout
- Tracking fires on page views immediately
- Data accrues as visitors land

### Brand assets in repo
- `public/brand/` — farleycreative-yellow-round.png · -straight.png · -stacked.png · -bw-banner.png

## Collie's access — fully wired

| Surface | Status |
|---|---|
| GitHub `haveebot/farley-creative-hub` write | ✅ Already had |
| GitHub `haveebot/farley-creative-site` write | ✅ Accepted invite |
| Vercel team `haveebots-projects` | ✅ Already member as `collie.breah@gmail.com` |
| Hub agent token (Etsy + Workspace + voice tools via MCP) | ✅ |
| Etsy OAuth connected | ✅ |

## Memory rules locked this session

None new this session — many cross-project rules already exist and were referenced (see workspace memory). The big architectural decision worth noting:

- **Voice as first-class entity, not buried in brand kit** — when voice quality is the #1 lever on AI output, it shouldn't be a single textarea inside a multi-field kit form. Voice profiles get their own table, own routes, own MCP tools, own Hub home card. Brand kits can still have voice notes (kept for backward compatibility), but voice profiles take precedence when wired into draftWithClaude.

## Next session pickup — priority order

### Operator (Winston) action items

- [ ] **DKIM for `google._domainkey.farleycreative.com`** — generate in Google Workspace admin, paste into registrar DNS as TXT record. 5 min. Improves outbound email deliverability when Collie sends client mail.
- [ ] **Confirm Collie's Vercel access** to `farley-creative-site` project visually (she should already see it as `collie.breah@gmail.com`)

### Hub — voice expansion

- [ ] **Voice picker dropdown** in `/drafts/new` UI — let operator pick non-default voice when creating drafts via web UI
- [ ] **Voice picker** in `/listings/new` UI — Etsy listings might want a different voice from outreach
- [ ] **Brand kit page** could show a "Create voice profile from this kit" CTA (parallel seed flow for client kits)
- [ ] **Empty-state-voice-from-Hub** could pre-fetch sample counts before clicking, so operator knows "8 drafts + 12 Etsy listings + 5 pipeline notes ready for analysis"
- [ ] **Multiple voice profiles for different contexts** — surface "Use this voice for…" hints

### Hub — leads quality of life

- [ ] **`/api/leads/admin/backfill-source-urls`** as a permanent endpoint (current backfill ran once locally; future leads should be covered by the parser fix but this gives a recovery option)
- [ ] **Lead detail summary card** — show all key fields at top instead of requiring scroll
- [ ] **Click-to-paste shortcut** — if operator opens the source URL, ideally one-click paste back

### Hub — nav restructure (flagged)

Current nav has 9 items. Dropdown restructure proposal:
```
Hub  ·  Studio ▾  ·  Make ▾  ·  Sell ▾  ·  Settings  ·  Sign out
        ├ Brand     ├ Drafts    ├ Pipeline
        ├ Voice     ├ Etsy      └ Cadences
        └ Assets
```

### farley-creative-site — Phase 2 polish

- [ ] **Real client logo marks** for "Who we've worked with" strip — placeholder text right now (PSL, PSC, etc.). Need white-version PNGs.
- [ ] **3 PFV case study content** review by Collie (Palm Social, Palm Republic, PALMFEST — currently translated from current Canva site, needs her validation)
- [ ] **Sage Em case study hero image** — currently text-only
- [ ] **Cinnamon Shore additional gallery item** — Google Ads banners collage downloaded but not yet wired
- [ ] **Package tier deliverable wording review** by Collie

### farley-creative-site — Phase 2 build

- [ ] **`/journal` editorial surface** (Phase 3 per audit) — when Collie wants to publish
- [ ] **Annual prepay discount** option for monthly Social Media tiers
- [ ] **À la carte add-ons table** at bottom of `/packages`

### Etsy integration polish

- [ ] **Per-listing voice override** when she has multiple voice profiles
- [ ] **Auto-publish from /listings** (currently pushes as draft; she manually publishes on Etsy) — risky, parking
- [ ] **Push images to existing pushed listing** — currently re-uploads pending images, could expand to "replace all images"

## How to resume

1. Open `farley-creative-hub` in Claude Code
2. Read this handoff + `Farley Creative Hub/memory/project_farley_creative_hub.md`
3. Check Vercel Crons dashboard for last night's DB backup (should be green by ~midnight CT)
4. Check Web Traffic card on Hub home for accumulated farleycreative.com analytics

## Pointers

- **Project memory authoritative:** [`Farley Creative Hub/memory/project_farley_creative_hub.md`](../Farley%20Creative%20Hub/memory/project_farley_creative_hub.md)
- **Workspace memory mirror:** `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md`
- **Site repo:** `~/Projects/workspace/farley-creative-site/`
- **Site next-actions:** [`farley-creative-site/docs/next-actions.md`](https://github.com/haveebot/farley-creative-site/blob/main/docs/next-actions.md)
- **Vendor submissions:** `Farley Creative Hub/vendor-submissions/`
- **Operator runbooks:** `Farley Creative Hub/operator-runbooks/`
- **Website audit:** `Farley Creative Hub/website-audit/farleycreative-com-phase-0.md`
