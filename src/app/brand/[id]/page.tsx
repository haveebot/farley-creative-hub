import { notFound } from "next/navigation";
import { getBrandKit } from "@/lib/db/brand-kits";
import TopNav from "../../TopNav";
import BrandKitForm from "../BrandKitForm";
import BrandBookUploader from "./BrandBookUploader";

export const dynamic = "force-dynamic";

export default async function BrandKitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) return notFound();

  const kit = await getBrandKit(numId);
  if (!kit) return notFound();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Brand · {kit.is_studio_self ? "Studio" : "Client"}
            </p>
            <h1 className="text-2xl font-serif mb-2">{kit.name}</h1>
            <p className="text-sm text-muted leading-relaxed">
              {kit.is_studio_self
                ? "Your studio's own brand. Voice, palette, and brand book here drive every AI-drafted listing, message, and post."
                : "Client brand kit. When you draft something for this client (in the Hub or via Claude Code), Claude uses this voice and palette instead of your studio's."}
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/brand" className="underline">← All brand kits</a>
            </p>
          </header>
          <BrandKitForm initial={kit} />
          <div className="mt-10">
            <BrandBookUploader kitId={kit.id} />
          </div>
        </div>
      </main>
    </>
  );
}
