/**
 * Voice extractor — analyzes a corpus of real writing samples and
 * returns a structured voice profile (notes, always-say, never-say,
 * audience persona).
 *
 * Used by the /api/voice-profiles/generate endpoint when an operator
 * pastes samples OR pulls existing Hub content via gatherExistingWriting().
 *
 * Returns DRAFT fields the operator reviews + edits before saving.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";

export type ExtractedVoice = {
  voice_notes: string;
  always_say: string[];
  never_say: string[];
  audience_persona: string;
  pattern_summary: string;
};

const SYSTEM = `You are a brand-voice analyst. Read the writing samples and extract the writer's voice signature with surgical precision.

Output JSON with these fields exactly:
{
  "voice_notes": "3-5 sentence description of HOW this person writes. Adjectives, energy, sentence rhythm, characteristic moves. Specific, not abstract.",
  "always_say": ["phrase 1", "phrase 2", ...],  // 5-10 phrases or words the writer reaches for repeatedly. Real ones from the samples, not invented.
  "never_say": ["phrase 1", ...],  // 3-6 corporate-speak / generic phrases this writer would clearly NEVER use. Inferred from absence + tone contrast.
  "audience_persona": "Who is the writer talking TO? 2-3 sentences describing the audience the samples suggest. Demographic, psychographic, behavioral.",
  "pattern_summary": "1-2 sentence summary of the strongest pattern across the samples. The thing a clone would have to nail to pass as this writer."
}

Rules:
- Voice notes must be CONCRETE. Not "warm and personal" — instead "uses second person, contractions, em-dashes for asides, ends paragraphs with a question or a quiet declarative."
- Always-say items come from real recurring phrases in the samples. If only one sample uses a phrase, don't include it.
- Never-say items are corporate-speak, jargon, or vague claims the writer demonstrably avoids. Examples: "synergy," "leverage," "world-class," "industry-leading."
- Audience persona infers from word choice + assumptions in the samples. Don't invent demographic data — infer from tone.
- Output JSON only, no preamble or explanation.`;

export async function extractVoiceFromSamples(samples: string): Promise<ExtractedVoice> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  if (!samples || samples.trim().length < 100) {
    throw new Error(
      "Not enough writing to analyze — need at least ~100 chars of real samples.",
    );
  }

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Here are the writing samples. Extract the voice signature as JSON.\n\n${samples}`,
      },
    ],
  });

  const text = res.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("\n");

  // Strip code fences if Claude added them
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  let parsed: Partial<ExtractedVoice>;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Couldn't parse voice extraction JSON. Raw response started with: ${text.slice(0, 200)}`,
    );
  }

  return {
    voice_notes: parsed.voice_notes ?? "",
    always_say: Array.isArray(parsed.always_say) ? parsed.always_say : [],
    never_say: Array.isArray(parsed.never_say) ? parsed.never_say : [],
    audience_persona: parsed.audience_persona ?? "",
    pattern_summary: parsed.pattern_summary ?? "",
  };
}
