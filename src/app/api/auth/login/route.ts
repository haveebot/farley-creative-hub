/**
 * POST /api/auth/login
 *
 * Verifies email + password against the users table. On success, sets
 * the session cookie and returns 200. On failure, returns 401 with a
 * generic message (no enumeration).
 *
 * Body: { email, password }
 */

import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth/session";
import { findUserByEmail, verifyPassword } from "@/lib/db/users";

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

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "invalid-credentials" }, { status: 401 });
  }

  const user = await findUserByEmail(email);
  if (!user) {
    // Run a dummy bcrypt compare to keep timing consistent — prevents
    // user-enumeration via response timing.
    await verifyPassword(
      { ...placeholderUser(), password_hash: "$2a$12$placeholderplaceholderplaceholderplacehold" },
      password,
    );
    return NextResponse.json({ ok: false, error: "invalid-credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(user, password);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid-credentials" }, { status: 401 });
  }

  await setSessionCookie(user.email);
  return NextResponse.json({ ok: true });
}

function placeholderUser() {
  return {
    id: 0,
    email: "",
    password_hash: "",
    role: "",
    created_at: new Date(),
    updated_at: new Date(),
  };
}
