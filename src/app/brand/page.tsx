import { listBrandKits } from "@/lib/db/brand-kits";
import TopNav from "../TopNav";
import BrandKitsList from "./BrandKitsList";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const kits = await listBrandKits();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Brand
            </p>
            <h1 className="text-2xl font-serif mb-2">Brand kits</h1>
            <p className="text-sm text-muted leading-relaxed">
              Your studio's brand and any client brand kits you maintain. Each kit's voice and palette is used to draft on-brand content. Hub look-and-feel is separate — see <a href="/settings" className="underline">Settings</a>.
            </p>
          </header>
          <BrandKitsList initialKits={kits} />
        </div>
      </main>
    </>
  );
}
