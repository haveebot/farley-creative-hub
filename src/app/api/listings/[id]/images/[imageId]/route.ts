/**
 * DELETE /api/listings/[id]/images/[imageId] — detach an image from a listing.
 *
 * Note: this only removes the Hub-side attachment. If the listing has already
 * been pushed to Etsy AND the image was uploaded there, the Etsy-side image
 * remains until the listing is republished.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { detachImage } from "@/lib/db/listing-images";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id, imageId } = await params;
  await detachImage(Number(id), Number(imageId));
  return NextResponse.json({ ok: true });
}
