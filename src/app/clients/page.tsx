/**
 * /clients — account management surface for signed clients.
 *
 * Distinct from /pipeline (sales motion) — /clients is the post-sale view.
 * A "client" = a prospect with status='signed', usually linked to a
 * brand_kit via from_prospect_id. The list joins both tables so each row
 * shows the prospect's identity + linked kit (if promoted).
 *
 * Detail page reuses /pipeline/[id] for now (same data model). When
 * client-specific workflows grow (retainer status, deliverables, SOWs),
 * we'll add a dedicated /clients/[id] surface that frames the same
 * underlying prospect from the account-management angle.
 */
import TopNav from "../TopNav";
import ClientsPanel from "./ClientsPanel";
import { query } from "@/lib/db/client";
import type { Prospect } from "@/lib/pipeline-shared";
import type { BrandKit } from "@/lib/db/brand-kits";

export const dynamic = "force-dynamic";

export type ClientRow = {
  prospect: Prospect;
  brand_kit: Pick<BrandKit, "id" | "name" | "primary_color" | "accent_color"> | null;
  /** Most recent activity timestamp for sorting + "last touched" display. */
  last_activity_at: Date | null;
};

async function listClients(): Promise<ClientRow[]> {
  // Signed prospects + their linked brand_kit (LEFT JOIN — a signed
  // prospect may not have a kit yet) + last activity timestamp.
  const rows = await query<{
    prospect_id: number;
    business_name: string;
    industry: string | null;
    size: string | null;
    city: string | null;
    state: string | null;
    website_url: string | null;
    status: string;
    service_interest: string[];
    notes: string;
    next_action: string | null;
    next_action_date: string | null;
    source: string | null;
    created_at: Date;
    updated_at: Date;
    brand_kit_id: number | null;
    brand_kit_name: string | null;
    brand_kit_primary_color: string | null;
    brand_kit_accent_color: string | null;
    last_activity_at: Date | null;
  }>(
    `SELECT
       p.id AS prospect_id,
       p.business_name,
       p.industry,
       p.size,
       p.city,
       p.state,
       p.website_url,
       p.status,
       p.service_interest,
       p.notes,
       p.next_action,
       p.next_action_date,
       p.source,
       p.created_at,
       p.updated_at,
       k.id AS brand_kit_id,
       k.name AS brand_kit_name,
       k.primary_color AS brand_kit_primary_color,
       k.accent_color AS brand_kit_accent_color,
       (SELECT MAX(created_at) FROM prospect_activity WHERE prospect_id = p.id) AS last_activity_at
       FROM prospects p
       LEFT JOIN brand_kits k ON k.from_prospect_id = p.id
      WHERE p.status = 'signed'
      ORDER BY COALESCE((SELECT MAX(created_at) FROM prospect_activity WHERE prospect_id = p.id), p.updated_at) DESC`,
  );

  return rows.map((r) => ({
    prospect: {
      id: r.prospect_id,
      business_name: r.business_name,
      industry: r.industry as Prospect["industry"],
      size: r.size as Prospect["size"],
      city: r.city,
      state: r.state,
      website_url: r.website_url,
      status: r.status as Prospect["status"],
      service_interest: r.service_interest as Prospect["service_interest"],
      notes: r.notes,
      next_action: r.next_action,
      next_action_date: r.next_action_date,
      source: r.source as Prospect["source"],
      created_at: r.created_at,
      updated_at: r.updated_at,
    },
    brand_kit: r.brand_kit_id
      ? {
          id: r.brand_kit_id,
          name: r.brand_kit_name ?? "(unnamed)",
          primary_color: r.brand_kit_primary_color ?? "",
          accent_color: r.brand_kit_accent_color ?? "",
        }
      : null,
    last_activity_at: r.last_activity_at,
  }));
}

export default async function ClientsPage() {
  const clients = await listClients();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Accounts
            </p>
            <h1 className="text-2xl font-serif mb-2">Clients</h1>
            <p className="text-sm text-muted leading-relaxed">
              Signed clients — brand kit, recent activity, ongoing work. Pipeline is for the sales motion; this is for what comes after the contract.
            </p>
          </header>
          <ClientsPanel initialClients={clients} />
        </div>
      </main>
    </>
  );
}
