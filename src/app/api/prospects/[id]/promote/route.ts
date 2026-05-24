/**
 * POST /api/prospects/[id]/promote
 *
 * Promote a signed prospect to a client brand kit. Creates a new
 * brand_kits row using the prospect's info, links it back via
 * from_prospect_id, and flips the prospect status to 'signed' if it
 * isn't already.
 *
 * Returns the new brand kit + updated prospect.
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { query, queryOne } from "@/lib/db/client";
import {
  getProspect,
  logActivity,
  updateProspect,
} from "@/lib/db/prospects";
import type { BrandKit } from "@/lib/db/brand-kits";

export async function POST(
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

  const prospect = await getProspect(numId);
  if (!prospect) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }

  // If already promoted, return existing kit.
  const existing = await queryOne<BrandKit>(
    `SELECT * FROM brand_kits WHERE from_prospect_id = $1 LIMIT 1`,
    [prospect.id],
  );
  if (existing) {
    return NextResponse.json({ ok: true, kit: existing, prospect, alreadyExisted: true });
  }

  // Build a starter bio from notes if present.
  const bio = (prospect.notes ?? "").trim().slice(0, 400);

  try {
    const kit = await queryOne<BrandKit>(
      `INSERT INTO brand_kits
        (name, is_studio_self, bio, etsy_shop_url, website_url, from_prospect_id)
       VALUES ($1, FALSE, $2, '', COALESCE($3, ''), $4)
       RETURNING *`,
      [prospect.business_name, bio, prospect.website_url ?? null, prospect.id],
    );
    if (!kit) throw new Error("Failed to create brand kit");

    // Flip prospect to signed if it isn't already, and log activity.
    const updatedProspect =
      prospect.status === "signed"
        ? prospect
        : await updateProspect(prospect.id, { status: "signed" });

    await logActivity({
      prospect_id: prospect.id,
      kind: "status_change",
      content: `Promoted to client brand kit #${kit.id} (${kit.name})`,
      draft_id: null,
      created_by: createdByLabel(auth),
    }).catch((err) =>
      console.warn("[promote] auto-log activity failed", err),
    );

    return NextResponse.json({ ok: true, kit, prospect: updatedProspect });
  } catch (err) {
    console.error("[api/prospects/[id]/promote] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}

// Suppress unused import linter (query reserved for future read patterns)
void query;
