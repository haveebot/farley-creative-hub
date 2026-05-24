/**
 * POST /api/workspace/disconnect?purpose=sending|reading_leads
 *
 * Deletes the specified Workspace connection. After disconnecting
 * the 'sending' slot, cadence emails will queue without drafting
 * until reconnected. After disconnecting 'reading_leads', lead-poll
 * will skip with a "no-workspace-connection" notice.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import {
  CONNECTION_PURPOSES,
  deleteConnectionByPurpose,
  type ConnectionPurpose,
} from "@/lib/db/workspace-connections";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const purposeParam = url.searchParams.get("purpose") ?? "sending";
  const purpose: ConnectionPurpose =
    (CONNECTION_PURPOSES as string[]).includes(purposeParam)
      ? (purposeParam as ConnectionPurpose)
      : "sending";

  await deleteConnectionByPurpose(purpose);

  return NextResponse.redirect(
    new URL(
      "/settings/workspace",
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://hub.farleycreative.com",
    ),
  );
}
