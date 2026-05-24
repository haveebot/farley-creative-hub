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

function buildBrandSystemBlock(brand: BrandKit): string {
  const lines = [
    `You are a writing assistant for ${brand.name}, a creative studio.`,
    "Everything you draft must sound like the studio — never generic, never corporate.",
    "",
    "STUDIO BIO",
    brand.bio || "(no bio provided yet)",
    "",
    "VOICE NOTES — how the studio sounds",
    brand.voice_notes || "(no voice notes provided yet)",
    "",
    "BRAND BOOK NOTES — guidelines, do's and don'ts, positioning",
    brand.brand_book_notes || "(no brand book notes provided yet)",
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
    "- Don't fabricate product specs, prices, sizes, or details the prompt didn't provide.",
    "- If the prompt is ambiguous, draft the most likely interpretation and note your assumption at the bottom in a single line: 'Assumed: X.'",
    "- Don't include filler intros like 'Here is a draft of...'.",
    "- Don't sign off with 'Best,' / 'Cheers,' unless the prompt asks for an email.",
  ];
  return lines.join("\n");
}

export type DraftRequest = {
  kind: DraftKind;
  prompt: string;
  brand: BrandKit;
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

  const brandSystem = buildBrandSystemBlock(req.brand);
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
