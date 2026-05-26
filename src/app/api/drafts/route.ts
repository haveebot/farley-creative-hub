/**
 * Drafts API.
 *
 *   GET  /api/drafts                — list drafts (optional ?status / ?kind / ?prospect_id)
 *   POST /api/drafts                — create a draft (Claude drafts content
 *                                     from the prompt unless content is
 *                                     supplied directly)
 *
 * POST body:
 *   {
 *     title: string,
 *     kind: DraftKind,
 *     prompt: string,
 *     content?: string,
 *     brand_kit_id?: number,
 *     prospect_id?: number,   // optional — drafts FOR/ABOUT a prospect get
 *                              //           prospect context + auto-log activity
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
import { getProspect, logActivity } from "@/lib/db/prospects";
import { getDefaultVoiceProfile, getVoiceProfile } from "@/lib/db/voice-profiles";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const kindParam = url.searchParams.get("kind");
  const prospectParam = url.searchParams.get("prospect_id");

  const filter: { status?: DraftStatus; kind?: DraftKind; prospect_id?: number } = {};
  if (statusParam && (DRAFT_STATUSES as string[]).includes(statusParam)) {
    filter.status = statusParam as DraftStatus;
  }
  if (kindParam && (DRAFT_KINDS as string[]).includes(kindParam)) {
    filter.kind = kindParam as DraftKind;
  }
  if (prospectParam) {
    const pid = parseInt(prospectParam, 10);
    if (Number.isFinite(pid)) filter.prospect_id = pid;
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
  const prospectIdRaw =
    typeof body.prospect_id === "number"
      ? body.prospect_id
      : typeof body.prospect_id === "string" && body.prospect_id
      ? parseInt(body.prospect_id, 10)
      : null;
  const voiceProfileIdRaw =
    typeof body.voice_profile_id === "number"
      ? body.voice_profile_id
      : typeof body.voice_profile_id === "string" && body.voice_profile_id
      ? parseInt(body.voice_profile_id, 10)
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

  // Resolve brand kit (default to studio).
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

  // Resolve optional prospect context.
  let prospect = null;
  if (prospectIdRaw && Number.isFinite(prospectIdRaw)) {
    prospect = await getProspect(prospectIdRaw as number);
    if (!prospect) {
      return NextResponse.json(
        { ok: false, error: "prospect-not-found" },
        { status: 400 },
      );
    }
  }

  // Resolve optional voice profile (overrides brand kit voice fields).
  // Falls back to default voice profile if one exists and no explicit pick.
  let voice = null;
  if (voiceProfileIdRaw && Number.isFinite(voiceProfileIdRaw)) {
    voice = await getVoiceProfile(voiceProfileIdRaw as number);
    if (!voice) {
      return NextResponse.json(
        { ok: false, error: "voice-profile-not-found" },
        { status: 400 },
      );
    }
  } else {
    voice = await getDefaultVoiceProfile();
  }

  // Draft via Claude unless content was pre-supplied.
  let content: string;
  let modelUsed: string | null = null;
  if (providedContent !== null) {
    content = providedContent;
  } else {
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "prompt-required", message: "Provide a prompt or content." },
        { status: 400 },
      );
    }
    try {
      const result = await draftWithClaude({ kind, prompt, brand, voice, prospect });
      content = result.content;
      modelUsed = result.model;
    } catch (err) {
      console.error("[api/drafts POST] Claude failed", err);
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
      prospect_id: prospect?.id ?? null,
      voice_profile_id: voice?.id ?? null,
      model_used: modelUsed,
      created_by: createdByLabel(auth),
    });

    // If linked to a prospect, auto-log activity so the timeline reflects
    // that a draft was created for them.
    if (prospect) {
      await logActivity({
        prospect_id: prospect.id,
        kind: "note",
        content: `Draft created: "${title}" (${kind})`,
        draft_id: record.id,
        created_by: createdByLabel(auth),
      }).catch((err) =>
        console.warn("[api/drafts POST] auto-log activity failed", err),
      );
    }

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
