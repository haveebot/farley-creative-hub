import { notFound } from "next/navigation";
import { listBrandKits } from "@/lib/db/brand-kits";
import { listCadences } from "@/lib/db/cadences";
import { listDrafts } from "@/lib/db/drafts";
import {
  listEnrollmentsForProspect,
  listSendsForEnrollment,
} from "@/lib/db/enrollments";
import { getProspect, listActivity, listContacts } from "@/lib/db/prospects";
import { query } from "@/lib/db/client";
import TopNav from "../../TopNav";
import CadenceEnrollment from "./CadenceEnrollment";
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

  const [contacts, activity, drafts, brandKits, promotedKitRows, enrollments, cadences] =
    await Promise.all([
      listContacts(numId),
      listActivity(numId),
      listDrafts({ prospect_id: numId }),
      listBrandKits(),
      query<{ id: number; name: string }>(
        `SELECT id, name FROM brand_kits WHERE from_prospect_id = $1 LIMIT 1`,
        [numId],
      ),
      listEnrollmentsForProspect(numId),
      listCadences(/* includeInactive */ false),
    ]);

  const promotedKit = promotedKitRows[0] ?? null;
  const activeEnrollment = enrollments.find((e) => e.status === "active") ?? null;
  const recentSends = activeEnrollment
    ? await listSendsForEnrollment(activeEnrollment.id)
    : [];

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
            initialDrafts={drafts}
            brandKits={brandKits}
            promotedKit={promotedKit}
          />
          <div className="mt-8">
            <CadenceEnrollment
              prospectId={numId}
              activeEnrollment={activeEnrollment}
              pastEnrollments={enrollments.filter((e) => e.status !== "active")}
              recentSends={recentSends}
              cadences={cadences}
            />
          </div>
        </div>
      </main>
    </>
  );
}
