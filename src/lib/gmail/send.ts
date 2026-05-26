/**
 * Gmail API send — sends as the connected Workspace user.
 *
 * Sends land in the connected account's Sent folder (because we're
 * actually using their account via OAuth, not impersonating). Replies
 * thread naturally back to their Inbox.
 *
 * Auto-refreshes access token when within 60s of expiry.
 */

import {
  getConnectionByPurpose,
  updateAccessToken,
  type ConnectionPurpose,
  type WorkspaceConnection,
} from "@/lib/db/workspace-connections";
import { refreshAccessToken } from "./oauth";

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_DRAFTS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";

export type GmailRecipient = {
  email: string;
  name?: string | null;
};

export type GmailSendOptions = {
  /** Primary recipient — backwards-compat singular field. If `tos` is set, this is appended to that list. Pass empty string to skip. */
  to: string;
  toName?: string | null;
  /** Additional TO recipients beyond the primary. Optional. */
  tos?: GmailRecipient[];
  /** CC recipients. Optional. */
  cc?: GmailRecipient[];
  subject: string;
  text: string;
  /** Optional RFC822 In-Reply-To header for threading future replies. */
  inReplyTo?: string;
};

export type GmailSendResult = {
  id: string;
  threadId: string;
};

/**
 * Get a usable access token for a Workspace connection of a given
 * purpose. Defaults to 'sending' (the cadence-draft + send role).
 * Refreshes the access token if expired or within 60s of expiry.
 */
export async function getValidAccessToken(
  purpose: ConnectionPurpose = "sending",
): Promise<{
  accessToken: string;
  connection: WorkspaceConnection;
}> {
  const connection = await getConnectionByPurpose(purpose);
  if (!connection) {
    throw new Error(
      `No Workspace connection for purpose '${purpose}'. Connect at /settings/workspace first.`,
    );
  }

  const needsRefresh =
    !connection.access_token ||
    !connection.access_expires_at ||
    new Date(connection.access_expires_at).getTime() - Date.now() < 60_000;

  if (!needsRefresh && connection.access_token) {
    return { accessToken: connection.access_token, connection };
  }

  const refreshed = await refreshAccessToken(connection.refresh_token);
  const updated = await updateAccessToken(
    connection.id,
    refreshed.access_token,
    refreshed.expires_in,
  );
  return { accessToken: refreshed.access_token, connection: updated };
}

/**
 * Send an email via Gmail API. Returns the Gmail message id + thread id.
 */
export async function sendViaGmail(opts: GmailSendOptions): Promise<GmailSendResult> {
  const { accessToken, connection } = await getValidAccessToken();

  const fromHeader = connection.email; // sends as the connected user
  const toHeader = opts.toName
    ? `${formatHeaderName(opts.toName)} <${opts.to}>`
    : opts.to;

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeSubject(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  const rfc822 = headers.join("\r\n") + "\r\n\r\n" + opts.text;
  const raw = Buffer.from(rfc822, "utf8").toString("base64url");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail send failed: ${res.status} — ${text}`);
  }
  const data = (await res.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}

export type GmailDraftResult = {
  draftId: string;
  messageId: string;
  threadId: string;
};

/**
 * Create a Gmail DRAFT (in the connected account's Drafts folder).
 * Does NOT send. The operator opens Gmail, reviews/edits, then sends
 * from there — landing in their Sent folder like any normal Gmail send.
 *
 * This is the failsafe path for cadence emails: the cron drafts;
 * the human approves + sends.
 */
export async function createGmailDraft(opts: GmailSendOptions): Promise<GmailDraftResult> {
  const { accessToken, connection } = await getValidAccessToken();

  const fromHeader = connection.email;

  // Build the TO list: backwards-compat `to` first, then any `tos` array.
  // Deduplicate by lowercased email so a primary + roster-duplicate doesn't
  // double-send.
  const toList: GmailRecipient[] = [];
  if (opts.to && opts.to.trim()) {
    toList.push({ email: opts.to.trim(), name: opts.toName ?? null });
  }
  for (const r of opts.tos ?? []) {
    const email = r.email?.trim();
    if (!email) continue;
    if (toList.some((x) => x.email.toLowerCase() === email.toLowerCase())) continue;
    toList.push({ email, name: r.name ?? null });
  }

  const ccList: GmailRecipient[] = [];
  for (const r of opts.cc ?? []) {
    const email = r.email?.trim();
    if (!email) continue;
    if (toList.some((x) => x.email.toLowerCase() === email.toLowerCase())) continue;
    if (ccList.some((x) => x.email.toLowerCase() === email.toLowerCase())) continue;
    ccList.push({ email, name: r.name ?? null });
  }

  function fmt(r: GmailRecipient): string {
    return r.name ? `${formatHeaderName(r.name)} <${r.email}>` : r.email;
  }

  const toHeader = toList.map(fmt).join(", ");
  const ccHeader = ccList.map(fmt).join(", ");

  const headers: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    ...(ccHeader ? [`Cc: ${ccHeader}`] : []),
    `Subject: ${encodeSubject(opts.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ];
  if (opts.inReplyTo) {
    headers.push(`In-Reply-To: ${opts.inReplyTo}`);
    headers.push(`References: ${opts.inReplyTo}`);
  }

  const rfc822 = headers.join("\r\n") + "\r\n\r\n" + opts.text;
  const raw = Buffer.from(rfc822, "utf8").toString("base64url");

  const res = await fetch(GMAIL_DRAFTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gmail draft create failed: ${res.status} — ${text}`);
  }
  const data = (await res.json()) as {
    id: string;
    message: { id: string; threadId: string };
  };
  return {
    draftId: data.id,
    messageId: data.message.id,
    threadId: data.message.threadId,
  };
}

/**
 * Delete a Gmail draft by id. Used when re-creating a draft with different
 * recipients (since Gmail draft update is a full-message replace anyway,
 * delete + create is simpler than tracking the change).
 */
export async function deleteGmailDraft(draftId: string): Promise<void> {
  const { accessToken } = await getValidAccessToken();
  const res = await fetch(`${GMAIL_DRAFTS_URL}/${draftId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Gmail draft delete failed: ${res.status} — ${text}`);
  }
}

/**
 * RFC 2047 encoded-word for non-ASCII subjects. ASCII subjects pass through.
 */
function encodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

/**
 * Quote a header display-name if it contains characters that need it.
 */
function formatHeaderName(name: string): string {
  if (/[,<>"]/.test(name)) {
    return `"${name.replace(/"/g, '\\"')}"`;
  }
  return name;
}
