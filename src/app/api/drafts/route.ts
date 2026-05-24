/**
 * Drafts API.
 *
 *   GET  /api/drafts                — list drafts (optional ?status= or ?kind=)
 *   POST /api/drafts                — create a draft (Claude drafts content
 *                                     from the prompt unless content is
 *                                     supplied directly)
 *
 * Auth: cookie (UI) or Bearer agent token.
 *
 * POST body:
 *   {
 *     title: string,
 *     kind: DraftKind,
 *     prompt: string,
 *     content?: string,        // skip Claude call when provided
 *     brand_kit_id?: number,   // which voice to use; defaults to studio
 *   }
 */

import { NextResponse } from "next/server";
import { requireAuth, type AuthContext } from "@/lib/auth/require";
import { getBrandKit, getStudioKit } from "@/lib/db/brand-kits";
import {
  createDraft,
  DRAFT_KINDS,
  DRAFT_STATUSES,
  listDrafts,
  type DraftKind,
  type DraftStatus,
} from "@/lib/db/drafts";
import { draftWithClaude } from "@/lib/ai/claude";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");

  const filter: { status?: DraftStatus; kind?: DraftKind } = {};
  if (statusParam && (DRAFT_STATUSES as string[]).includes(statusParam)) {
    filter.status = statusParam as DraftStatus;
  }
  if (kindParam && (DRAFT_KINDS as string[]).includes(kindParam)) {
    filter.kind = kindParam as DraftKind;
  }

  const drafts = await listDrafts(filter);
  return NextResponse.json({ drafts });
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const kindRaw = typeof body.kind === "string" ? body.kind.trim() : "general";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const providedContent = typeof body.content === "string" ? body.content : null;
  const brandKitIdRaw =
    typeof body.brand_kit_id === "number"
      ? body.brand_kit_id
      : typeof body.brand_kit_id === "string"
      ? parseInt(body.brand_kit_id, 10)
      : null;

  if (!title) {
    return NextResponse.json(
      { ok: false, error: "title-required" },
      { status: 400 },
    );
  }

  const kind: DraftKind = (DRAFT_KINDS as string[]).includes(kindRaw)
    ? (kindRaw as DraftKind)
    : "general";

  // Resolve which brand kit voice to use. Default to studio.
  let brand;
  if (brandKitIdRaw && Number.isFinite(brandKitIdRaw)) {
    brand = await getBrandKit(brandKitIdRaw as number);
    if (!brand) {
      return NextResponse.json(
        { ok: false, error: "brand-kit-not-found" },
        { status: 400 },
      );
    }
  } else {
    brand = await getStudioKit();
  }

  // If content wasn't pre-supplied, draft via Claude.
  let content: string;
  let modelUsed: string | null = null;
  if (providedContent !== null) {
    content = providedContent;
  } else {
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "prompt-required", message: "Provide a prompt (for Claude to draft from) or content (to save directly)." },
        { status: 400 },
      );
    }
    try {
      const result = await draftWithClaude({ kind, prompt, brand });
      content = result.content;
      modelUsed = result.model;
    } catch (err) {
      console.error("[api/drafts POST] Claude call failed", err);
      return NextResponse.json(
        { ok: false, error: "draft-failed", message: (err as Error).message },
        { status: 502 },
      );
    }
  }

  try {
    const record = await createDraft({
      title,
      kind,
      prompt,
      content,
      brand_kit_id: brand.id,
      model_used: modelUsed,
      created_by: createdByLabel(auth),
    });
    return NextResponse.json({ ok: true, draft: record });
  } catch (err) {
    console.error("[api/drafts POST] DB insert failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}

function createdByLabel(auth: AuthContext): string {
  return auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;
}
