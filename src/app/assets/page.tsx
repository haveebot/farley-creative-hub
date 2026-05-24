import { listAssets } from "@/lib/db/assets";
import { listBrandKits } from "@/lib/db/brand-kits";
import TopNav from "../TopNav";
import AssetsPanel from "./AssetsPanel";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const [assets, brandKits] = await Promise.all([
    listAssets(),
    listBrandKits(),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Library
            </p>
            <h1 className="text-2xl font-serif mb-2">Assets</h1>
            <p className="text-sm text-muted leading-relaxed">
              Logos, brand books, design masters, and exports. Files stored in Vercel Blob; the Hub keeps the metadata + the public URL. AI can reference any asset here when drafting copy or generating designs.
            </p>
          </header>
          <AssetsPanel initialAssets={assets} brandKits={brandKits} />
        </div>
      </main>
    </>
  );
}
