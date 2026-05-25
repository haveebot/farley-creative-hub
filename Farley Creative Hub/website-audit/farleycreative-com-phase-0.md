# farleycreative.com — Phase 0 Audit

**Date:** 2026-05-25
**Status:** Audit only — no build commitments yet.
**Authoritative source for brand:** the Hub studio brand kit (`brand_kits` table, `is_studio_self=true`).

---

## 1. Scope of this audit

Three questions:

1. **What's currently at `farleycreative.com`?** (Canva-hosted, marketing presence)
2. **What should it become** as a real firm-enterprise web presence?
3. **What's the path** to get there — IA, tech stack, repo, migration sequence?

Out of scope: actually building the new site. That decision (timing + scope of first phase) belongs to a follow-on session once this audit is reviewed.

## 2. Current state

### Hosting + tech
- **Platform:** Canva website builder
- **Domain:** `farleycreative.com` (apex, DNS pointed to Canva)
- **DNS provider:** Canva (per the workspace DNS records we added when verifying the `farleycreative.com` Workspace secondary domain — five records were added in a zero-disruption pass alongside Google MX)

### Content inventory
**Status: needs operator screenshots** — the Canva site renders client-side, so machine-fetching only returns the page title ("Meet Collie"). To complete this section, please drop screenshots of each page on the desktop and I'll do the inventory.

Specifically need:
- [ ] Home / landing page
- [ ] Any sub-pages (services, work, about, contact)
- [ ] Header navigation (what links exist)
- [ ] Footer (contact info, social handles, legal links)
- [ ] Any forms (contact, newsletter, intake)
- [ ] Mobile vs desktop differences (if material)

### Known signals from the brand kit
The kit references the website at `https://farleycreative.com` but provides no specifics about the current structure. The bio + voice notes suggest the current site likely focuses on:
- Collie as founder-operator
- "Bridge between creative and conversion" tagline
- Industries served (hospitality, retail, real estate, lifestyle)

Confidence: low — this is inference, not observation.

## 3. What it should become

Pulled from the studio brand kit. This is what's authoritative for the new site.

### Brand-level positioning
- **Primary tagline:** "Farley Creative bridges the gap between creative and conversion."
- **Short tagline:** "Where creative meets conversion."
- **Pull quote:** "Creating brand identities and storytelling that translates business values into emotional connections is our love language."
- **Long positioning:** A founder-operator marketing and branding agency translating creative vision into scalable systems — connecting brand, space, events, and marketing to drive growth, engagement, and long-term value.

### Who the site is for
Two distinct audiences the site must serve:

1. **Prospective service clients** — founders + leadership teams at hospitality, retail, real estate, lifestyle, nonprofit, events businesses. Looking for brand strategy, visual identity, multi-channel marketing, brand experiences. **Primary audience.** This is where billable client work comes from.
2. **Etsy template buyers** — end consumers shopping farleygirlscreative.etsy.com. Smaller but real revenue stream; the site should at minimum point to the shop.

The site is NOT a portfolio for a freelance designer-for-hire. It's the front door of a small founder-operator agency.

### Voice + tone (canonical)
- Calm yet authoritative — grounded confidence, not performative expertise.
- Direct about trade-offs. Will tell a client what's a bad fit instead of upselling.
- Founder-operator credibility, not consultant-performing-expertise.
- Texas-rooted, refined-but-grounded — "well-styled small-town hospitality brand," not "New York agency."

### Never sound like
No "synergy / leverage / ideate / pivot / circle back / stakeholder / value-add." No startup-pitching-AI framing. No coastal-glossy agency tone.

### Visual identity (canonical)
- **Foundation (90%):** Warm Black (`#1B1410`) text on Cream (`#EFECE2`) background — restrained.
- **Primary accent (CTAs, buttons):** Butter Yellow (`#F0EBA1`) with Warm Black text. This is "the click color."
- **Secondary accent (section headers, brand anchor):** Forest Teal (`#3C5751`).
- **Tertiary accent (soft backgrounds, breaks):** Soft Mint (`#CFE0D4`).
- **Typography:** Montserrat for headings + body. Times New Roman Condensed (italic) for pull quotes + editorial moments.
- **Logo:** lowercase italic serif "farley" + bold sans-serif "creative" set tight as "farleycreative." Stacked variant adds "AGENCY" in small caps.
- **Pattern:** B&W bold vertical stripes (Lilly Pulitzer / vintage market awning vibe). Used as accent, not full background.
- **Imagery:** Photography over illustration. Texas coastal-meets-grandmillennial mood — Port Aransas aerials, Hill Country, beach umbrellas, storefront-with-striped-awning.

