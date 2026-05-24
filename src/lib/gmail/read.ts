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
