import { listBrandKits } from "@/lib/db/brand-kits";
import TopNav from "../../TopNav";
import NewCadenceForm from "./NewCadenceForm";

export const dynamic = "force-dynamic";

export default async function NewCadencePage() {
  const brandKits = await listBrandKits();

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-2xl mx-auto">
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Cadences
            </p>
            <h1 className="text-2xl font-serif mb-2">New cadence</h1>
            <p className="text-sm text-muted leading-relaxed">
              Just a name and voice to start — you'll add the steps on the detail page after creating.
            </p>
            <p className="text-xs text-muted mt-4">
              <a href="/cadences" className="underline">← Cadences</a>
            </p>
          </header>
          <NewCadenceForm brandKits={brandKits} />
        </div>
      </main>
    </>
  );
}
