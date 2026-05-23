---
name: Substance flag before grammar pass on customer outbound
description: When reviewing operator-drafted customer-facing outbound (SMS, email), always check substance against latest conversation context BEFORE the grammar / optimization pass. Polished mistakes ship as polished mistakes.
type: feedback
originSessionId: 41980cdf-3bc9-4b3f-8d67-4d3068b084c9
---
When the operator asks "review and optimize" on a customer-facing outbound (SMS, email, DM), ALWAYS pull the latest customer message(s) and check substance against context BEFORE doing the grammar/optimization pass.

**Why:** Grammar polish on a substantively wrong message ships a polished mistake. During the PAL canonical Cabana customer recovery (2026-05-09, 8-SMS arc over 48 min), this discipline saved at least two ship-the-wrong-thing moments:

1. Operator's "we will dispatch him" draft was responding to her uid 119 message but missed her uid 120 ("Nvm we're coming down there") that arrived 1 minute later. Substance flag prevented redispatching the crew when the customer had self-reversed. The operator's reply when shown the flag: "shit." The flag worked.
2. Operator's "What is your preference?" closer didn't address her "I want a refund" demand. Substance flag named the strategic call (push-through vs. acknowledge) so the call was intentional rather than implicit.

**How to apply:**

1. Pull the latest customer message(s) — read what they actually said, INCLUDING any updates that may have arrived after the operator started drafting
2. Check the operator draft against:
   - Does it answer what they asked?
   - Does it address any escalation language (refund, complaint, contradiction)?
   - Does it conflict with anything we said earlier in the thread?
   - Has the customer's state changed since the draft was started?
3. **Surface substance flags BEFORE the grammar pass.** Name strategic calls explicitly so the operator can confirm intent before language is ever polished. Format: brief flag + the option space + which path the draft is currently on.
4. After the operator confirms substance, then do grammar / optimization.
5. After substance + grammar are both locked, ship.

**Pairs with:**
- `feedback_email_recipient_verify.md` — recipient verify pre-send. Same family of pre-flight checks.
- `feedback_verify_before_declare.md` — read the actual sources before answering. Same impulse: don't extrapolate when you can verify.
- `feedback_customer_recovery_patterns.md` — the substance flags during recovery scenarios should reference the four patterns there.

**Filed 2026-05-09 after PAL canonical Cabana customer recovery** — eight-SMS arc where this discipline directly prevented a contradictory re-dispatch and made a strategic refund-handling decision explicit. Worth treating as a hard rule for any operator-facing outbound review.
