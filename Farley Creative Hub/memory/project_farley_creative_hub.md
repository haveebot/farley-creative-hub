---
name: Farley Creative Hub — operator-tier dashboard for Farley Girls Creative
description: HeyeLab tenant (Heye Lab built, Collie operated). Multi-vertical creative studio operating system — Etsy store ops, client design work, brand management, marketing scheduling, outbound prospecting, revenue tracking. Phase 1 lands foundation + Etsy submission bridge. Working name for the underlying framework (private): FirmDeploy.
type: project
originSessionId: 2026-05-22-farley-creative-hub-scaffold
---

**This is the authoritative project memory file for Farley Creative Hub.** The mirror lives at `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md` and is synced during dumptruck.

## What this is

A Wheelhouse-style operator dashboard that runs Collie Farley's creative studio (Farley Girls Creative) end-to-end. One Hub, all the firm's verticals: Etsy template store, client brand/design/web/marketing work, asset management, prospecting, scheduling, revenue tracking.

Live at `hub.farleycreative.com` (planned, post-Phase-1 deploy).

## Origin

Brainstormed 2026-05-22 in workspace session. Started as "Etsy backend for Collie" — pivoted same session when Winston reframed: she's not just an Etsy seller, she's building a vertically-integrated creative services firm. The Hub needed to scope to the full firm, not just one revenue stream.

Three earlier sessions had already validated the readiness:
- PAL Wheelhouse pattern (the canonical Collie already uses)
- Sage HQ client-management pattern (agencies.ts + Step-2 seed JSON)
- Brons-beach as the latest Heye Lab tenant repo structural template

## The two-frame discipline

Per [`feedback_beta_tenant_self_framing.md`](../../../../../.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/feedback_beta_tenant_self_framing.md) (locked same session): **Collie builds her perfect platform; we hold the product lens privately.**

- **Her framing:** "I'm building my perfect platform for my creative studio."
- **Our private framing:** "Canonical beta for the FirmDeploy productization."

Never crossed. No FirmDeploy / product-pitch language in the Farley repo, in briefs to her, or in tenant-facing surfaces. Framework thinking stays in heyedeploy + workspace memory.

## Phase 1 scope

Foundation + Etsy submission bridge. See [`PHASE_1_SPEC.md`](PHASE_1_SPEC.md) for the detailed cut. Headline: magic-link auth + Hub shell + brand identity setup + Etsy OAuth + listing-draft pipeline + one-click approve → published listing.

Phase 1 success: Collie logs into `hub.farleycreative.com`, sees her brand, drops a folder of design assets, gets a pre-populated Etsy listing draft, one-click approves, listing publishes to her shop.

## Stack

Same as PAL / Brons / Sage-em — Next.js 16.2.1, React 19.2.4, Tailwind 4.2.2, TypeScript 6, Vercel hosting, Resend transactional email, magic-link HMAC auth.

## Domain + DNS

- Domain: `farleycreative.com` (registered through Canva by Collie)
- Phase 1 subdomain: `hub.farleycreative.com` → Vercel
- DNS managed inside Canva's DNS settings UI (verified 2026-05-22 — Canva-registered domains support arbitrary CNAME records)
- No domain migration needed

## Canva integration posture (Phase 1)

**Route around, don't integrate directly.** Collie is on Canva Pro; Connect API requires Enterprise ($20-50K/yr) which doesn't pencil at her stage. Her Claude already creates assets to her Desktop via her current setup — the Hub picks up from there.

Phase 4 productization plan: build FirmDeploy as a PUBLIC Canva integration on a Heye Lab developer account. Public integrations don't require tenant-side Enterprise upgrades. That's a future decision.

## Etsy integration

- Heye Lab registers a public Etsy app pre-Phase-1
- Tenant (Collie) OAuth-authorizes once during setup
- MCP server exposes shop, listings, transactions, messages
- Reads on cache; writes only on explicit approve

## The Hub as source of truth

Brand identity, asset library, listing drafts, client kits, sales data — all live in the Hub database. Desktop folders, Canva files, Etsy dashboard become consumable surfaces, not authorities.

## Architecture for future extraction

Even though Phase 1 is single-tenant, code is structured for future genericization without rewrite:

- No hardcoded brand strings — everything flows from the brand-identity surface
- Modular integrations under `src/lib/integrations/<name>/`
- Database schema multi-tenant at row level
- Tenant-specific config in env vars + config files

Second-tenant extraction (later, with a different creative firm) becomes mechanical, not a rewrite.

## Repo + GitHub

- Repo: `haveebot/farley-creative-hub` (public per Vercel-onboarding-for-contributors rule)
- Author: `haveebot <haveebot@gmail.com>` for Vercel build-author parity
- Branch protection: status checks + code-owner review on protected paths
- Free-merge surfaces: cosmetic/brand/copy (cards, content, public assets)
- Protected paths: API routes, middleware, admin, auth lib, build/deps config

## Cross-references

- **Wheelhouse pattern canonical:** `~/Projects/workspace/port-a-local/` (PAL)
- **Repo structure freshest pattern:** `~/Projects/workspace/brons-beach/`
- **Client-management pattern (Phase 2 source):** `~/Projects/workspace/sage-em-dashboard/`
- **Outbound pattern (Phase 3 source):** `~/Projects/workspace/sage-em/`
- **Framework (private):** `~/Projects/workspace/heyedeploy/`
- **Workspace memory:** `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/`

## Open items / decisions held

- Display name: defaults to "Farley Creative Hub" pre-setup; Collie sets actual label in first-run wizard
- Studio brand name in customer-facing surfaces: "Farley Girls Creative" (her Etsy brand)
- Heye Lab dev-side Canva upgrade: Winston deciding separately
- FirmDeploy framework name: working title, may rename

## Session notes index

(none yet — first scaffold session is 2026-05-22)
