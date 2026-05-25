import { notFound } from "next/navigation";
import { getListing } from "@/lib/db/listings";
import { getAsset, listAssets } from "@/lib/db/assets";
import { listImagesForListing } from "@/lib/db/listing-images";
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

  const [asset, imagesRaw, allAssets] = await Promise.all([
    listing.asset_id ? getAsset(listing.asset_id) : Promise.resolve(null),
    listImagesForListing(numId),
    listAssets(),
  ]);

  const imageAssets = allAssets.filter((a) => a.mime_type.startsWith("image/"));
  const imageAssetById = new Map(imageAssets.map((a) => [a.id, a]));
  const images = imagesRaw.map((img) => ({
    ...img,
    asset: imageAssetById.get(img.asset_id),
  }));

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
          <ListingEditor
            initialListing={listing}
            asset={asset}
            initialImages={images}
            imageAssets={imageAssets}
          />
        </div>
      </main>
    </>
  );
}