## 4. Proposed information architecture

Mapping services + audience to a page structure that serves both prospective clients and Etsy buyers, with the prospective-client funnel as the primary flow.

### Page list (v1)

| Page | URL | Purpose | Primary CTA |
|---|---|---|---|
| Home | `/` | Anchor positioning, surface the work, channel to services or shop | "Start a conversation" / "Browse templates" |
| Services | `/services` | Six offerings from the brand kit, each with its own anchor | "Inquire about [service]" |
| Work | `/work` | Selected case studies — image-led, story-first | "See more" / "Discuss yours" |
| Work case study | `/work/[slug]` | Long-form per project: context → strategy → execution → outcomes | "Start your own" |
| About | `/about` | Collie's founder-operator credibility, journalism foundation, Texas roots | "Start a conversation" |
| Shop | `/shop` or external redirect | Etsy templates — preview grid → links to farleygirlscreative.etsy.com | "Shop on Etsy →" |
| Journal | `/journal` (Phase 2) | Editorial pieces, brand thinking, case-study deep-dives | "Subscribe" |
| Contact | `/contact` | Form + scheduling link | (form submit) |

### Six services to feature (verbatim from brand kit)
1. Brand strategy + visual identity systems
2. Multi-channel marketing (social, paid, content, email, web)
3. Brand experiences across physical + digital environments
4. Event design + execution
5. Retail / hospitality / lifestyle brand development
6. AI + technology integration to scale operations and drive results

Each service gets its own anchor on `/services` with: a one-line definition (calm, direct), 2-3 sentences on approach, optional case-study link, "inquire" CTA that pre-fills the contact form's "interested in" field.

### Navigation
**Primary nav (header):** Work · Services · About · Shop · Contact
**Footer:** contact email · Etsy link · Instagram · Pinterest · legal (privacy, terms) · "© Farley Creative" · stripe motif

### What NOT to include (per "never sound like")
- No "Get a free quote" or other transactional friction-eliminators that read as sales-y.
- No AI-first framing on the home page. AI is a tool that lives inside service descriptions, not a brand position.
- No generic stock photography. Photo-led layouts must use real Collie/client/place imagery.
- No live chat widget. Calm, considered communication — email + scheduling, not real-time pressure.

## 5. Tech stack recommendation

**Match the Hub:** Next.js 16 + React 19 + Tailwind 4 + Vercel hosting + custom domain at apex `farleycreative.com`.

**Why match the Hub:**
- One codebase pattern for operator + Claude to maintain
- Same deploy + env-management muscle memory
- Brand kit can theoretically be read FROM the Hub's MCP server, keeping brand voice + colors in one source of truth (Phase 2 ambition; not required for v1)
- Tailwind 4 + the existing color tokens map cleanly to the brand kit's Warm Black / Cream / Butter Yellow palette
- Vercel deploy + DNS migration we've already done six times in this org

**Content management approach:**
- **Pages (Home, About, Services, Contact):** committed to repo as `.tsx` with copy inline. Edits are PRs. Suits low-frequency change.
- **Work case studies + Journal posts:** MDX files in `content/work/` and `content/journal/`. Frontmatter for metadata. Edits are PRs. Image assets in `public/` or Vercel Blob.
- **No headless CMS for v1.** Adding Sanity / Contentful / Payload introduces operator surface area + cost for a site that ships maybe 1 new case study per quarter. Revisit when content cadence justifies it.

**Forms:**
- Contact form posts to a Hub MCP endpoint (or Resend transactional email) that drops the inquiry into the Hub's `leads` table — same pipeline she already uses. Closes the loop: marketing site → operations Hub.

