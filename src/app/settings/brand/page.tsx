import { getBrand } from "@/lib/db/brand";
import BrandForm from "./BrandForm";

export const dynamic = "force-dynamic";

export default async function BrandSettingsPage() {
  const brand = await getBrand();

  return (
    <main className="min-h-screen p-8 md:p-12">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted mb-1">
            Settings
          </p>
          <h1 className="text-2xl font-serif mb-2">Brand identity</h1>
          <p className="text-sm text-muted leading-relaxed">
            How the Hub presents your studio — and what downstream surfaces
            (listing copy, customer messages, marketing posts) inherit. Change
            anything anytime.
          </p>
          <p className="text-xs text-muted mt-4">
            <a href="/" className="underline">← Back to Hub</a>
          </p>
        </header>
        <BrandForm initial={brand} />
      </div>
    </main>
  );
}
