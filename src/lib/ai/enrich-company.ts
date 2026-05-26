/**
 * Company enrichment — given a prospect (business_name + optional source_url),
 * find the company website, scrape team / about / leadership pages, extract
 * a structured contact roster.
 *
 * No external search API used (yet). Approach:
 *   1. If website_url is already on the prospect → use it.
 *   2. Else: ask Claude to suggest the likely company URL from business_name.
 *      (Claude knows most established companies' domains. For unknowns
 *      Claude can flag low-confidence and the operator pastes the URL.)
 *   3. Fetch the homepage; ask Claude to point at team/about/leadership
 *      links from the rendered text.
 *   4. Fetch those pages.
 *   5. Ask Claude to extract structured contacts (name, role, email).
 *   6. Ask Claude to pick the BEST first-touch recipient for a given role
 *      context — e.g., "we're pitching for a Marketing Director hire" →
 *      pick the existing Marketing leader or the founder/CEO.
 *
 * Output: { website_url, candidates: GmailRecipient[], best_pick_index, notes }
 *
 * Sage-style rule: search engines + actual scraped pages, never guesses.
 * Today we're doing Claude-guess + actual scrape. Add a real search API
 * later (Brave/Serp/Google CSE) if guessing degrades for less-known firms.
 */
import Anthropic from "@anthropic-ai/sdk";
import { fetchUrlToText } from "./parse-lead";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 3000;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export type ContactCandidate = {
  name: string;
  title: string | null;
  /** Email literally visible on a scraped page. Null when not found.
   *  We do NOT guess emails — operator manually adds them on the lead
   *  detail page if extraction missed them. */
  email: string | null;
  source_url: string;
  notes: string | null;
};

export type EnrichmentResult = {
  website_url: string | null;
  /** True when Claude was confident enough to scrape; false when guess was weak. */
  website_confidence: "high" | "medium" | "low";
  /** Pages we actually scraped to extract contacts. */
  scraped_pages: string[];
  /** Pages we tried but failed to fetch. */
  failed_pages: Array<{ url: string; error: string }>;
  candidates: ContactCandidate[];
  /** Claude's recommended primary contact among the candidates, by index. -1 if none. */
  best_pick_index: number;
  best_pick_reason: string;
  /** Free-text notes from the enrichment run (operator-facing). */
  notes: string;
};

export type EnrichmentInput = {
  business_name: string;
  /** Pre-known website URL — overrides the URL-guess step. */
  website_url?: string | null;
  /** Lead/posting source URL — gives Claude context if business_name is generic. */
  source_url?: string | null;
  /** Lead/posting title — gives Claude context about the role being filled. */
  source_title?: string | null;
  /** Description of who we want to reach (e.g., "Marketing Director hire — find marketing leaders or founder"). */
  recipient_context?: string;
};

const FETCH_TIMEOUT_MS = 10_000;
const MAX_TEAM_PAGES = 8;

/** Common paths where companies put contact info, leadership, team lists.
 *  Tried unconditionally on top of Claude's homepage-link picks — companies
 *  often have these even when they're not linked from the homepage. */
const COMMON_TEAM_PATHS = [
  "/contact",
  "/contact-us",
  "/contact-us/",
  "/contactus",
  "/about",
  "/about-us",
  "/about/",
  "/team",
  "/team/",
  "/our-team",
  "/leadership",
  "/people",
  "/who-we-are",
  "/company",
];

