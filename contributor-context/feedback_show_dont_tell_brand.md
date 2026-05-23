---
name: Show don't tell — earned brand positioning is never declared on the site
description: Cross-project rule. Brand-thesis claims that depend on customer perception (category-defining, "Kleenex of X," "best-in-class," "the leader in") never appear in customer-facing copy. Earned positioning is shown / proven / adopted, not stated. Internal compass lives in foundation docs only.
type: feedback
originSessionId: 1a473af3-23c0-4e2e-8e09-dbc81993d1dd
---
**Rule:** Brand-thesis claims that depend on the customer's perception of the brand — "Kleenex of cable bus," "category-defining," "best-in-class," "the leader in X," "industry-standard" — never appear in customer-facing copy. The brand earns those labels through what it makes, how it operates, and how customers come to talk about it. Stating them on the site signals you haven't earned them yet.

**Why:** Locked 2026-05-06 by Winston during HeyeWay site scaffold review. The HeyeWay homepage initially included a "Kleenex thesis ribbon" rendering Nick's "It's not a tissue. It's a Kleenex" quote with attribution. Winston: *"we dont need the kleenex comment on the home page - that is something that is proven, shown and adopted not said."* The Kleenex framing is HeyeWay's internal strategic compass — it informs every brand decision — but it does not get articulated on the site.

**How to apply:**

| Where the thesis goes | Where it doesn't |
|---|---|
| Internal foundation docs (`memory/heyeway-foundation.md`) | Public website |
| Strategy briefs and decision logs | Marketing collateral |
| Founder-team Slack / internal docs | Customer-facing emails |
| Constants in `data/foundation.ts` marked `_INTERNAL` | Pillar / hero / about copy |

**The test:** "Could a customer or competitor look at this and say *they're claiming to be X they haven't earned yet*?" — if yes, strip it. The site demonstrates the thesis through:

- The product (one product, executed with discipline)
- The voice (focused, plain-spoken, technical)
- The differentiation pillars (Texas-built · Sole focus · Decade-plus expertise — all earned, all provable)
- The refusal (no adjacent products, no breadth, no "we also make...")

**Don't:**
- Render brand-thesis declarations like "the Kleenex of [category]" on public surfaces
- Use "best-in-class" / "industry-leading" / "category-defining" in customer copy
- Quote the founder making category-domination claims
- Use the thesis as a marketing tagline or hero ribbon

**Do:**
- Keep the thesis as the internal compass that drives product, brand, and refusal decisions
- Mark internal-only constants with `_INTERNAL` suffix or explicit `// INTERNAL ONLY — never rendered` comments
- Let customers articulate the brand status in their own words (testimonials, RFP language, "we spec'd the HeyeWay")

**Cross-project applicability:**

This rule applies to every Heye Lab tenant. Specific examples:
- **HeyeWay**: no "Kleenex of cable bus" on heyeway.com
- **Sage Em**: no "leading rep firm" / "best-in-class" claims on sageem.co
- **PAL**: no "the definitive Port Aransas guide" on theportalocal.com (already enforced via PAL voice rules)
- **CrossRef**: no "the cross-reference standard" on crossref.app

If a brand wants to claim category leadership, the route is to BE the category leader and let the customers say it. Until then, the thesis is internal.

**Companion memories:**
- `feedback_pal_email_signature.md` — entity-only voice (similar discipline applied to email)
- `feedback_pal_no_names_on_website.md` — strict surface-rendering rule (similar mechanic)
- `project_heyeway.md` — HeyeWay-specific application

**Codified as cross-tenant pattern:** `~/Projects/workspace/heyedeploy/components/RepDeploy/06-brand-discipline.md` — operational application of this rule across Sage Em + HeyeWay (filed 2026-05-07).
