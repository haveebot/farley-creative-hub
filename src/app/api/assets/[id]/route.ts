/**
 * DELETE /api/assets/[id]
 *
 * Deletes both the DB record and the Blob file.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { deleteAsset, getAsset } from "@/lib/db/assets";
import { deleteBlob } from "@/lib/storage/blob";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) {
    return NextResponse.json({ ok: false, error: "invalid-id" }, { status: 400 });
  }

  const asset = await getAsset(numId);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // Delete blob first; if it fails, leave the record so we don't orphan storage.
  try {
    await deleteBlob(asset.url);
  } catch (err) {
    console.warn("[api/assets DELETE] blob delete failed; continuing", err);
  }

  await deleteAsset(numId);
  return NextResponse.json({ ok: true });
}
