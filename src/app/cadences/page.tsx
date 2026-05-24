import { listCadences } from "@/lib/db/cadences";
import { listEnrollments } from "@/lib/db/enrollments";
import TopNav from "../TopNav";
import PipelineTabs from "../pipeline/PipelineTabs";

export const dynamic = "force-dynamic";

export default async function CadencesPage() {
  const [cadences, allEnrollments] = await Promise.all([
    listCadences(/* includeInactive */ true),
    listEnrollments(),
  ]);

  const activeByCadence = new Map<number, number>();
  for (const e of allEnrollments) {
    if (e.status === "active") {
      activeByCadence.set(e.cadence_id, (activeByCadence.get(e.cadence_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6">
            <p className="text-xs uppercase tracking-widest text-muted mb-1">
              Outreach
            </p>
            <h1 className="text-2xl font-serif mb-2">Cadences</h1>
            <p className="text-sm text-muted leading-relaxed">
              Build a sequence of touchpoints, then enroll prospects from the pipeline. Claude drafts each step in your brand voice using what you know about the prospect; the cron tick sends each at its scheduled time.
            </p>
          </header>
          <PipelineTabs active="cadences" />

          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted">
              {cadences.length === 0
                ? "No cadences yet."
                : `${cadences.length} cadence${cadences.length === 1 ? "" : "s"}.`}
            </p>
            <a
              href="/cadences/new"
              className="text-sm font-medium underline hover:text-accent transition"
            >
              + New cadence
            </a>
          </div>

          {cadences.length === 0 ? (
            <div className="border border-border rounded p-8 text-center">
              <p className="text-sm text-muted mb-4">
                Cadences are reusable outreach sequences — first touch, follow-up at day 3, nudge at day 7, etc. You define the prompts; Claude drafts the actual messages at send time.
              </p>
              <a
                href="/cadences/new"
                className="inline-block text-sm font-medium underline hover:text-accent transition"
              >
                Create your first cadence →
              </a>
            </div>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {cadences.map((c) => (
                <li key={c.id}>
                  <a
                    href={`/cadences/${c.id}`}
                    className="flex items-center justify-between py-4 px-2 -mx-2 rounded hover:bg-surface-strong transition"
                  >
                    <div>
                      <p className="font-medium">
                        {c.name}
                        {!c.is_active && (
                          <span className="ml-2 text-xs uppercase tracking-wider text-muted">
                            inactive
                          </span>
                        )}
                      </p>
                      {c.description && (
                        <p className="text-sm text-muted mt-1">{c.description}</p>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted">
                      {activeByCadence.get(c.id) ?? 0} active enrollment
                      {(activeByCadence.get(c.id) ?? 0) === 1 ? "" : "s"}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
