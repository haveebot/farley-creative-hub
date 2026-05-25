/**
 * Cadence templates — pre-built starter cadences the operator can
 * clone instead of building from scratch. Templates live in code (not
 * the DB) so they're versionable and reusable across tenants.
 *
 * Each template defines a sequence of steps with timing + a draft
 * prompt. Cloning creates real cadence + cadence_steps rows that the
 * operator can then edit freely.
 *
 * Prompts are written for Claude — they're the SEED instruction for
 * how the email at each step should sound. Claude has the brand voice
 * + prospect context as cached system blocks; these prompts add the
 * step-specific intent.
 */

export type CadenceTemplate = {
  id: string;
  name: string;
  description: string;
  /** Why this cadence exists / when to use it. Shown in the template gallery. */
  use_case: string;
  steps: Array<{
    delay_days: number;
    delay_hours: number;
    draft_prompt: string;
    subject_template?: string;
  }>;
};

export const CADENCE_TEMPLATES: CadenceTemplate[] = [
  {
    id: "intro-3-touch",
    name: "New-prospect 3-touch intro",
    description:
      "First-touch outreach to a cold prospect, then two follow-ups before backing off.",
    use_case:
      "Use when enrolling a fresh lead you've decided is worth pursuing. Ten-day arc from intro to soft breakup. Claude writes each step in your brand voice with the prospect's context.",
    steps: [
      {
        delay_days: 0,
        delay_hours: 0,
        draft_prompt:
          "First-touch cold outreach. Brief introduction of who the studio is and what we do. Reference something specific about this prospect — their work, their industry, or a relevant context cue from the notes. Soft ask for a 15-minute intro conversation. Warm but not over-familiar. Three short paragraphs max. End with a clear single ask.",
      },
      {
        delay_days: 3,
        delay_hours: 0,
        draft_prompt:
          "Follow-up after no reply to the first touch. Don't re-pitch the same thing — come at it from a different angle. Maybe mention a specific recent project we did that's relevant to their world, or ask a sharper question that invites a one-line reply. Keep it short — under 80 words. Avoid 'just checking in' and 'bumping this up' phrasing.",
      },
      {
        delay_days: 4,
        delay_hours: 0,
        draft_prompt:
          "Soft breakup note after no reply to the first two touches. Acknowledge the silence without guilt-tripping. Make it easy for them to come back later if timing changes — keep the door open. Two short paragraphs. End with the studio's contact line and let them know this is the last from us on this thread.",
      },
    ],
  },
  {
    id: "post-discovery",
    name: "Post-discovery follow-up",
    description:
      "After a first conversation. Recap, next steps, then a check-in if they go quiet.",
    use_case:
      "Use after a discovery call or first substantive conversation. Reinforces the value of the call, opens a proposal path, and reels them back in if they go silent.",
    steps: [
      {
        delay_days: 0,
        delay_hours: 2,
        draft_prompt:
          "Recap email sent within hours of a discovery call. Summarize the three most important things we heard from them about their goals and constraints. Confirm the next step we agreed on (or propose one if it wasn't clear). Warm, specific, no fluff. Show that we were listening.",
      },
      {
        delay_days: 4,
        delay_hours: 0,
        draft_prompt:
          "Check-in if they haven't responded to the recap. Restate the proposed next step in one sentence. Ask one specific question that's easier to answer than 'are you ready to move forward' — something like 'is the timing in your earlier note still right?' or 'is the budget range we discussed still where you're thinking?' Keep it under 60 words.",
      },
      {
        delay_days: 7,
        delay_hours: 0,
        draft_prompt:
          "Light final nudge. Don't push for a yes; offer to put the conversation on pause and reach back out in a quarter. Genuinely give them an out. The goal is to leave the relationship warm whether or not this becomes work right now.",
      },
    ],
  },
  {
    id: "long-form-nurture",
    name: "Long-form 5-step nurture",
    description:
      "Sixty-day arc for interested-but-not-ready prospects. Mix of touchpoints + value shares.",
    use_case:
      "Use when a prospect has expressed interest but the timing isn't right. Stays in their orbit without nagging — quarterly cadence ish. Mix of relationship-building + soft value shares.",
    steps: [
      {
        delay_days: 0,
        delay_hours: 0,
        draft_prompt:
          "Opening note after their initial interest. Thank them for the conversation, confirm we'll keep in touch lightly, and mention that we'll share something useful in about a week. No ask. Just set expectations and disappear gracefully.",
      },
      {
        delay_days: 7,
        delay_hours: 0,
        draft_prompt:
          "Value-share email. Pick a relevant idea, lesson, or short observation from the studio's recent work — something specific to their industry or the challenge they mentioned. Frame it as a quick share, not a pitch. End by inviting their reaction if anything resonates. Under 120 words.",
      },
      {
        delay_days: 14,
        delay_hours: 0,
        draft_prompt:
          "Different-angle touch. Ask one good question about how their work is evolving — something that shows we're paying attention to their world, not just trying to sell. A question worth answering, not a 'how's it going' filler. Two sentences max.",
      },
      {
        delay_days: 23,
        delay_hours: 0,
        draft_prompt:
          "Quick check-in about a month after first contact. Reference where they were last time, ask if anything has shifted on the project they originally mentioned. Stay warm; this is a relationship cadence not a sales push.",
      },
      {
        delay_days: 30,
        delay_hours: 0,
        draft_prompt:
          "Stay-in-touch closer. Acknowledge that timing might still not be right, offer to circle back in another quarter or whenever they're ready. Make it explicit that there's no pressure. End with a clear contact line so they can find us when they need us.",
      },
    ],
  },
];

export function getCadenceTemplate(id: string): CadenceTemplate | null {
  return CADENCE_TEMPLATES.find((t) => t.id === id) ?? null;
}
