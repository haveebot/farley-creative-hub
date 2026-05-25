import { listAssets } from "@/lib/db/assets";
import { listBrandKits } from "@/lib/db/brand-kits";
import TopNav from "../../TopNav";
import NewListingForm from "./NewListingForm";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const [assets, brandKits] = await Promise.all([
    listAssets(),
    listBrandKits(),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Listings
            </p>
            <h1 className="text-2xl font-serif mb-2">Prep a new listing</h1>
            <p className="text-sm text-muted leading-relaxed">
              Tell Claude what the design is (type, use case, customization,
              delivery format). Optionally link the design file. Claude drafts
              the full Etsy listing package — title, description, tags,
              keywords — in your studio voice. You review and edit anything
              before posting.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/listings" className="underline">← Listings</a>
            </p>
          </header>
          <NewListingForm assets={assets} brandKits={brandKits} />
        </div>
      </main>
    </>
  );
}
