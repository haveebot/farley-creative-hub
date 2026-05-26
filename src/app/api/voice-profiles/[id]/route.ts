/**
 * GET    /api/voice-profiles/[id]
 * PATCH  /api/voice-profiles/[id]
 * DELETE /api/voice-profiles/[id]
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  deleteVoiceProfile,
  getVoiceProfile,
  updateVoiceProfile,
} from "@/lib/db/voice-profiles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const profile = await getVoiceProfile(Number(id));
  if (!profile) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, profile });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.voice_notes === "string") updates.voice_notes = body.voice_notes;
  if (typeof body.writing_samples === "string") updates.writing_samples = body.writing_samples;
  if (Array.isArray(body.always_say)) {
    updates.always_say = (body.always_say as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
  }
  if (Array.isArray(body.never_say)) {
    updates.never_say = (body.never_say as unknown[]).filter(
      (s): s is string => typeof s === "string",
    );
  }
  if (typeof body.audience_persona === "string") {
    updates.audience_persona = body.audience_persona;
  }
  if (typeof body.is_default === "boolean") updates.is_default = body.is_default;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = await updateVoiceProfile(Number(id), updates as any);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  await deleteVoiceProfile(Number(id));
  return NextResponse.json({ ok: true });
}
