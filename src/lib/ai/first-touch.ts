/**
 * First-touch generator — drafts a custom outreach email to a job-board lead.
 *
 * Distinct from cadence drafting (which is template-step-based and identical
 * per prospect). First-touch is one-off, custom to the specific job posting:
 * Claude reads the JD, dissects role + constraint + lever, then composes the
 * email per the principles in composition-templates/job-board-first-touch.md.
 *
 * The template file is the single source of truth — loaded from disk at
 * runtime so editing the .md updates the prompt without a code change.
 *
 * URL hybrid fetch:
 *   1. Try fresh fetch of lead.source_url (catches updates to the posting)
 *   2. Fall back to stored lead.raw_content
 *   3. If both are thin (< 300 chars), throw — operator must paste-to-enrich
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BrandKit } from "@/lib/db/brand-kits";
import type { Lead } from "@/lib/leads-shared";
import type { VoiceProfile } from "@/lib/voice-profiles-shared";
import { buildBrandSystemBlock } from "./claude";
import { fetchUrlToText } from "./parse-lead";

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2000;
const MIN_JD_CHARS = 300;
const TEMPLATE_PATH = path.join(
  process.cwd(),
  "composition-templates",
  "job-board-first-touch.md",
);

let cachedTemplate: string | null = null;

async function loadCompositionTemplate(): Promise<string> {
  if (cachedTemplate) return cachedTemplate;
  cachedTemplate = await readFile(TEMPLATE_PATH, "utf8");
  return cachedTemplate;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  return new Anthropic({ apiKey });
}

export type FirstTouchSource = {
  /** Where the JD content actually came from on this call. */
  origin: "fresh_fetch" | "stored_raw" | "operator_paste";
  /** Char count of the content used. */
  chars: number;
  /** True if the fresh fetch failed and we fell back. */
  fetch_failed?: boolean;
  /** Reason the fetch failed (if any). */
  fetch_error?: string;
};

export type FirstTouchOutput = {
  analysis: { role: string; constraint: string; lever: string };
  subject: string;
  body: string;
  source: FirstTouchSource;
  raw_content_used: string;
};

export type FirstTouchInput = {
  lead: Lead;
  brand: BrandKit;
  voice: VoiceProfile | null;
  /** Optional operator-pasted JD content; overrides URL fetch + stored raw. */
  operator_pasted?: string;
};

/**
 * Resolve the JD content via hybrid fetch:
 * 1. operator_pasted (highest precedence)
 * 2. fresh fetch of source_url
 * 3. stored raw_content
 *
 * Throws if the resolved content is below MIN_JD_CHARS.
 */
async function resolveJdContent(input: FirstTouchInput): Promise<{
  content: string;
  source: FirstTouchSource;
}> {
  if (input.operator_pasted && input.operator_pasted.trim().length >= MIN_JD_CHARS) {
    return {
      content: input.operator_pasted.trim(),
      source: {
        origin: "operator_paste",
        chars: input.operator_pasted.trim().length,
      },
    };
  }

  let fetch_failed = false;
  let fetch_error: string | undefined;
  if (input.lead.source_url) {
    try {
      const fresh = await fetchUrlToText(input.lead.source_url);
      if (fresh && fresh.trim().length >= MIN_JD_CHARS) {
        return {
          content: fresh.trim(),
          source: { origin: "fresh_fetch", chars: fresh.trim().length },
        };
      }
      fetch_failed = true;
      fetch_error = `fresh fetch returned only ${fresh?.length ?? 0} chars`;
    } catch (err) {
      fetch_failed = true;
      fetch_error = (err as Error).message;
    }
  }

  const stored = (input.lead.raw_content ?? "").trim();
  if (stored.length >= MIN_JD_CHARS) {
    return {
      content: stored,
      source: {
        origin: "stored_raw",
        chars: stored.length,
        fetch_failed,
        fetch_error,
      },
    };
  }

  throw new Error(
    `Not enough JD content to draft (need ≥${MIN_JD_CHARS} chars). ` +
      `URL fetch ${fetch_failed ? "failed: " + (fetch_error ?? "unknown") : "n/a"}. ` +
      `Stored raw_content has ${stored.length} chars. ` +
      `Pass operator_pasted with the full JD to proceed.`,
  );
}

function buildLeadContextBlock(lead: Lead, content: string): string {
  const lines = [
    "LEAD CONTEXT — the job posting you are responding to.",
    "",
    `Business: ${lead.business_name || "(unknown — extract from the JD if visible)"}`,
    `Posting title: ${lead.source_title || "(no title parsed)"}`,
    `Source URL: ${lead.source_url || "(none)"}`,
  ];
  if (lead.city || lead.state) {
    lines.push(`Location: ${[lead.city, lead.state].filter(Boolean).join(", ")}`);
  }
  if (lead.industry) lines.push(`Industry signal: ${lead.industry}`);
  if (lead.size) lines.push(`Size signal: ${lead.size}`);
  if (lead.notes && lead.notes.trim()) {
    lines.push("", `Operator notes on this lead: ${lead.notes.trim()}`);
  }
  lines.push(
    "",
    "FULL JOB POSTING CONTENT (this is what they wrote — read it carefully):",
    "---",
    content,
    "---",
  );
  return lines.join("\n");
}

/**
 * Parse the structured AI output back into typed fields.
 * Expected format:
 *   Analysis:
 *     Role: <...>
 *     Constraint: <...>
 *     Lever: <...>
 *
 *   Subject: <...>
 *
 *   Body:
 *   <body content>
 */
function parseOutput(raw: string): {
  analysis: { role: string; constraint: string; lever: string };
  subject: string;
  body: string;
} {
  const roleMatch = raw.match(/^\s*Role:\s*(.+)$/m);
  const constraintMatch = raw.match(/^\s*Constraint:\s*(.+)$/m);
  const leverMatch = raw.match(/^\s*Lever:\s*(.+)$/m);
  const subjectMatch = raw.match(/^Subject:\s*(.+)$/m);
  const bodyIdx = raw.search(/^Body:\s*/m);

  const analysis = {
    role: roleMatch?.[1].trim() ?? "(not extracted)",
    constraint: constraintMatch?.[1].trim() ?? "(not extracted)",
    lever: leverMatch?.[1].trim() ?? "(not extracted)",
  };

  if (!subjectMatch || bodyIdx === -1) {
    return { analysis, subject: "(no subject)", body: raw.trim() };
  }

  const subject = subjectMatch[1].trim();
  const body = raw.slice(bodyIdx).replace(/^Body:\s*/m, "").trim();
  return { analysis, subject, body };
}

export async function draftFirstTouch(
  input: FirstTouchInput,
): Promise<FirstTouchOutput> {
  const { content, source } = await resolveJdContent(input);
  const template = await loadCompositionTemplate();

  const brandSystem = buildBrandSystemBlock(input.brand, input.voice);
  const leadContext = buildLeadContextBlock(input.lead, content);

  const client = getClient();

  const systemBlocks: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: brandSystem,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: template,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: leadContext,
    },
  ];

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemBlocks,
    messages: [
      {
        role: "user",
        content:
          "Draft the first-touch email per the frameworks. " +
          "Output only the three labeled blocks (Analysis / Subject / Body).",
      },
    ],
  });

  const raw = response.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();

  const { analysis, subject, body } = parseOutput(raw);

  return {
    analysis,
    subject,
    body,
    source,
    raw_content_used: content,
  };
}
