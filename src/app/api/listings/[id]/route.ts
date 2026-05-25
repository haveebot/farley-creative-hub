/**
 * Single listing API.
 *
 *   GET    /api/listings/[id]   — read
 *   PATCH  /api/listings/[id]   — update any editable field
 *   DELETE /api/listings/[id]   — delete
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  deleteListing,
  getListing,
  updateListing,
} from "@/lib/db/listings";
import { LISTING_STATUSES, type ListingStatus } from "@/lib/listings-shared";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const listing = await getListing(Number(id));
  if (!listing) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, listing });
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
  if (typeof body.working_name === "string") updates.working_name = body.working_name.trim();
  if (typeof body.context_notes === "string") updates.context_notes = body.context_notes;
  if (typeof body.title === "string") updates.title = body.title.slice(0, 140);
  if (typeof body.description === "string") updates.description = body.description;
  if (Array.isArray(body.tags)) {
    updates.tags = (body.tags as unknown[])
      .filter((t): t is string => typeof t === "string")
      .slice(0, 13);
  }
  if (Array.isArray(body.keywords)) {
    updates.keywords = (body.keywords as unknown[]).filter(
      (k): k is string => typeof k === "string",
    );
  }
  if (typeof body.status === "string" && (LISTING_STATUSES as string[]).includes(body.status)) {
    updates.status = body.status as ListingStatus;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = await updateListing(Number(id), updates as any);
    return NextResponse.json({ ok: true, listing });
  } catch (err) {
    console.error("[api/listings PATCH] failed", err);
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
  try {
    await deleteListing(Number(id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
