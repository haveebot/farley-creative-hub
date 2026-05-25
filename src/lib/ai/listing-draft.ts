/**
 * Etsy listing drafter — returns structured title / description /
 * tags / keywords using the studio brand voice + the operator's
 * context notes + optional asset metadata.
 *
 * Output is parsed into the listings table's structured columns so
 * each field can be copied independently into Etsy's separate inputs.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { BrandKit } from "@/lib/db/brand-kits";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2500;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export type ListingDraftInput = {
  brand: BrandKit;
  /** Operator's freeform description of what the listing IS — design type,
   *  use case, customization, delivery, etc. The richer this is, the better
   *  the draft. */
  context_notes: string;
  /** Optional file/name info from the linked asset, helps Claude understand
   *  the design shape (file format, file name conventions, etc.) */
  asset_summary?: string | null;
};

export type ListingDraftOutput = {
  title: string;
  description: string;
  tags: string[];
  keywords: string[];
  model: string;
};

const SYSTEM_PROMPT = `You write Etsy listings for a creative studio. Output ONE listing in strict JSON.

Shape:
{
  "title": string,                    // Etsy title rules: max 140 characters, keyword-rich, what shoppers actually search for. Front-load the most important terms.
  "description": string,              // Long-form description, 3-5 short paragraphs. Order: (1) lead with the use case + the feeling, (2) what's in the package / specs, (3) sizing / customization options, (4) file format + delivery + how-to, (5) shop signature line. Plain text, no markdown.
  "tags": string[],                   // EXACTLY 13 tags. Lowercase. 2-3 word phrases, multi-word preferred over single-word. No hashtags. No commas inside a tag. These are the Etsy search terms.
  "keywords": string[]                // 8-12 keywords/phrases woven INTO the description body for SEO. Overlap with tags is fine. These are descriptive search terms shoppers use.
}

Voice rules:
- Write in the studio's voice (per the cached brand block). Never generic, never corporate.
- Description should sound like the studio talking — warm, specific, capable. Not like a stock template.
- Don't invent specs the operator didn't provide. If file dimensions/colors/etc. aren't in the context notes, say "fully customizable" or "comes in [editable formats]" rather than make up numbers.
- Use ASCII characters only in tags. Description can use normal punctuation.

Output rules:
- Output raw JSON only. NO markdown code fences. NO surrounding text.
- All four fields required.
- Tags must be exactly 13. If you can't generate 13 strong ones, pad with the strongest variations.
- Title must be ≤140 characters.`;

function buildBrandSystemBlock(brand: BrandKit): string {
  return [
    `You are writing for ${brand.name}, a creative studio.`,
    "",
    "STUDIO BIO",
    brand.bio || "(no bio provided)",
    "",
    "VOICE NOTES",
    brand.voice_notes || "(no voice notes provided)",
    "",
    "BRAND BOOK NOTES",
    brand.brand_book_notes || "(no brand book notes provided)",
    "",
    "PALETTE (reference only)",
    `  Primary: ${brand.primary_color || "(unset)"}`,
    `  Secondary: ${brand.secondary_color || "(unset)"}`,
    `  Accent: ${brand.accent_color || "(unset)"}`,
    "",
    "LINKS (reference; don't stuff into copy):",
    `  Etsy: ${brand.etsy_shop_url || "(unset)"}`,
    `  Site: ${brand.website_url || "(unset)"}`,
  ].join("\n");
}

export async function draftListing(input: ListingDraftInput): Promise<ListingDraftOutput> {
  const client = getClient();

  const userBlock = [
    input.asset_summary ? `Asset attached:\n${input.asset_summary}\n` : "",
    "What this listing is (operator notes):",
    input.context_notes,
    "",
    "Draft the Etsy listing as JSON.",
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: buildBrandSystemBlock(input.brand),
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: SYSTEM_PROMPT },
    ],
    messages: [{ role: "user", content: userBlock }],
  });

  const text = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  const jsonText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}…`);
  }

  const title = typeof parsed.title === "string" ? parsed.title.slice(0, 140) : "";
  const description = typeof parsed.description === "string" ? parsed.description : "";
  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 13)
    : [];
  const keywords = Array.isArray(parsed.keywords)
    ? (parsed.keywords as unknown[]).filter((k): k is string => typeof k === "string")
    : [];

  return { title, description, tags, keywords, model: MODEL };
}
