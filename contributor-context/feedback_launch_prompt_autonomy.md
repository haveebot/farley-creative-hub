---
name: Launch prompts for non-engineer contributors must be autonomous-by-default
description: HARD CROSS-PROJECT RULE. Contributor / operator launch prompts (the text pasted into Claude during onboarding) must instruct Claude to PROCEED through the technical chain autonomously — install, auth, clone, read context, open the first PR — only stopping for human-judgment inputs (bio, design decisions). NEVER include "wait for me to confirm each step worked" language; that paralyzes non-engineer contributors who don't know how to confirm technical steps.
type: feedback
originSessionId: 1aa76c0b-3b97-43f4-bdc1-75a87f0e4229
---
**HARD CROSS-PROJECT RULE.** Locked 2026-05-11 after Collie's brons-beach launch stalled on Claude asking her for technical confirmation between every step.

## Origin

The PAL canonical launch prompt (carried forward verbatim into Bron's) ended with:

```
Take it one step at a time. Wait for me to confirm each step worked
before moving to the next.
```

For an engineer, this is fine — they can verify "did git clone work? yes." For a designer / brand / copy contributor, this is the worst possible UX:

- Claude pauses after every technical step
- The contributor doesn't know what "confirm it worked" means at a technical level
- She has to ask follow-up questions OR guess yes/no
- Cognitive overhead skyrockets
- Time-to-first-PR balloons

Winston flagged in real-time during Collie's brons-beach launch: *"it asks her way too many times to confirm the next technical step — she has to ask too many questions on technical config."*

## The rule

For ANY contributor or operator launch prompt (the text the human pastes into Claude on their Mac):

**Claude must proceed through the technical chain autonomously, only stopping for human-judgment inputs.**

**Technical chain (autonomous-by-default — no confirmation between steps):**
- Install tools (Homebrew, gh, node, etc.)
- Authenticate (gh auth login, claude login)
- Clone repo
- Read contributor-context / orientation docs
- Open first PR
- Enable auto-merge

**Human-judgment-required stops (legitimate to pause):**
- Bio / personal copy for CONTRIBUTORS.md
- Design decisions (placement, color, copy choice)
- Anything that requires the human's PERSON, not just technical verification

## The replacement language

**Instead of:**
> Take it one step at a time. Wait for me to confirm each step worked before moving to the next.

**Use:**
> Run the technical chain autonomously — install, auth, clone, read contributor-context, open the first PR, enable auto-merge — in one go. Don't pause to ask me "did this step work?" between technical steps. Only stop when you need MY input as a person — my bio, design decisions, anything that needs my judgment rather than your verification.

## How to apply

- ALL launch prompts (Bron's · PAL · heyedeploy · future tenants · operator-tier CrewDeploy launches) must use the autonomous-by-default pattern.
- When drafting a new launch prompt, audit the closing instruction. If it says "wait for confirmation between steps" or anything similar, REWRITE.
- For non-engineer contributors specifically (designers, brand-keepers, copy editors), this rule is non-negotiable — they cannot meaningfully "confirm" technical steps and confirmation-asks create paralysis.
- If Claude DOES need to ask the human something mid-chain (e.g. an interactive auth flow that requires a browser-tab click), the ask should be specific and actionable — "open the GitHub auth tab in Safari and approve the device login" — not "tell me when you've done step 2."

## Pairs with

- `feedback_consumer_ux_for_non_tech_operators.md` — same family: don't make non-tech people parse dev metadata
- `feedback_if_winston_cant_no_customer_can.md` — same family: the bar is download → drag → sign in → done
- `feedback_terminal_aversion.md` — automate aggressively, don't hand off CLI commands
- `feedback_winston_autonomy.md` — bias toward autonomy, not less
- `feedback_best_practice_default.md` — when there's no preference, default to the best path; don't stage menus

## Locked 2026-05-11

Origin: Collie's brons-beach launch (her second HeyeLab tenant onboarding). Claude asking for technical confirmation between every step. Winston flagged in real-time. Fix landed same session — brons-beach launch wrapper updated, PAL launch wrapper followed, memory rule filed, contributor-context mirrors refreshed.
