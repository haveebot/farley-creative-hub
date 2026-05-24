/**
 * AI lead parser — takes raw text (or URL → text) and extracts
 * structured lead fields using Claude.
 *
 * Returns null fields where Claude can't determine a value. Returns
 * raw_content as the source text so it can be stored alongside the
 * extracted fields.
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1500;
const MAX_INPUT_CHARS = 30_000; // ~7-8k tokens; plenty for most postings

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export type ParsedLead = {
  business_name: string | null;
  source_title: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  size: string | null;
  service_signal: string[];
  raw_content: string;
  summary: string | null;
};

/**
 * Fetch a URL and extract readable text. Best-effort — many job sites
 * (Indeed, LinkedIn) block server fetches; caller should fall back to
 * pasting text directly when this fails.
 */
export async function fetchUrlToText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  return htmlToText(html).slice(0, MAX_INPUT_CHARS);
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const SYSTEM_PROMPT = `You're parsing a sourced lead — typically a job posting, RFP, article, or social mention — to extract structured fields for a marketing/design firm's sales pipeline.

Return ONLY a JSON object with these exact keys:
{
  "business_name": string | null,
  "source_title": string | null,
  "city": string | null,
  "state": string | null,  // 2-letter US code
  "industry": "food_beverage" | "retail" | "professional_services" | "health_wellness" | "arts_creative" | "technology" | "hospitality" | "nonprofit" | "other" | null,
  "size": "solo" | "small" | "medium" | "larger" | null,
  "service_signal": string[],  // subset of: ["brand_identity", "web_design", "marketing", "strategy", "packaging", "social_media", "content", "other"]
  "summary": string  // 1-2 sentences: who they are + why this is interesting for outreach
}

Rules:
- If a field can't be determined from the source, use null (or [] for service_signal).
- size: solo = 1 person, small = 2-10, medium = 11-50, larger = 50+. Infer from context (revenue mentions, team mentions, "small business" language, Fortune 500, etc.).
- service_signal: think about what a creative/marketing firm could offer this company. A job posting for "marketing manager" → ["marketing"]. A company rebranding → ["brand_identity"]. A new product launch → ["packaging", "marketing"]. Don't reach — only include services the source actually signals.
- summary: angle for outreach, not just facts. e.g. "Hiring an in-house marketing manager — interim/contract pitch could land while they search."
- Do NOT wrap the JSON in markdown code fences. Output raw JSON only.`;

export async function parseLead(rawText: string): Promise<ParsedLead> {
  const client = getClient();
  const text = rawText.slice(0, MAX_INPUT_CHARS);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Source to parse:\n\n${text}`,
      },
    ],
  });

  const reply = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  // Strip code fences if Claude added them anyway.
  const jsonText = reply
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  let parsed: Partial<ParsedLead>;
  try {
    parsed = JSON.parse(jsonText) as Partial<ParsedLead>;
  } catch {
    throw new Error(`Claude returned non-JSON: ${reply.slice(0, 200)}…`);
  }

  return {
    business_name: typeof parsed.business_name === "string" ? parsed.business_name : null,
    source_title: typeof parsed.source_title === "string" ? parsed.source_title : null,
    city: typeof parsed.city === "string" ? parsed.city : null,
    state: typeof parsed.state === "string" ? parsed.state.toUpperCase() : null,
    industry: typeof parsed.industry === "string" ? parsed.industry : null,
    size: typeof parsed.size === "string" ? parsed.size : null,
    service_signal: Array.isArray(parsed.service_signal)
      ? parsed.service_signal.filter((s): s is string => typeof s === "string")
      : [],
    raw_content: text,
    summary: typeof parsed.summary === "string" ? parsed.summary : null,
  };
}
