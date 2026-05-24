import { listBrandKits } from "@/lib/db/brand-kits";
import { listDrafts } from "@/lib/db/drafts";
import TopNav from "../TopNav";
import DraftsPanel from "./DraftsPanel";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const [drafts, brandKits] = await Promise.all([
    listDrafts(),
    listBrandKits(),
  ]);

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
              Type a prompt + pick a kind + which brand voice to draft in. Claude grounds the draft in that brand kit's voice notes and brand book notes. Drafts from your Claude Code (via MCP) land here too.
            </p>
          </header>
          <DraftsPanel initialDrafts={drafts} brandKits={brandKits} />
        </div>
      </main>
    </>
  );
}
