import { listLeads } from "@/lib/db/leads";
import TopNav from "../../TopNav";
import PipelineTabs from "../PipelineTabs";
import LeadsPanel from "./LeadsPanel";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Sales
            </p>
            <h1 className="text-2xl font-serif mb-2">Leads</h1>
            <p className="text-sm text-muted leading-relaxed">
              Sourced signals to triage — job postings, RFPs, article mentions, referrals. Promising ones convert into active prospects with one click; the prospect carries the lead's source context.
            </p>
          </header>
          <PipelineTabs active="leads" />
          <LeadsPanel initialLeads={leads} />
        </div>
      </main>
    </>
  );
}
