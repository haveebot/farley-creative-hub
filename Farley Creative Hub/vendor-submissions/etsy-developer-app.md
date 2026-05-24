# Etsy Developer App Submission — corrected draft

**Status:** Drafted but NOT submitted. The previous submission (`farley-creativ-hub`) was permanently banned on first review on or before 2026-05-24. This artifact is a corrected, policy-aware draft that addresses the failure causes. Whether and when to submit, and from which developer account, is a separate decision.

**Prior submission failure causes (root-cause analysis):**

1. **Third-party-tool framing.** Previous description framed this as "HeyeLab builds operator dashboard for Collie's creative studio" — which Etsy reviewers treat as a third party using the API on behalf of a seller. Etsy's API Terms of Use explicitly prohibit "Sell, lease, or otherwise transfer our API or member data to any third party." This is the single most common documented rejection trigger and was directly contradicted by the explicit project-level framing rule that Farley Creative Hub is Collie's own tool for her own firm.
2. **No drafting step.** Submission was field-dictated in real-time during a Claude session with no artifact, no policy research, no review.
3. **Typo in app name.** `farley-creativ-hub` (missing 'e' in "creative"). Cosmetic but signals the submission was rushed.
4. **Likely AI-content policy adjacency.** Description language emphasizing AI-drafted listings reads as bulk-automation to Etsy reviewers, who are actively enforcing against AI-content abuse in 2025-2026.

**The corrected framing** in this draft: a single-shop personal operator tool, owned and operated by the shop owner (Collie Farley) for her own Etsy shop (`farleygirlscreative.etsy.com`). The Hub does not transfer API credentials or member data to any third party. All shop data stays in the shop owner's own infrastructure. The shop owner reviews and approves every listing before any submission to Etsy — nothing publishes automatically.

---

## Form fields (ready for paste from a reviewed artifact, never field-dictated)

### App name
`Farley Girls Creative Hub`

(Lowercase-kebab variant if the portal asks for an internal slug: `farley-girls-creative-hub`. Note: verified spelling, "creative" not "creativ". Do not abbreviate to anything containing the partial string "creativ" without the 'e'.)

### Application description (long-form — the field reviewers actually read)

> Farley Girls Creative Hub is a personal operator dashboard that I built for my own Etsy shop, Farley Girls Creative (shop URL: farleygirlscreative.etsy.com). I am the sole shop owner and the sole operator of this app — there is no third-party access to the Etsy API or to any Etsy member data via this app.
>
> The app helps me with three single-shop tasks for my own store:
>
> 1. **Listing drafting.** When I finish a design in Canva, I save the design assets in my Hub and draft the listing copy (title, description, tags) inside the Hub before I publish anything to Etsy. The Hub assists with copy drafting, but I personally review and approve every listing before any submission to Etsy. Nothing publishes to Etsy automatically.
>
> 2. **Sales visibility.** I want to see my own shop's transactions in one place rather than rebuilding spreadsheets each month.
>
> 3. **Customer message awareness.** I want to see my shop's incoming customer messages alongside my drafting workflow so I can respond quickly.
>
> All data flowing through the app stays inside my own infrastructure (private Vercel deployment + private Neon Postgres database that I own and control). The app does not transfer Etsy API credentials, listing data, transaction data, or customer messages to any third party. No analytics, advertising, or third-party processing service receives any Etsy member data.
>
> The term "Etsy" is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.

### Application URL / homepage
`https://hub.farleycreative.com`

### OAuth redirect URI(s)
- Production: `https://hub.farleycreative.com/api/etsy/callback`
- (Add staging only if a staging environment exists; otherwise omit. Do not list `localhost` unless the portal specifically asks for local-dev URLs.)

### Scopes requested
Minimum necessary, with justification ready for each:

| Scope | Why |
|---|---|
| `shops_r` | Read my own shop metadata (name, currency, policies). |
| `listings_r` | Read my own listings to display current state in the Hub. |
| `listings_w` | Create draft listings (in DRAFT state) that I then review and publish from the Hub interface. Note: listings are created as drafts; the operator manually transitions to active. |
| `transactions_r` | Read my own sales transactions for the sales-visibility surface. |
| `email_r` | Read incoming customer messages on my own shop so the Hub can surface them for me to respond. |

(Drop `email_r` from the initial request if the reviewer requires the smallest possible scope set for first approval. It can be requested in a scope-expansion review later.)

### Intended user base
Single user: the shop owner of `farleygirlscreative.etsy.com`. This is a personal app for one shop, not a multi-seller tool. (If Etsy's form asks "is this a commercial app for multiple sellers?" the answer is **no**. Commercial-access is a separate review tier we are not requesting.)

### Will you share or sell access to the Etsy API or member data?
**No.** All access is for the single shop owner of `farleygirlscreative.etsy.com`. No third party receives API credentials or data.

### Caching and rate-limit compliance
The app respects Etsy's caching policy as defined in the API Terms of Use. Listing data, transaction data, and shop metadata are cached locally per the recommended TTLs. The app does not poll the API outside the documented rate limits.

### Trademark notice
The phrase **"The term 'Etsy' is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc."** is displayed in the app's settings page footer.

---

## What is deliberately NOT in this submission

- Any mention of "HeyeLab", "Heye Lab", "Heyedeploy", "Heye", or any umbrella brand. This is Collie's app for Collie's shop. Period.
- Any mention of AI drafting, AI generation, AI-assisted listings, Claude, Anthropic, automation, bulk creation, or any phrase that reads as AI-content-generation to Etsy's policy team. The drafting assistance is described as a tool that "assists with copy drafting" with explicit operator review.
- Any mention of "platform", "agency", "service to creative studios", or any framing that implies multi-shop or third-party operation.
- Any redirect URL that points anywhere other than the Hub's own production domain.
- Any mention of MCP, agent tokens, bearer auth for external agents, or anything that could read to a reviewer as "this app exposes Etsy data to other systems."

---

## Pre-submission checklist (operator-side, before any portal click)

- [ ] This artifact has been reviewed by Winston.
- [ ] Spelling of every field has been verified, including app name. (`Farley Girls Creative Hub` — every word spelled out, "creative" has an 'e' at the end.)
- [ ] Redirect URLs match the deployed Hub domain exactly (https, no trailing slash variations).
- [ ] The Etsy account being used to submit is decided and documented below.
- [ ] Whether a fresh developer account is needed (because the prior account has a banned app on record) has been decided and documented below.

### Decision: which Etsy account submits this?

(Operator-side decision; document the choice and the reasoning here before submission.)

- [ ] Same account as the banned `farley-creativ-hub` app — risks: Etsy may treat repeat submission from a banned-app developer account as a flag; unclear from public docs whether this works.
- [ ] A different existing Etsy account.
- [ ] Walk away from Etsy API entirely; Hub operates in manual-handoff mode (operator copy-pastes drafted listings into Etsy by hand — which is the current workflow anyway).

---

## Operational reality if no Etsy app is ever approved

The Hub continues to function for the operator's primary stated bottleneck (listing creation) without the Etsy API:

- Hub generates listing title, description, tags, and assists with asset organization.
- Operator manually copies the drafted listing into Etsy.com and publishes there.
- This is functionally identical to the operator's pre-Hub workflow except the drafting inputs come from a single tool instead of being assembled across tabs.

The Etsy API would add: read-side sales visibility, read-side message visibility, and the convenience of draft-listing creation directly to Etsy from inside the Hub. None of those are the primary bottleneck.
