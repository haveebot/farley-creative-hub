/**
 * Assets API.
 *
 *   GET  /api/assets             — list assets (optional ?kind= or ?brand_kit_id=)
 *   POST /api/assets             — upload a file (multipart) + create record
 *
 * Auth: cookie (UI) or Bearer agent token.
 *
 * Upload flow: multipart form with fields:
 *   file        — the file body (required)
 *   name        — friendly name (optional; falls back to filename)
 *   kind        — asset kind (optional, default 'general')
 *   brand_kit_id— optional integer
 *   description — optional text
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import {
  ASSET_KINDS,
  createAsset,
  listAssets,
  type AssetKind,
} from "@/lib/db/assets";
import { uploadBlob } from "@/lib/storage/blob";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const kindParam = url.searchParams.get("kind");
  const brandKitParam = url.searchParams.get("brand_kit_id");

  const filter: { kind?: AssetKind; brand_kit_id?: number | null } = {};
  if (kindParam && (ASSET_KINDS as string[]).includes(kindParam)) {
    filter.kind = kindParam as AssetKind;
  }
  if (brandKitParam !== null) {
    if (brandKitParam === "null" || brandKitParam === "") {
      filter.brand_kit_id = null;
    } else {
      const id = parseInt(brandKitParam, 10);
      if (Number.isFinite(id)) filter.brand_kit_id = id;
    }
  }

  const assets = await listAssets(filter);
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "expected-multipart" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "file-required" }, { status: 400 });
  }

  const name = (form.get("name") as string | null)?.trim() || file.name;
  const kindRaw = (form.get("kind") as string | null)?.trim() || "general";
  const kind: AssetKind = (ASSET_KINDS as string[]).includes(kindRaw)
    ? (kindRaw as AssetKind)
    : "general";
  const brandKitIdRaw = (form.get("brand_kit_id") as string | null)?.trim();
  const brand_kit_id =
    brandKitIdRaw && brandKitIdRaw !== "" ? parseInt(brandKitIdRaw, 10) : null;
  const description = (form.get("description") as string | null)?.trim() ?? "";

  // Upload to Blob first.
  let uploaded;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    uploaded = await uploadBlob(
      `assets/${kind}/${file.name}`,
      buffer,
      file.type || "application/octet-stream",
    );
  } catch (err) {
    console.error("[api/assets POST] blob upload failed", err);
    return NextResponse.json(
      { ok: false, error: "upload-failed", message: (err as Error).message },
      { status: 500 },
    );
  }

  // Create DB record.
  try {
    const record = await createAsset({
      name,
      filename: file.name,
      url: uploaded.url,
      mime_type: uploaded.contentType,
      size_bytes: file.size,
      kind,
      brand_kit_id: Number.isFinite(brand_kit_id as number) ? (brand_kit_id as number) : null,
      description,
      uploaded_by: uploadedByLabel(auth),
    });
    return NextResponse.json({ ok: true, asset: record });
  } catch (err) {
    console.error("[api/assets POST] db insert failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function uploadedByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
