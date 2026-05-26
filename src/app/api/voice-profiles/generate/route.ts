/**
 * POST /api/voice-profiles/generate
 *
 * Generate a draft voice profile from existing writing samples.
 * Accepts either:
 *   - { samples: "..." } — pasted text the operator wants analyzed
 *   - { fromExisting: true, sources?: ["drafts","listings","pipeline"] } —
 *     pulls existing Hub content (Etsy listings, drafts, pipeline notes)
 *     and analyzes that
 *
 * Returns extracted voice fields WITHOUT saving. Operator reviews +
 * edits, then POSTs to /api/voice-profiles to create the profile.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { extractVoiceFromSamples } from "@/lib/ai/voice-extractor";
import { gatherExistingWriting } from "@/lib/db/voice-profiles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  samples?: string;
  fromExisting?: boolean;
  sources?: Array<"drafts" | "listings" | "pipeline">;
};

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  let samples = (body.samples ?? "").trim();
  let sourceCounts: Record<string, number> = {};

  if (body.fromExisting) {
    const gathered = await gatherExistingWriting({ sources: body.sources });
    if (samples) {
      samples = `${samples}\n\n--- EXISTING HUB CONTENT ---\n\n${gathered.samples}`;
    } else {
      samples = gathered.samples;
    }
    sourceCounts = gathered.sources;
  }

  if (!samples || samples.length < 100) {
    return NextResponse.json(
      {
        ok: false,
        error: "not-enough-samples",
        message:
          "Need at least ~100 characters of real writing to analyze. Paste some samples or set fromExisting:true after creating some Hub drafts / Etsy listings.",
        source_counts: sourceCounts,
      },
      { status: 400 },
    );
  }

  try {
    const extracted = await extractVoiceFromSamples(samples);
    return NextResponse.json({
      ok: true,
      extracted,
      source_counts: sourceCounts,
      sample_length: samples.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "extraction-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
