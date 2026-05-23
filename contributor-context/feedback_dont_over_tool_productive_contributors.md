---
name: Default to NO when adding tools to a productive contributor's stack
description: HARD CROSS-PROJECT RULE. When evaluating whether to add a new tool to a contributor's or operator's toolkit, the default answer is NO unless all three conditions are met — they explicitly asked, there's a current pain point the tool solves, and the marginal value clearly beats tooling sprawl + learning curve + cost. Productive workflow without the tool is the strongest signal against adding it.
type: feedback
originSessionId: 1aa76c0b-3b97-43f4-bdc1-75a87f0e4229
---
**HARD CROSS-PROJECT RULE.** Locked 2026-05-11 PM after evaluating Figma for Collie.

## The rule

For ANY tool-addition decision (new SaaS, new IDE feature, new MCP server, new workflow step) on a contributor's or operator's stack, the default answer is **NO** unless ALL three conditions are met:

1. **They've explicitly asked for it** — no operator-pushed tools onto a productive contributor
2. **There's a current pain point the tool would solve** — not a hypothetical future scenario
3. **The marginal value clearly beats** tooling sprawl + learning curve + cost + drift risk

If any of those is missing, default to NO. Productive workflow is sacred — don't introduce friction looking for hypothetical wins.

## Why

- Heye Lab contributors and operators are non-engineers using a tight stack (Claude + GitHub + Vercel for Collie; Claude + Bash for Winston). Each new tool adds learning curve, context-switching cost, and another potential source of drift between systems.
- The `feedback_if_winston_cant_no_customer_can.md` bar applies: if a tool isn't strictly necessary to ship the actual work, it's just complexity.
- Inertia to REMOVE a tool once added is high. Adding it later when a real condition emerges is cheap.
- The HeyeDeploy ethos is **automate, don't tool-pile** — adding parallel surfaces (Figma alongside code) usually creates drift, not productivity.

## Pattern that triggered the rule

**2026-05-11 PM, Winston asked:** "Should we add Figma to Collie's toolkit?"

**Observed about Collie's actual workflow:**
- 5 PRs in 7 hours her PAL launch day
- 4 branded photos + 3 Firefly illustrations + line caricature shipped into Bron's last weekend
- `theportalocal.com/brand` page authored directly in code, not Figma-translated
- Never asked for Figma in any session

**Decision: NO, don't add Figma.**

**Revisit conditions:**
- She explicitly asks for it
- Multi-frame visual iteration scales beyond code branches (e.g. BrandDeploy tenants like Palm Republic with 10+ logo variations to compare)
- A second designer joins Heye Lab (Figma's collab features earn their cost then)
- Non-engineer stakeholder review surface needed (sharing with Bron, future tenants who can't read a Vercel preview link)
- She starts iterating on vector assets (SVG icons, OG card art) where Figma's vector tooling beats hand-coding

Winston confirmed: *"10-4 agreed."*

## How to apply

When a "should we add X tool?" question comes up:

1. **Default position: NO**
2. **Inventory the person's actual workflow** — what do they ship, how fast, with what existing tools? A productive workflow is a strong NO signal.
3. **List the three conditions explicitly** and map them to current pain points
4. **If conditions aren't met, recommend skipping** with a clear "when would change my mind" list
5. **Don't sell the tool. Don't generate enthusiasm.** Be the honest reviewer.

## What this rule is NOT

- Not "never add tools" — when conditions ARE met, add eagerly
- Not "tools are bad" — Heye Lab's stack itself is a deliberate tool set
- Not applicable to operator-side automation tools (those serve a different goal — eliminating Terminal friction per `feedback_terminal_aversion.md`)
- Not anti-experimentation — exploring a tool's value (like asking "what would this look like?") is healthy. Adding it to someone's daily stack is the bar.

## Pairs with

- `feedback_if_winston_cant_no_customer_can.md` — if a non-engineer can't navigate it, it's not the right add for non-engineers
- `feedback_terminal_aversion.md` — automate aggressively; the same principle applies to tooling — don't pile manual surfaces on contributors
- `feedback_consumer_ux_for_non_tech_operators.md` — the value bar is "does this make their work easier or harder"
- `feedback_best_practice_default.md` — when there's no preference, default to best-practice; in tool-add questions, best-practice IS "skip unless conditions met"
- `feedback_winston_autonomy.md` — give the recommendation; don't stage A-vs-B menus on tool-add questions
- `feedback_surface_full_option_space.md` — DOES apply when committing to a paid sub or vendor lock-in; for the inverse case (NOT adding), this rule resolves cleanly

## Locked 2026-05-11 PM

After the Figma-for-Collie evaluation. Productive workflows are sacred — default to NO on tool additions.
