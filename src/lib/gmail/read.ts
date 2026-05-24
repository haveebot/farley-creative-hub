/**
 * Gmail API read — list recent messages with a given email address.
 *
 * Server-only. Uses the connected Workspace OAuth (gmail.modify scope
 * covers read). Returns a small, render-ready slice of metadata
 * (id, subject, date, direction, snippet) — not full bodies.
 */

import { getValidAccessToken } from "./send";

const GMAIL_MESSAGES_LIST_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";

export type GmailExchangeMessage = {
  id: string;
  threadId: string;
  /** Direction relative to the connected account: "in" = received, "out" = sent. */
  direction: "in" | "out";
  subject: string;
  /** ISO date string from the message's Date header (or internalDate fallback). */
  date: string;
  /** Gmail's snippet — first ~200 chars of body, plain text. */
  snippet: string;
  /** Other party (the contact email — sender if in, recipient if out). */
  other_party: string;
};

/**
 * List recent messages exchanged with `contactEmail` in the connected
 * Workspace inbox. Both sent and received. Newest first. Limited
 * to `limit` items (default 10).
 *
 * Returns [] if there's no Workspace connection or no messages match.
 * Throws on Gmail API errors (caller decides whether to suppress).
 */
export async function listRecentExchange(
  contactEmail: string,
  limit = 10,
): Promise<GmailExchangeMessage[]> {
  const { accessToken, connection } = await getValidAccessToken();
  const meEmail = connection.email.toLowerCase();
  const contact = contactEmail.toLowerCase().trim();
  if (!contact) return [];

  // Search query: messages from or to the contact. Use `in:anywhere`
  // to include Spam/Trash; better to err on the side of showing
  // everything than missing a reply that landed in spam.
  const q = `(from:${contact} OR to:${contact}) in:anywhere`;

  const listUrl = new URL(GMAIL_MESSAGES_LIST_URL);
  listUrl.searchParams.set("q", q);
  listUrl.searchParams.set("maxResults", String(limit));

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail messages.list failed: ${listRes.status} — ${text}`);
  }
  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  if (!listData.messages || listData.messages.length === 0) return [];

  // Fetch each message's metadata in parallel.
  const messages = await Promise.all(
    listData.messages.map(async (m) => {
      const url = new URL(`${GMAIL_MESSAGES_LIST_URL}/${m.id}`);
      url.searchParams.set("format", "metadata");
      url.searchParams.append("metadataHeaders", "From");
      url.searchParams.append("metadataHeaders", "To");
      url.searchParams.append("metadataHeaders", "Subject");
      url.searchParams.append("metadataHeaders", "Date");
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        id: string;
        threadId: string;
        snippet?: string;
        internalDate?: string;
        payload?: {
          headers?: Array<{ name: string; value: string }>;
        };
      };
      const headers = data.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

      const fromHeader = header("From");
      const toHeader = header("To");
      const subject = header("Subject") || "(no subject)";

      // Date: prefer Date header (RFC-822), fall back to Gmail internalDate (ms epoch).
      let date = header("Date");
      if (!date && data.internalDate) {
        date = new Date(Number(data.internalDate)).toISOString();
      } else if (date) {
        // Normalize to ISO if possible.
        const parsed = new Date(date);
        if (!isNaN(parsed.getTime())) date = parsed.toISOString();
      }

      const fromAddr = extractAddress(fromHeader);
      const direction: "in" | "out" =
        fromAddr.toLowerCase() === meEmail ? "out" : "in";
      const other_party =
        direction === "out" ? extractAddress(toHeader) : fromAddr;

      return {
        id: data.id,
        threadId: data.threadId,
        direction,
        subject,
        date,
        snippet: data.snippet ?? "",
        other_party,
      } satisfies GmailExchangeMessage;
    }),
  );

  return messages
    .filter((m): m is GmailExchangeMessage => m !== null)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/**
 * Extract the bare email address from a header value like
 * "Display Name <addr@example.com>". Returns the original string if no
 * bracketed address is present.
 */
function extractAddress(header: string): string {
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim();
}

// ============ Label management ============

const GMAIL_LABELS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/labels";

export type GmailLabel = {
  id: string;
  name: string;
  type?: string;
};

/**
 * Look up a label by name. Returns null if no label with that name exists.
 */
export async function getLabelByName(name: string): Promise<GmailLabel | null> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(GMAIL_LABELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail labels.list failed: ${res.status} — ${text}`);
  }
  const data = (await res.json()) as { labels?: GmailLabel[] };
  return data.labels?.find((l) => l.name === name) ?? null;
}

