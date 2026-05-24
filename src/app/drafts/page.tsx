import { listDrafts } from "@/lib/db/drafts";
import TopNav from "../TopNav";
import DraftsPanel from "./DraftsPanel";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const drafts = await listDrafts();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Library
            </p>
            <h1 className="text-2xl font-serif mb-2">Drafts</h1>
            <p className="text-sm text-muted leading-relaxed">
              Type a prompt + pick a kind → Claude drafts it in your studio voice, grounded in your brand book notes and voice notes. Drafts created from your Claude Code session (via MCP) land here too. Review, edit, mark approved.
            </p>
          </header>
          <DraftsPanel initialDrafts={drafts} />
        </div>
      </main>
    </>
  );
}
