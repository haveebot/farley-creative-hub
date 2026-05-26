/**
 * Anthropic Claude API wrapper — brand-aware drafting.
 *
 * The studio's brand kit (voice notes, brand book notes, bio, palette)
 * is injected as a cached system prompt so every draft is grounded in
 * her voice without re-uploading the brand context on every call.
 * Caching gives ~90% cost reduction on the brand block.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "@/lib/db/brand-kits";
import type { DraftKind } from "@/lib/drafts-shared";
import type { Prospect } from "@/lib/db/prospects";
import type { VoiceProfile } from "@/lib/voice-profiles-shared";
import {
  INDUSTRY_LABELS,
  SERVICE_LABELS,
  SIZE_LABELS,
} from "@/lib/pipeline-shared";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2000;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not set. Add it as a Sensitive env var in Vercel.",
    );
  }
  return new Anthropic({ apiKey });
}

function kindGuidance(kind: DraftKind): string {
  switch (kind) {
    case "listing":
      return [
        "OUTPUT FORMAT — Etsy listing copy. Provide three labeled blocks:",
        "  Title: (max 140 chars, keyword-rich, what shoppers search for)",
        "  Description: (long form, 3–5 short paragraphs; lead with the use case,",
        "    then specs, then sizing/customization, then file format / delivery)",
        "  Tags: (exactly 13 tags, lowercase, comma-separated, no hashtags)",
      ].join("\n");
    case "pin":
      return [
        "OUTPUT FORMAT — Pinterest pin copy. Provide two labeled blocks:",
        "  Title: (under 100 chars, search-friendly, hooks the scroll)",
        "  Description: (1–2 sentences with relevant hashtags at end)",
      ].join("\n");
    case "customer_reply":
      return [
        "OUTPUT FORMAT — direct customer reply. No labels. Voice matches her brand.",
        "Address the question completely. End warmly but don't over-apologize.",
      ].join("\n");
    case "social_post":
      return [
        "OUTPUT FORMAT — short social post (Instagram-friendly).",
        "1–4 sentences. Hashtags at the end on their own line if relevant.",
      ].join("\n");
    case "blog":
      return [
        "OUTPUT FORMAT — blog post with a clear H1 title and 3–6 short sections",
        "with H2 subheads. Aim for ~500 words unless the prompt asks otherwise.",
      ].join("\n");
    case "email":
      return [
        "OUTPUT FORMAT — email. Provide:",
        "  Subject: (a short, specific subject line)",
        "  Body: (no greeting placeholder; write the full body in her voice)",
      ].join("\n");
    case "general":
    default:
      return "OUTPUT FORMAT — whatever the prompt requests, in her studio voice.";
  }
}

function buildBrandSystemBlock(brand: BrandKit, voice?: VoiceProfile | null): string {
  // When a voice profile is supplied, voice-related fields come from it
  // and override the brand kit. Brand kit still provides bio, palette,
  // positioning, brand book notes, links — the "what" while voice is "how".
  const voiceNotes = voice?.voice_notes || brand.voice_notes;
  const writingSamples = voice?.writing_samples || brand.writing_samples;
  const audiencePersona = voice?.audience_persona || brand.audience_persona;
  const alwaysSay = (voice?.always_say && voice.always_say.length > 0)
    ? voice.always_say
    : brand.always_say;
  const neverSay = (voice?.never_say && voice.never_say.length > 0)
    ? voice.never_say
    : brand.never_say;

  const lines = [
    `You are a writing assistant for ${brand.name}, a creative studio.`,
    "Everything you draft must sound like the studio — never generic, never corporate.",
    "",
    "STUDIO BIO",
    brand.bio || "(no bio provided yet)",
  ];

  if (voice) {
    lines.push(
      "",
      `VOICE PROFILE: ${voice.name}${voice.description ? ` — ${voice.description}` : ""}`,
      "(Use this voice for this draft; it overrides the brand kit's default voice fields.)",
    );
  }

  lines.push(
    "",
    "VOICE NOTES — how to sound (described)",
    voiceNotes || "(no voice notes provided yet)",
  );

  if (writingSamples && writingSamples.trim()) {
    lines.push(
      "",
      "WRITING SAMPLES — actual examples of the voice. Pattern-match against these. They are the strongest signal of how to sound.",
      writingSamples,
    );
  }

  if (audiencePersona && audiencePersona.trim()) {
    lines.push(
      "",
      "AUDIENCE — who you're writing to. Tune voice, references, and assumed knowledge to this reader.",
      audiencePersona,
    );
  }

  if (brand.differentiators && brand.differentiators.trim()) {
    lines.push(
      "",
      "POSITIONING — what makes this studio different. Lead with this kind of value, not generic descriptors.",
      brand.differentiators,
    );
  }

  lines.push(
    "",
    "BRAND BOOK NOTES — guidelines, do's and don'ts, longer-form positioning",
    brand.brand_book_notes || "(no brand book notes provided yet)",
  );

  if (alwaysSay && alwaysSay.length > 0) {
    lines.push("", "ALWAYS-SAY — favored words/phrases. Prefer these when they fit.");
    alwaysSay.forEach((p) => lines.push(`  • ${p}`));
  }

  if (neverSay && neverSay.length > 0) {
    lines.push("", "NEVER-SAY — forbidden words/phrases. Never use these, even close variants.");
    neverSay.forEach((p) => lines.push(`  • ${p}`));
  }

  lines.push(
    "",
    "PALETTE (for reference if visual descriptions come up):",
    `  Primary: ${brand.primary_color || "(unset)"}`,
    `  Secondary: ${brand.secondary_color || "(unset)"}`,
    `  Accent: ${brand.accent_color || "(unset)"}`,
    "",
    "LINKS (for reference, not for stuffing into every draft):",
    `  Etsy: ${brand.etsy_shop_url || "(unset)"}`,
    `  Website: ${brand.website_url || "(unset)"}`,
    `  Instagram: ${brand.instagram_url || "(unset)"}`,
    `  Pinterest: ${brand.pinterest_url || "(unset)"}`,
    "",
    "RULES",
    "- Match the voice notes precisely. If they say 'never corporate' — never sound corporate.",
    "- If WRITING SAMPLES are provided, weight them above the descriptive VOICE NOTES — show, don't just describe.",
    "- Don't fabricate product specs, prices, sizes, or details the prompt didn't provide.",
    "- If the prompt is ambiguous, draft the most likely interpretation and note your assumption at the bottom in a single line: 'Assumed: X.'",
    "- Don't include filler intros like 'Here is a draft of...'.",
    "- Don't sign off with 'Best,' / 'Cheers,' unless the prompt asks for an email.",
  );
  return lines.join("\n");
}

export type DraftRequest = {
  kind: DraftKind;
  prompt: string;
  brand: BrandKit;
  voice?: VoiceProfile | null;
  prospect?: Prospect | null;
};

export type DraftResponse = {
  content: string;
  model: string;
};

function buildProspectBlock(p: Prospect): string {
  const lines = [
    "DRAFTING FOR THIS PROSPECT — they are the audience or subject of this draft.",
    "",
    `Name: ${p.business_name}`,
  ];
  if (p.industry) lines.push(`Industry: ${INDUSTRY_LABELS[p.industry] ?? p.industry}`);
  if (p.size) lines.push(`Size: ${SIZE_LABELS[p.size] ?? p.size}`);
  if (p.city || p.state) {
    lines.push(`Location: ${[p.city, p.state].filter(Boolean).join(", ")}`);
  }
  if (p.website_url) lines.push(`Website: ${p.website_url}`);
  if (p.service_interest.length > 0) {
    lines.push(
      `Services they'd hire for: ${p.service_interest.map((s) => SERVICE_LABELS[s] ?? s).join(", ")}`,
    );
  }
  if (p.notes && p.notes.trim()) {
    lines.push("", "Operator notes on this prospect:", p.notes.trim());
  }
  lines.push(
    "",
    "Use this context to ground the draft. Reference what they actually do; don't make up facts not in this context.",
  );
  return lines.join("\n");
}

export async function draftWithClaude(req: DraftRequest): Promise<DraftResponse> {
  const client = getClient();

  const brandSystem = buildBrandSystemBlock(req.brand, req.voice);
  const kindSystem = kindGuidance(req.kind);

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: brandSystem,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (req.prospect) {
    // Prospect context varies per call — don't cache.
    systemBlocks.push({
      type: "text",
      text: buildProspectBlock(req.prospect),
    });
  }

  systemBlocks.push({ type: "text", text: kindSystem });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages: [
      {
        role: "user",
        content: req.prompt,
      },
    ],
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n")
    .trim();

  return { content: text, model: MODEL };
}
