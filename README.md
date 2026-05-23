# Farley Creative Hub

The operator-tier hub for **Farley Girls Creative** — a creative studio running an Etsy template store, design-for-clients work, and (over time) brand identity, web design, marketing campaigns, and business development for clients.

Live at `hub.farleycreative.com` (planned).

## What this is

A single Wheelhouse-style operator dashboard that runs the firm end-to-end:

- **Awaiting You** — cross-vertical queue: client messages, Etsy customer questions, contract approvals, design reviews, listing approvals
- **Today** — sales, new leads, scheduled posts going live, invoices paid
- **Clients / Accounts** — active engagements, status, next-up, deliverables pending
- **Pipeline / Leads** — prospects, sent proposals, follow-ups due
- **Asset Library** — brand kits per client, master templates, Etsy products, design archive
- **Etsy Store** — listing creation, sales, customer messages
- **Marketing / Scheduler** — Instagram, Pinterest, FB, email blasts for the studio AND its clients
- **Outbound / Prospecting** — new business outreach, email cascade, follow-ups
- **Revenue / Stats** — billable hours, retainer MRR, Etsy revenue, forecast
- **Brand System** — the studio's brand assets + the client kits it manages

## Phase 1 scope

Foundation + Etsy submission bridge. See [`Farley Creative Hub/PHASE_1_SPEC.md`](Farley%20Creative%20Hub/PHASE_1_SPEC.md).

## If you're sitting at the keyboard

- **Operator (Collie):** open the Hub at `hub.farleycreative.com` (once deployed). Brand setup lives inside the Hub — no config files to touch.
- **Code contributor:** start with [`contributor-context/README.md`](contributor-context/README.md).
- **Operator-tier (Winston / Heye Lab):** memory canonical at `Farley Creative Hub/memory/project_farley_creative_hub.md`. Session truck at `Session Notes/handoff-<date>.md`.

## Stack

Next.js 16 · React 19 · Tailwind 4 · TypeScript · Vercel · magic-link auth (HeyeDeploy pattern).
