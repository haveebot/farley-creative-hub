import { notFound } from "next/navigation";
import { getListing } from "@/lib/db/listings";
import { getAsset } from "@/lib/db/assets";
import TopNav from "../../TopNav";
import ListingEditor from "./ListingEditor";

export const dynamic = "force-dynamic";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isFinite(numId)) notFound();
  const listing = await getListing(numId);
  if (!listing) notFound();

  const asset = listing.asset_id ? await getAsset(listing.asset_id) : null;

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Listing
            </p>
            <h1 className="text-2xl font-serif mb-2">{listing.working_name}</h1>
            <p className="text-xs text-muted">
              <a href="/listings" className="underline">← Listings</a>
            </p>
          </header>
          <ListingEditor initialListing={listing} asset={asset} />
        </div>
      </main>
    </>
  );
}
