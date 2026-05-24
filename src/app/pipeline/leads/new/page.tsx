import TopNav from "../../../TopNav";
import PipelineTabs from "../../PipelineTabs";
import NewLeadForm from "./NewLeadForm";

export const dynamic = "force-dynamic";

export default function NewLeadPage() {
  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Sales · Leads
            </p>
            <h1 className="text-2xl font-serif mb-2">New lead</h1>
            <p className="text-sm text-muted leading-relaxed">
              Paste the source (URL + raw content) and any context you have. You don't need to know everything — fields you fill in get carried into the prospect if you convert this later.
            </p>
          </header>
          <PipelineTabs active="leads" />
          <NewLeadForm />
        </div>
      </main>
    </>
  );
}
