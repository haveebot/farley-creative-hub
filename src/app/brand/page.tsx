import { getStudioKit } from "@/lib/db/brand-kits";
import TopNav from "../TopNav";
import BrandKitForm from "./BrandKitForm";

export const dynamic = "force-dynamic";

export default async function BrandPage() {
  const studio = await getStudioKit();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Brand
            </p>
            <h1 className="text-2xl font-serif mb-2">Studio brand kit</h1>
            <p className="text-sm text-muted leading-relaxed">
              Your studio's brand — voice, palette, and guidelines. AI uses this when drafting listings, customer messages, marketing posts. (Hub look-and-feel is separate — see <a href="/settings" className="underline">Settings</a>.)
            </p>
            <p className="text-xs text-muted mt-4">
              Client brand kits coming next. Logo and brand-book file uploads coming once Vercel Blob storage is wired in.
            </p>
          </header>
          <BrandKitForm initial={studio} />
        </div>
      </main>
    </>
  );
}
