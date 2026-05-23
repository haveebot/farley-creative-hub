/**
 * POST /api/auth/request
 *
 * Accepts { email } in the body. If the email is in the operator
 * allowlist, sends a magic-link email. Always returns 200 with a
 * generic message — never confirm or deny whether an email is
 * authorized (prevents enumeration).
 */

import { NextResponse } from "next/server";
import { isAllowedOperator } from "@/lib/auth/allowlist";
import { generateMagicLinkToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  let email: string;
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  const allowed = isAllowedOperator(email);

  if (allowed) {
    try {
      const token = generateMagicLinkToken(email);
      const origin = new URL(request.url).origin;
      const link = `${origin}/api/auth/verify?t=${encodeURIComponent(token)}`;

      await sendEmail({
        to: email,
        subject: "Sign in to Farley Creative Hub",
        text: [
          "Click the link below to sign in. The link expires in 15 minutes.",
          "",
          link,
          "",
          "If you didn't request this, you can ignore the email.",
        ].join("\n"),
        html: [
          '<div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 32px; color: #1a1a1a;">',
          '  <h2 style="font-family: ui-serif, Georgia, serif; font-weight: 400; font-size: 22px; margin: 0 0 16px;">Sign in to Farley Creative Hub</h2>',
          '  <p style="margin: 0 0 24px; line-height: 1.6;">Click the button below to sign in. The link expires in 15 minutes.</p>',
          `  <p style="margin: 0 0 24px;"><a href="${link}" style="display: inline-block; padding: 12px 24px; background: #c97d5d; color: #fff; text-decoration: none; border-radius: 6px;">Sign in</a></p>`,
          `  <p style="margin: 24px 0 0; font-size: 13px; color: #6b6b6b;">Or paste this link in your browser:<br><span style="word-break: break-all;">${link}</span></p>`,
          '  <p style="margin: 24px 0 0; font-size: 13px; color: #6b6b6b;">If you didn\'t request this, you can ignore the email.</p>',
          "</div>",
        ].join("\n"),
      });
    } catch (err) {
      console.error("[auth/request] send failed", err);
      // Still return generic ok so we don't leak which emails are valid.
    }
  }

  // Generic response — never indicates whether the email is on the
  // allowlist. Caller shows the same "check your email" message either way.
  return NextResponse.json({ ok: true });
}
