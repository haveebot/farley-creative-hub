---
name: Consumer-app feel for non-technical operators (Collie-style)
description: When building internal tools for non-engineer collaborators, default to consumer-app design patterns — tile launchers, breadcrumbs, hidden dev metadata, time-aware greetings, generous whitespace
type: feedback
originSessionId: 3b7f6e28-aac8-437a-a841-cb95a18623ae
---
**When building internal operator tools for non-technical collaborators (Collie-style users), default to consumer-app design patterns over dev-console patterns.** The tools should feel like Apple/Google consumer apps, not admin dashboards.

**Why:** Validated 2026-05-01 PAL session. Marketing Hub redesign + breadcrumb + Details toggle was for Collie's daily use. Winston: "wow this is insane - she is absolutely blown away." Single biggest perceived-value jump in PAL's operator tooling came from UX polish, not new features. Reframing existing surfaces in consumer-app idiom unlocked Collie's confidence in operating the system independently.

**How to apply (the playbook):**

1. **Time-aware greeting using the auth cookie/session identity.** "Good morning, Collie 👋" reads as a real product saying hello, not a system saying "Logged in as: collie." Use `Intl.DateTimeFormat` for time-of-day in the user's timezone. Capitalize the name.

2. **Tile-based home/launcher screen.** Big tappable cards with icon + title + live count + sublabel. Hover lifts. Right-arrow that slides on hover. Mirror Apple/Google home-screen feeling. PAL example: `/wheelhouse/marketing` — 4 big tiles for Social/Bank/Glossary/Ask Gully.

3. **Persistent breadcrumb header on every nested page.** "🏠 Home › 📊 Section › 📱 Tool › 📚 Sub-tool" with each segment clickable. One tap home from any depth — not a single back-arrow that dumps to top-level. Sticky on scroll. Built as reusable component (`MarketingBreadcrumb` in PAL).

4. **Hide dev metadata by default behind a "▸ Show details" toggle.** Internal IDs, ref strings, trigger types, mono-font codes — these are dev affordances. They're useful for engineers but visual noise for non-tech operators. Show only the human-meaningful labels (position pill, channel, caption, action buttons). Toggle reveals everything for engineering use.

5. **Friendly copy.** Operator-talking-to-operator tone, not system-messaging tone. "What's queued up" beats "Pending review." "Look these over and fire when ready" beats "Auto-triggered drafts. Edit caption if needed → Send / Skip."

6. **At-a-glance live badge row.** A horizontal strip of tiny pills with current state numbers (`🔥 3 pending · 📤 5 sent today · 📚 12 in bank`). Operator scans in 1 second, knows where to focus.

7. **Quick-action row above the tiles.** 3 chunky icon buttons for the most common ops (Upload · Compose · What's hot). Reduces "where do I click" hunt.

8. **Generous whitespace + emoji.** Internal tools don't need to follow customer-facing brand rules around emoji restraint. Friendly emoji throughout (🏠📊📱📚📖🔍🔥📤✏️) is a major contributor to consumer-app feel. Per `feedback_pal_brand_system.md`, emoji are LOCKED-restricted only in customer-facing contexts; internal tooling has free range.

9. **Coral/emerald/navy semantic palette consistently.**
   - **Coral** = primary action, "needs attention," promote-to-top
   - **Emerald** = success, completed, "all clear"
   - **Navy** = neutral, structural, info
   - **Sand** = surfaces, backgrounds

10. **Single primary action per surface.** One coral SEND button, everything else muted/secondary. Don't make the operator pick from 8 equally-styled buttons.

**Do NOT:**
- Show internal IDs, foreign keys, or trigger_type strings without a Details toggle
- Use back-arrows that go to top-level — always breadcrumb to scoped home
- Use "system-messaging" copy ("Click Send to publish post" — write "Hit Send when you're ready" instead)
- Cram 10+ buttons of equal weight; create hierarchy
- Skip the greeting / personalization on the home screen — it's "free" warmth that compounds across sessions

**HeyeDeploy template:** This pattern is canonically PAL-validated 2026-05-01 and should be the default for any Heye Lab tenant's collaborator-facing tooling. Add to `feedback_heyedeploy_pattern_thinking.md` template list.