function stripJson(text: string): string {
  return text
    .replace(/^```json\s*\n/, "")
    .replace(/^```\s*\n/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

async function guessWebsiteUrl(input: EnrichmentInput): Promise<{
  url: string | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}> {
  const client = getClient();
  const context = [
    `Business name: ${input.business_name}`,
    input.source_url ? `Lead source URL: ${input.source_url}` : null,
    input.source_title ? `Posting title: ${input.source_title}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Identify the official company website for the business below. Return ONLY a JSON object with three fields:
- url: the most likely website URL (with https://), or null if you can't identify one with reasonable confidence
- confidence: "high" (you know this company well), "medium" (educated guess from name + context), "low" (probably wrong — operator should verify)
- reasoning: one sentence explaining how you got there

DO NOT make up URLs. If the business is unfamiliar and the lead source doesn't give you a domain, return null.

Business:
${context}

JSON output only, no other text.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  try {
    const parsed = JSON.parse(stripJson(raw));
    return {
      url: typeof parsed.url === "string" ? parsed.url : null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "low",
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch {
    return { url: null, confidence: "low", reasoning: "Failed to parse URL guess" };
  }
}

async function identifyTeamPages(
  websiteUrl: string,
  homepageText: string,
): Promise<string[]> {
  const client = getClient();
  const prompt = `From the homepage text below, identify URLs (or path stubs) that likely lead to TEAM, ABOUT, LEADERSHIP, OUR PEOPLE, or CONTACT pages — pages where staff names and titles would be listed.

Return ONLY a JSON array of full URLs (resolve relative paths against ${websiteUrl}). Max 5 URLs, prioritized most-likely first. No commentary.

Homepage text:
---
${homepageText.slice(0, 8000)}
---

JSON array only.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  try {
    const arr = JSON.parse(stripJson(raw));
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((u): u is string => typeof u === "string")
      .slice(0, MAX_TEAM_PAGES);
  } catch {
    return [];
  }
}

async function extractContacts(
  pages: Array<{ url: string; text: string }>,
  recipientContext: string | undefined,
): Promise<{
  candidates: ContactCandidate[];
  best_pick_index: number;
  best_pick_reason: string;
  notes: string;
}> {
  const client = getClient();
  const pagesBlock = pages
    .map(
      (p, i) =>
        `## Page ${i + 1}: ${p.url}\n\n${p.text.slice(0, 6000)}`,
    )
    .join("\n\n---\n\n");

  const contextLine = recipientContext
    ? `\n\nRECIPIENT CONTEXT — pick the best contact for this outreach: ${recipientContext}`
    : "";

  const prompt = `Extract structured contacts from the company team/about/leadership pages below. Pull every named person you can find with their title. Include email if visible on the page (do NOT fabricate emails).${contextLine}

Return ONLY a JSON object with this shape:
{
  "candidates": [
    {
      "name": "full name",
      "title": "their title at this company",
      "email": "email if visible on the page, otherwise null",
      "source_url": "which page URL you found this person on",
      "notes": "any extra context worth noting (e.g., 'co-founder', 'recently joined', or null)"
    }
  ],
  "best_pick_index": <integer — index into candidates array of who Collie should reach out to, or -1 if no one fits>,
  "best_pick_reason": "1-sentence explanation of why this person is the best first-touch recipient",
  "notes": "1-2 sentence operator note — anything Collie should know before reaching out (e.g., 'small leadership team, founder-led so Sandra is the right call', or 'team page only lists 3 senior people; smaller roster than expected')"
}

Rules:
- No fabricated emails. Email field is null unless you literally saw the email address text on the page.
- No fabricated people. Only include names that appear on the actual page text.
- best_pick selection logic:
  - If RECIPIENT CONTEXT names a role, pick the existing leader of that function (e.g., for "Marketing Director hire" → pick the current CMO/VP Marketing/Marketing Director if present).
  - If no role-match, pick the principal/founder/CEO.
  - If the team page is empty or only lists junior staff, set best_pick_index to -1.

Pages:
${pagesBlock}

JSON only.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  try {
    const parsed = JSON.parse(stripJson(raw));
    const candidates: ContactCandidate[] = Array.isArray(parsed.candidates)
      ? parsed.candidates
          .filter(
            (c: unknown): c is Record<string, unknown> =>
              typeof c === "object" && c !== null,
          )
          .map((c: Record<string, unknown>) => ({
            name: typeof c.name === "string" ? c.name : "(unnamed)",
            title: typeof c.title === "string" ? c.title : null,
            email: typeof c.email === "string" ? c.email : null,
            source_url:
              typeof c.source_url === "string" ? c.source_url : pages[0]?.url ?? "",
            notes: typeof c.notes === "string" ? c.notes : null,
          }))
      : [];
    return {
      candidates,
      best_pick_index:
        typeof parsed.best_pick_index === "number" ? parsed.best_pick_index : -1,
      best_pick_reason:
        typeof parsed.best_pick_reason === "string" ? parsed.best_pick_reason : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return {
      candidates: [],
      best_pick_index: -1,
      best_pick_reason: "",
      notes: "Failed to parse extraction output",
    };
  }
}

async function fetchWithTimeout(url: string): Promise<string> {
  return Promise.race([
    fetchUrlToText(url),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("fetch timeout")), FETCH_TIMEOUT_MS),
    ),
  ]);
}

export async function enrichCompany(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  const failed_pages: Array<{ url: string; error: string }> = [];
  const scraped_pages: string[] = [];

  // Step 1: figure out the website URL
  let websiteUrl = input.website_url?.trim() ?? null;
  let confidence: "high" | "medium" | "low" = websiteUrl ? "high" : "low";
  let urlReasoning = websiteUrl ? "Provided by caller" : "";

  if (!websiteUrl) {
    const guess = await guessWebsiteUrl(input);
    websiteUrl = guess.url;
    confidence = guess.confidence;
    urlReasoning = guess.reasoning;
  }

  if (!websiteUrl) {
    return {
      website_url: null,
      website_confidence: "low",
      scraped_pages: [],
      failed_pages: [],
      candidates: [],
      best_pick_index: -1,
      best_pick_reason: "",
      notes: `Could not identify a company website. ${urlReasoning}. Paste a website URL on the prospect to retry.`,
    };
  }

  // Step 2: fetch the homepage
  let homepageText: string;
  try {
    homepageText = await fetchWithTimeout(websiteUrl);
  } catch (err) {
    failed_pages.push({ url: websiteUrl, error: (err as Error).message });
    return {
      website_url: websiteUrl,
      website_confidence: confidence,
      scraped_pages: [],
      failed_pages,
      candidates: [],
      best_pick_index: -1,
      best_pick_reason: "",
      notes: `Found website (${urlReasoning}) but couldn't fetch the homepage: ${(err as Error).message}. Try again later or paste team-page content manually.`,
    };
  }
  scraped_pages.push(websiteUrl);

  // Step 3: identify team / about / leadership / contact pages.
  // Combine TWO strategies:
  //   a) Claude-suggested from homepage links
  //   b) Common paths (contact-us, team, about, etc.) — companies often
  //      have these even when not linked from the home nav. Contact pages
  //      especially are where individual emails live.
  const claudeUrls = await identifyTeamPages(websiteUrl, homepageText);
  const base = new URL(websiteUrl);
  const commonUrls = COMMON_TEAM_PATHS.map((p) => `${base.origin}${p}`);
  const seen = new Set<string>([websiteUrl]);
  const candidateUrls: string[] = [];
  for (const u of [...claudeUrls, ...commonUrls]) {
    const norm = u.replace(/\/$/, "");
    if (seen.has(norm) || seen.has(norm + "/")) continue;
    seen.add(norm);
    candidateUrls.push(u);
    if (candidateUrls.length >= MAX_TEAM_PAGES) break;
  }

  // Step 4: fetch each candidate page
  const teamPagesContent: Array<{ url: string; text: string }> = [
    { url: websiteUrl, text: homepageText },
  ];
  for (const url of candidateUrls) {
    try {
      const text = await fetchWithTimeout(url);
      if (text && text.trim().length >= 200) {
        teamPagesContent.push({ url, text });
        scraped_pages.push(url);
      }
    } catch (err) {
      failed_pages.push({ url, error: (err as Error).message });
    }
  }

  // Step 5 + 6: extract contacts + best pick
  const extracted = await extractContacts(teamPagesContent, input.recipient_context);

  return {
    website_url: websiteUrl,
    website_confidence: confidence,
    scraped_pages,
    failed_pages,
    candidates: extracted.candidates,
    best_pick_index: extracted.best_pick_index,
    best_pick_reason: extracted.best_pick_reason,
    notes: [urlReasoning, extracted.notes].filter(Boolean).join(" — "),
  };
}
