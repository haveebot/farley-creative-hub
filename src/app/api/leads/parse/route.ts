/**
 * POST /api/leads/parse
 *
 * Parse raw lead text (or fetch from a URL) into structured fields.
 *
 * Body:
 *   { text: string }          — paste the posting/article body
 *   { url: string }           — fetch the URL server-side (best-effort;
 *                                Indeed/LinkedIn typically block)
 *   { url, text }             — both fine; text wins if both supplied
 *
 * Returns: { ok: true, parsed: ParsedLead }
 *
 * The parsed result is NOT auto-saved. Caller (the form) populates
 * fields with the result and the operator reviews + saves.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { fetchUrlToText, parseLead } from "@/lib/ai/parse-lead";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  let text = typeof body.text === "string" ? body.text.trim() : "";

  if (!text && url) {
    try {
      text = await fetchUrlToText(url);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: "fetch-failed",
          message: `Couldn't fetch the URL (${(err as Error).message}). Many job sites block automated fetches — try pasting the posting text instead.`,
        },
        { status: 502 },
      );
    }
  }

  if (!text) {
    return NextResponse.json(
      { ok: false, error: "no-content", message: "Pass either text or a fetchable URL." },
      { status: 400 },
    );
  }

  try {
    const parsed = await parseLead(text);
    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    console.error("[api/leads/parse] Claude parse failed", err);
    return NextResponse.json(
      { ok: false, error: "parse-failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
