import { notFound } from "next/navigation";
import { listBrandKits } from "@/lib/db/brand-kits";
import { listCadences } from "@/lib/db/cadences";
import { listDrafts } from "@/lib/db/drafts";
import {
  listEnrollmentsForProspect,
  listSendsForEnrollment,
} from "@/lib/db/enrollments";
import { getActiveConnection as getWorkspaceConnection } from "@/lib/db/workspace-connections";
import { listRecentExchange, type GmailExchangeMessage } from "@/lib/gmail/read";
import { getProspect, listActivity, listContacts } from "@/lib/db/prospects";
import { query } from "@/lib/db/client";
import TopNav from "../../TopNav";
import CadenceEnrollment from "./CadenceEnrollment";
import GmailExchange from "./GmailExchange";
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

  // Recent Gmail exchange with the primary contact — context for any
  // cadence draft about to be reviewed. Only fetched if Workspace is
  // connected AND the primary contact has an email. Silently empty
  // on Gmail API errors so the rest of the page still renders.
  const primaryContact =
    contacts.find((c) => c.is_primary && c.email) ?? contacts.find((c) => c.email);
  const workspaceConnection = await getWorkspaceConnection();
  let recentExchange: GmailExchangeMessage[] = [];
  let exchangeError: string | null = null;
  if (workspaceConnection && primaryContact?.email) {
    try {
      recentExchange = await listRecentExchange(primaryContact.email, 10);
    } catch (err) {
      console.warn(`[pipeline/${numId}] Gmail exchange fetch failed`, err);
      exchangeError = (err as Error).message;
    }
  }

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
          {workspaceConnection && primaryContact?.email && (
            <div className="mt-8">
              <GmailExchange
                contactEmail={primaryContact.email}
                contactName={primaryContact.name}
                messages={recentExchange}
                error={exchangeError}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
