/**
 * DELETE /api/agent-tokens/[id]
 *
 * Revoke a token. Doesn't actually delete the row (keeps audit trail);
 * sets revoked_at, after which the token no longer authenticates.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { revokeAgentToken } from "@/lib/db/agent-tokens";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  if (auth.type !== "user") {
    return NextResponse.json({ ok: false, error: "user-only" }, { status: 403 });
  }

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  try {
    await revokeAgentToken(numId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/agent-tokens DELETE] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}
