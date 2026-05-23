# Contributor context — farley-creative-hub

A curated subset of HeyeLab cross-project rules + Farley-specific docs that Claude on a contributor's Mac auto-loads when the farley-creative-hub repo is opened. Lives here so contributors get consistent design / brand / voice context without needing access to the full operator-tier memory vault.

Mirrors the canonical PAL pattern at `port-a-local/Port A Local/Memory/contributor-context/` and the brons-beach implementation at `brons-beach/contributor-context/`. This is the third tenant to implement the pattern.

## What this repo is in one paragraph

**Farley Creative Hub** is the operator-tier dashboard for **Farley Girls Creative** — Collie Farley's creative studio. The Hub runs the firm end-to-end: Etsy template store ops, client design work (brand identity, web, marketing), asset management, prospecting, scheduling, revenue tracking. Phase 1 lands the foundation + Etsy submission bridge — Collie's most-named bottleneck. Subsequent phases light up clients/accounts, scheduler, outbound, dashboard analytics.

## What's in here

### Farley-specific docs

| File | What it covers |
|---|---|
| [`farley-as-heyelab-tenant.md`](farley-as-heyelab-tenant.md) | Tenant bridge doc — how Farley fits in the HeyeDeploy framework, what's Farley brand vs HeyeLab framework |

### Cross-project rules (mirrored from workspace memory)

| File | Why a Farley contributor needs it |
|---|---|
| `feedback_heyelab_brand_spelling.md` | HeyeLab one-word for marketing / wordmark; Heye Lab two-word for legal / official |
| `feedback_heyedeploy_collie_validation.md` | HeyeDeploy brand tokens (Collie-validated 2026-05-04) — applies anywhere a HeyeLab umbrella reference appears |
| `feedback_deploy_phase_naming.md` | Pre / In / Post Deploy lifecycle naming discipline |
| `feedback_consumer_ux_for_non_tech_operators.md` | UX principle — tile launchers, hide-dev-metadata, consumer-app feel (the Hub IS the operator surface; this rule is core) |
| `feedback_show_dont_tell_brand.md` | Earned brand positioning is never declared on the site (no "Kleenex of X" claims on customer surfaces) |
| `feedback_substance_flag_before_grammar.md` | When reviewing operator-drafted SMS / email passing through the Hub, check substance against latest context BEFORE the grammar pass |
| `feedback_launch_prompt_autonomy.md` | Launch prompts must let Claude run the full technical chain autonomously |
| `feedback_beta_tenant_self_framing.md` | **Locked 2026-05-22 during this repo's brainstorm.** Tenant frame: "my perfect platform"; our private frame: "canonical beta for product." Never cross — input degrades the moment they pre-filter through imagined other users. **Direct application** to this tenant. |
| `feedback_dont_over_tool_productive_contributors.md` | Default to NO when adding tools. The operator (Collie) is productive on a tight stack — don't pile on. |

## How your work is captured

Same pattern as Brons / PAL — no separate truck or end-of-session ritual:

- **Your PR description IS your handoff brief.** Write it like an operator truck: what shipped, why, what's next, what to watch.
- **Cross-Heye productivity is auto-aggregated** via `~/Projects/workspace/scripts/contributor_activity.py`.
- **Pattern-promotion is operator-driven** — when you ship something framework-relevant, the operator catches it in the activity scan and promotes to `heyedeploy/patterns/`.

## Maintenance

These are **curated mirrors** of files in the operator-tier workspace memory. The canonical versions update over time (rarely — these rules are stable once locked).

**To refresh:** Winston (or anyone with workspace-memory access) re-copies updated files into this directory periodically.

**To add a new design-relevant memory:** copy from workspace memory into this directory + commit. The contributor's Claude will auto-load on next session.

## Contribution back

If you (or your Claude) discover a new pattern, design observation, or convention while working on Farley, add a note in this directory under `contributor-insights/<slug>.md`. These get reviewed during PR review and promoted to HeyeDeploy framework when patterns emerge.

Spoke→hub contribution path. Every spoke contributes back. Mandatory, not optional.
