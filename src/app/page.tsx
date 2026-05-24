import { getCurrentOperatorEmail } from "@/lib/auth/session";
import { listBrandKits } from "@/lib/db/brand-kits";
import { listAssets } from "@/lib/db/assets";
import { listDrafts } from "@/lib/db/drafts";
import { listDraftedSends } from "@/lib/db/enrollments";
import { listProspects } from "@/lib/db/prospects";
import { listRecentActivity } from "@/lib/db/activity-feed";
import { KIND_LABELS } from "@/lib/drafts-shared";
import Greeting from "./Greeting";
import TopNav from "./TopNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [email, kits, assets, allDrafts, allProspects, activity, draftedSends] =
    await Promise.all([
      getCurrentOperatorEmail(),
      listBrandKits(),
      listAssets(),
      listDrafts(),
      listProspects(),
      listRecentActivity(15),
      listDraftedSends(20),
    ]);

  const studio = kits.find((k) => k.is_studio_self);
  const clientKitCount = kits.filter((k) => !k.is_studio_self).length;

  const draftStatus = allDrafts.filter((d) => d.status === "draft");
  const recentAssets = assets.slice(0, 3);

  // Prospects with a due-today-or-overdue next_action_date.
  const todayIso = new Date().toISOString().slice(0, 10);
  const overdueProspects = allProspects
    .filter(
      (p) =>
        p.next_action_date &&
        p.next_action_date <= todayIso &&
        !["signed", "passed", "dormant"].includes(p.status),
    )
    .sort((a, b) => (a.next_action_date ?? "").localeCompare(b.next_action_date ?? ""));

  // 24h cutoff for "Today" activity.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayDrafts = allDrafts.filter((d) => new Date(d.created_at) > dayAgo);
  const todayAssets = assets.filter((a) => new Date(a.created_at) > dayAgo);

  const awaitingCount =
    draftStatus.length + overdueProspects.length + draftedSends.length;

  return (
    <>
      <TopNav />
      <main className="min-h-screen p-8 md:p-12">
        <header className="max-w-5xl mx-auto mb-12">
          <h1 className="text-3xl font-serif">
            <Greeting />.
          </h1>
        </header>

        <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Awaiting You */}
          <div className="p-6 border border-border rounded-lg bg-surface h-full">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider">
                Awaiting you
              </h2>
              <span className="text-xs text-muted">
                {awaitingCount === 0 ? "all clear" : `${awaitingCount} item${awaitingCount === 1 ? "" : "s"}`}
              </span>
            </div>
            {awaitingCount === 0 ? (
              <p className="text-sm text-muted">
                Nothing waiting. Cadence drafts, open drafts, and overdue prospect actions land here.
              </p>
            ) : (
              <div className="space-y-4 text-sm">
                {draftedSends.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted mb-1 flex items-center gap-2">
                      <span>Cadence drafts</span>
                      <a
                        href="https://mail.google.com/mail/u/0/#drafts"
                        target="_blank"
                        rel="noopener"
                        className="text-[10px] underline hover:text-foreground"
                      >
                        review in Gmail →
                      </a>
                    </p>
                    <ul className="space-y-1">
                      {draftedSends.slice(0, 3).map((s) => (
                        <li key={s.id} className="truncate">
                          <span className="text-xs text-accent">●</span>{" "}
                          <span className="text-xs text-muted">{s.prospect_business_name} ·</span>{" "}
                          {s.subject}
                        </li>
                      ))}
                      {draftedSends.length > 3 && (
                        <li className="text-xs text-muted">+ {draftedSends.length - 3} more →</li>
                      )}
                    </ul>
                  </div>
                )}
                {overdueProspects.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted mb-1">
                      Prospects
                    </p>
                    <ul className="space-y-1">
                      {overdueProspects.slice(0, 3).map((p) => (
                        <li key={p.id} className="truncate">
                          <a
                            href={`/pipeline/${p.id}`}
                            className="hover:text-foreground transition"
                          >
                            <span className="text-xs text-red-600">●</span> {p.business_name} — {p.next_action ?? "follow up"}
                          </a>
                        </li>
                      ))}
                      {overdueProspects.length > 3 && (
                        <li className="text-xs text-muted">+ {overdueProspects.length - 3} more →</li>
                      )}
                    </ul>
                  </div>
                )}
                {draftStatus.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted mb-1">
                      Drafts
                    </p>
                    <ul className="space-y-1">
                      {draftStatus.slice(0, 3).map((d) => (
                        <li key={d.id} className="truncate">
                          <a href="/drafts" className="hover:text-foreground transition">
                            <span className="text-xs text-muted">{KIND_LABELS[d.kind] ?? d.kind} ·</span> {d.title}
                          </a>
                        </li>
                      ))}
                      {draftStatus.length > 3 && (
                        <li className="text-xs text-muted">+ {draftStatus.length - 3} more →</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Today */}
          <div className="p-6 border border-border rounded-lg bg-surface h-full">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider">Today</h2>
              <span className="text-xs text-muted">
                {todayDrafts.length + todayAssets.length === 0
                  ? "—"
                  : `${todayDrafts.length + todayAssets.length} new`}
              </span>
            </div>
            {todayDrafts.length + todayAssets.length === 0 ? (
              <p className="text-sm text-muted">
                Nothing yet today. Create a draft, upload an asset, or move a prospect.
              </p>
            ) : (
              <ul className="text-sm space-y-2">
                {todayDrafts.length > 0 && (
                  <li>
                    {todayDrafts.length} {todayDrafts.length === 1 ? "draft" : "drafts"} created
                  </li>
                )}
                {todayAssets.length > 0 && (
                  <li>
                    {todayAssets.length} {todayAssets.length === 1 ? "asset" : "assets"} uploaded
                  </li>
                )}
              </ul>
            )}
          </div>

          {/* Quick actions */}
          <div className="p-6 border border-border rounded-lg bg-surface h-full">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider">
                Quick actions
              </h2>
            </div>
            <ul className="text-sm space-y-2 text-muted">
              <li>
                <a href="/drafts" className="hover:text-foreground transition">
                  → Draft something with Claude
                </a>
              </li>
              <li>
                <a href="/pipeline/leads/new" className="hover:text-foreground transition">
                  → Capture a lead
                </a>
              </li>
              <li>
                <a href="/pipeline/new" className="hover:text-foreground transition">
                  → Add a prospect
                </a>
              </li>
              <li>
                <a href="/brand" className="hover:text-foreground transition">
                  → Edit brand kits {clientKitCount > 0 && `(studio + ${clientKitCount})`}
                </a>
              </li>
              <li>
                <a href="/assets" className="hover:text-foreground transition">
                  → Upload assets {assets.length > 0 && `(${assets.length})`}
                </a>
              </li>
            </ul>
          </div>
        </section>

        {/* Recent activity feed */}
        {activity.length > 0 && (
          <section className="max-w-5xl mx-auto mt-10">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted mb-3">
              Recent activity
            </h2>
            <ul className="border border-border rounded-lg bg-surface divide-y divide-border">
              {activity.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  {e.href ? (
                    <a href={e.href} className="block hover:opacity-90 transition">
                      <ActivityRow event={e} />
                    </a>
                  ) : (
                    <ActivityRow event={e} />
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Recent assets strip */}
        {recentAssets.length > 0 && (
          <section className="max-w-5xl mx-auto mt-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Recent assets
              </h2>
              <a href="/assets" className="text-xs underline text-muted hover:text-foreground">
                All →
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {recentAssets.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-video bg-surface border border-border rounded overflow-hidden hover:border-accent transition"
                >
                  {a.mime_type.startsWith("image/") ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-3xl text-muted">
                      <span>{a.mime_type === "application/pdf" ? "📄" : "📦"}</span>
                      <span className="text-xs mt-2 px-2 truncate w-full text-center">{a.name}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="max-w-5xl mx-auto mt-16 text-xs text-muted flex items-center justify-between">
          <span>{studio?.name ?? "Studio"}</span>
          <span>Signed in as {email}</span>
        </footer>
      </main>
    </>
  );
}

function ActivityRow({
  event,
}: {
  event: {
    title: string;
    subtitle: string | null;
    at: Date;
    actor: string;
  };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="truncate">{event.title}</p>
        {event.subtitle && (
          <p className="text-xs text-muted truncate">{event.subtitle}</p>
        )}
      </div>
      <p className="text-xs text-muted shrink-0">
        {formatRelative(event.at)}
        {event.actor && event.actor !== "you" && (
          <> · {event.actor}</>
        )}
      </p>
    </div>
  );
}

function formatRelative(d: Date | string): string {
  const date = new Date(d);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return date.toLocaleDateString();
}
