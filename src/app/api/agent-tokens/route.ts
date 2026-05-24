/**
 * Agent tokens API.
 *
 *   GET  /api/agent-tokens — list tokens (no plaintext returned ever)
 *   POST /api/agent-tokens — create a new token (plaintext returned ONCE)
 *
 * Both require a UI session — agents can't create or rotate their own
 * tokens. Token management is operator-only.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { createAgentToken, listAgentTokens } from "@/lib/db/agent-tokens";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  if (auth.type !== "user") {
    return NextResponse.json({ ok: false, error: "user-only" }, { status: 403 });
  }

  const tokens = await listAgentTokens();
  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  if (auth.type !== "user") {
    return NextResponse.json({ ok: false, error: "user-only" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "name-required" }, { status: 400 });
  }

  try {
    const { plaintext, record } = await createAgentToken(name);
    // Plaintext returned ONCE — never recoverable.
    return NextResponse.json({ ok: true, token: plaintext, record });
  } catch (err) {
    console.error("[api/agent-tokens POST] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}
