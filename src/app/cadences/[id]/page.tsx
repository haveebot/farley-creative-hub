import { notFound } from "next/navigation";
import { getCadenceWithSteps } from "@/lib/db/cadences";
import { listEnrollmentsForCadence } from "@/lib/db/enrollments";
import { listBrandKits } from "@/lib/db/brand-kits";
import { listProspects } from "@/lib/db/prospects";
import TopNav from "../../TopNav";
import CadenceEditor from "./CadenceEditor";

export const dynamic = "force-dynamic";

export default async function CadencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cadenceId = Number(id);
  if (!Number.isFinite(cadenceId)) notFound();

  const [cadence, brandKits, enrollments, prospects] = await Promise.all([
    getCadenceWithSteps(cadenceId),
    listBrandKits(),
    listEnrollmentsForCadence(cadenceId),
    listProspects(),
  ]);

  if (!cadence) notFound();

  // Build a prospect lookup for the enrollments table.
  const prospectsById = new Map(prospects.map((p) => [p.id, p]));

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-3xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Cadence
            </p>
            <h1 className="text-2xl font-serif mb-2">{cadence.name}</h1>
            <p className="text-xs text-muted">
              <a href="/cadences" className="underline">← Cadences</a>
            </p>
          </header>
          <CadenceEditor
            initialCadence={cadence}
            brandKits={brandKits}
            enrollments={enrollments}
            prospectsById={Object.fromEntries(prospectsById)}
          />
        </div>
      </main>
    </>
  );
}
