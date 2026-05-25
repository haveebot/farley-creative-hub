# Demo Hub vs FC Hub — what's the same, what's different

Two deployments, one codebase. They look almost identical because they ARE almost identical — same UI, same features, same APIs. The differences are isolated to a few specific layers.

## The two surfaces

| | Real FC Hub | Demo Hub |
|---|---|---|
| URL | `hub.farleycreative.com` | `fcdemohub.com` |
| Vercel project | `farley-creative-hub` | `farley-creative-hub-demo` |
| Database | Production Neon | Separate Neon DB (`neon-almond-crystal`) |
| GitHub repo | `haveebot/farley-creative-hub` | Same repo (shared codebase) |
| Who uses it | Collie, operating her firm | Prospects, clients, anyone with the link |

## What's different — the one env flag that flips everything

A single environment variable, `DEMO_MODE=true`, is set on the demo deployment and NOT set on the real Hub. That one flag changes four behaviors:

### Behavior 1 — Auth
- **Real Hub:** every page requires a session cookie. Unauthenticated visitors redirect to `/login`.
- **Demo Hub:** middleware bypasses auth entirely. Public access, no login.

### Behavior 2 — Writes
- **Real Hub:** every mutating API call (`POST` / `PATCH` / `PUT` / `DELETE`) hits its normal handler. Data changes.
- **Demo Hub:** the same middleware returns `403 demo-read-only` for any mutation. Reads work fully; writes never persist.

### Behavior 3 — Banner
- **Real Hub:** the `<DemoBanner>` component renders `null`. Invisible.
- **Demo Hub:** the same component renders a coral bar at the top of every page: "DEMO HUB — This is a live working preview of the Farley Creative operating system. Everything you see is realistic sample content. Changes don't persist."

### Behavior 4 — Cron
- **Real Hub:** `/api/cron/cadence-tick` actually drafts via Claude + creates Gmail drafts. `/api/cron/lead-poll` actually polls Collie's PFV inbox.
- **Demo Hub:** both cron endpoints exist but no-op meaningfully — no Workspace OAuth means no Gmail to draft to / poll from.

That's it. No other code path differs. The Hub IS the demo. The demo IS the Hub.

## What's different — the data

The two databases have completely different content:

| Table | Real Hub content | Demo Hub content |
|---|---|---|
| `brand_kits` | Farley Girls Creative studio kit (real bio, real voice, real samples) | "Farley Creative Demo Studio" — fictional but credible, with deep voice notes |
| `prospects` | Collie's actual prospects (live pipeline) | 9 fictional prospects across all stages: Indigo Books (signed), The Ginger People (negotiating), Lavender Lane Florals (discovery), Bayou Bistro (passed), etc. |
| `leads` | Real auto-imported job postings from her PFV inbox via cron | 8 fictional leads showing the kind of work she'd source |
| `cadences` | Cadences she's built; some with real enrollments | 2 pre-seeded cadences with Morning Bird Inc. enrolled and a drafted email sitting in `drafted` state |
| `listings` | Her real Etsy listing preps | 3 sample listings: botanical wedding suite (approved), holiday card set (draft), Italian villa bridal (posted) |
| `workspace_connections` | Real OAuth tokens for `collie@farleycreative.com` (sending) + `collie@palmfamilyventures.com` (reading_leads) | None |
| `hub_preferences.hub_label` | "Farley Creative Hub" | "Farley Creative Demo Hub" |

## How the SAME information becomes DIFFERENT experiences

This is the part that makes the demo a credible sales tool — it's not a "fake version" of the Hub, it's the SAME product running on different data:

- **Daily Briefing.** Same component pulls signals (drafts awaiting review, new leads, gone-cold prospects) and synthesizes a Claude-written paragraph. On the real Hub it reads Collie's actual state. On the demo it reads the fictional state. A visitor sees the briefing write something insightful about Indigo Books and Green Valley Special Utility District — proving the briefing isn't a static asset but a working AI synthesis.

- **Pipeline funnel.** Same horizontal-bar chart on Hub home. Real Hub: Collie's actual funnel shape. Demo: 1 signed, 1 negotiating, 1 in proposal, 2 in discovery, 1 contacted, 2 leads — a deliberately varied funnel so the chart actually has something to show.

- **Cadence builder.** Same UI for creating a cadence with steps. Real Hub: Collie builds outreach for actual companies. Demo: visitors see 2 fully-built cadences they can click through (read-only). If they try to edit, the write-block triggers + they see the demo posture.

- **Listing prep workflow.** Same Claude-drafting flow producing structured Etsy copy. Real Hub: Collie preps real listings she'll post. Demo: 3 sample listings show what the output looks like + the operator's editing surface.

- **Recent Gmail exchange on prospect detail.** On the real Hub this section queries Collie's actual Gmail via Workspace OAuth. On the demo there's no Workspace connection so the section just doesn't render — gracefully degraded.

The proof point: a visitor at `fcdemohub.com/pipeline/<id>` is looking at the exact same code path Collie sees at `hub.farleycreative.com/pipeline/<id>`. The only difference is whose data fills the page.

## Why this architecture (vs alternatives)

The choice we made: **same codebase, separate deployments, separate databases.**

Alternatives we considered and rejected:

- **Same deployment with `/demo` URL paths.** Would have commingled real and fake data in one DB; complicates auth (some routes need login, others don't); demo data risks leaking into production queries.

- **Two completely separate codebases.** Would mean every Hub improvement requires manual porting to the demo. Demo drifts out of date the moment a feature ships. Operational disaster as features compound.

- **Multi-tenant from day one (tenant_id column on every row).** Right architecture eventually, huge refactor today, blocks shipping value. Defer until productization actually multiplies the tenant count.

Our choice keeps the demo automatically reflecting the current product (every push to `main` redeploys both), keeps the data fully isolated, and seeds the path to proper multi-tenancy when FirmDeploy productizes.

## What this means operationally

- **Ship a Hub improvement → demo updates automatically.** No porting, no drift.
- **Seed the demo with fresh content anytime.** `npm run seed-demo` (with the `.env.demo` file) wipes + reseeds. Demo can be regenerated in 30 seconds whenever.
- **Real Hub data never touches the demo.** Two separate Neon instances; impossible for Collie's actual prospects to appear on the demo.
- **Demo can never accidentally send an email or post to Etsy or modify her Gmail.** No OAuth tokens, no API keys for sending services — even if the write-block had a bug, there's nothing for the demo to write TO.

## Future evolutions

- **Per-prospect personalized demos** (Phase 2): `fcdemohub.com/p/[slug]` URLs that overlay prospect-specific seed content. Same underlying demo Hub, different sample data per slug. Generated from the real FC Hub with a "create demo for [prospect]" action.
- **Engagement signal back to FC Hub:** "Demo viewed N times, /pipeline/[id] most-visited" surfaces in Collie's daily briefing so she sees who's looking.
- **Custom-branded demo per industry:** beyond per-prospect, maybe per-vertical demos (one tuned for retail prospects, one for health/wellness, etc.). Same architecture, more seed scripts.
