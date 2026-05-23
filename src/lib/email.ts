/**
 * Email sending via Resend.
 *
 * Phase 1 uses the platform name + sender from env vars so brand
 * identity stays configurable. Once the in-Hub brand-identity surface
 * is wired, the sender display name + reply-to flow from the database
 * record instead.
 */

import { Resend } from "resend";

function getClient(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY not set");
  }
  return new Resend(key);
}

function getFrom(): string {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL not set. Set it to a verified Resend sender (e.g. `Farley Creative Hub <hub@farleycreative.com>`).",
    );
  }
  return from;
}

export type SendOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmail(opts: SendOptions): Promise<void> {
  const resend = getClient();
  const result = await resend.emails.send({
    from: getFrom(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
}
