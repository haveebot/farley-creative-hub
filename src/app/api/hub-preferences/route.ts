/**
 * Hub preferences API.
 *
 *   GET /api/hub-preferences   — return Hub theme
 *   PUT /api/hub-preferences   — update Hub theme
 *
 * Auth: cookie (UI) or Bearer agent token. Either grants full access
 * for now; per-token scoping is a Phase 2+ concern.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  getHubPreferences,
  updateHubPreferences,
  type HubPreferencesUpdate,
} from "@/lib/db/hub-preferences";

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const prefs = await getHubPreferences();
  return NextResponse.json({ prefs });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const updates: HubPreferencesUpdate = {};
  if (typeof body.hub_label === "string") updates.hub_label = body.hub_label.trim();
  if (typeof body.accent_color === "string") updates.accent_color = body.accent_color.trim();

  if (updates.accent_color && !HEX_COLOR.test(updates.accent_color)) {
    return NextResponse.json(
      { ok: false, error: "invalid-color", message: "Accent color must be a hex value like #c97d5d." },
      { status: 400 },
    );
  }

  try {
    const prefs = await updateHubPreferences(updates);
    return NextResponse.json({ ok: true, prefs });
  } catch (err) {
    console.error("[api/hub-preferences PUT] failed", err);
    return NextResponse.json({ ok: false, error: "server-error" }, { status: 500 });
  }
}
