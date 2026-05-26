/**
 * POST /api/voice-profiles/seed-from-brand-kit
 *
 * One-click migration: pulls the studio brand kit's voice fields
 * (voice_notes, writing_samples, always_say, never_say, audience_persona)
 * into a new voice profile named "Studio voice" and marks it default.
 *
 * Idempotent — if a profile with the seeded name already exists, returns
 * it without creating a duplicate. Safe to call multiple times.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { getStudioKit } from "@/lib/db/brand-kits";
import { query } from "@/lib/db/client";
import { createVoiceProfile } from "@/lib/db/voice-profiles";
import type { VoiceProfile } from "@/lib/voice-profiles-shared";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const brand = await getStudioKit();
  if (!brand) {
    return NextResponse.json(
      { ok: false, error: "no-studio-brand-kit", message: "No studio brand kit found" },
      { status: 404 },
    );
  }

  const SEED_NAME = "Studio voice";

  const existing = await query<VoiceProfile>(
    `SELECT * FROM voice_profiles WHERE name = $1 LIMIT 1`,
    [SEED_NAME],
  );
  if (existing.length > 0) {
    return NextResponse.json({
      ok: true,
      profile: existing[0],
      created: false,
      message: "Profile already exists — returned existing.",
    });
  }

  const profile = await createVoiceProfile({
    name: SEED_NAME,
    description: `Seeded from the ${brand.name} brand kit.`,
    voice_notes: brand.voice_notes ?? "",
    writing_samples: brand.writing_samples ?? "",
    always_say: brand.always_say ?? [],
    never_say: brand.never_say ?? [],
    audience_persona: brand.audience_persona ?? "",
    is_default: true,
  });

  return NextResponse.json({ ok: true, profile, created: true });
}
