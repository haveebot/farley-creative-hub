/**
 * POST /api/auth/signup
 *
 * Creates the operator account. Allowed ONLY when no users exist yet
 * (first-user-becomes-owner). After the first signup, this route
 * returns 403 and the /setup page redirects to /login.
 *
 * Body: { email, password }
 * Returns: 200 { ok: true } with session cookie set, or 4xx with error.
 */

import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { countUsers, createUser } from "@/lib/db/users";

export async function POST(request: Request) {
  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim() : "";
    password = typeof body?.password === "string" ? body.password : "";
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

  // Gate: only allow if no users exist yet.
  const existing = await countUsers();
  if (existing > 0) {
    return NextResponse.json(
      { ok: false, error: "setup-already-complete" },
      { status: 403 },
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
