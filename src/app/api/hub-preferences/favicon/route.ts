/**
 * POST /api/hub-preferences/favicon
 *
 * Uploads a custom favicon to Vercel Blob and persists the URL on
 * hub_preferences. Multipart form-data with a "file" field.
 *
 * DELETE /api/hub-preferences/favicon
 *
 * Clears the custom favicon URL — /icon falls back to the generated mark.
 */

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireAuth } from "@/lib/auth/require";
import { updateHubPreferences } from "@/lib/db/hub-preferences";

export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024; // 500KB — favicons should be small
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/x-icon", "image/svg+xml", "image/webp"];

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-form" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file-required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "empty-file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: "file-too-large",
        detail: `Max ${MAX_BYTES / 1024}KB. Favicons are small images; resize before uploading.`,
      },
      { status: 400 },
    );
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "unsupported-type",
        detail: `Allowed: PNG, JPEG, ICO, SVG, WebP. Got ${file.type || "unknown"}.`,
      },
      { status: 400 },
    );
  }

  try {
    // Stable name so the Blob path is predictable, but include a
    // timestamp to bust browser caches when the operator replaces it.
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `favicons/hub-${Date.now()}.${ext}`;
    const blob = await put(path, file, {
      access: "public",
      contentType: file.type,
    });

    const prefs = await updateHubPreferences({ favicon_url: blob.url });
    return NextResponse.json({ ok: true, favicon_url: blob.url, prefs });
  } catch (err) {
    console.error("[api/hub-preferences/favicon POST] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  try {
    const prefs = await updateHubPreferences({ favicon_url: null });
    return NextResponse.json({ ok: true, prefs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
