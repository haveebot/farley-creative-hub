import { notFound } from "next/navigation";
import { getProspect, listActivity, listContacts } from "@/lib/db/prospects";
import TopNav from "../../TopNav";
import ProspectDetail from "./ProspectDetail";

export const dynamic = "force-dynamic";

export default async function ProspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId)) return notFound();

  const prospect = await getProspect(numId);
  if (!prospect) return notFound();

  const [contacts, activity] = await Promise.all([
    listContacts(numId),
    listActivity(numId),
  ]);

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Pipeline
            </p>
            <h1 className="text-2xl font-serif mb-2">{prospect.business_name}</h1>
            <p className="text-xs text-muted">
              <a href="/pipeline" className="underline">← Pipeline</a>
            </p>
          </header>
          <ProspectDetail
            initialProspect={prospect}
            initialContacts={contacts}
            initialActivity={activity}
          />
        </div>
      </main>
    </>
  );
}
