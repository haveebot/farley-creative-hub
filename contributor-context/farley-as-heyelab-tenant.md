# Farley as a HeyeLab tenant — the bridge doc

A short orientation doc for contributors who've worked on PAL, Brons, or other HeyeLab tenants: what makes Farley its own thing, and where framework discipline still applies.

## Farley is its OWN brand

**Farley Girls Creative** is the studio brand (Collie's Etsy shop, design firm identity, client-facing voice). **Farley Creative Hub** is the operator-tier internal dashboard at `hub.farleycreative.com` that runs the firm.

The Hub is operator-only. Customers / clients of Farley Girls Creative don't see the Hub. They see her Etsy listings, her marketing posts, her client deliverables — all branded as Farley Girls Creative.

This is locked at the framework level. Same posture as Brons (where customers see Bron's, not the HeyeLab tools running underneath).

## Different from PAL / Brons in one important way

**Farley is operator-built, operator-operated.** Heye Lab builds the Hub. Collie runs it for her own creative studio. There's no revenue-share or principal arrangement the way Brons has (HeyeLab 12% on transactions) — Collie's studio is her business, the Hub is her tool.

Translation for contributors: this is closer to a "we built it for her" arrangement than a "we run it with revenue share" arrangement. Same code discipline applies; different business shape.

## What carries from PAL / HeyeLab framework

Even though Farley brand is its own, framework-level discipline applies:

- **HeyeLab brand spelling** when the umbrella is referenced (footer credit, legal). One-word `HeyeLab` for marketing; two-word `Heye Lab` for legal. See `feedback_heyelab_brand_spelling.md`.
- **Pre / In / Post Deploy lifecycle naming** when describing the launch process. See `feedback_deploy_phase_naming.md`.
- **Consumer-app feel for non-tech operators** — this rule is CORE here. The Hub IS the operator surface and Collie IS the non-tech operator. Tile launchers, hide-dev-metadata, time-aware greetings, etc. See `feedback_consumer_ux_for_non_tech_operators.md`.
- **Show don't tell** — earned brand positioning is never declared on the site. Applies if Farley Girls Creative content lives anywhere customer-facing. See `feedback_show_dont_tell_brand.md`.
- **Substance flag before grammar** — when the Hub assembles a draft email, SMS, or listing for operator review, check substance against latest context BEFORE polishing. See `feedback_substance_flag_before_grammar.md`.
- **Beta-tenant self-framing** — never reference "FirmDeploy" or "product we're selling later" in Farley-facing surfaces. Operator builds for herself. See `feedback_beta_tenant_self_framing.md`.
- **Don't over-tool a productive contributor** — Collie's design workflow already works. The Hub adds operator surfaces around her workflow, not replacements for it. See `feedback_dont_over_tool_productive_contributors.md`.

## Where Farley sits in the HeyeDeploy framework

The 4-layer hierarchy (locked 2026-05-01):

```
HeyeDeploy (framework + customer-facing brand action)
   ├─ Patterns          — code shapes
   ├─ Components        — bundled capabilities (<X>Deploy)
   ├─ Vertical-Deploys  — SaaS shells per customer class
   └─ Tenants           — concrete deployments
```

Farley is a **Tenant** at the leaf. Working name for the future vertical-Deploy it'd anchor: **FirmDeploy** (creative-services firm operating system). That naming + vertical-extraction is held privately, not surfaced in this repo or to Collie — see `feedback_beta_tenant_self_framing.md`.

## Operator-tier context (skim only — Winston-side)

| Question | Answer |
|---|---|
| Who's the operator? | Collie Farley (`collie.breah@gmail.com`) |
| Who's the principal? | Heye Lab built it; Collie owns her studio. No revenue share (different from Brons). |
| Where's the domain? | `farleycreative.com` registered through Canva; Hub on `hub.farleycreative.com` subdomain via CNAME inside Canva's DNS UI |
| Etsy shop | `farleygirlscreative.etsy.com` |
| Canva tier | Pro (no Connect API; we route around per Phase 1 spec) |
| Current volume | 4 Etsy sales total (analytics deferred until volume justifies) |
| Phase 1 scope | Foundation + Etsy submission bridge. See `Farley Creative Hub/PHASE_1_SPEC.md` |

## Cross-tenant references

- **Wheelhouse pattern canonical:** `port-a-local/` (PAL)
- **Repo structure freshest pattern:** `brons-beach/`
- **Client-management pattern (Phase 2):** `sage-em-dashboard/`
- **Outbound/prospecting pattern (Phase 3):** `sage-em/`
- **HeyeDeploy framework:** `heyedeploy/`
