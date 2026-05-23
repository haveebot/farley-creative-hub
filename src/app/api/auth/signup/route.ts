/**
 * POST /api/auth/signup
 *
 * Creates a new operator account. Gated by SIGNUP_KEY — anyone with
 * the key can sign up. The key is shared out-of-band between trusted
 * operators (Winston, Collie). When we eventually build an in-Hub
 * invite flow, this gate can be replaced with per-invite tokens.
 *
 * Body: { email, password, key }
 * Returns: 200 { ok: true } with session cookie set, or 4xx with error.
 */

import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { createUser, findUserByEmail } from "@/lib/db/users";

export async function POST(request: Request) {
  let email = "";
  let password = "";
  let key = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
    key = typeof body?.key === "string" ? body.key.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }
  if (password.length < 10) {
    return NextResponse.json(
      { ok: false, error: "password-too-short", message: "Password must be at least 10 characters." },
      { status: 400 },
    );
  }

  // Gate: signup key must match.
  const expectedKey = process.env.SIGNUP_KEY;
  if (!expectedKey) {
    console.error("[auth/signup] SIGNUP_KEY env var not configured");
    return NextResponse.json(
      { ok: false, error: "server-misconfigured", message: "Signup is not enabled. Contact the operator." },
      { status: 503 },
    );
  }
  if (!constantTimeEqual(key, expectedKey)) {
    return NextResponse.json(
      { ok: false, error: "invalid-key", message: "Signup key didn't match." },
      { status: 403 },
    );
  }

  // Check for existing email.
  const existing = await findUserByEmail(email);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "email-taken", message: "An account with that email already exists." },
      { status: 409 },
    );
  }

  try {
    const user = await createUser({ email, password });
    await setSessionCookie(user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/signup] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