/**
 * Create a label by name. Returns the new label.
 */
export async function createLabel(name: string): Promise<GmailLabel> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(GMAIL_LABELS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail labels.create failed: ${res.status} — ${text}`);
  }
  return (await res.json()) as GmailLabel;
}

/**
 * Look up a label by name OR create it if it doesn't exist. Idempotent.
 */
export async function ensureLabel(name: string): Promise<GmailLabel> {
  const existing = await getLabelByName(name);
  if (existing) return existing;
  return createLabel(name);
}

// ============ Reading messages by label ============

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  /** ISO date string (from internalDate). */
  date: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  /** Plain-text body (extracted from text/plain part, or HTML stripped). */
  body: string;
};

/**
 * List messages with the given label. Returns up to `limit` messages,
 * each with full body extracted as plain text. Newest first.
 */
export async function listMessagesByLabel(
  labelId: string,
  limit = 20,
): Promise<GmailMessageSummary[]> {
  const { accessToken } = await getValidAccessToken();

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("labelIds", labelId);
  listUrl.searchParams.set("maxResults", String(limit));

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail messages.list (label) failed: ${listRes.status} — ${text}`);
  }
  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };
  if (!listData.messages?.length) return [];

  const messages = await Promise.all(
    listData.messages.map(async (m) => fetchMessageWithBody(m.id, accessToken)),
  );
  return messages
    .filter((m): m is GmailMessageSummary => m !== null)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/**
 * Fetch a single message with format=full and extract its plain text body.
 */
async function fetchMessageWithBody(
  id: string,
  accessToken: string,
): Promise<GmailMessageSummary | null> {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
  url.searchParams.set("format", "full");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    payload?: GmailPayload;
  };
  const headers = data.payload?.headers ?? [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const date = data.internalDate
    ? new Date(Number(data.internalDate)).toISOString()
    : "";

  return {
    id: data.id,
    threadId: data.threadId,
    date,
    from: header("From"),
    to: header("To"),
    subject: header("Subject") || "(no subject)",
    snippet: data.snippet ?? "",
    body: extractTextFromPayload(data.payload),
  };
}

type GmailPayload = {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPayload[];
};

/**
 * Walk the MIME tree to extract plain text. Prefers text/plain; falls
 * back to text/html with tags stripped. Returns empty string if none.
 */
function extractTextFromPayload(payload: GmailPayload | undefined): string {
  if (!payload) return "";

  // Walk the tree, collecting all text/plain and text/html parts.
  const textParts: string[] = [];
  const htmlParts: string[] = [];

  function walk(p: GmailPayload) {
    const mime = (p.mimeType || "").toLowerCase();
    if (mime === "text/plain" && p.body?.data) {
      textParts.push(decodeBase64Url(p.body.data));
    } else if (mime === "text/html" && p.body?.data) {
      htmlParts.push(decodeBase64Url(p.body.data));
    }
    if (p.parts) {
      for (const part of p.parts) walk(part);
    }
  }
  walk(payload);

  if (textParts.length > 0) return textParts.join("\n\n").trim();
  if (htmlParts.length > 0) return stripHtml(htmlParts.join("\n\n")).trim();
  return "";
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n");
}

// ============ Modifying messages ============

/**
 * Remove a label from a message. Used to mark a message as "processed"
 * after the Hub has extracted leads from it.
 */
export async function removeLabel(messageId: string, labelId: string): Promise<void> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ removeLabelIds: [labelId] }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail messages.modify failed: ${res.status} — ${text}`);
  }
}
