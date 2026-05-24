/**
 * Cross-surface recent activity feed.
 *
 * Union query across drafts, prospects, prospect_activity, leads,
 * assets. Each surface emits an ActivityEvent with a consistent
 * shape so the UI can render them uniformly.
 *
 * For Phase 1 this is a TS-side merge of N small queries. If volume
 * grows we'd replace with a single SQL UNION ALL or a dedicated
 * activity_events table.
 */

import { query } from "./client";

export type ActivityEventKind =
  | "draft_created"
  | "draft_status"
  | "prospect_created"
  | "prospect_activity"
  | "lead_captured"
  | "lead_converted"
  | "asset_uploaded";

export type ActivityEvent = {
  id: string; // composite "kind:row-id"
  kind: ActivityEventKind;
  at: Date;
  title: string;
  subtitle: string | null;
  href: string | null;
  actor: string;
};

const DEFAULT_LIMIT = 20;

export async function listRecentActivity(limit = DEFAULT_LIMIT): Promise<ActivityEvent[]> {
  // Pull a slightly larger window from each surface to leave room for merging.
  const perSurface = limit + 5;

  const [drafts, prospects, prospectActivity, leads, assets] = await Promise.all([
    query<{
      id: number; title: string; kind: string; status: string;
      created_by: string; created_at: Date;
    }>(
      `SELECT id, title, kind, status, created_by, created_at
         FROM drafts
         ORDER BY created_at DESC
         LIMIT $1`,
      [perSurface],
    ),
    query<{ id: number; business_name: string; status: string; created_at: Date }>(
      `SELECT id, business_name, status, created_at
         FROM prospects
         ORDER BY created_at DESC
         LIMIT $1`,
      [perSurface],
    ),
    query<{
      id: number; prospect_id: number; kind: string; content: string;
      created_by: string; created_at: Date; business_name: string;
    }>(
      `SELECT pa.id, pa.prospect_id, pa.kind, pa.content, pa.created_by, pa.created_at,
              p.business_name
         FROM prospect_activity pa
         JOIN prospects p ON p.id = pa.prospect_id
         ORDER BY pa.created_at DESC
         LIMIT $1`,
      [perSurface],
    ),
    query<{
      id: number; business_name: string | null; source_title: string | null;
      source_type: string; status: string; converted_to_prospect_id: number | null;
      found_by: string; created_at: Date; updated_at: Date;
    }>(
      `SELECT id, business_name, source_title, source_type, status,
              converted_to_prospect_id, found_by, created_at, updated_at
         FROM leads
         ORDER BY GREATEST(created_at, updated_at) DESC
         LIMIT $1`,
      [perSurface],
    ),
    query<{
      id: number; name: string; kind: string; uploaded_by: string; created_at: Date;
    }>(
      `SELECT id, name, kind, uploaded_by, created_at
         FROM assets
         ORDER BY created_at DESC
         LIMIT $1`,
      [perSurface],
    ),
  ]);

  const events: ActivityEvent[] = [];

  for (const d of drafts) {
    events.push({
      id: `draft_created:${d.id}`,
      kind: "draft_created",
      at: d.created_at,
      title: `Draft created · ${d.title}`,
      subtitle: `${labelizeKind(d.kind)} · ${d.status}`,
      href: "/drafts",
      actor: d.created_by,
    });
  }

  for (const p of prospects) {
    events.push({
      id: `prospect_created:${p.id}`,
      kind: "prospect_created",
      at: p.created_at,
      title: `Prospect added · ${p.business_name}`,
      subtitle: `Status: ${p.status}`,
      href: `/pipeline/${p.id}`,
      actor: "you",
    });
  }

  for (const a of prospectActivity) {
    events.push({
      id: `prospect_activity:${a.id}`,
      kind: "prospect_activity",
      at: a.created_at,
      title: `${labelizeActivityKind(a.kind)} · ${a.business_name}`,
      subtitle: a.content ? truncate(a.content, 120) : null,
      href: `/pipeline/${a.prospect_id}`,
      actor: a.created_by,
    });
  }

  for (const l of leads) {
    if (l.status === "converted" && l.converted_to_prospect_id) {
      events.push({
        id: `lead_converted:${l.id}`,
        kind: "lead_converted",
        at: l.updated_at,
        title: `Lead converted → prospect`,
        subtitle: l.business_name ?? l.source_title ?? "Untitled lead",
        href: `/pipeline/${l.converted_to_prospect_id}`,
        actor: l.found_by,
      });
    } else {
      events.push({
        id: `lead_captured:${l.id}`,
        kind: "lead_captured",
        at: l.created_at,
        title: `Lead captured · ${l.business_name ?? l.source_title ?? "Untitled"}`,
        subtitle: `${l.source_type.replace(/_/g, " ")} · ${l.status}`,
        href: `/pipeline/leads/${l.id}`,
        actor: l.found_by,
      });
    }
  }

  for (const a of assets) {
    events.push({
      id: `asset_uploaded:${a.id}`,
      kind: "asset_uploaded",
      at: a.created_at,
      title: `Asset uploaded · ${a.name}`,
      subtitle: a.kind.replace(/_/g, " "),
      href: "/assets",
      actor: a.uploaded_by,
    });
  }

  events.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  return events.slice(0, limit);
}

function labelizeKind(k: string): string {
  return k.replace(/_/g, " ");
}

function labelizeActivityKind(k: string): string {
  switch (k) {
    case "email_sent": return "Email sent";
    case "call": return "Call logged";
    case "meeting": return "Meeting logged";
    case "proposal_sent": return "Proposal sent";
    case "status_change": return "Status changed";
    case "note": return "Note added";
    default: return k.replace(/_/g, " ");
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
