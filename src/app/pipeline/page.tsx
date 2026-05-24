import { listProspects } from "@/lib/db/prospects";
import TopNav from "../TopNav";
import PipelinePanel from "./PipelinePanel";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const prospects = await listProspects();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Sales
            </p>
            <h1 className="text-2xl font-serif mb-2">Pipeline</h1>
            <p className="text-sm text-muted leading-relaxed">
              Prospects you're working — where they sit, what's next, when to follow up. Once signed, one click promotes them to a client brand kit so future work draws on their voice automatically.
            </p>
          </header>
          <PipelinePanel initialProspects={prospects} />
        </div>
      </main>
    </>
  );
}
