import { notFound } from "next/navigation";
import { getLead } from "@/lib/db/leads";
import TopNav from "../../../TopNav";
import PipelineTabs from "../../PipelineTabs";
import LeadDetail from "./LeadDetail";

export const dynamic = "force-dynamic";

export default async function LeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) return notFound();

  const lead = await getLead(numId);
  if (!lead) return notFound();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Sales · Leads
            </p>
            <h1 className="text-2xl font-serif mb-2">
              {lead.business_name || lead.source_title || "Untitled lead"}
            </h1>
            <p className="text-xs text-muted">
              <a href="/pipeline/leads" className="underline">← Leads</a>
            </p>
          </header>
          <PipelineTabs active="leads" />
          <LeadDetail initialLead={lead} />
        </div>
      </main>
    </>
  );
}
