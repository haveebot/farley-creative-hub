/**
 * POST /api/workspace/disconnect
 *
 * Deletes the active Workspace connection. Cadence sends will start
 * falling back to Resend (or queued-no-resend) once disconnected.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require";
import { deleteConnection, getActiveConnection } from "@/lib/db/workspace-connections";

export async function POST() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const conn = await getActiveConnection();
  if (conn) {
    await deleteConnection(conn.id);
  }

  return NextResponse.redirect(
    new URL("/settings/workspace", process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://hub.farleycreative.com"),
  );
}