**Analytics:** Vercel Analytics (already configured for Hub). Optionally Plausible if she wants more depth without GA-style tracking heaviness.

## 6. Repo + migration approach

### New repo

**Recommendation: separate repo, not a folder in the Hub.**

- Name: `farley-creative-site` (or `farleycreative-site` — pick one and stay consistent)
- Visibility: public (matches PAL/heyeway/brons-beach pattern, allows non-owner contributors to push)
- Location: `~/Projects/workspace/farley-creative-site/`
- Vercel project: `farley-creative-site` under `haveebots-projects` scope
- Domain: `farleycreative.com` apex + `www.farleycreative.com` 301 to apex
- GitHub collaborator: invite `colliebreah` (matches Hub access pattern)

### Migration sequence (proposed)

**Phase 0 — this document.** (Done after operator review.)

**Phase 1 — scaffold + home + about + services + contact.** Single-session build (~3-4 hours). Ships a credible v1 of the four highest-traffic pages. Etsy "Shop" link points to Etsy directly. No case studies yet, no journal. Goes live at `staging.farleycreative.com` or a Vercel preview URL — apex stays on Canva until Phase 2.

**Phase 2 — case studies + cutover.** Build the `/work` page + 2-3 case studies with real Collie/client material. DNS cutover from Canva to Vercel. Old Canva URL set to 404 or removed.

**Phase 3 — journal + lead capture polish.** Editorial publishing surface, contact form → Hub leads integration, newsletter signup if she wants one.

### What we need from operator before Phase 1
1. Screenshots of current Canva pages (for honest before/after comparison + to know what existing copy to preserve vs rewrite)
2. 3-5 representative case-study candidates (project names + a 1-line scope per — full content can come later)
3. A preferred contact email for the form to route to (`hello@farleycreative.com`? `collie@farleycreative.com`? Both already exist as Workspace identities.)
4. Any existing brand assets that should be preserved: logos, photography, fonts (the Hub doesn't store the actual Montserrat/Times font files or the logo files themselves)
5. Confirmation on staging strategy: ship to `staging.farleycreative.com` first OR build on Vercel preview URLs until cutover

## 7. Decision points for the next session

When we're ready to start Phase 1, three architectural decisions to lock before code lands:

1. **Repo name** — `farley-creative-site` vs `farleycreative-site` (no strong opinion; pick one)
2. **Contact form destination** — drops into Hub `leads` table via MCP (best long-term, requires Hub MCP route built), OR plain Resend email (simpler, no integration). Recommend Hub-leads route since the integration is small (~15 min) and the loop-closing matters.
3. **Staging strategy** — `staging.farleycreative.com` subdomain (Vercel auto-DNS), OR ephemeral Vercel preview URLs per PR (no DNS work, but URLs are uglier). Recommend staging subdomain — Collie's used to seeing the Hub at `hub.farleycreative.com`, so `staging.farleycreative.com` follows the pattern.

## 8. Open questions / parking lot

- **SEO posture:** is there existing SEO juice on the current Canva site we'd want to preserve via 301 redirects? Requires Google Search Console access to know.
- **Schema markup:** LocalBusiness + Organization JSON-LD should be added at v1 for the Texas-rooted local-search angle.
- **Accessibility:** Phase 1 ships WCAG AA-baseline (semantic HTML, color contrast in palette already checks out — Warm Black on Cream is ~12:1).
- **Press / earned media surface:** if Collie has been written about anywhere (South Jetty, local press, hospitality trades), Phase 2 should include a "Press" or "As seen in" strip on Home.

## 9. Decision needed from Winston

Two paths to choose from:

**A. Fill in the current-state gap, then proceed.** You/Collie screenshot the current Canva pages and drop them on the desktop. I do the full inventory + gap analysis (1 session step, ~20 min). Then we plan Phase 1.

**B. Skip the current-state inventory, proceed to Phase 1 planning.** Brand kit gives us everything we need to design forward. Current site becomes irrelevant the moment Phase 1 ships. Saves a session step.

I'd recommend B — the current site is a known-to-be-thin Canva page; preserving anything from it is unlikely to be high-value vs. starting clean from her thorough brand kit. But A is the more thorough route if you want a side-by-side comparison artifact.
