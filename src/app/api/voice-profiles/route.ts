/**
 * GET  /api/voice-profiles  — list all voice profiles
 * POST /api/voice-profiles  — create a new voice profile
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  createVoiceProfile,
  listVoiceProfiles,
} from "@/lib/db/voice-profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const profiles = await listVoiceProfiles();
  return NextResponse.json({ ok: true, profiles });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "name-required" },
      { status: 400 },
    );
  }

  try {
    const profile = await createVoiceProfile({
      name,
      description: typeof body.description === "string" ? body.description : undefined,
      voice_notes: typeof body.voice_notes === "string" ? body.voice_notes : undefined,
      writing_samples:
        typeof body.writing_samples === "string" ? body.writing_samples : undefined,
      always_say: Array.isArray(body.always_say)
        ? (body.always_say as unknown[]).filter((s): s is string => typeof s === "string")
        : undefined,
      never_say: Array.isArray(body.never_say)
        ? (body.never_say as unknown[]).filter((s): s is string => typeof s === "string")
        : undefined,
      audience_persona:
        typeof body.audience_persona === "string" ? body.audience_persona : undefined,
      is_default: body.is_default === true,
    });
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
