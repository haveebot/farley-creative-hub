# Phase 1 — Farley Creative Hub

The foundation + Etsy submission bridge. The smallest cut that delivers real value to Collie on day one and sets the architecture for everything that follows.

**Phase 1 success = Collie logs into the Hub at `hub.farleycreative.com`, sees her brand, sees her Etsy sales pulled in live, drops a folder of design assets, gets a pre-populated Etsy listing draft, one-click approves, listing publishes to her shop.**

---

## What ships in Phase 1

### 1. Auth + tenant identity

- Magic-link login (HMAC-signed tokens, no passwords)
- Single-operator surface (Collie). Multi-user comes in a later phase.
- Session persistence ~30 days
- Pattern: same as PAL / Brons / Sage-em

### 2. Hub shell (Wheelhouse base)

- Time-aware greeting ("Good morning, Collie")
- Three primary cards on the home view:
  - **Awaiting You** — listing drafts ready for approval, Etsy customer messages
  - **Today** — Etsy sales today, new reviews, orders shipped
  - **Quick Actions** — start a listing, view drafts, view shop
- Top nav (left): Home · Etsy · Asset Library · Brand · Settings
- Consumer-app feel — no developer metadata visible; per the `consumer_ux_for_non_tech_operators` rule

### 3. Brand identity surface (in-Hub setup)

- First-run wizard prompts: studio name, display label, logo upload, primary colors, voice notes, social handles, Etsy shop URL
- All values stored in the database (not hardcoded)
- Editable anytime under Settings → Brand
- Downstream surfaces (listing copy, email signatures, etc.) read from this surface
- Sensible defaults pre-setup so the Hub is never blank

### 4. Etsy integration (the bridge)

- **Heye Lab registers a Farley-Creative-Hub app with Etsy Developers** (one-time, pre-launch)
- OAuth 2.0 flow inside the Hub — Collie authorizes once, token refreshes automatically
- Etsy MCP server in `src/lib/integrations/etsy/` exposing:
  - `etsy.shop.get` — shop metadata
  - `etsy.listings.list` — paginated listings
  - `etsy.listings.create` — draft listing creation
  - `etsy.listings.update` — edit drafts
  - `etsy.listings.publish` — publish from draft
  - `etsy.transactions.list` — sales
  - `etsy.messages.list` — incoming customer messages
- Reads pull lightly (cache friendly); writes only on explicit approve

### 5. Asset library + listing-draft pipeline

- Asset upload (folder upload or drag-drop into Hub)
- Each "design" object includes: master file, mockup images (already produced by her Claude), PDF deliverable, linkthrough URL, keywords, suggested title/description/tags
- "Awaiting You" surfaces design objects with a "Create listing draft" action
- Listing draft assembled with all fields pre-populated from the design object
- Collie reviews → edits if needed → one-click approve → publishes to Etsy

### 6. Listing copy generator (Claude-powered)

- Title, description, tags generated from design metadata + Collie's brand voice + Etsy keyword data
- Stays draft-state until she approves
- She can re-roll the generator or hand-edit before approve

### 7. Infrastructure

- Vercel deploy
- Postgres (Neon or similar — pattern parity with PAL / Brons)
- Resend for transactional email (magic links, listing-published confirmations)
- DNS: `hub.farleycreative.com` CNAME → Vercel (added inside Canva's DNS settings UI — Collie owns the domain via Canva)

---

## What does NOT ship in Phase 1 (and why)

- **Canva Connect API integration** — her Pro tier doesn't include it; Enterprise upgrade ($20-50K/yr) isn't justified at her current scale. Her existing Desktop folder + Claude flow already produces the assets we need. Revisit when productizing for other tenants.
- **Pinterest auto-pin pipeline** — Phase 3. Distribution multiplier matters more once listings are flowing.
- **Sales / revenue dashboard** — Phase 2. Analytics matter once volume justifies them (currently 4 sales total).
- **Clients / Accounts surface** (Sage HQ pattern) — Phase 2. Solid client-management once design-firm work picks up.
- **Marketing scheduler** (Instagram / Pinterest / email blasts) — Phase 2-3.
- **Outbound / prospecting** (Sage Em pattern) — Phase 3.
- **Customer message agent** (Claude-drafts replies) — Phase 2 once Etsy message volume justifies it.

---

## Pre-Phase-1 setup (Heye Lab operator side)

These happen before any contributor code is written:

1. **Etsy Developer app registration** — register a public app named "Farley Creative Hub" (or generic "Heye Lab" app that all our tenants share). Get client ID + client secret. Configure OAuth redirect URLs for development + production.
2. **GitHub repo creation** — `haveebot/farley-creative-hub`, public per the Vercel-onboarding rule for contributor access. Done as part of the scaffold.
3. **Vercel project linked to repo** — deploy preview branch + production main. SSO disabled (`ssoProtection: null`) for contributor build access, per the same rule.
4. **Database provisioned** — Postgres on Neon, env wired into Vercel.
5. **Resend account / sending domain configured** — for magic links + transactional email.
6. **DNS for `hub.farleycreative.com`** — Collie adds CNAME → Vercel inside Canva's DNS UI when ready.

---

## Phase 1 architecture notes

- **No hardcoded brand strings** — every name, color, voice note flows from the brand-identity surface. Tenant-extraction-ready from day one.
- **Modular integrations** — each external service (Etsy, Pinterest later, Canva later) lives in its own `src/lib/integrations/<name>/` package. Lift-and-shift ready when a second tenant arrives.
- **Database schema** designed for multi-tenancy at the row level even though Phase 1 is single-tenant — sets up genericization without rewrite.
- **The Hub is the source of truth for brand + assets.** The Desktop folder pattern Collie uses today becomes optional / bookkeeping once the Hub asset uploads are wired.

---

## Sequencing (rough)

1. Scaffold (this turn — repo + foundation)
2. Next.js app init + base routing + Tailwind config
3. Magic-link auth (port from PAL pattern)
4. Database schema + Prisma/Drizzle setup
5. Hub shell UI (3 cards + nav)
6. Brand identity surface (settings + setup wizard)
7. Etsy OAuth flow
8. Etsy MCP server (read paths first: shop, listings, transactions)
9. Asset library upload + design object model
10. Listing draft assembler (Etsy write path)
11. Listing copy generator (Claude integration)
12. End-to-end smoke test with Collie's real Etsy shop
13. Production deploy + DNS cut-over

Each step lands as its own PR; Vercel preview deploys keep state visible.

---

## Out-of-scope flags for future phases

Tracked separately so we don't lose them:

- **Phase 2:** Clients/Accounts surface · Sales dashboard · Customer message agent · Trend feed
- **Phase 3:** Marketing scheduler · Pinterest auto-pin · Outbound/prospecting · Lead intake form
- **Phase 4:** Genericize as FirmDeploy framework template · second-tenant solo-launch test · Canva Connect API integration (if Heye Lab dev account upgraded)
