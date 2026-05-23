---
name: Deploy phase naming — Pre / In / Post, never bare "Deploy"
description: Brand-discipline rule. The HeyeDeploy lifecycle has three phases — PreDeploy, InDeploy, PostDeploy. Never use bare "Deploy" as a phase name; that name is reserved for the umbrella framework + vertical-specific products (HeyeDeploy, MarketingDeploy, CityDeploy, ArchiveDeploy, etc.). Phase names always carry a temporal prefix.
type: feedback
originSessionId: pal-2026-05-07
---

**Cross-project brand-discipline rule. Locked 2026-05-07 PM during Collie's first canonical design-contributor onboarding to PAL.**

The Heye Lab brand hierarchy uses "Deploy" exclusively for two layers:

1. **HeyeDeploy** — the umbrella framework / operating model
2. **`<Vertical>Deploy`** — vertical-specific SaaS products (MarketingDeploy, CityDeploy, ArchiveDeploy, BrandDeploy, RepDeploy, EventDeploy, BuildDeploy, RealtyDeploy, OnboardDeploy, etc.)

The lifecycle / phase layer **must not collide with either**. Phases get a temporal prefix:

- **PreDeploy** — pre-flight (accounts, tools, identity, machine prep)
- **InDeploy** — the launch ritual itself (the "going live" moment)
- **PostDeploy** — operating, tier graduation, ongoing PR flow

Never use bare "Deploy" alone for a phase, sub-component, or section heading where the umbrella context is ambiguous. Examples of violations:

- ❌ "Today we'll do the Deploy" → ✅ "Today we'll do InDeploy"
- ❌ "Pre-Deploy phase" → ✅ "PreDeploy phase" (one word, capital P, capital D — matches HeyeDeploy convention)
- ❌ "Section 2 — Deploy" in a playbook → ✅ "Section 2 — InDeploy"
- ❌ "We're in the Deploy phase" → ✅ "We're in InDeploy"

## Why the rule exists

Without the discipline, "Deploy" overloads at every level:

- "Are we doing Deploy today?" — meaning the framework, the product, or the launch?
- "Tenant Deploy" — is that the launch ritual or the whole service offering?
- "Schedule the Deploy" — refers to which thing?

With the discipline, each layer is unambiguous:

- "HeyeDeploy" = framework
- "MarketingDeploy" = vertical product
- "InDeploy" = launch phase
- "Bron's InDeploy is Tuesday" = unambiguous

## Productized as a service

PreDeploy is brandable + billable on its own:

- For design contributors joining a tenant: PreDeploy is part of onboarding (free)
- For tenant deployments (Bron's, Sandfest, future): PreDeploy is a scoped engagement with deliverable artifacts ("Cleared for InDeploy" sign-off)
- The asymmetric value lives in PreDeploy — done right, InDeploy is 30 min and ~2 commands; done wrong, InDeploy is hours of debugging

Same model for InDeploy + PostDeploy — each phase is a discrete service with measurable bars.

## Extension pattern

If additional phases are ever needed, they follow the same temporal-prefix discipline:

- **ReDeploy** — repeat customer onboarding (revisit / refresh)
- **CoDeploy** — co-developed (operator + customer building together)
- **MultiDeploy** — multi-tenant simultaneous launch
- **UnDeploy** — sunset / wind-down

In every case: prefix + Deploy. Never bare Deploy.

## Empirical anchor

Locked the naming during Collie Farley's first canonical design-contributor onboarding to PAL on 2026-05-07. Empirical InDeploy floor measured: **2 terminal commands + 2 Mac password entries**, ~30 min including auth flows, end-to-end PR-to-prod in <3 minutes. Architecture validated; naming discipline locked alongside.

## How to apply (Claude session behavior)

When drafting docs, README files, brand surfaces, or operator playbooks for any Heye Lab project:

1. If a phase or sub-component name needs to reference the Deploy lifecycle, use **PreDeploy / InDeploy / PostDeploy** — never bare "Deploy"
2. If unsure whether a usage collides, default to the temporal-prefix form
3. If a customer or contributor uses bare "Deploy" in conversation, mirror back the temporal-prefix form ("InDeploy day Tuesday — locked")
4. CamelCase consistent with HeyeDeploy: `PreDeploy`, not `Pre-Deploy` or `pre-deploy` (filenames may use kebab — `pre-deploy.md` — but the in-text brand string is single-word camel-case)

## Pairs with

- `feedback_heyedeploy_pattern_thinking.md` — the framework hierarchy (HeyeDeploy → vertical-Deploys → tenant)
- `feedback_heyelab_brand_spelling.md` — HeyeLab one-word for marketing, Heye Lab two-word for legal (sibling brand-discipline rule)
- `feedback_agent_driven_contributor_autonomy.md` — the model that PreDeploy / InDeploy / PostDeploy operates within

## Filed: 2026-05-07 PM

After the lifecycle naming locked at the kitchen table during Collie's launch — Winston's call to "never have a sequence that is just deploy."
