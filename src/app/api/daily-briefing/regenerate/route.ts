/**
 * POST /api/daily-briefing/regenerate
 *
 * Forces a fresh briefing for today (overwrites whatever is cached).
 * Used by the manual "refresh" button on the Hub home.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  gatherBriefingContext,
  generateDailyBriefing,
} from "@/lib/ai/daily-briefing";
import { todayDateString, upsertBriefing } from "@/lib/db/daily-briefings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const generatedBy = auth.type === "user" ? auth.email : `agent:${auth.tokenName}`;

  try {
    const context = await gatherBriefingContext();
    const content = await generateDailyBriefing(context);
    const briefing = await upsertBriefing({
      for_date: todayDateString(),
      content,
      context_summary: context,
      generated_by: generatedBy,
    });
    return NextResponse.json({ ok: true, briefing });
  } catch (err) {
    console.error("[daily-briefing/regenerate] failed", err);
    return NextResponse.json(
      { ok: false, error: "server-error", message: (err as Error).message },
      { status: 500 },
    );
  }
}
