# CLAUDE.md — farley-creative-hub

This file auto-loads when a Claude session opens the farley-creative-hub repo. It points the session at the right context for whoever is sitting at the keyboard.

## What this repo is

**Farley Creative Hub** is the operator-tier dashboard for **Farley Girls Creative** — Collie Farley's creative studio. The Hub runs the firm end-to-end: Etsy template store operations, client work (brand identity, web, marketing), asset management, prospecting, scheduling, and revenue tracking. One Wheelhouse, all the firm's verticals.

Phase 1 lands the foundation plus the Etsy submission bridge — Collie's most-named bottleneck. Subsequent phases light up clients/accounts, marketing scheduler, outbound, and dashboard analytics.

Live at `hub.farleycreative.com` (planned).

## If you are the operator (Collie)

Open the Hub. Brand identity setup lives inside the platform — no config files to touch. If you're reading this file you're already in the code; the operator surface is the deployed Hub itself.

## If you are a design / brand / copy contributor

Your first stop is [`contributor-context/`](contributor-context/). Read `contributor-context/README.md` first — it orients you on what's in scope, how PRs auto-merge, the brand system, and cross-project HeyeLab rules.

## If you are operator-tier (Winston / Heye Lab)

The standing project memory lives at:
`Farley Creative Hub/memory/project_farley_creative_hub.md` (authoritative)
mirrored to: `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/project_farley_creative_hub.md`

Latest session truck: `Session Notes/handoff-<date>.md` — read the newest first.

Phase 1 spec: `Farley Creative Hub/PHASE_1_SPEC.md`

## Repo conventions

- **Branch protection** (once GitHub setup is finalized): status checks (Vercel build) required, code-owner review on protected paths per `.github/CODEOWNERS`. Auto-merge enabled per PR.
- **Free-merge surfaces** (cosmetic / brand / copy): `src/app/*.tsx`, `src/app/globals.css`, `src/data/**`, `public/**`, docs, content
- **Operator-protected paths**: `src/app/api/`, `src/middleware.ts`, `src/app/admin/`, `src/lib/auth/**`, build/deps config
- **Commit convention**: lowercase imperative subject. `feat:`, `fix:`, `chore:`, `copy:`, `polish:` all fine.
- **Author**: commits should be authored as `haveebot <haveebot@gmail.com>` for Vercel build-author parity (same as PAL / brons-beach / sage-em repos)

## Architecture notes

- **No hardcoded brand strings.** Studio name, display label, voice notes, social handles, colors — all flow from the brand-identity surface inside the Hub. Pre-setup state shows sensible defaults.
- **Tenant-specific config in env vars + config files.** Never inline.
- **Modular API integrations** (Etsy, Pinterest, Canva). Each lives in its own package under `src/lib/integrations/<name>/`.
- **Magic-link auth** (HMAC-signed tokens, HeyeDeploy pattern). See `src/lib/auth/` once built.

## Cross-references

- HeyeLab framework: `~/Projects/workspace/heyedeploy/` (private)
- Wheelhouse pattern reference: `~/Projects/workspace/port-a-local/` (PAL — canonical Wheelhouse)
- Repo-structure reference: `~/Projects/workspace/brons-beach/` (latest Heye Lab tenant pattern)
- Client-management pattern reference: `~/Projects/workspace/sage-em-dashboard/` (Sage HQ — agencies pattern)
- Workspace memory canonical: `~/.claude/projects/-Users-winstoncaraker-Projects-workspace/memory/`
